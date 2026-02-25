/**
 * MyJobs.tsx
 *
 * Page that lists jobs accepted by the user's company and allows confirming acceptance details.
 *
 * Fixes:
 * - Do NOT rely on user.company_id being present on the auth user object.
 * - Resolve carrier company id from public.users / trucks / companies.
 * - Use the authenticated session access_token (RLS-safe) instead of anon bearer.
 * - URL-encode PostgREST select strings to avoid subtle parsing issues.
 * - Fetch + map origin/destination client companies so JobCard shows company blocks.
 * - Fetch + map origin_city_id/destination_city_id so WeatherBadge can resolve weather.
 * - Retry without pickup_ready if backend schema doesn't yet have that column (42703).
 *
 * Cancellation behavior:
 * - Preferred path uses DB RPC cancel_assignment(p_assignment_id) so backend handles
 *   penalty/session/offer reopen logic.
 * - Fallback path patches job_assignments as cancelled and explicitly reopens job_offers
 *   so the job returns to Market if RPC is unavailable.
 * - After cancel, remove the job from Market's local hidden-id set so it can reappear.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import JobCard, { JobRow } from '../components/market/JobCard'
import ConfirmAcceptModal from '../components/market/ConfirmAcceptModal'
import CancelPenaltyModal from '../components/market/CancelPenaltyModal'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

/**
 * SectionBoxProps
 */
interface SectionBoxProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  count?: number
}

function SectionBox({ title, subtitle, children, count }: SectionBoxProps) {
  return (
    <section className="bg-white p-6 rounded shadow space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <div className="text-sm text-slate-500 mt-1">{subtitle}</div>}
        </div>
        <div className="text-sm text-slate-600">
          {typeof count === 'number' && (
            <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded">{count}</span>
          )}
        </div>
      </header>
      <div>{children}</div>
    </section>
  )
}

/**
 * normalizePhase
 */
function normalizePhase(phaseRaw: any): string {
  if (!phaseRaw && phaseRaw !== 0) return ''
  return String(phaseRaw).toLowerCase().replace(/_/g, ' ')
}

function pickLogo(obj: any): string | null {
  if (!obj) return null
  return obj.logo ?? obj.logo_url ?? obj.image_url ?? obj.icon_url ?? null
}

/**
 * Detect schema drift error when pickup_ready is selected but column does not exist.
 */
function shouldRetryWithoutPickupReady(status: number, bodyText: string): boolean {
  if (status !== 400) return false
  const t = String(bodyText ?? '').toLowerCase()
  return t.includes('42703') && t.includes('pickup_ready')
}

/**
 * Remove pickup_ready from encoded PostgREST select.
 */
function stripPickupReadyFromEncodedSelect(encodedSelect: string): string {
  const decoded = decodeURIComponent(encodedSelect)
  const cleaned = decoded
    .replace(/,pickup_ready(?=,|\))/g, '')
    .replace(/pickup_ready,(?=[^)]*\))/g, '')
  return encodeURIComponent(cleaned)
}

/**
 * Market local hidden jobs key (must match Market page).
 * If your Market page uses a different key, update this constant to match.
 */
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
    // ignore localStorage parse/write errors
  }
}

/**
 * API constants
 * NOTE: In production move anon key to env var.
 */
const API_BASE = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

function buildHeaders(accessToken?: string | null) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken ?? SUPABASE_ANON_KEY}`,
  }
}

/**
 * resolveCarrierCompanyId
 *
 * Robustly resolve carrier company id even when user.company_id is missing from auth context.
 */
async function resolveCarrierCompanyId(authUserId: string, accessToken?: string | null): Promise<string | null> {
  const headers = buildHeaders(accessToken)

  // 1) public.users by auth_user_id
  try {
    const url = `${API_BASE}/rest/v1/users?select=company_id&auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`
    const res = await fetch(url, { headers })
    if (res.ok) {
      const rows = (await res.json().catch(() => [])) as any[]
      const cid = rows?.[0]?.company_id ?? null
      if (cid) return String(cid)
    }
  } catch {
    // ignore
  }

  // 2) user_trucks by owner_user_id -> owner_company_id
  try {
    const url = `${API_BASE}/rest/v1/user_trucks?select=owner_company_id&owner_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`
    const res = await fetch(url, { headers })
    if (res.ok) {
      const rows = (await res.json().catch(() => [])) as any[]
      const cid = rows?.[0]?.owner_company_id ?? null
      if (cid) return String(cid)
    }
  } catch {
    // ignore
  }

  // 3) companies by owner_id
  try {
    const url = `${API_BASE}/rest/v1/companies?select=id&owner_id=eq.${encodeURIComponent(authUserId)}&limit=1`
    const res = await fetch(url, { headers })
    if (res.ok) {
      const rows = (await res.json().catch(() => [])) as any[]
      const cid = rows?.[0]?.id ?? null
      if (cid) return String(cid)
    }
  } catch {
    // ignore
  }

  return null
}

export default function MyJobs(): JSX.Element {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal state for accept modal
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Modal state for cancel penalty modal
  const [cancelJob, setCancelJob] = useState<JobRow | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelPenalty, setCancelPenalty] = useState<number | null>(null)

  async function fetchJobs() {
    setLoading(true)
    setError(null)

    try {
      const session = await supabase.auth.getSession()
      const accessToken = session.data.session?.access_token ?? null
      const authUserId = session.data.session?.user?.id ?? (user as any)?.id ?? null

      if (!authUserId) {
        setJobs([])
        setError('Please log in')
        return
      }

      // Prefer user.company_id if provided, otherwise resolve it robustly
      const carrierCompanyId =
        (user as any)?.company_id ??
        (user as any)?.companyId ??
        (await resolveCarrierCompanyId(String(authUserId), accessToken))

      if (!carrierCompanyId) {
        setJobs([])
        setError('No carrier company linked to your account. Please create or join a company.')
        return
      }

      // Select assignments and embed job offer.
      // Include company + city ids for JobCard company block and WeatherBadge.
      const select = [
        'id',
        'status',
        'accepted_at',
        'pickup_started_at',
        'assignment_preview_id',
        'assigned_payload_kg',
        'payload_remaining_kg',
        'job_offer:job_offer_id(' +
          [
            'id',
            'transport_mode',
            'pickup_time',
            'delivery_deadline',
            'distance_km',
            'weight_kg',
            'remaining_payload',
            'volume_m3',
            'pallets',
            'currency',
            'temperature_control',
            'hazardous',
            'requires_customs',
            'special_requirements',
            'job_offer_type_code',
            // Optional in some envs -> retry without it if 42703
            'pickup_ready',
            'reward_load_cargo',
            'reward_trailer_cargo',

            'origin_city_id',
            'destination_city_id',

            'origin_city:origin_city_id(city_name,country_code)',
            'destination_city:destination_city_id(city_name,country_code)',

            'origin_company:origin_client_company_id(id,name,logo)',
            'destination_company:destination_client_company_id(id,name,logo)',

            'cargo_type_obj:cargo_type_id(name)',
            'cargo_item_obj:cargo_item_id(name)',
          ].join(',') +
          ')',
      ].join(',')

      let encodedSelect = encodeURIComponent(select)

      const buildAssignmentsUrl = (encoded: string) =>
        `${API_BASE}/rest/v1/job_assignments` +
        `?carrier_company_id=eq.${encodeURIComponent(String(carrierCompanyId))}` +
        `&select=${encoded}` +
        `&order=accepted_at.desc` +
        `&limit=500`

      let jaRes = await fetch(buildAssignmentsUrl(encodedSelect), { headers: buildHeaders(accessToken) })
      if (!jaRes.ok) {
        const txt = await jaRes.text().catch(() => '')
        if (shouldRetryWithoutPickupReady(jaRes.status, txt)) {
          encodedSelect = stripPickupReadyFromEncodedSelect(encodedSelect)
          jaRes = await fetch(buildAssignmentsUrl(encodedSelect), { headers: buildHeaders(accessToken) })
        } else {
          throw new Error(`Failed to load jobs: ${jaRes.status} ${txt}`)
        }
      }

      if (!jaRes.ok) {
        const txt = await jaRes.text().catch(() => '')
        throw new Error(`Failed to load jobs: ${jaRes.status} ${txt}`)
      }

      const jaData = (await jaRes.json().catch(() => [])) as any[]
      const assignmentIds = (jaData ?? []).map((r) => r?.id).filter(Boolean) as string[]

      // Load driving_sessions for assignments (best-effort)
      const dsByAssignment: Record<string, any> = {}
      if (assignmentIds.length > 0) {
        const inList = assignmentIds.join(',')
        const dsUrl =
          `${API_BASE}/rest/v1/driving_sessions` +
          `?job_assignment_id=in.(${encodeURIComponent(inList)})` +
          `&select=id,job_assignment_id,phase,updated_at,pickup_city_id,delivery_city_id` +
          `&order=updated_at.desc` +
          `&limit=2000`

        const dsRes = await fetch(dsUrl, { headers: buildHeaders(accessToken) })
        if (dsRes.ok) {
          const dsRows = (await dsRes.json().catch(() => [])) as any[]
          for (const row of dsRows) {
            const key = String(row.job_assignment_id ?? '')
            if (!key) continue
            if (!dsByAssignment[key]) dsByAssignment[key] = row
          }
        } else {
          // non-fatal
          console.debug('[MyJobs] driving_sessions fetch failed', await dsRes.text().catch(() => ''))
        }
      }

      const mapped: JobRow[] = (jaData ?? []).map((row: any) => {
        const j = row.job_offer ?? {}
        const ds = dsByAssignment[String(row.id)] ?? null

        const originCompany = j.origin_company ?? null
        const destinationCompany = j.destination_company ?? null

        const authoritativePhase = ds?.phase ?? row.status ?? null
        const normalizedStatus = normalizePhase(authoritativePhase)
        const rowStatus = String(row.status ?? '').toLowerCase()

        const rowRemainingPayload = Number(row?.payload_remaining_kg ?? NaN)
        const rowAssignedPayload = Number(row?.assigned_payload_kg ?? NaN)

        let displayPayload = j.remaining_payload ?? j.weight_kg ?? null
        if (rowStatus === 'assigned' && Number.isFinite(rowRemainingPayload) && rowRemainingPayload >= 0) {
          displayPayload = rowRemainingPayload
        } else if (
          ['picking_load', 'to_pickup', 'in_progress', 'delivering', 'in_transit'].includes(rowStatus) &&
          Number.isFinite(rowAssignedPayload) &&
          rowAssignedPayload > 0
        ) {
          displayPayload = rowAssignedPayload
        }

        const deliveryDeadline = j.delivery_deadline ?? null
        const isDeadlineExpired =
          deliveryDeadline != null && !Number.isNaN(Date.parse(String(deliveryDeadline)))
            ? new Date(String(deliveryDeadline)) < new Date()
            : false

        return {
          // JobCard expects JobRow.id = job_offer.id
          id: j.id,
          pickup_time: j.pickup_time ?? null,
          delivery_deadline: j.delivery_deadline ?? null,
          transport_mode: j.transport_mode ?? null,
          weight_kg: j.weight_kg ?? null,
          remaining_payload: displayPayload,
          volume_m3: j.volume_m3 ?? null,
          pallets: j.pallets ?? null,
          reward_trailer_cargo: j.reward_trailer_cargo ?? null,
          reward_load_cargo: j.reward_load_cargo ?? null,
          distance_km: j.distance_km ?? null,

          currency: j.currency ?? null,
          temperature_control: j.temperature_control ?? null,
          hazardous: j.hazardous ?? null,
          requires_customs: j.requires_customs ?? null,
          special_requirements: j.special_requirements ?? null,
          job_offer_type_code: j.job_offer_type_code ?? null,
          pickup_ready: typeof j.pickup_ready === 'boolean' ? j.pickup_ready : null,

          origin_city_id: j.origin_city_id ?? null,
          destination_city_id: j.destination_city_id ?? null,

          origin_city_name: j.origin_city?.city_name ?? null,
          destination_city_name: j.destination_city?.city_name ?? null,
          origin_country_code: j.origin_city?.country_code ?? null,
          destination_country_code: j.destination_city?.country_code ?? null,

          cargo_type: j.cargo_type_obj?.name ?? null,
          cargo_item: j.cargo_item_obj?.name ?? null,

          // assignment metadata
          status: row.status ?? null,
          assignment_status: row.status ?? null,
          payload_remaining_kg: row.payload_remaining_kg ?? null,
          assigned_payload_kg: row.assigned_payload_kg ?? null,

          // driving session fields (authoritative)
          driving_session_phase: ds?.phase ?? null,
          driving_session_pickup_city_id: ds?.pickup_city_id ?? null,
          driving_session_delivery_city_id: ds?.delivery_city_id ?? null,
          driving_session_updated_at: ds?.updated_at ?? null,

          computed_status: normalizedStatus,

          pickup_started_at: row.pickup_started_at ?? null,

          // IMPORTANT: keep assignment id for cancel flows
          assignment_id: row.id ?? null,

          // keep preview id if present (used in your confirm flow)
          assignment_preview_id: row.assignment_preview_id ?? null,

          // optional UI helper
          is_deadline_expired: isDeadlineExpired,

          // company fields (used by JobCard company block)
          origin_client_company_id: originCompany?.id ?? null,
          origin_client_company_name: originCompany?.name ?? null,
          origin_client_company_logo: pickLogo(originCompany),

          destination_client_company_id: destinationCompany?.id ?? null,
          destination_client_company_name: destinationCompany?.name ?? null,
          destination_client_company_logo: pickLogo(destinationCompany),
        } as JobRow
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
  }, [user?.id, (user as any)?.company_id])

  async function handleOpenConfirm(job: JobRow) {
    const selectedDriverId = localStorage.getItem('staging_selected_driver') ?? null
    const previewId = (job as any)?.assignment_preview_id ?? (job as any)?.preview_id ?? null

    if (previewId && selectedDriverId) {
      try {
        const session = await supabase.auth.getSession()
        const accessToken = session.data.session?.access_token ?? null

        const res = await fetch(`${API_BASE}/rest/v1/assignment_previews?id=eq.${encodeURIComponent(previewId)}`, {
          method: 'PATCH',
          headers: {
            ...buildHeaders(accessToken),
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ driver_id: selectedDriverId }),
        })

        if (!res.ok) {
          console.debug('[MyJobs] Failed to update assignment_previews driver_id:', await res.text().catch(() => ''))
        }
      } catch (e) {
        console.debug('[MyJobs] Exception updating preview driver', e)
      }
    }

    setSelectedJob(job)
    setConfirmOpen(true)
  }

  async function handleConfirmAccept(truckId: string) {
    if (!selectedJob) return
    void truckId // reserved for future server patch flow
    setJobs((s) => s.filter((j) => j.id !== selectedJob.id))

    setSuccessMessage(
      `Confirmed: ${selectedJob.origin_city_name ?? '—'} → ${selectedJob.destination_city_name ?? '—'} (${selectedJob.transport_mode ?? '—'})`
    )

    setConfirmOpen(false)
    setSelectedJob(null)
    window.setTimeout(() => setSuccessMessage(null), 5000)
  }

  function handleCancelLoad(job: JobRow) {
    setJobs((s) => s.filter((j) => j.id !== job.id))
    setSuccessMessage(`Cancelled load: ${job.origin_city_name ?? '—'} → ${job.destination_city_name ?? '—'}`)
    window.setTimeout(() => setSuccessMessage(null), 5000)
  }

  async function openCancelModal(job: JobRow) {
    setCancelJob(job)
    setCancelPenalty(null)
    setCancelOpen(true)

    try {
      const session = await supabase.auth.getSession()
      const accessToken = session.data.session?.access_token ?? null

      const assignmentId = (job as any)?.assignment_id ?? job.id
      if (!assignmentId) return

      const url = `${API_BASE}/rest/v1/job_assignments?id=eq.${encodeURIComponent(assignmentId)}&select=accepted_at`
      const res = await fetch(url, { headers: buildHeaders(accessToken) })
      if (!res.ok) return

      const rows = (await res.json().catch(() => [])) as any[]
      if (!rows || rows.length === 0) return

      const acceptedAt = rows[0].accepted_at ? Date.parse(String(rows[0].accepted_at)) : null
      if (!acceptedAt) return

      const hours = (Date.now() - acceptedAt) / (1000 * 60 * 60)
      if (hours <= 12) setCancelPenalty(0)
      else {
        const pct = Math.min(1.2, 0.01 * Math.floor(hours))
        const estimatedBase = 100
        setCancelPenalty(Math.round(estimatedBase * pct * 100) / 100)
      }
    } catch (e) {
      console.debug('[MyJobs] Exception fetching penalty', e)
    }
  }

  async function handleConfirmCancel() {
    if (!cancelJob) return
    setCancelLoading(true)

    try {
      try {
        const session = await supabase.auth.getSession()
        const accessToken = session.data.session?.access_token ?? null

        const assignmentId = (cancelJob as any)?.assignment_id ?? cancelJob.id
        const jobOfferId = cancelJob.id // JobRow.id is job_offer.id in this page mapping
        let cancelledServerSide = false

        // Preferred path: DB function handles penalty + offer re-open + session updates.
        if (assignmentId) {
          const { error: rpcErr } = await supabase.rpc('cancel_assignment', { p_assignment_id: assignmentId })
          if (!rpcErr) {
            cancelledServerSide = true
          } else {
            console.debug('[MyJobs] cancel_assignment rpc failed, using fallback patch path', rpcErr)
          }
        }

        // Fallback path: cancel assignment + explicitly re-open offer so it returns to Market.
        if (!cancelledServerSide && assignmentId) {
          await fetch(`${API_BASE}/rest/v1/job_assignments?id=eq.${encodeURIComponent(assignmentId)}`, {
            method: 'PATCH',
            headers: {
              ...buildHeaders(accessToken),
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify({ status: 'cancelled', cancelled_at: new Date().toISOString() }),
          })

          // Fallback: return offer to market if RPC is unavailable.
          if (jobOfferId) {
            await fetch(`${API_BASE}/rest/v1/job_offers?id=eq.${encodeURIComponent(jobOfferId)}`, {
              method: 'PATCH',
              headers: {
                ...buildHeaders(accessToken),
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify({
                status: 'open',
                assigned_user_truck_id: null,
                user_id: null,
                user_truck_id: null,
                accepted_at: null,
              }),
            })
          }
        }

        // Ensure reopened job can actually reappear in Market UI.
        if (jobOfferId) {
          unhideJobInMarket(String(jobOfferId))
        }
      } catch (e) {
        console.debug('[MyJobs] server cancellation attempt failed', e)
      }

      handleCancelLoad(cancelJob)
    } finally {
      setCancelLoading(false)
      setCancelOpen(false)
      setCancelJob(null)
      setCancelPenalty(null)
    }
  }

  const { waitingJobs, activeJobs } = useMemo(() => {
    const wait: JobRow[] = []
    const active: JobRow[] = []

    for (const j of jobs) {
      const status = (j as any)?.computed_status ?? (j.status ?? '').toString().toLowerCase()
      const rowRemaining = Number((j as any)?.payload_remaining_kg ?? (j as any)?.remaining_payload ?? NaN)

      if (status === 'assigned') {
        wait.push(j)
        continue
      }

      if (status === 'completed' || status === 'cancelled') continue

      // Keep remainder visible in Waiting even while one run is active.
      if (Number.isFinite(rowRemaining) && rowRemaining > 0) {
        wait.push(
          {
            ...(j as any),
            computed_status: 'assigned',
            assignment_status: 'assigned',
            remaining_payload: rowRemaining,
          } as JobRow
        )
      }

      active.push(j)
    }

    return { waitingJobs: wait, activeJobs: active }
  }, [jobs])

  const content = (
    <div className="flex flex-col gap-4">
      {loading && <div className="text-sm text-slate-500">Loading jobs…</div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {!loading && jobs.length === 0 && !error && <div className="text-sm text-slate-500">No jobs found.</div>}

      <SectionBox
        title="Waiting"
        subtitle="Assignments awaiting confirmation (status: assigned)"
        count={waitingJobs.length}
      >
        {waitingJobs.length === 0 ? (
          <div className="text-sm text-slate-500">No waiting jobs.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {waitingJobs.map((job) => (
              <JobCard
                key={`${(job as any)?.assignment_id ?? job.id}-waiting`}
                job={job}
                onAccept={(j) => handleOpenConfirm(j)}
                onView={() => {}}
                variant="waiting"
                actionsVariant="my-jobs"
                onCancel={(j) => openCancelModal(j)}
              />
            ))}
          </div>
        )}
      </SectionBox>

      <SectionBox
        title="Active"
        subtitle="Active assignments (authoritative: driving_sessions.phase)"
        count={activeJobs.length}
      >
        {activeJobs.length === 0 ? (
          <div className="text-sm text-slate-500">No active jobs.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeJobs.map((job) => (
              <JobCard
                key={`${(job as any)?.assignment_id ?? job.id}-active`}
                job={job}
                onAccept={(j) => handleOpenConfirm(j)}
                onView={() => {}}
                variant="active"
                actionsVariant="my-jobs"
                onCancel={(j) => openCancelModal(j)}
              />
            ))}
          </div>
        )}
      </SectionBox>
    </div>
  )

  return (
    <Layout fullWidth>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">My Jobs</h1>
          <p className="text-sm text-black/70">Jobs your company accepted and is performing</p>
        </header>

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded text-emerald-700 shadow-sm">
            {successMessage}
          </div>
        )}

        <div>{content}</div>

        <ConfirmAcceptModal
          open={confirmOpen}
          job={selectedJob}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirmAccept}
        />

        <CancelPenaltyModal
          open={cancelOpen}
          loading={cancelLoading}
          penalty={cancelPenalty}
          assignmentId={(cancelJob as any)?.assignment_id ?? (cancelJob as any)?.id}
          onClose={() => {
            setCancelOpen(false)
            setCancelJob(null)
            setCancelPenalty(null)
          }}
          onConfirm={async () => {
            await handleConfirmCancel()
          }}
        />
      </div>
    </Layout>
  )
}