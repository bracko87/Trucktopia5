/**
 * Footer.tsx
 *
 * Renders the application footer and shows a human-friendly "game time".
 * This file contains a robust fetch implementation that avoids PostgREST 400
 * errors caused by ordering by non-existent columns. It first attempts a
 * safe select with limit=1; if that fails, it falls back to fetching an id
 * and then the row by primary key. All debug info is logged to console so
 * we do not change the page layout or visual design.
 */

import React, { useEffect, useState } from 'react'
import { Truck, Clock } from 'lucide-react'
import { getTable } from '../lib/supabase'

/**
 * GameTimeRow
 *
 * Flexible shape for game_time rows. Real table may use different column names.
 */
interface GameTimeRow {
  id?: string
  created_at?: string | number
  game_time?: string | number
  current_time?: string | number
  now?: string | number
  time?: string | number
  [key: string]: any
}

/**
 * toIso
 *
 * Convert various timestamp representations to an ISO string.
 *
 * @param v - value possibly string/number/Date
 * @returns ISO string or null
 */
function toIso(v: any): string | null {
  if (!v && v !== 0) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    // If it looks like an ISO string, accept it
    if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s
    // If numeric string, try number conversion
    if (/^\d+$/.test(s)) {
      const n = Number(s)
      return new Date(n > 1e12 ? n : n * 1000).toISOString()
    }
    // otherwise return raw (Date can parse many formats)
    const parsed = Date.parse(s)
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
    return null
  }
  if (typeof v === 'number' && !Number.isNaN(v)) {
    // treat as seconds when < 1e12, else milliseconds
    return new Date(v > 1e12 ? v : v * 1000).toISOString()
  }
  return null
}

/**
 * pickTimestamp
 *
 * Inspect row fields and return first plausible ISO timestamp string.
 *
 * @param row - fetched row
 */
function pickTimestamp(row: GameTimeRow | null): string | null {
  if (!row) return null
  const candidates = ['game_time', 'current_time', 'now', 'time', 'created_at', 'timestamp']
  for (const k of candidates) {
    const iso = toIso(row[k])
    if (iso) return iso
  }
  // fallback: scan all values for an ISO-like value
  for (const v of Object.values(row)) {
    const iso = toIso(v)
    if (iso) return iso
  }
  return null
}

/**
 * formatTimestamp
 *
 * Format ISO timestamp into a readable string.
 *
 * @param iso - ISO string
 */
function formatTimestamp(iso: string) {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  } catch {
    return iso
  }
}

/**
 * Footer
 *
 * Visual layout retained exactly as before. Data fetching is made resilient
 * to avoid PostgREST "column does not exist" (42703) 400 errors by never
 * ordering by unknown columns and by using a safe two-step fallback.
 */
export default function Footer() {
  const [gameTimeLabel, setGameTimeLabel] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    /**
     * safeGet
     *
     * Wrapper around getTable that normalizes responses and never throws.
     *
     * @param q - query string for getTable
     */
    async function safeGet(q: string) {
      try {
        const res: any = await getTable('game_time', q)
        // Normalize shape: { status, data } expected from supabaseFetch wrapper
        const status = res?.status ?? (res?.error ? 400 : 200)
        const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : null
        return { status, data, raw: res }
      } catch (err) {
        return { status: 0, data: null, raw: err }
      }
    }

    /**
     * fetchGameTime
     *
     * Strategy:
     * 1) Try ?select=*&limit=1 (safe, no ordering).
     * 2) If empty or not allowed, try ?select=id&limit=1 then fetch by id.
     * 3) Inspect the returned row for any timestamp-like field.
     */
    async function fetchGameTime() {
      try {
        // 1) safe select limit 1
        const r = await safeGet('?select=*&limit=1')
        if (!mounted) return

        let row: GameTimeRow | null = null

        if (r.status >= 200 && r.status < 300 && Array.isArray(r.data) && r.data.length > 0) {
          row = r.data[0] as GameTimeRow
        } else {
          // 2) fallback: get an id then fetch by that id
          const ids = await safeGet('?select=id&limit=1')
          if (!mounted) return
          if (ids.status >= 200 && Array.isArray(ids.data) && ids.data.length > 0 && ids.data[0].id) {
            const id = ids.data[0].id
            const byId = await safeGet(`?select=*&id=eq.${encodeURIComponent(id)}`)
            if (!mounted) return
            if (byId.status >= 200 && Array.isArray(byId.data) && byId.data.length > 0) {
              row = byId.data[0] as GameTimeRow
            } else {
              // Log raw responses for diagnosis
              // eslint-disable-next-line no-console
              console.info('[Footer] fallback fetch by id failed', { ids: ids.raw, byId: byId.raw })
            }
          } else {
            // eslint-disable-next-line no-console
            console.info('[Footer] no ids returned when attempting fallback', ids.raw)
          }
        }

        if (row) {
          // Log the raw row so you can paste it if needed for mapping
          // eslint-disable-next-line no-console
          console.info('[Footer] game_time row:', row)
          const iso = pickTimestamp(row)
          if (iso) {
            setGameTimeLabel(formatTimestamp(iso))
            return
          } else {
            // eslint-disable-next-line no-console
            console.info('[Footer] could not find timestamp field in row', row)
          }
        } else {
          // eslint-disable-next-line no-console
          console.info('[Footer] no game_time row found', r.raw)
        }

        setGameTimeLabel(null)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Footer] unexpected error fetching game_time', err)
        if (!mounted) return
        setGameTimeLabel(null)
      }
    }

    fetchGameTime()
    const id = setInterval(fetchGameTime, 30000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return (
    <footer className="mt-auto bg-gradient-to-r from-amber-400 to-amber-500 border-t border-black/10 text-black py-4 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
        {/* Left: decorative emblem + copyright */}
        <div className="flex items-center gap-4">
          {/* Emblem: circular badge with truck icon and subtle stripes */}
          <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-white/10 ring-1 ring-black/10 overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#00000010_0%,#00000006_100%)] pointer-events-none" />
            <div className="flex items-center justify-center w-full h-full">
              <div className="bg-white/90 rounded-full p-2 shadow-sm">
                <Truck className="text-amber-600" size={18} />
              </div>
            </div>
            {/* decorative diagonal stripe */}
            <div className="absolute -right-6 top-0 h-full w-8 transform rotate-12 bg-amber-600/15 pointer-events-none" />
          </div>

          <div className="flex flex-col leading-tight">
            <div className="font-semibold">Tracktopia</div>
            <div className="hidden sm:block text-xs text-black/70">Built with ♥ for trucking managers</div>
          </div>
        </div>

        {/* Right: Game Time */}
        <div className="flex items-center gap-3 text-right">
          <div className="flex flex-col">
            <div className="text-xs text-black/80 flex items-center gap-2 justify-end">
              <Clock size={14} />
              <span>Game Time</span>
            </div>
            <div className="font-medium">{gameTimeLabel ?? '—'}</div>
          </div>
        </div>
      </div>
    </footer>
  )
}