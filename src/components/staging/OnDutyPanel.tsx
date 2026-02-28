/**
 * src/components/staging/OnDutyPanel.tsx
 *
 * Compact "On duty" panel showing active assignments.
 *
 * This rewrite:
 * - Avoids querying driving_sessions REST endpoint (not present in some schemas).
 * - Queries job_assignments directly and uses created_at/ status fields.
 * - Keeps UI layout and behavior intact while using safe field names.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

/**
 * ActiveAssignmentRow
 *
 * Minimal representation of a job_assignment used by the panel.
 */
interface ActiveAssignmentRow {
  id: string
  status?: string | null
  user_truck_id?: string | null
  accepted_at?: string | null
  created_at?: string | null
  job_offer?: {
    id?: string | null
    distance_km?: number | null
    origin_city?: { city_name?: string | null; country_code?: string | null } | null
    destination_city?: { city_name?: string | null; country_code?: string | null } | null
  } | null
  _raw?: any
}

/**
 * TruckInfo
 *
 * Simple truck payload returned from user_trucks.
 */
interface TruckInfo {
  id: string
  name?: string | null
  registration?: string | null
}

/**
 * getShortId
 *
 * Return a short readable id for display.
 */
function getShortId(id?: string | null) {
  if (!id) return '—'
  return String(id).slice(0, 8)
}

/**
 * StatusBadge
 *
 * Small status label for active phases.
 */
function StatusBadge({ status }: { status?: string | null }) {
  const s = (status ?? '').toLowerCase()
  const bg =
    s === 'to_pickup' || s === 'picking_load'
      ? 'bg-amber-100 text-amber-800'
      : s === 'in_progress' || s === 'in-progress'
      ? 'bg-sky-100 text-sky-800'
      : s === 'delivering'
      ? 'bg-violet-100 text-violet-800'
      : s === 'assigned'
      ? 'bg-slate-100 text-slate-800'
      : 'bg-slate-100 text-slate-700'

  return <span className={`text-xs px-2 py-0.5 rounded ${bg} font-semibold`}>{status ?? '—'}</span>
}

/**
 * ProgressBar
 *
 * Visual progress bar with percentage label.
 */
function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="w-28 h-2 bg-slate-200 rounded overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-700">{v}%</span>
    </div>
  )
}

/**
 * normalizePhase
 *
 * Normalize DB phase/status values to lowercase string for consistent UI.
 */
function normalizePhase(raw: any): string {
  if (raw === undefined || raw === null) return ''
  try {
    return String(raw).toLowerCase()
  } catch {
    return String(raw ?? '')
  }
}

/**
 * OnDutyPanel
 *
 * Main component that loads and renders active job_assignments for a company.
 * Uses job_assignments (not driving_sessions) for compatibility.
 */
export default function OnDutyPanel({ companyId }: { companyId?: string | null }) {
  const { user } = useAuth()
  const resolvedCompanyId = companyId ?? (user as any)?.company_id ?? null

  const [assignments, setAssignments] = useState<ActiveAssignmentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [truckMap, setTruckMap] = useState<Record<string, TruckInfo>>({})
  const [driverMap, setDriverMap] = useState<Record<string, string>>({}) // assignmentId -> driver display name

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  function isTerminalPhase(normalized: string) {
    return ['idle', 'finished', 'complete', 'completed', 'done', 'cancelled', 'canceled', 'archived'].includes(normalized)
  }

  /**
   * fetchOnDuty
   *
   * Load recent job_assignments and related nested job_offer info.
   * Then perform truck lookup and best-effort driver lookup.
   */
  const fetchOnDuty = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch recent job_assignments with nested job_offer
      const q = supabase
        .from('job_assignments')
        .select(
          `
          id,
          status,
          user_truck_id,
          user_trailer_id,
          distance_completed_km,
          total_distance_km,
          created_at,
          carrier_company_id,
          owner_company_id,
          company_id,
          job_offer:job_offer_id(
            id,
            distance_km,
            origin_city:origin_city_id(city_name, country_code),
            destination_city:destination_city_id(city_name, country_code)
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(500)

      if (resolvedCompanyId) {
        // keep company filter if available
        ;(q as any).eq('carrier_company_id', resolvedCompanyId)
      }

      const { data, error: err } = await q
      if (err) throw err

      const rows = Array.isArray(data) ? (data as any[]) : []

      // Filter: exclude terminal statuses
      const filtered = rows.filter((r) => {
        const phaseNorm = normalizePhase(r.status ?? null)
        if (isTerminalPhase(phaseNorm)) return false

        // If company filter was used ensure this row belongs to the company when possible
        if (resolvedCompanyId) {
          const aCompanyCandidates = [
            r.carrier_company_id,
            r.owner_company_id,
            r.company_id,
            r.job_offer?.carrier_company_id,
          ].filter(Boolean)
          if (aCompanyCandidates.length > 0 && !aCompanyCandidates.map(String).includes(String(resolvedCompanyId))) {
            // skip rows not belonging to the resolved company
            return false
          }
        }

        return true
      })

      const mapped: ActiveAssignmentRow[] = filtered.map((row) => {
        const a = row ?? {}
        const normalizedStatus = normalizePhase(a.status ?? null) || null

        return {
          id: String(a.id ?? ''),
          status: normalizedStatus,
          user_truck_id: a.user_truck_id ?? null,
          accepted_at: a.accepted_at ?? null,
          created_at: a.created_at ?? null,
          job_offer: a.job_offer
            ? {
                id: a.job_offer.id ?? null,
                distance_km: a.job_offer.distance_km ?? null,
                origin_city: a.job_offer.origin_city ?? null,
                destination_city: a.job_offer.destination_city ?? null,
              }
            : null,
          _raw: {
            total_distance_km: row.total_distance_km ?? null,
            distance_completed_km: row.distance_completed_km ?? null,
            created_at: row.created_at ?? null,
          },
        } as any
      })

      setAssignments(mapped)

      // Batch truck lookup
      const truckIds = Array.from(new Set(mapped.map((m) => m.user_truck_id).filter(Boolean))) as string[]
      if (truckIds.length > 0) {
        try {
          const { data: trucks } = await supabase.from('user_trucks').select('id,name,registration').in('id', truckIds)
          const map: Record<string, TruckInfo> = {}
          if (Array.isArray(trucks)) {
            trucks.forEach((t: any) => {
              map[String(t.id)] = { id: String(t.id), name: t.name ?? null, registration: t.registration ?? null }
            })
          }
          setTruckMap(map)
        } catch (e) {
          // tolerate silently
          // eslint-disable-next-line no-console
          console.debug('OnDutyPanel: truck batch fetch failed', e)
        }
      } else {
        setTruckMap({})
      }

      // Per-assignment driver lookup (best-effort)
      const driverPromises = mapped.map(async (m) => {
        try {
          const { data: byJobAssignment } = await supabase
            .from('hired_staff')
            .select('id,first_name,last_name,display_name')
            .eq('job_assignment_id', m.id)
            .limit(1)
            .maybeSingle()

          if (byJobAssignment) {
            const name = byJobAssignment.display_name ?? `${byJobAssignment.first_name ?? ''} ${byJobAssignment.last_name ?? ''}`.trim()
            return { id: m.id, name: name || '—' }
          }

          const { data: byAssignment } = await supabase
            .from('hired_staff')
            .select('id,first_name,last_name,display_name')
            .eq('assignment_id', m.id)
            .limit(1)
            .maybeSingle()

          if (byAssignment) {
            const name = byAssignment.display_name ?? `${byAssignment.first_name ?? ''} ${byAssignment.last_name ?? ''}`.trim()
            return { id: m.id, name: name || '—' }
          }

          return { id: m.id, name: '—' }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.debug('OnDutyPanel: driver lookup error', e)
          return { id: m.id, name: '—' }
        }
      })

      const driverResults = await Promise.all(driverPromises)
      const dmap: Record<string, string> = {}
      driverResults.forEach((r) => {
        dmap[r.id] = r.name
      })
      setDriverMap(dmap)
    } catch (e: any) {
      setError(e?.message ?? String(e))
      setAssignments([])
      setTruckMap({})
      setDriverMap({})
    } finally {
      setLoading(false)
    }
  }, [resolvedCompanyId])

  useEffect(() => {
    void fetchOnDuty()
    function onReload() {
      void fetchOnDuty()
    }
    window.addEventListener('staging:reload', onReload)
    return () => window.removeEventListener('staging:reload', onReload)
  }, [fetchOnDuty])

  return (
    <section className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
      <header className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">On duty</h3>
          <div className="text-xs text-slate-500">Active assignments currently running</div>
        </div>
        <div className="text-sm font-medium text-slate-700">{assignments.length}</div>
      </header>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : error ? (
        <div className="text-sm text-rose-600">{error}</div>
      ) : assignments.length === 0 ? (
        <div className="text-sm text-slate-500">No active assignments.</div>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => {
            const origin = a.job_offer?.origin_city?.city_name ?? '—'
            const dest = a.job_offer?.destination_city?.city_name ?? '—'
            const distance = a.job_offer?.distance_km ?? null

            const truck = a.user_truck_id ? truckMap[a.user_truck_id] : undefined
            const truckLabel = truck ? (truck.name ? truck.name : getShortId(truck.id)) : a.user_truck_id ? getShortId(a.user_truck_id) : '—'

            const driverName = driverMap[a.id] ?? '—'

            const totalKm = Number(a._raw?.total_distance_km ?? a.job_offer?.distance_km ?? 0)
            const completedKm = Number(a._raw?.distance_completed_km ?? 0)
            const progress = totalKm > 0 ? Math.round((completedKm / totalKm) * 100) : null

            return (
              <li key={a.id} className="px-3 py-2 border border-slate-100 rounded hover:bg-slate-50 transition">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {/* ID */}
                  <div className="font-semibold text-slate-800">#{getShortId(a.id)}</div>

                  {/* Route */}
                  <div className="font-medium text-slate-700">
                    {origin} → {dest}
                  </div>

                  {/* Truck */}
                  <div className="text-slate-600">
                    Truck:
                    <span className="ml-1 font-medium text-slate-800">{truckLabel}</span>
                  </div>

                  {/* Trailer placeholder (keeps layout unchanged) */}
                  <div className="text-slate-600">
                    Trailer:
                    <span className="ml-1 font-medium text-slate-800">—</span>
                  </div>

                  {/* Driver */}
                  <div className="text-slate-600">
                    Driver:
                    <span className="ml-1 font-medium text-slate-800">{driverName}</span>
                  </div>

                  {/* Phase */}
                  <div>
                    <StatusBadge status={a.status} />
                  </div>

                  {/* Progress */}
                  {progress != null ? <ProgressBar value={progress} /> : <div className="text-xs text-slate-500">—</div>}

                  {/* Details button - aligned to the end of the row */}
                  <div className="ml-auto">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(a.id)}
                      className="px-2 py-1 text-xs border rounded hover:bg-slate-100"
                    >
                      {expanded[a.id] ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>

                {/* Expanded details block shown when row is toggled */}
                {expanded[a.id] && (
                  <div className="mt-2 p-3 bg-slate-50 border rounded text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <div className="text-xs text-slate-500">Distance</div>
                        <div className="font-medium text-slate-800">{distance != null ? `${distance} km` : totalKm > 0 ? `${totalKm.toFixed(0)} km` : '—'}</div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500">Accepted</div>
                        <div className="font-medium text-slate-800">{a.accepted_at ? new Date(a.accepted_at).toLocaleString() : a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500">Created</div>
                        <div className="font-medium text-slate-800">{a._raw?.created_at ? new Date(a._raw.created_at).toLocaleString() : '—'}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                      <div>
                        <div className="text-xs text-slate-500">Truck</div>
                        <div className="font-medium text-slate-800">{truckLabel}</div>
                        <div className="text-xs text-slate-500 mt-1">Registration: {truck?.registration ?? '—'}</div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500">Driver</div>
                        <div className="font-medium text-slate-800">{driverName}</div>
                        <div className="text-xs text-slate-500 mt-1">Progress: {progress != null ? `${progress}%` : '—'}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 justify-end">
                      <button className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50">Track</button>
                      <button className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50">Reassign</button>
                      <button className="px-3 py-1 text-sm border border-rose-200 text-rose-600 rounded hover:bg-rose-50">Cancel</button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
