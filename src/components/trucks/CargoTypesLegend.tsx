/**
 * CargoTypesLegend.tsx
 *
 * Fetches cargo types (id, name, description, icon_url) from public.cargo_types
 * and renders a responsive legend (icon + name + description).
 *
 * - Uses getTable REST helper to query PostgREST.
 * - Caches results in window.__cargoTypesCache to avoid repeated network calls.
 * - Lightweight skeleton state shown while loading.
 */

import React, { useEffect, useState } from 'react'
import { getTable } from '../../lib/supabase'

/**
 * CargoTypeRow
 *
 * Minimal shape for public.cargo_types rows used by the legend.
 */
interface CargoTypeRow {
  id?: string
  name?: string | null
  description?: string | null
  icon_url?: string | null
}

/**
 * CargoTypesLegend
 *
 * Fetch and render a legend of cargo types (icon + name + description).
 *
 * @returns JSX.Element
 */
export default function CargoTypesLegend(): JSX.Element {
  const [items, setItems] = useState<CargoTypeRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let mounted = true
    // use a simple global cache to avoid duplicate REST calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalCache = (window as any).__cargoTypesCache as CargoTypeRow[] | undefined

    async function load() {
      setLoading(true)
      try {
        if (globalCache && Array.isArray(globalCache)) {
          if (mounted) {
            setItems(globalCache)
            setLoading(false)
          }
          return
        }

        // select commonly needed fields and order by name
        const res: any = await getTable('cargo_types', '?select=id,name,description,icon_url&order=name.asc')
        const rows: CargoTypeRow[] = Array.isArray(res?.data) ? res.data : []
        // store in window cache
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).__cargoTypesCache = rows
        if (mounted) setItems(rows)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug('CargoTypesLegend: failed to load cargo types', err)
        if (mounted) setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <section className="bg-white p-4 rounded-lg mt-4 border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-800">Cargo types legend</h3>
        <div className="text-xs text-slate-500">{loading ? 'Loading…' : `${items.length} types`}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-14 h-14 rounded-sm bg-slate-100" />
                <div className="flex-1">
                  <div className="h-3 rounded bg-slate-100 w-3/4 mb-2" />
                  <div className="h-3 rounded bg-slate-100 w-1/2" />
                </div>
              </div>
            ))
          : items.map((c) => (
              <div key={c.id ?? c.name} className="flex items-start gap-3">
                {c.icon_url ? (
                  <img
                    src={c.icon_url}
                    alt={c.name ?? 'cargo'}
                    className="w-14 h-14 rounded-sm border border-slate-100 bg-white object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-sm bg-slate-100 flex items-center justify-center text-slate-600 font-medium flex-shrink-0">
                    {c.name ? String(c.name).slice(0, 1).toUpperCase() : '—'}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{c.name ?? '—'}</div>
                  <div className="text-xs text-slate-500 truncate">{c.description ?? 'No description'}</div>
                </div>
              </div>
            ))}
      </div>
    </section>
  )
}