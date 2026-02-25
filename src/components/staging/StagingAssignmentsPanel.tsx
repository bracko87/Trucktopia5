/**
 * StagingAssignmentsPanel.tsx
 *
 * Compact bottom panel for the staging area showing Active assignments.
 * - Renders each row as a 5-column grid: Route | Distance | Phase | ETA | Progress+Actions.
 * - Adds Payload and Job type to the expanded details without changing layout.
 *
 * Notes:
 * - This file implements phase-aware ETA/pickup display logic.
 * - Updated Active details to never show raw ID fragments for Truck/Trailer/Driver;
 *   only readable names/registrations are shown (or — if unavailable).
 *
 * Lifecycle / locking note (related finalize flow, for reference):
 * - Partial lifecycle enforcement is already in place in assignment finalization:
 *   - truck uniqueness during active assignment is enforced via
 *     ux_job_offer_truck_active_assignment conflict handling/reuse paths
 *   - selected drivers are marked as assigned on finalize
 *     (hired_staff.activity_id = 'assigned')
 */

import React, { useCallback, useEffect, useState } from 'react'
import { List, Trash2 } from 'lucide-react'
import { loadOnDutySessions } from '../../services/loadOnDutySessions'
import { abortAssignment } from '../../services/jobsService'
import { useAuth } from '../../context/AuthContext'
import { formatPhase } from '../../lib/formatPhase'
import { getTimeStatus } from '../../lib/timeStatus'
import { supabase } from '../../lib/supabase'

/**
 * DrivingSessionRow
 *
 * Minimal interface representing an on-duty driving session row returned by the API.
 */
interface DrivingSessionRow {
  id: string
  phase?: string | null
  distance_completed_km?: number | null
  total_distance_km?: number | null
  updated_at?: string | null
  job_assignment?: any | null
  relocation_ready_at?: string | null
  phase_started_at?: string | null
  [key: string]: any
}

/**
 * StagingAssignmentsPanelProps
 *
 * Props for the StagingAssignmentsPanel component.
 */
interface StagingAssignmentsPanelProps {
  companyId?: string | null
}

/**
 * formatDuration
 *
 * Format a duration in milliseconds into a compact human readable string.
 *
 * @param ms milliseconds
 * @returns formatted string like "2d 3h", "4h 12m", "15m", or "Due"
 */
function formatDuration(ms: number): string {
  if (ms <= 0) return 'Due'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const remMin = minutes % 60
    return `${hours}h${remMin ? ` ${remMin}m` : ''}`
  }
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return `${days}d${remHours ? ` ${remHours}h` : ''}`
}

/**
 * formatKm
 *
 * Format a numeric km value to a compact string.
 *
 * @param km kilometers
 * @returns formatted string like "123 km" or "—"
 */
function formatKm(km: number | null | undefined): string {
  if (km == null || Number.isNaN(Number(km))) return '—'
  if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`
  return `${Math.round(km)} km`
}

/**
 * formatArrival
 *
 * Format a unix ms timestamp into dd.mm.yyyy hh:mm.
 * Returns '—' when ts is falsy.
 *
 * @param ts unix milliseconds timestamp
 * @returns formatted arrival string or '—'
 */
function formatArrival(ts?: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`
}

/**
 * formatDateTime
 *
 * Format an ISO datetime string / Date / numeric ms into dd.mm.yyyy hh:mm using de-DE locale.
 *
 * @param value ISO datetime string | number | Date | null | undefined
 * @returns formatted string like "14.02.2026 03:27" or '—'
 */
function formatDateTime(value?: string | number | Date | null): string {
  if (value == null || value === '') return '—'
  try {
    const d = typeof value === 'number' ? new Date(value) : new Date(String(value))
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

/**
 * Expose formatDateTime to globals to avoid ReferenceError from runtime-evaluated code.
 */
try {
  ;(globalThis as any).formatDateTime = formatDateTime
} catch {
  // ignore in restricted environments
}
try {
  ;(window as any).formatDateTime = formatDateTime
} catch {
  // ignore
}
try {
  ;(self as any).formatDateTime = formatDateTime
} catch {
  // ignore
}

/**
 * shallowEqualSerialized
 *
 * Small helper to compare data snapshots by serialization.
 *
 * @param a previous value
 * @param b newly fetched value
 */
function shallowEqualSerialized(a: any, b: any): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * StagingAssignmentsPanel
 *
 * Renders a compact panel with the Active tab and per-row Details.
 * Uses a local confirmation modal for abort operations and surfaces errors.
 *
 * @param props StagingAssignmentsPanelProps
 * @returns JSX.Element
 */
export default function StagingAssignmentsPanel({ companyId }: StagingAssignmentsPanelProps) {
  const { user } = useAuth()
  const resolvedCompanyId = companyId ?? (user as any)?.company_id ?? null
  const [effectiveCompanyId, setEffectiveCompanyId] = useState<string | null>(
    resolvedCompanyId ? String(resolvedCompanyId) : null
  )

  const [tab, setTab] = useState<'active'>('active')
  const [activeSessions, setActiveSessions] = useState<DrivingSessionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState<number>(() => Date.now())

  /**
   * expanded
   *
   * Local UI state tracking which rows are expanded (by assignment id).
   */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  /**
   * abortTarget & aborting
   *
   * Local modal state for abort confirmation and in-flight abort status.
   */
  const [abortTarget, setAbortTarget] = useState<string | null>(null)
  const [aborting, setAborting] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (resolvedCompanyId) {
      setEffectiveCompanyId(String(resolvedCompanyId))
      return () => {
        cancelled = true
      }
    }

    ;(async () => {
      try {
        const session = await supabase.auth.getSession()
        const authUserId = session.data.session?.user?.id
        if (!authUserId) {
          if (!cancelled) setEffectiveCompanyId(null)
          return
        }

        const lookupBy = async (field: 'auth_user_id' | 'id') => {
          const { data } = await supabase
            .from('users')
            .select('company_id')
            .eq(field, authUserId)
            .limit(1)
            .maybeSingle()
          return data?.company_id ? String(data.company_id) : null
        }

        const companyFromUser = (await lookupBy('auth_user_id')) ?? (await lookupBy('id'))
        if (!cancelled) setEffectiveCompanyId(companyFromUser)
      } catch {
        if (!cancelled) setEffectiveCompanyId(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [resolvedCompanyId, user?.id])

  /**
   * toggleExpanded
   *
   * Toggle expanded state for a given assignment id.
   *
   * @param id assignment id string
   */
  function toggleExpanded(id: string) {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const fetchAll = useCallback(async () => {
    if (!effectiveCompanyId) {
      setActiveSessions([])
      return
    }
    setLoading(true)
    try {
      const sessions = await loadOnDutySessions(effectiveCompanyId)
      setActiveSessions((prev) => {
        const next = (sessions as DrivingSessionRow[]) ?? []
        if (shallowEqualSerialized(prev, next)) return prev
        return next
      })
    } finally {
      setLoading(false)
    }
  }, [effectiveCompanyId])

  useEffect(() => {
    void fetchAll()
    function onReload() {
      void fetchAll()
    }
    window.addEventListener('staging:reload', onReload)
    const id = window.setInterval(fetchAll, 30000)
    return () => {
      window.removeEventListener('staging:reload', onReload)
      window.clearInterval(id)
    }
  }, [fetchAll])

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(tick)
  }, [])

  /**
   * handleConfirmAbort
   *
   * Performs the abort API call for the current abortTarget, refreshes UI,
   * and surfaces errors instead of silently failing.
   */
  async function handleConfirmAbort() {
    if (!abortTarget) return
    setAborting(true)
    try {
      await abortAssignment(String(abortTarget))
      // refresh sessions after successful abort
      await fetchAll()
      setAbortTarget(null)
    } catch (err: any) {
      console.error('[StagingAssignmentsPanel] Abort failed', err)
      try {
        window.alert(err?.message ?? String(err) ?? 'Abort failed')
      } catch {
        // ignore
      }
    } finally {
      setAborting(false)
    }
  }

  /**
   * openAbortModal
   *
   * Backwards-compatible no-op emitter kept for other code. We prefer local modal.
   *
   * @param assignmentId - assignment id string or null
   */
  function openAbortModal(assignmentId?: string | null) {
    try {
      const detail = { assignmentId: assignmentId ?? null }
      const ev = new CustomEvent('openAbortModal', { detail, bubbles: true, composed: true } as any)
      try {
        window.dispatchEvent(ev)
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }

  return (
    <section className="bg-white border-t border-slate-200 shadow-inner">
      <div className="flex border-b border-slate-200">
        <button
          className={`px-4 py-2 text-sm ${tab === 'active' ? 'border-b-2 border-blue-600 font-semibold' : 'text-slate-500'}`}
          onClick={() => setTab('active')}
        >
          Active ({activeSessions.length})
        </button>
        <div className="ml-auto px-3 py-2 text-xs text-slate-400" aria-hidden>
          {loading ? 'Refreshing…' : null}
        </div>
      </div>

      <div className="p-3 max-h-56 overflow-y-auto text-sm">
        {tab === 'active' && (
          <>
            {activeSessions.length === 0 ? (
              <div className="text-slate-500">No active assignments.</div>
            ) : (
              activeSessions.map((s) => {
                const a = s.job_assignment ?? {}
                const origin = a.job_offer?.origin_city?.city_name ?? '—'
                const destination = a.job_offer?.destination_city?.city_name ?? '—'
                const phaseLabel = formatPhase(s.phase)
                const completed = Number(s.distance_completed_km ?? 0)
                const total = Number(s.total_distance_km ?? 0)
                const remaining = Math.max(total - completed, 0)
                const progress = total > 0 ? Math.round((completed / total) * 100) : 0

                const speedKmH = 60
                const estimatedMsRemaining =
                  a.job_offer?.delivery_deadline
                    ? new Date(String(a.job_offer.delivery_deadline)).getTime() - now
                    : remaining > 0
                    ? Math.round((remaining / speedKmH) * 3600 * 1000)
                    : 0

                const pickupMs = a.job_offer?.pickup_time ? new Date(String(a.job_offer.pickup_time)).getTime() : undefined
                const deadlineMs = a.job_offer?.delivery_deadline ? new Date(String(a.job_offer.delivery_deadline)).getTime() : undefined
                const timeStatus = getTimeStatus(pickupMs, deadlineMs, now)

                const deliveryClass =
                  timeStatus.delivery === 'urgent'
                    ? 'text-rose-600 font-semibold'
                    : timeStatus.delivery === 'past'
                    ? 'text-rose-700 font-bold'
                    : 'text-slate-800'

                const idKey = a?.id ?? s.id
                const assignedPayloadKg = Number(a?.assigned_payload_kg ?? NaN)
                const payloadThisRunLabel =
                  Number.isFinite(assignedPayloadKg) && assignedPayloadKg > 0
                    ? `${Math.round(assignedPayloadKg)} kg`
                    : '—'

                /**
                 * normalize phase for UI decisions and check if this is a return trip.
                 * Keep a small resilient set of variants to match backend naming differences.
                 */
                const normalizedPhase = String(s.phase ?? '').toLowerCase()
                const isReturn = ['return_to_hub', 'return-to-hub', 'return to hub', 'returning'].includes(
                  normalizedPhase
                )

                /**
                 * isAborted
                 *
                 * Treat sessions as aborted/finished when either the session phase or the
                 * job_assignment status indicate an aborted/cancelled flow.
                 */
                const statusLower = String(a?.status ?? '').toLowerCase()
                const isAborted =
                  ['aborted', 'cancelled', 'canceled'].includes(normalizedPhase) ||
                  ['aborted', 'cancelled', 'canceled'].includes(statusLower)

                /**
                 * canAbort
                 *
                 * Return trips and aborted/cancelled flows should not be abortable.
                 */
                const canAbort = !isReturn && !isAborted

                /**
                 * showGrayEta
                 *
                 * When this is true we render a muted ETA ("—") to avoid showing an active delivery ETA
                 * for returning or already-aborted/cancelled sessions.
                 */
                const showGrayEta = isReturn || isAborted

                /**
                 * jobTypeLabel
                 *
                 * Map transport_mode values to display labels ("Load" / "Trailer").
                 */
                const transportMode =
                  a?.job_offer?.transport_mode ??
                  a?.transport_mode ??
                  (a.job_offer_id && typeof a.job_offer_id === 'object' ? a.job_offer_id.transport_mode : undefined)

                const jobTypeLabel = transportMode === 'trailer_cargo' ? 'Trailer' : 'Load'

                return (
                  <div key={s.id} className="px-0">
                    {/* Row wrapper: 5-column grid as requested */}
                    <div
                      className="grid items-center gap-3 px-3 py-2 border border-slate-100 rounded hover:bg-slate-50 transition"
                      style={{
                        // increased ETA column width, other columns slightly compressed to keep layout
                        gridTemplateColumns: '1.8fr 1fr 1fr 1.4fr 2.9fr',
                      }}
                    >
                      {/* Section 1 — Route (wide) */}
                      <div className="truncate">
                        <span className="text-slate-600">Route:</span>
                        <span className="ml-2 font-medium text-slate-800">
                          {' '}
                          {origin} - {destination}
                        </span>
                      </div>

                      {/* Section 2 — Distance */}
                      <div className="text-slate-600 whitespace-nowrap">
                        Distance:
                        <span className="ml-1 font-medium text-slate-800">{formatKm(remaining)}</span>
                      </div>

                      {/* Section 3 — Phase */}
                      <div className="text-slate-600 whitespace-nowrap">
                        Phase:
                        <span className="ml-1 font-medium text-slate-800">{phaseLabel || '—'}</span>
                      </div>

                      {/* Section 4 — ETA (arrival date + time) */}
                      <div className="whitespace-nowrap min-w-[170px] text-right text-slate-600">
                        {pickupMs && timeStatus.pickup === 'future' ? (
                          <>
                            Pickup:
                            <span className="ml-1 font-medium text-rose-600">{formatArrival(pickupMs)}</span>
                          </>
                        ) : (
                          <>
                            ETA:
                            <span className={`ml-1 font-medium ${showGrayEta ? 'text-slate-400' : deliveryClass}`}>
                              {showGrayEta ? '—' : formatArrival(now + (estimatedMsRemaining ?? 0))}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Section 5 — Progress + buttons (right aligned) */}
                      <div className="flex items-center justify-end gap-2">
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <div className="w-24 h-2 bg-slate-200 rounded overflow-hidden">
                            <div
                              className={`h-full ${isReturn ? 'bg-slate-400' : 'bg-emerald-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs">{progress}%</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            toggleExpanded(String(idKey))
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-md border bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition text-xs"
                          title="Details"
                          aria-label={`Details ${origin} to ${destination}`}
                          aria-expanded={!!expanded[String(idKey)]}
                        >
                          <List className="w-4 h-4" />
                          <span className="leading-none">Details</span>
                        </button>

                        {/* Abort button: disabled when session is returning or aborted */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            if (!canAbort) return
                            setAbortTarget(a?.id ?? s.id)
                          }}
                          className={`px-3 py-1 rounded-md text-xs transition shadow ${
                            canAbort
                              ? 'bg-rose-600 text-white hover:bg-rose-700'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                          title={canAbort ? 'Abort Job' : 'Cannot abort a returning or cancelled assignment'}
                          aria-label="Abort Job"
                          data-assignment-id={a?.id ?? s.id}
                          disabled={!canAbort || aborting}
                        >
                          <span className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4" />
                            <span>{aborting ? 'Aborting…' : 'Abort Job'}</span>
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable details block (responsive grid: 1 / 2 / 3 columns) */}
                    {expanded[String(idKey)] && (
                      <div className="mt-2 p-3 bg-slate-50 border rounded text-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <div className="text-slate-500 text-xs">Assignment ID</div>
                            <div className="font-mono text-xs break-all">{a?.id ?? s.id}</div>
                          </div>

                          <div>
                            <div className="text-slate-500 text-xs">Route</div>
                            <div className="text-sm">
                              {origin} → {destination}
                            </div>
                          </div>

                          <div>
                            <div className="text-slate-500 text-xs">Phase</div>
                            <div className="text-sm">{phaseLabel || '—'}</div>
                          </div>

                          <div>
                            <div className="text-slate-500 text-xs">Total distance</div>
                            <div className="text-sm">{formatKm(total)}</div>
                          </div>

                          <div>
                            <div className="text-slate-500 text-xs">Completed</div>
                            <div className="text-sm">{formatKm(completed)}</div>
                          </div>

                          <div>
                            <div className="text-slate-500 text-xs">ETA</div>
                            <div className={`text-sm ${showGrayEta ? 'text-slate-400' : deliveryClass}`}>
                              {showGrayEta ? '—' : formatArrival(now + (estimatedMsRemaining ?? 0))}
                            </div>
                          </div>

                          {/* Updated: never show raw ID fragments here */}
                          <div>
                            <div className="text-slate-500 text-xs">Truck</div>
                            <div className="text-sm">{a.user_truck?.name ?? a.user_truck?.registration ?? '—'}</div>
                          </div>

                          {/* Updated: never show raw ID fragments here */}
                          <div>
                            <div className="text-slate-500 text-xs">Trailer</div>
                            <div className="text-sm">{a.user_trailer?.name ?? a.user_trailer?.registration ?? '—'}</div>
                          </div>

                          {/* Updated: never show raw ID fragments here */}
                          <div>
                            <div className="text-slate-500 text-xs">Driver</div>
                            <div className="text-sm">
                              {Array.isArray(a?.drivers) && a.drivers.length
                                ? a.drivers
                                    .map((d: any) => d?.name ?? d?.first_name)
                                    .filter(Boolean)
                                    .join(', ')
                                : a?.driver?.name ?? a?.driver?.first_name ?? '—'}
                            </div>
                          </div>

                          <div>
                            <div className="text-slate-500 text-xs">Reward</div>
                            <div className="text-sm">
                              {a.resolved_reward == null
                                ? a.final_reward == null
                                  ? '—'
                                  : `${a.final_reward} ${a.currency ?? 'USD'}`
                                : `${a.resolved_reward} ${a.currency ?? 'USD'}`}
                            </div>
                          </div>

                          {/* Payload for this assignment run */}
                          <div>
                            <div className="text-slate-500 text-xs">Payload</div>
                            <div className="font-medium">{payloadThisRunLabel}</div>
                          </div>

                          {/* Job type */}
                          <div>
                            <div className="text-slate-500 text-xs">Job type</div>
                            <div className="font-medium">{jobTypeLabel}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}
      </div>

      {/* LOCAL CONFIRMATION MODAL */}
      {abortTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3">Abort Job?</h3>

            <p className="text-sm text-slate-600 mb-4">
              Aborting the job will:
              <ul className="list-disc ml-5 mt-2">
                <li>Cancel delivery</li>
                <li>Truck returns to pickup</li>
                <li>No reward is paid</li>
                <li>Assignment becomes failed</li>
              </ul>
            </p>

            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setAbortTarget(null)} type="button">
                Cancel
              </button>

              <button
                className="px-3 py-1 bg-rose-600 text-white rounded disabled:opacity-50"
                disabled={aborting}
                onClick={async () => {
                  await handleConfirmAbort()
                }}
                type="button"
              >
                {aborting ? 'Aborting…' : 'Confirm Abort'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}