/**
 * TruckComponentsModal.tsx
 *
 * Modal to display components for a single truck using public.user_truck_components.
 * Reworked to use the shared ModalShell for consistent look/feel and behaviour.
 *
 * Responsibilities:
 * - Query REST endpoints for user_truck_components (including label) and fallback to Supabase client.
 * - Resolve human-readable master component names from truck_components_master and display them.
 * - Prefer the per-row "label" column from user_truck_components for display if present.
 * - Render using the shared ModalShell (blurred backdrop, portal, animations, ESC/backdrop/close).
 */

import React, { useEffect, useState } from 'react'
import { X, RefreshCw, Search, Filter } from 'lucide-react'
import ModalShell from '../common/ModalShell'
import { supabaseFetch, supabase } from '../../lib/supabase'

/**
 * UserTruckComponentRow
 *
 * Minimal shape for rows returned by public.user_truck_components.
 */
interface UserTruckComponentRow {
  id: string
  user_truck_id?: string | null
  master_component_id?: string | null
  master_component_name?: string | null
  label?: string | null
  condition_score?: number | null
  status?: string | null
  last_maintenance_at?: string | null
  installed_at?: string | null
  replacement_count?: number | null
  wear_rate?: number | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/**
 * TruckComponentsModalProps
 *
 * Props for TruckComponentsModal component.
 */
export interface TruckComponentsModalProps {
  truckId: string
  open: boolean
  onClose: () => void
}

/**
 * fetchComponentsForTruck
 *
 * Try REST paths first, then fallback to Supabase client.
 *
 * @param truckId - user_trucks.id
 * @returns array of UserTruckComponentRow
 */
async function fetchComponentsForTruck(truckId: string): Promise<UserTruckComponentRow[]> {
  // include label here so we can prefer it for display
  const select =
    'select=id,user_truck_id,master_component_id,label,condition_score,status,last_maintenance_at,installed_at,replacement_count,wear_rate,notes,created_at,updated_at'
  const filter = `user_truck_id=eq.${encodeURIComponent(truckId)}`
  const order = 'order=created_at.desc'
  const q = `${select}&${filter}&${order}`

  const paths = [
    `/rest/v1/public.user_truck_components?${q}`,
    `/rest/v1/user_truck_components?${q}`,
  ]

  for (const p of paths) {
    try {
      const res = await supabaseFetch(p)
      if (res && Array.isArray(res.data)) {
        return res.data as UserTruckComponentRow[]
      }
    } catch {
      // try next path
    }
  }

  // Fallback: Supabase client
  try {
    const { data, error } = await supabase
      .from('user_truck_components')
      .select('id,user_truck_id,master_component_id,label,condition_score,status,last_maintenance_at,installed_at,replacement_count,wear_rate,notes,created_at,updated_at')
      .eq('user_truck_id', truckId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return Array.isArray(data) ? (data as UserTruckComponentRow[]) : []
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchComponentsForTruck error', err)
    return []
  }
}

/**
 * fetchMasterComponentNames
 *
 * Query truck_components_master for names for the provided ids and return a map id -> name.
 *
 * @param ids - array of master_component_id values
 * @returns map of id -> name
 */
async function fetchMasterComponentNames(ids: string[]): Promise<Record<string, string>> {
  if (!ids || ids.length === 0) return {}
  try {
    const { data, error } = await supabase.from('truck_components_master').select('id,name').in('id', ids)
    if (error) throw error
    const map: Record<string, string> = {}
    if (Array.isArray(data)) {
      data.forEach((r: any) => {
        if (r.id && r.name) map[r.id] = r.name
      })
    }
    return map
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch master component names', err)
    return {}
  }
}

/**
 * TruckComponentsModal
 *
 * Main exported component. Loads components and resolves master_component_name for display.
 *
 * @param props - TruckComponentsModalProps
 */
export default function TruckComponentsModal({ truckId, open, onClose }: TruckComponentsModalProps): JSX.Element | null {
  const [components, setComponents] = useState<UserTruckComponentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')

  /**
   * loadComponentsWithNames
   *
   * Load components then resolve master component names and merge into rows.
   *
   * @param tId - truck id
   */
  async function loadComponentsWithNames(tId: string) {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchComponentsForTruck(tId)
      // Resolve unique master_component_id values
      const ids = Array.from(new Set(rows.map((r) => r.master_component_id).filter(Boolean))) as string[]
      const nameMap = await fetchMasterComponentNames(ids)
      const mapped = rows.map((r) => ({
        ...r,
        master_component_name: r.master_component_id ? nameMap[r.master_component_id] ?? null : null,
      }))
      setComponents(mapped)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load components')
      setComponents([])
    } finally {
      setLoading(false)
    }
  }

  // Load components when modal opens
  useEffect(() => {
    let mounted = true
    async function load() {
      if (!open || !truckId) {
        if (mounted) {
          setComponents([])
          setError(null)
          setLoading(false)
        }
        return
      }
      await loadComponentsWithNames(truckId)
    }
    void load()
    return () => {
      mounted = false
    }
  }, [open, truckId])

  // Close on ESC is handled by ModalShell, keep this effect only if additional handling needed
  useEffect(() => {
    // noop here - ModalShell already listens for Escape
    return
  }, [])

  if (!open) return null

  // Filtering + sorting
  const qText = search.trim().toLowerCase()
  let filtered = components.slice()
  if (statusFilter) filtered = filtered.filter((c) => (c.status ?? '').toLowerCase() === statusFilter.toLowerCase())
  if (qText) {
    filtered = filtered.filter((c) => {
      const notes = (c.notes ?? '').toString().toLowerCase()
      const mid = (c.master_component_id ?? '').toString().toLowerCase()
      const name = (c.master_component_name ?? '').toString().toLowerCase()
      const lbl = (c.label ?? '').toString().toLowerCase()
      const st = (c.status ?? '').toString().toLowerCase()
      return notes.includes(qText) || mid.includes(qText) || name.includes(qText) || lbl.includes(qText) || st.includes(qText)
    })
  }
  filtered.sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime()
    const tb = new Date(b.created_at ?? 0).getTime()
    return sort === 'newest' ? tb - ta : ta - tb
  })

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-slate-500">Showing {filtered.length} component(s)</div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded">
          Close
        </button>
      </div>
    </div>
  )

  return (
    <ModalShell open={open} onClose={onClose} title="Truck Components" size="lg" footer={footer}>
      <div className="flex items-start justify-between px-0">
        <div />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              /* Drive to Workshop action - keep minimal for now */
              // eslint-disable-next-line no-console
              console.log('Drive to Workshop', truckId)
            }}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2"
            title="Drive to Workshop"
          >
            Drive to Workshop
          </button>

          <button
            type="button"
            onClick={() => {
              /* Drive to Repair Garage action - keep minimal for now */
              // eslint-disable-next-line no-console
              console.log('Drive to Repair Garage', truckId)
            }}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-sm flex items-center gap-2"
            title="Drive to Repair Garage"
          >
            Drive to Repair Garage
          </button>

          <button onClick={onClose} aria-label="Close components" className="p-2 rounded hover:bg-slate-100 text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-0 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2 w-full">
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              aria-label="Search components"
              placeholder="Search label, notes, master_component_id, master_component_name, status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm px-2 py-1 border border-slate-200 rounded bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 hidden sm:inline" />
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm px-2 py-1 border border-slate-200 rounded bg-white"
              >
                <option value="">All statuses</option>
                {Array.from(new Set(components.map((c) => (c.status ?? '').toString()).filter(Boolean))).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <select
              aria-label="Sort components"
              value={sort}
              onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}
              className="text-sm px-2 py-1 border border-slate-200 rounded bg-white"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-h-[56vh] overflow-auto p-0">
        {loading ? (
          <div className="text-sm text-slate-500">Loading components…</div>
        ) : error ? (
          <div className="text-sm text-rose-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-slate-500">No components found for this truck.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              // Prefer per-row label, then master name, then master id, then row id
              const displayName = c.label ?? c.master_component_name ?? c.master_component_id ?? c.id
              return (
                <div key={c.id} className="p-3 border rounded-md bg-slate-50 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{displayName}</div>
                      {c.installed_at ? <div className="text-xs text-slate-500">Installed: {new Date(c.installed_at).toLocaleString()}</div> : null}
                    </div>
                    <div className="text-sm text-slate-700 text-right">
                      <div className="text-sm">Condition:</div>
                      <div>
                        <span
                          className={
                            'font-semibold text-lg ' +
                            (typeof c.condition_score === 'number'
                              ? c.condition_score > 80
                                ? 'text-emerald-600'
                                : c.condition_score > 60
                                ? 'text-green-600'
                                : c.condition_score > 40
                                ? 'text-amber-600'
                                : c.condition_score > 20
                                ? 'text-orange-600'
                                : 'text-red-600'
                              : 'text-slate-800')
                          }
                        >
                          {typeof c.condition_score === 'number' ? c.condition_score : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {c.notes ? <div className="mt-2 text-sm text-slate-700">{c.notes}</div> : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ModalShell>
  )
}