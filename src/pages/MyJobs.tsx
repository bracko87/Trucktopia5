/**
 * MyJobs.tsx
 *
 * New flow:
 * - Uses accepted_jobs as the source of truth for My Jobs
 * - Uses job_assignments + job_run_executions only as supporting runtime detail
 * - Adds History button + popup (last 30 days via backend history_visible_until rule)
 * - Cancel path avoids cancel_accepted_job because some DBs fail on missing sync_job_market_visibility()
 *
 * Page mapping:
 * - Waiting  -> accepted_jobs.status in ('accepted', 'assigned')
 * - Active   -> accepted_jobs.status = 'in_progress'
 * - History  -> accepted_jobs.status in ('completed','aborted','cancelled','expired')
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import JobCard, { JobRow } from '../components/market/JobCard'
import ConfirmAcceptModal from '../components/market/ConfirmAcceptModal'
import CancelPenaltyModal from '../components/market/CancelPenaltyModal'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

interface SectionBoxProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  count?: number
  action?: React.ReactNode
}

interface MyJobRow extends JobRow {
  accepted_job_id: string
  accepted_status: string | null
  accepted_at_raw?: string | null
  assigned_at_raw?: string | null
  started_at_raw?: string | null
  ended_at_raw?: string | null
  current_job_assignment_id?: string | null
  current_assignment_preview_id?: string | null
  runtime_state?: string | null
  runtime_eta?: string | null
  run_no?: number | null
  final_reward?: number | null
  reputation_delta?: number | null
  history_visible_until?: string | null
  cancel_reason?: string | null
  abort_reason?: string | null
  expire_reason?: string | null

  // for history popup
  truck_name?: string | null
  trailer_name?: string | null
  driver_names?: string[] | null
}

function SectionBox({ title, subtitle, children, count, action }: SectionBoxProps) {
  return (
    <section className="bg-white p-6 rounded shadow space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <div className="text-sm text-slate-500 mt-1">{subtitle}</div>}
        </div>

        <div className="flex items-center gap-2">
          {typeof count === 'number' && (
            <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded text-sm text-slate-600">
              {count}
            </span>
          )}
          {action}
        </div>
      </header>
      <div>{children}</div>
    </section>
  )
}

function pickLogo(obj: any): string | null {
  if (!obj) return null
  return obj.logo ?? obj.logo_url ?? obj.image_url ?? obj.icon_url ?? null
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function formatMoney(value?: number | string | null, currency?: string | null): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return `0 ${currency ?? ''}`.trim()
  return `${n.toFixed(2)} ${currency ?? ''}`.trim()
}

function titleCaseStatus(value?: string | null): string {
  if (!value) return 'Unknown'
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function terminalReason(job: MyJobRow): string | null {
  return job.abort_reason ?? job.cancel_reason ?? job.expire_reason ?? null
}

function statusPillClasses(status?: string | null): string {
  const s = String(status ?? '').toLowerCase()

  if (s === 'completed') {
    return 'rounded-full px-2 py-1 border bg-emerald-50 border-emerald-200 text-emerald-700'
  }
  if (s === 'cancelled' || s === 'canceled') {
    return 'rounded-full px-2 py-1 border bg-rose-50 border-rose-200 text-rose-700'
  }
  if (s === 'aborted') {
    return 'rounded-full px-2 py-1 border bg-amber-50 border-amber-200 text-amber-800'
  }
  if (s === 'expired') {
    return 'rounded-full px-2 py-1 border bg-slate-100 border-slate-200 text-slate-700'
  }

  return 'rounded-full bg-white px-2 py-1 border text-slate-700'
}

function bestAssignmentTimestamp(row: any): number {
  const candidates = [row?.delivered_at, row?.started_at, row?.assigned_at]
    .map((v) => (v ? Date.parse(String(v)) : Number.NaN))
    .filter((v) => Number.isFinite(v)) as number[]

  if (candidates.length === 0) return 0
  return Math.max(...candidates)
}

function preferNewerAssignment(current: any, next: any): any {
  if (!current) return next
  if (!next) return current
  return bestAssignmentTimestamp(next) >= bestAssignmentTimestamp(current) ? next : current
}

function safeLabel(value?: string | null): string {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : '-'
}

function assignmentMetaText(job: MyJobRow): string {
  const drivers = Array.isArray(job.driver_names)
    ? job.driver_names
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
    : []

  const driversText = drivers.length > 0 ? drivers.join(', ') : '-'

  return `Truck: ${safeLabel(job.truck_name)} · Trailer: ${safeLabel(job.trailer_name)} · Driver${drivers.length > 1 ? 's' : ''}: ${driversText}`
}

const HIDDEN_MARKET_JOBS_KEY = 'hidden_market_jobs'

function unhideJobInMarket(jobOfferId: string) {
  try {
    if (!jobOfferId) return
    const raw = localStorage.getItem(HIDDEN_MARKET_JOBS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    const next = parsed.map(String).filter((id) => id !== String(jobOfferId))
    localStorage.setItem(HIDDEN_MARKET_JOBS_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

async function resolveAppUserId(authUserId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .limit(1)
      .maybeSingle()

    if (!error && data?.id) return String(data.id)
  } catch {
    // ignore
  }

  // fallback for deployments where public.users.id == auth user id
  return authUserId || null
}

function HistoryModal({
  open,
  jobs,
  onClose,
}: {
  open: boolean
  jobs: MyJobRow[]
  onClose: () => void
}) {
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (open) setPage(1)
  }, [open])

  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const visibleJobs = jobs.slice(startIndex, startIndex + PAGE_SIZE)

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold">Job History</h2>
            <p className="text-sm text-slate-500">
              Completed, aborted, cancelled and expired jobs visible for the last 30 days.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {jobs.length === 0 ? (
            <div className="text-sm text-slate-500">No history jobs in the last 30 days.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
                <span>
                  Showing {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, jobs.length)} of {jobs.length}
                </span>
                <span>
                  Page {safePage} / {totalPages}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {visibleJobs.map((job) => (
                  <div
                    key={`${job.accepted_job_id}-history`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="text-base font-semibold">
                          {job.origin_city_name ?? '—'} → {job.destination_city_name ?? '—'}
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className={statusPillClasses(job.accepted_status)}>
                            {titleCaseStatus(job.accepted_status)}
                          </span>

                          {job.transport_mode && (
                            <span className="rounded-full bg-white px-2 py-1 border">
                              {titleCaseStatus(job.transport_mode)}
                            </span>
                          )}

                          {job.runtime_state && (
                            <span className="rounded-full bg-white px-2 py-1 border">
                              Runtime: {titleCaseStatus(job.runtime_state)}
                            </span>
                          )}
                        </div>

                        <div className="text-sm text-slate-600">
                          Payload delivered:{' '}
                          <strong>{Number(job.delivered_payload_kg ?? 0).toFixed(2)} kg</strong>
                          {job.total_payload_kg != null && (
                            <>
                              {' '}
                              / {Number(job.total_payload_kg).toFixed(2)} kg
                            </>
                          )}{' '}
                          · Ended: <strong>{formatDateTime(job.ended_at_raw)}</strong>
                        </div>

                        <div className="min-h-[20px] text-sm text-slate-600">
                          {assignmentMetaText(job)}
                        </div>

                        {terminalReason(job) && (
                          <div className="text-sm text-amber-700">Reason: {terminalReason(job)}</div>
                        )}
                      </div>

                      <div className="min-w-[190px] rounded-xl bg-white border p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Reward</span>
                          <strong className="text-emerald-700">
                            {formatMoney(job.final_reward, job.currency ?? 'USD')}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Reputation</span>
                          <strong>{Number(job.reputation_delta ?? 0).toFixed(3)}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Distance</span>
                          <strong>{Number(job.distance_km ?? 0).toFixed(2)} km</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
                  >
                    Previous
                  </button>

                  <span className="px-3 text-sm text-slate-600">
                    {safePage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MyJobs(): JSX.Element {
  const { user } = useAuth()

  const [jobs, setJobs] = useState<MyJobRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedJob, setSelectedJob] = useState<MyJobRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [cancelJob, setCancelJob] = useState<MyJobRow | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelPenalty, setCancelPenalty] = useState<number | null>(null)

  const [historyOpen, setHistoryOpen] = useState(false)

  async function fetchJobs() {
    setLoading(true)
    setError(null)

    try {
      const sessionRes = await supabase.auth.getSession()
      const authUserId = sessionRes.data.session?.user?.id ?? (user as any)?.id ?? null

      if (!authUserId) {
        setJobs([])
        setError('Please log in')
        return
      }

      const appUserId = await resolveAppUserId(String(authUserId))
      if (!appUserId) {
        setJobs([])
        setError('Unable to resolve your user profile.')
        return
      }

      const { data: acceptedRaw, error: acceptedErr } = await supabase
        .from('accepted_jobs')
        .select(
          `
          id,
          user_id,
          status,
          transport_mode,
          total_payload_kg,
          remaining_payload_kg,
          delivered_payload_kg,
          accepted_at,
          assigned_at,
          started_at,
          ended_at,
          current_assignment_preview_id,
          current_job_assignment_id,
          final_reward,
          reputation_delta,
          cancel_reason,
          abort_reason,
          expire_reason,
          history_visible_until,
          job_offer:job_offer_id(
            id,
            transport_mode,
            pickup_time,
            delivery_deadline,
            distance_km,
            weight_kg,
            remaining_payload,
            volume_m3,
            pallets,
            currency,
            temperature_control,
            hazardous,
            requires_customs,
            special_requirements,
            job_offer_type_code,
            reward_load_cargo,
            reward_trailer_cargo,
            origin_city_id,
            destination_city_id,
            origin_city:origin_city_id(city_name,country_code),
            destination_city:destination_city_id(city_name,country_code),
            origin_company:origin_client_company_id(id,name,logo),
            destination_company:destination_client_company_id(id,name,logo),
            cargo_type_obj:cargo_type_id(name),
            cargo_item_obj:cargo_item_id(name)
          )
        `
        )
        .eq('user_id', String(appUserId))
        .order('accepted_at', { ascending: false })
        .limit(500)

      if (acceptedErr) {
        throw new Error(`Failed to load accepted jobs: ${acceptedErr.message}`)
      }

      const acceptedRows = Array.isArray(acceptedRaw) ? acceptedRaw : []
      const acceptedJobIds = acceptedRows.map((r: any) => r?.id).filter(Boolean) as string[]
      const assignmentIds = acceptedRows
        .map((r: any) => r?.current_job_assignment_id)
        .filter(Boolean) as string[]

      const assignmentsById: Record<string, any> = {}
      const assignmentsByAcceptedJobId: Record<string, any> = {}
      const runtimeByAssignmentId: Record<string, any> = {}

      if (assignmentIds.length > 0 || acceptedJobIds.length > 0) {
        const assignmentSelect = `
          id,
          accepted_job_id,
          job_offer_id,
          status,
          run_no,
          run_payload_kg,
          truck_id,
          trailer_id,
          driver_id,
          co_driver_id,
          assigned_at,
          started_at,
          delivered_at,
          accepted_at
        `

        const collectedAssignmentRows: any[] = []

        if (assignmentIds.length > 0) {
          const { data: jaRaw, error: jaErr } = await supabase
            .from('job_assignments')
            .select(assignmentSelect)
            .in('id', assignmentIds)

          if (!jaErr && Array.isArray(jaRaw)) {
            collectedAssignmentRows.push(...jaRaw)
          }
        }

        // fallback: for history rows where current_job_assignment_id is null,
        // try to resolve the latest assignment by accepted_job_id
        if (acceptedJobIds.length > 0) {
          const { data: jaByAcceptedRaw, error: jaByAcceptedErr } = await supabase
            .from('job_assignments')
            .select(assignmentSelect)
            .in('accepted_job_id', acceptedJobIds)

          if (!jaByAcceptedErr && Array.isArray(jaByAcceptedRaw)) {
            collectedAssignmentRows.push(...jaByAcceptedRaw)
          }
        }

        for (const row of collectedAssignmentRows) {
          if (row?.id) {
            const idKey = String(row.id)
            assignmentsById[idKey] = preferNewerAssignment(assignmentsById[idKey], row)
          }

          if (row?.accepted_job_id) {
            const acceptedKey = String(row.accepted_job_id)
            assignmentsByAcceptedJobId[acceptedKey] = preferNewerAssignment(
              assignmentsByAcceptedJobId[acceptedKey],
              row
            )
          }
        }

        if (assignmentIds.length > 0) {
          const { data: jreRaw, error: jreErr } = await supabase
            .from('job_run_executions')
            .select(
              'id,job_assignment_id,state,current_leg,current_city_id,pickup_city_id,delivery_city_id,distance_completed_km,total_distance_km,state_eta,updated_at'
            )
            .in('job_assignment_id', assignmentIds)
            .order('updated_at', { ascending: false })

          if (!jreErr && Array.isArray(jreRaw)) {
            for (const row of jreRaw) {
              const key = String(row?.job_assignment_id ?? '')
              if (!key) continue
              if (!runtimeByAssignmentId[key]) {
                runtimeByAssignmentId[key] = row
              }
            }
          }
        }
      }

      const mapped: MyJobRow[] = acceptedRows.map((row: any) => {
        const jobOffer = row.job_offer ?? {}
        const assignment =
          (row.current_job_assignment_id
            ? assignmentsById[String(row.current_job_assignment_id)]
            : null) ??
          assignmentsByAcceptedJobId[String(row.id)] ??
          null

        const runtime = row.current_job_assignment_id
          ? runtimeByAssignmentId[String(row.current_job_assignment_id)]
          : null

        const originCompany = jobOffer.origin_company ?? null
        const destinationCompany = jobOffer.destination_company ?? null

        const computedStatus = runtime?.state ?? row.status ?? null

        const truckName = assignment?.truck_id ? `Truck #${assignment.truck_id}` : '-'
        const trailerName = assignment?.trailer_id ? `Trailer #${assignment.trailer_id}` : '-'

        const driverNames = [
          assignment?.driver_id ? `Driver #${assignment.driver_id}` : null,
          assignment?.co_driver_id ? `Driver #${assignment.co_driver_id}` : null,
        ].filter(Boolean) as string[]

        return {
          // JobCard base
          id: jobOffer.id,
          pickup_time: jobOffer.pickup_time ?? null,
          delivery_deadline: jobOffer.delivery_deadline ?? null,
          transport_mode: row.transport_mode ?? jobOffer.transport_mode ?? null,
          weight_kg: jobOffer.weight_kg ?? null,
          remaining_payload: row.remaining_payload_kg ?? jobOffer.remaining_payload ?? null,
          volume_m3: jobOffer.volume_m3 ?? null,
          pallets: jobOffer.pallets ?? null,
          reward_trailer_cargo: jobOffer.reward_trailer_cargo ?? null,
          reward_load_cargo: jobOffer.reward_load_cargo ?? null,
          distance_km: jobOffer.distance_km ?? null,
          currency: jobOffer.currency ?? 'USD',
          temperature_control: jobOffer.temperature_control ?? null,
          hazardous: jobOffer.hazardous ?? null,
          requires_customs: jobOffer.requires_customs ?? null,
          special_requirements: jobOffer.special_requirements ?? null,
          job_offer_type_code: jobOffer.job_offer_type_code ?? null,
          pickup_ready: null,

          origin_city_id: jobOffer.origin_city_id ?? null,
          destination_city_id: jobOffer.destination_city_id ?? null,
          origin_city_name: jobOffer.origin_city?.city_name ?? null,
          destination_city_name: jobOffer.destination_city?.city_name ?? null,
          origin_country_code: jobOffer.origin_city?.country_code ?? null,
          destination_country_code: jobOffer.destination_city?.country_code ?? null,
          cargo_type: jobOffer.cargo_type_obj?.name ?? null,
          cargo_item: jobOffer.cargo_item_obj?.name ?? null,

          origin_client_company_id: originCompany?.id ?? null,
          origin_client_company_name: originCompany?.name ?? null,
          origin_client_company_logo: pickLogo(originCompany),
          destination_client_company_id: destinationCompany?.id ?? null,
          destination_client_company_name: destinationCompany?.name ?? null,
          destination_client_company_logo: pickLogo(destinationCompany),

          // compatibility props used by JobCard / page actions
          status: row.status ?? null,
          assignment_status: assignment?.status ?? row.status ?? null,
          payload_remaining_kg: row.remaining_payload_kg ?? null,
          assigned_payload_kg: assignment?.run_payload_kg ?? null,
          assignment_id: row.current_job_assignment_id ?? assignment?.id ?? null,
          assignment_preview_id: row.current_assignment_preview_id ?? null,
          computed_status: computedStatus,
          pickup_started_at: row.started_at ?? null,
          driving_session_phase: runtime?.state ?? null,
          driving_session_pickup_city_id: runtime?.pickup_city_id ?? null,
          driving_session_delivery_city_id: runtime?.delivery_city_id ?? null,
          driving_session_updated_at: runtime?.updated_at ?? null,

          // accepted job extras
          accepted_job_id: String(row.id),
          accepted_status: row.status ?? null,
          accepted_at_raw: row.accepted_at ?? null,
          assigned_at_raw: row.assigned_at ?? null,
          started_at_raw: row.started_at ?? null,
          ended_at_raw: row.ended_at ?? assignment?.delivered_at ?? null,
          current_job_assignment_id: row.current_job_assignment_id ?? assignment?.id ?? null,
          current_assignment_preview_id: row.current_assignment_preview_id ?? null,
          runtime_state: runtime?.state ?? null,
          runtime_eta: runtime?.state_eta ?? null,
          run_no: assignment?.run_no ?? null,
          total_payload_kg: row.total_payload_kg ?? null,
          delivered_payload_kg: row.delivered_payload_kg ?? null,
          final_reward: row.final_reward ?? 0,
          reputation_delta: row.reputation_delta ?? 0,
          history_visible_until: row.history_visible_until ?? null,
          cancel_reason: row.cancel_reason ?? null,
          abort_reason: row.abort_reason ?? null,
          expire_reason: row.expire_reason ?? null,

          // history popup extras
          truck_name: truckName,
          trailer_name: trailerName,
          driver_names: driverNames,
        } as MyJobRow
      })

      setJobs(mapped)
    } catch (e: any) {
      setError(e?.message ?? String(e))
      setJobs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  function handleOpenConfirm(job: MyJobRow) {
    setSelectedJob(job)
    setConfirmOpen(true)
  }

  async function handleConfirmAccept(_truckId: string) {
    if (!selectedJob) return

    setSuccessMessage(
      `Ready to continue assignment for ${selectedJob.origin_city_name ?? '—'} → ${selectedJob.destination_city_name ?? '—'}.`
    )

    setConfirmOpen(false)
    setSelectedJob(null)
    window.setTimeout(() => setSuccessMessage(null), 5000)
    await fetchJobs()
  }

  async function openCancelModal(job: MyJobRow) {
    setCancelJob(job)
    setCancelOpen(true)
    setCancelPenalty(null)

    const acceptedAt = job.accepted_at_raw ? Date.parse(String(job.accepted_at_raw)) : Number.NaN
    const assignedAt = job.assigned_at_raw ? Date.parse(String(job.assigned_at_raw)) : Number.NaN
    const deliveryDeadline = job.delivery_deadline ? Date.parse(String(job.delivery_deadline)) : Number.NaN

    const rewardCandidates = [job.final_reward, job.reward_load_cargo, job.reward_trailer_cargo]
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0)

    const reward = rewardCandidates.length > 0 ? rewardCandidates[0] : 0

    const nowMs = Date.now()
    const hardDeadlinePenalty =
      Number.isFinite(deliveryDeadline) && nowMs > deliveryDeadline
        ? Math.round(reward * 1.2 * 100) / 100
        : null

    const assignmentId = job.current_job_assignment_id
    if (assignmentId) {
      const { data, error } = await supabase.rpc('get_assignment_cancellation_penalty', {
        p_assignment_id: assignmentId,
      })

      if (!error && typeof data === 'number') {
        if (hardDeadlinePenalty !== null) {
          setCancelPenalty(Math.max(data, hardDeadlinePenalty))
          return
        }

        setCancelPenalty(data)
        return
      }
    }

    const baselineTs = Number.isFinite(acceptedAt)
      ? acceptedAt
      : Number.isFinite(assignedAt)
        ? assignedAt
        : null

    if (Number.isFinite(deliveryDeadline) && nowMs > deliveryDeadline) {
      setCancelPenalty(Math.round(reward * 1.2 * 100) / 100)
      return
    }

    if (!baselineTs) {
      setCancelPenalty(null)
      return
    }

    const freeLimit = baselineTs + 12 * 60 * 60 * 1000

    if (nowMs <= freeLimit) {
      setCancelPenalty(0)
      return
    }

    if (!Number.isFinite(deliveryDeadline) || deliveryDeadline <= freeLimit) {
      setCancelPenalty(Math.round(reward * 100) / 100)
      return
    }

    const progress = (nowMs - freeLimit) / (deliveryDeadline - freeLimit)
    const penalty = reward * Math.max(0, Math.min(1, progress))
    setCancelPenalty(Math.round(penalty * 100) / 100)
  }

  async function handleConfirmCancel() {
    if (!cancelJob) return
    setCancelLoading(true)

    try {
      const sessionRes = await supabase.auth.getSession()
      const authUserId = sessionRes.data.session?.user?.id ?? (user as any)?.id ?? null

      if (!authUserId) {
        throw new Error('Please log in')
      }

      const appUserId = await resolveAppUserId(String(authUserId))
      if (!appUserId) {
        throw new Error('Unable to resolve your user profile.')
      }

      const acceptedJobId = cancelJob.accepted_job_id
      if (!acceptedJobId) {
        throw new Error('Missing accepted job id.')
      }

      let assignmentId = cancelJob.current_job_assignment_id
      if (!assignmentId) {
        const { data: latestAssignment } = await supabase
          .from('job_assignments')
          .select('id,assigned_at,started_at')
          .eq('accepted_job_id', acceptedJobId)
          .order('started_at', { ascending: false, nullsFirst: false })
          .order('assigned_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()

        assignmentId = latestAssignment?.id ? String(latestAssignment.id) : null
      }

      const cancelReason = 'cancelled_from_my_jobs'
      const nowIso = new Date().toISOString()
      const deadlineTs = cancelJob.delivery_deadline
        ? Date.parse(String(cancelJob.delivery_deadline))
        : Number.NaN
      const deadlinePassed = Number.isFinite(deadlineTs) ? Date.now() > deadlineTs : false

      let cancelled = false

      // NOTE: we intentionally do not call `cancel_accepted_job` because that DB
      // function depends on `sync_job_market_visibility()` which is missing in
      // the target environment and causes hard failures.
      if (assignmentId) {
        const { error: assignmentCancelErr } = await supabase.rpc('cancel_assignment', {
          p_assignment_id: assignmentId,
        })

        if (!assignmentCancelErr) {
          cancelled = true
        }
      }

      if (!cancelled) {
        if (assignmentId) {
          await supabase
            .from('job_assignments')
            .update({
              status: 'cancelled',
              cancelled_at: nowIso,
            })
            .eq('id', assignmentId)
        }

        const { error: acceptedUpdateErr } = await supabase
          .from('accepted_jobs')
          .update({
            status: 'cancelled',
            cancel_reason: cancelReason,
            current_job_assignment_id: null,
            ended_at: nowIso,
          })
          .eq('id', acceptedJobId)
          .eq('user_id', appUserId)

        if (acceptedUpdateErr) {
          throw new Error(acceptedUpdateErr.message ?? 'Failed to cancel job')
        }

        if (cancelJob.id && !deadlinePassed) {
          await supabase
            .from('job_offers')
            .update({
              status: 'open',
              published: true,
              user_id: null,
              user_truck_id: null,
              assigned_user_truck_id: null,
              accepted_at: null,
            })
            .eq('id', String(cancelJob.id))
        }

        cancelled = true
      }

      if (!cancelled) {
        throw new Error('Failed to cancel job')
      }

      if (cancelJob.id) {
        unhideJobInMarket(String(cancelJob.id))
      }

      setError(null)
      setSuccessMessage(
        `Cancelled: ${cancelJob.origin_city_name ?? '—'} → ${cancelJob.destination_city_name ?? '—'}`
      )
      window.setTimeout(() => setSuccessMessage(null), 5000)

      await fetchJobs()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setCancelLoading(false)
      setCancelOpen(false)
      setCancelJob(null)
      setCancelPenalty(null)
    }
  }

  const { waitingJobs, activeJobs, historyJobs } = useMemo(() => {
    const now = Date.now()

    const waiting = jobs.filter((j) => ['accepted', 'assigned'].includes(String(j.accepted_status ?? '')))
    const active = jobs.filter((j) => String(j.accepted_status ?? '') === 'in_progress')
    const history = jobs.filter((j) => {
      const s = String(j.accepted_status ?? '')
      if (!['completed', 'aborted', 'cancelled', 'expired'].includes(s)) return false

      if (!j.history_visible_until) return true
      const t = Date.parse(String(j.history_visible_until))
      if (Number.isNaN(t)) return true
      return t > now
    })

    return {
      waitingJobs: waiting,
      activeJobs: active,
      historyJobs: history,
    }
  }, [jobs])

  return (
    <Layout fullWidth>
      <div className="space-y-4">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Jobs</h1>
            <p className="text-sm text-black/70">Jobs your company accepted and is performing</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              History
              <span className="rounded-full bg-white px-2 py-0.5 text-xs border border-emerald-200">
                {historyJobs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => fetchJobs()}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </header>

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded text-emerald-700 shadow-sm">
            {successMessage}
          </div>
        )}

        {loading && <div className="text-sm text-slate-500">Loading jobs…</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}
        {!loading && jobs.length === 0 && !error && (
          <div className="text-sm text-slate-500">No jobs found.</div>
        )}

        <div className="flex flex-col gap-4">
          <SectionBox
            title="Waiting"
            subtitle="Accepted jobs not yet running"
            count={waitingJobs.length}
          >
            {waitingJobs.length === 0 ? (
              <div className="text-sm text-slate-500">No waiting jobs.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {waitingJobs.map((job) => (
                  <JobCard
                    key={`${job.accepted_job_id}-waiting`}
                    job={job}
                    onAccept={(j) => handleOpenConfirm(j as MyJobRow)}
                    onView={() => {}}
                    variant="waiting"
                    actionsVariant="my-jobs"
                    onCancel={(j) => {
                      void openCancelModal(j as MyJobRow)
                    }}
                  />
                ))}
              </div>
            )}
          </SectionBox>

          <SectionBox
            title="Active"
            subtitle="Jobs currently running (runtime state is authoritative)"
            count={activeJobs.length}
          >
            {activeJobs.length === 0 ? (
              <div className="text-sm text-slate-500">No active jobs.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {activeJobs.map((job) => (
                  <div key={`${job.accepted_job_id}-active`} className="space-y-2">
                    <JobCard
                      job={job}
                      onAccept={(j) => handleOpenConfirm(j as MyJobRow)}
                      onView={() => {}}
                      variant="active"
                      actionsVariant="my-jobs"
                    />

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center gap-3">
                        <span>
                          Runtime: <strong>{titleCaseStatus(job.runtime_state ?? 'in_progress')}</strong>
                        </span>
                        {job.run_no != null && (
                          <span>
                            Run: <strong>{job.run_no}</strong>
                          </span>
                        )}
                        {job.runtime_eta && (
                          <span>
                            ETA: <strong>{formatDateTime(job.runtime_eta)}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionBox>
        </div>

        <ConfirmAcceptModal
          open={confirmOpen}
          job={selectedJob}
          onClose={() => {
            setConfirmOpen(false)
            setSelectedJob(null)
          }}
          onConfirm={handleConfirmAccept}
        />

        <CancelPenaltyModal
          open={cancelOpen}
          loading={cancelLoading}
          penalty={cancelPenalty}
          assignmentId={cancelJob?.current_job_assignment_id ?? null}
          onClose={() => {
            setCancelOpen(false)
            setCancelJob(null)
            setCancelPenalty(null)
          }}
          onConfirm={async () => {
            await handleConfirmCancel()
          }}
        />

        <HistoryModal
          open={historyOpen}
          jobs={historyJobs}
          onClose={() => setHistoryOpen(false)}
        />
      </div>
    </Layout>
  )
}