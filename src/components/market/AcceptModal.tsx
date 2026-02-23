/**
 * AcceptModal.tsx
 *
 * Confirmation modal shown when accepting a job.
 *
 * This variant uses the job prop passed by the caller (no fetch) and formats
 * pickup/delivery timestamps to DD-MM-YYYY HH:MM:SS. Headline labels are rendered
 * in bold for better emphasis. Transport mode values are normalized to friendly
 * text (e.g. "trailer_cargo" -> "Trailer Cargo", "load_cargo" -> "Load Cargo").
 *
 * Added behavior:
 * - Loads candidate trucks on open and requires a truck selection before confirming.
 * - Resolves trucks using multiple ownership filters (auth user + public user + company)
 *   to avoid false "No trucks found" states in manager/company accounts.
 * - Shows local errors (login/truck load/accept failure) without closing the modal.
 */

import React, { useState, useEffect } from 'react'
import type { JobRow } from './JobCard'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export interface AcceptModalProps {
  open: boolean
  jobId: string | null
  job: JobRow | null
  onClose: () => void
  onConfirm: (truckId?: string) => Promise<void> | void
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 1000) return `${Math.round(n).toLocaleString()}`
  return n.toString()
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'

  const pad = (n: number) => String(n).padStart(2, '0')
  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const year = d.getFullYear()
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  const seconds = pad(d.getSeconds())

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`
}

function formatTransportMode(m?: string | null): string {
  if (!m) return '—'
  const s = String(m).trim().toLowerCase()
  if (s === 'trailer_cargo') return 'Trailer Cargo'
  if (s === 'load_cargo') return 'Load Cargo'
  if (s.includes('trailer')) return 'Trailer Cargo'
  if (s.includes('load')) return 'Load Cargo'
  return s
}

type TruckRow = {
  id: string
  name?: string | null
  registration?: string | null
  model_make?: string | null
  model_model?: string | null
  model_year?: number | null
  model_max_load_kg?: number | null
  status?: string | null
  created_at?: string | null
}

export default function AcceptModal({
  open,
  jobId,
  job,
  onClose,
  onConfirm,
}: AcceptModalProps) {
  const { user } = useAuth()
  const [confirming, setConfirming] = useState(false)

  const [trucks, setTrucks] = useState<Array<{ id: string; label: string }>>([])
  const [selectedTruckId, setSelectedTruckId] = useState<string>('')
  const [loadingTrucks, setLoadingTrucks] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    setLocalError(null)
    setSelectedTruckId('')
    setTrucks([])
    setLoadingTrucks(true)

    ;(async () => {
      try {
        const session = await supabase.auth.getSession()
        const authUserId = session.data.session?.user?.id ?? null
        if (!authUserId) {
          if (!cancelled) setLocalError('Please log in')
          return
        }

        const baseSelect = 'id,name,registration,model_make,model_model,model_year,model_max_load_kg,status,created_at,owner_user_auth_id,owner_user_id,owner_company_id'

        const tryLoad = async (field: string, value: string | null | undefined) => {
          if (!value) return [] as TruckRow[]
          const { data, error } = await supabase
            .from('user_trucks')
            .select(baseSelect)
            .eq(field, value)
            .order('created_at', { ascending: false })

          if (error) return []
          return (data ?? []) as TruckRow[]
        }

        const publicUserByAuth = await supabase
          .from('users')
          .select('id,company_id')
          .eq('auth_user_id', authUserId)
          .limit(1)
          .maybeSingle()

        const publicUserId = publicUserByAuth.data?.id ? String(publicUserByAuth.data.id) : null
        const resolvedCompanyId =
          (user as any)?.company_id ??
          (publicUserByAuth.data?.company_id ? String(publicUserByAuth.data.company_id) : null)

        const buckets = await Promise.all([
          tryLoad('owner_user_auth_id', authUserId),
          tryLoad('owner_user_id', authUserId),
          tryLoad('owner_user_id', publicUserId),
          tryLoad('owner_company_id', resolvedCompanyId),
        ])

        const mergedById = new Map<string, TruckRow>()
        for (const rows of buckets) {
          for (const t of rows) {
            if (!t?.id) continue
            if (!mergedById.has(String(t.id))) mergedById.set(String(t.id), t)
          }
        }

        const rows = Array.from(mergedById.values())

        const mapped = rows.map((t) => {
          const cap = t.model_max_load_kg != null ? `${formatNumber(Number(t.model_max_load_kg))} kg` : '—'
          const makeModel = [t.model_make, t.model_model].filter(Boolean).join(' ')
          const year = t.model_year ? String(t.model_year) : ''
          const reg = t.registration ? `(${t.registration})` : ''
          const status = t.status ? String(t.status) : 'unknown'
          const nm = t.name ? t.name : `Truck ${String(t.id).slice(0, 8)}`
          const desc = [makeModel, year].filter(Boolean).join(' ')
          const label = `${nm} ${reg}${desc ? ` — ${desc}` : ''} | cap: ${cap} | ${status}`

          return { id: t.id, label }
        })

        if (!cancelled) {
          setTrucks(mapped)
          if (mapped.length > 0) setSelectedTruckId(mapped[0].id)
          if (mapped.length === 0) {
            setLocalError('No trucks available for your account/company. Check truck ownership/company mapping and truck status.')
          }
        }
      } catch (e: any) {
        if (!cancelled) setLocalError(e?.message ?? 'Failed to load trucks')
      } finally {
        if (!cancelled) setLoadingTrucks(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, user])

  if (!open || !jobId) return null

  const displayJob = job
  const mode = formatTransportMode(displayJob?.transport_mode ?? null)

  const reward =
    displayJob?.transport_mode === 'trailer_cargo'
      ? displayJob?.reward_trailer_cargo ?? displayJob?.reward_load_cargo
      : displayJob?.reward_load_cargo ?? displayJob?.reward_trailer_cargo

  const distance = displayJob?.distance_km != null ? `${formatNumber(displayJob.distance_km)} km` : '—'
  const pickupFormatted = formatDateTime(displayJob?.pickup_time ?? null)
  const deliveryFormatted = formatDateTime(displayJob?.delivery_deadline ?? null)

  async function handleConfirm() {
    if (confirming) return

    setLocalError(null)

    if (!selectedTruckId) {
      setLocalError('Please select a truck before accepting.')
      return
    }

    setConfirming(true)
    try {
      await Promise.resolve(onConfirm(selectedTruckId))
      onClose()
    } catch (err: any) {
      console.error('AcceptModal onConfirm error', err)
      setLocalError(err?.message ?? 'Accept failed')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-lg p-5 w-full max-w-md shadow-lg">
        <h3 className="text-lg font-semibold mb-2">Accept job</h3>

        <p className="text-sm text-slate-600 mb-4">Confirm job details before accepting.</p>

        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-2 font-semibold">Job summary</div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col">
              <div className="text-xs text-slate-500 font-semibold">Pickup</div>
              <div className="text-black/80">{pickupFormatted}</div>
            </div>

            <div className="flex flex-col">
              <div className="text-xs text-slate-500 font-semibold">Delivery</div>
              <div className="text-black/80">{deliveryFormatted}</div>
            </div>

            <div className="flex flex-col">
              <div className="text-xs text-slate-500 font-semibold">Type</div>
              <div className="text-black/80">{mode}</div>
            </div>

            <div className="flex flex-col">
              <div className="text-xs text-slate-500 font-semibold">Reward</div>
              <div className="text-sm font-semibold text-emerald-600" aria-label="reward-value">
                {reward != null ? `${formatNumber(Number(reward))} USD` : '—'}
              </div>
            </div>

            <div className="flex flex-col col-span-2">
              <div className="text-xs text-slate-500 font-semibold">Distance</div>
              <div className="text-black/80">{distance}</div>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-slate-700 mb-1">Select truck</label>

          {loadingTrucks ? (
            <div className="text-sm text-slate-500">Loading trucks…</div>
          ) : trucks.length === 0 ? (
            <div className="text-sm text-rose-600">No trucks found. Please add a truck first.</div>
          ) : (
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={selectedTruckId}
              onChange={(e) => setSelectedTruckId(e.target.value)}
            >
              <option value="">-- choose a truck --</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {localError && (
          <div className="mt-3 p-2 rounded bg-rose-50 border border-rose-100 text-rose-700 text-sm">
            {localError}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border text-sm" disabled={confirming}>
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            className="px-3 py-1 rounded bg-sky-600 text-white text-sm"
            disabled={confirming}
            style={{ pointerEvents: confirming ? 'none' : 'auto' }}
            aria-disabled={confirming}
          >
            {confirming ? 'Accepting…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
