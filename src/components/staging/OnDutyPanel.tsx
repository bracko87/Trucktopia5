/**
 * src/components/staging/OnDutyPanel.tsx
 *
 * Compact "On duty" panel showing active assignments as single horizontal rows.
 * This file loads driving_sessions and related nested job_assignment -> job_offer info,
 * then renders a compact list. The main goal of the rewrite is to broaden matching
 * logic and accepted phases so assigned rows are not accidentally filtered out.
 *
 * Notes:
 * - UI design / layout are intentionally preserved from the original component.
 * - This file includes additional console.debug logs to help diagnose skipped rows.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

/**
 * ActiveAssignmentRow
 *
 * Minimal representation of the job_assignment/job_offer used by the panel.
 */
interface ActiveAssignmentRow {
  id: string
  status: string | null
  user_truck_id: string | null
  accepted_at: string | null
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
 *
 * @param id full id string
 * @returns shortened id
 */
function getShortId(id?: string | null) {
  if (!id) return '—'
  return String(id).slice(0, 8)
}

/**
 * StatusBadge
 *
 * Small status label for active phases.
 *
 * @param props.status string
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
 *
 * @param props.value numeric progress 0-100
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
 *
 * @param raw raw phase value
 * @returns normalized phase string
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
 * Main component that loads and renders active driving sessions for a company.
 *
 * Changes in this rewrite:
 * - Query includes common session-level company columns and session truck id.
 * - Company matching is widened to check several possible fields.
 * - Phase acceptance is relaxed: exclude clearly finished/idle states instead of
 *   requiring a small whitelist (safer across schema variations).
 *
 * @param props.companyId optional company id override
 */
export default function OnDutyPanel({ companyId }: { companyId?: string | null }) {
  const { user } = useAuth()
  const resolvedCompanyId = companyId ?? (user as any)?.company_id ?? null

  const [assignments, setAssignments] = useState<ActiveAssignmentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [truckMap, setTruckMap] = useState<Record<string, TruckInfo>>({})
  const [driverMap, setDriverMap] = useState<Record<string, string>>({}) // assignmentId -> driver display name

  /**
   * expanded
   *
   * Local UI map tracking which assignment rows are expanded to show details.
   */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  /**
   * toggleExpanded
   *
   * Toggle the expanded state for a given assignment id so the details block shows/hides.
   *
   * @param id assignment id to toggle
   */
  function toggleExpanded(id: string) {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  /**
   * isTerminalPhase
   *
   * Return true for phases that should be considered finished/irrelevant for "on duty".
   *
   * @param normalized normalized phase string
   */
  function isTerminalPhase(normalized: string) {
    return ['idle', 'finished', 'complete', 'completed', 'done', 'cancelled', 'canceled', 'archived'].includes(
      normalized
    )
  }

  /**
   * fetchOnDuty
   *
   * Load recent driving_sessions and related nested job_assignment -> job_offer info.
   * Then perform batch truck lookup and per-assignment driver lookup (best-effort).
   */
  const fetchOnDuty = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Defensive: if no company resolved, we'll show all active sessions (useful for debugging)
      // but still prefer showing rows belonging to resolvedCompanyId when present.
      // Fetch session + assignment columns that may contain company/truck references.
      const { data, error: err } = await supabase
        .from('driving_sessions')
        .select(
          `
          id,
          phase,
          user_truck_id,
          user_trailer_id,
          distance_completed_km,
          total_distance_km,
          phase_started_at,
          created_at,
          carrier_company_id,
          owner_company_id,
          company_id,
          job_assignment:job_assignment_id(
            id,
            status,
            user_truck_id,
            accepted_at,
            carrier_company_id,
            owner_company_id,
            company_id,
            job_offer:job_offer_id(
              id,
              distance_km,
              origin_city:origin_city_id(city_name, country_code),
              destination_city:destination_city_id(city_name, country_code)
            )
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(500)

      if (err) throw err

      const rows = Array.isArray(data) ? (data as any[]) : []

      // Filter: accept rows that are not terminal (idle/finished) and where company
      // matches resolvedCompanyId when provided. If no resolvedCompanyId, do not filter by company.
      const filtered = rows.filter((r) => {
        const phaseNorm = normalizePhase(r.phase ?? (r.job_assignment?.status ?? null))

        // Skip terminal phases
        if (isTerminalPhase(phaseNorm)) return false

        const a = r.job_assignment ?? {}

        /**
         * Collect a set of possible company-id fields that different schemas may use.
         * We stringify everything so comparisons are consistent.
         */
        const candidates = [
          a.carrier_company_id,
          a.owner_company_id,
          a.company_id,
          (r as any).carrier_company_id,
          (r as any).owner_company_id,
          (r as any).company_id,
        ]
          .filter((x) => x !== undefined && x !== null)
          .map((x) => String(x))

        const resolvedStr = resolvedCompanyId ? String(resolvedCompanyId) : null
        const match = resolvedStr ? candidates.includes(resolvedStr) : true // if no company resolved, accept

        if (!match) {
          // Helpful debug: why a row was skipped
          // eslint-disable-next-line no-console
          console.debug('OnDutyPanel: skipped driving_session (company mismatch)', {
            rowId: r.id,
            phase: phaseNorm,
            assignmentCompany:
              a.carrier_company_id ?? a.owner_company_id ?? a.company_id ?? null,
            sessionCompany:
              (r as any).carrier_company_id ?? (r as any).owner_company_id ?? (r as any).company_id ?? null,
            resolvedCompanyId,
            candidates,
          })
          return false
        }

        return true
      })

      // Map into local shape and prefer assignment user_truck_id, fall back to session-level user_truck_id
      const mapped: ActiveAssignmentRow[] = filtered.map((row) => {
        const a = row.job_assignment ?? {}
        const normalizedStatus = normalizePhase(row.phase ?? a.status ?? null) || null

        return {
          id: String(a.id ?? row.id ?? ''),
          status: normalizedStatus,
          user_truck_id: a.user_truck_id ?? row.user_truck_id ?? null,
          accepted_at: a.accepted_at ?? row.phase_started_at ?? null,
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
          const { data: trucks } = await supabase
            .from('user_trucks')
            .select('id,name,registration')
            .in('id', truckIds)
          const map: Record<string, TruckInfo> = {}
          if (Array.isArray(trucks)) {
            trucks.forEach((t: any) => {
              map[String(t.id)] = { id: String(t.id), name: t.name ?? null, registration: t.registration ?? null }
            })
          }
          setTruckMap(map)
        } catch (e) {
          // tolerate silently; UI will fallback to ids
          // eslint-disable-next-line no-console
          console.debug('OnDutyPanel: truck batch fetch failed', e)
        }
      } else {
        setTruckMap({})
      }

      // Per-assignment driver lookup (best-effort). Tries common column names.
      const driverPromises = mapped.map(async (m) => {
        try {
          const { data: byJobAssignment } = await supabase
            .from('hired_staff')
            .select('id,first_name,last_name,display_name')
            .eq('job_assignment_id', m.id)
            .limit(1)
            .maybeSingle()

          if (byJobAssignment) {
            const name =
              byJobAssignment.display_name ??
              `${byJobAssignment.first_name ?? ''} ${byJobAssignment.last_name ?? ''}`.trim()
            return { id: m.id, name: name || '—' }
          }

          const { data: byAssignment } = await supabase
            .from('hired_staff')
            .select('id,first_name,last_name,display_name')
            .eq('assignment_id', m.id)
            .limit(1)
            .maybeSingle()

          if (byAssignment) {
            const name =
              byAssignment.display_name ?? `${byAssignment.first_name ?? ''} ${byAssignment.last_name ?? ''}`.trim()
            return { id: m.id, name: name || '—' }
          }

          // Last fallback: none found
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
                        <div className="font-medium text-slate-800">{a.accepted_at ? new Date(a.accepted_at).toLocaleString() : '—'}</div>
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