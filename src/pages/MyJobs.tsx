/**
 * MyJobs.tsx
 *
 * Page that lists jobs accepted by the user's company and allows confirming acceptance details.
 *
 * Changes:
 * - Use driving_sessions as authoritative source of truth for active job status.
 * - Add a cancellation confirmation modal (CancelPenaltyModal) with blurred backdrop and penalty info.
 * - Wire Cancel buttons to open the modal and perform confirmation before removing jobs.
 *
 * Added improvement:
 * - Compute and attach is_deadline_expired flag to each JobRow so downstream UI can render deadline emphasis.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import JobCard, { JobRow } from '../components/market/JobCard'
import ConfirmAcceptModal from '../components/market/ConfirmAcceptModal'
import CancelPenaltyModal from '../components/market/CancelPenaltyModal'
import { useAuth } from '../context/AuthContext'

/**
 * SectionBoxProps
 *
 * Props for the simple stacked section box used on the page.
 */
interface SectionBoxProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  count?: number
}

/**
 * SectionBox
 *
 * Small presentational wrapper used to render a titled box with uniform padding
 * and subtle shadow. Re-usable for both "Waiting" and "Active" sections.
 *
 * @param props SectionBoxProps
 */
function SectionBox({ title, subtitle, children, count }: SectionBoxProps) {
  return (
    <section className="bg-white p-6 rounded shadow space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <div className="text-sm text-slate-500 mt-1">{subtitle}</div>}
        </div>
        <div className="text-sm text-slate-600">
          {typeof count === 'number' && <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded">{count}</span>}
        </div>
      </header>

      <div>{children}</div>
    </section>
  )
}

/**
 * normalizePhase
 *
 * Normalize phase/status strings:
 * - Prefer driving_sessions.phase when available.
 * - Lower-case and replace underscores with spaces: "TO_PICKUP" -> "to pickup"
 *
 * @param phaseRaw raw phase/status value
 * @returns normalized status string
 */
function normalizePhase(phaseRaw: any): string {
  if (!phaseRaw && phaseRaw !== 0) return ''
  return String(phaseRaw).toLowerCase().replace(/_/g, ' ')
}

/**
 * MyJobs
 *
 * Main page component. Loads assignments for the current company and splits them
 * into Waiting / Active groups for display.
 *
 * Implementation notes:
 * - Loads job_assignments (embedding job_offer) and then loads driving_sessions
 *   for the fetched assignments. The latest driving_session (by updated_at) is
 *   chosen per assignment and used as authoritative phase when present.
 *
 * - Adds a CancelPenaltyModal flow for confirming a job cancellation with penalty info.
 *
 * @returns JSX.Element
 */
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

  /**
   * fetchJobs
   *
   * Load assignments for the current company by selecting rows from job_assignments
   * and embedding the related job_offers (joined). Then load driving_sessions for
   * the fetched assignment ids and attach the latest session to each job row.
   *
   * Behavior:
   * - Requires authenticated user with company_id.
   */
  async function fetchJobs() {
    const API_BASE = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'
    const SUPABASE_ANON_KEY =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

    if (!user?.company_id) return

    setLoading(true)
    setError(null)

    try {
      // Conservative select: embed job_offer only (avoid joining other company rows).
      const jaUrl =
        `${API_BASE}/rest/v1/job_assignments` +
        `?carrier_company_id=eq.${user.company_id}` +
        `&select=` +
        `id,status,accepted_at,job_offer:job_offer_id(` +
        `id,transport_mode,pickup_time,delivery_deadline,` +
        `distance_km,weight_kg,volume_m3,pallets,` +
        `reward_load_cargo,reward_trailer_cargo,` +
        `origin_city:origin_city_id(city_name,country_code),` +
        `destination_city:destination_city_id(city_name,country_code),` +
        `cargo_type_obj:cargo_type_id(name),` +
        `cargo_item_obj:cargo_item_id(name)` +
        `)`

      const res = await fetch(jaUrl, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to load jobs: ${res.status}`)
      }

      const jaData = (await res.json()) as any[]
      const assignmentIds = jaData.map((r) => r.id).filter(Boolean) as string[]

      // If we have assignments, load driving_sessions for them and pick the latest per assignment.
      const dsByAssignment: Record<string, any> = {}
      if (assignmentIds.length > 0) {
        // Build in(...) list for PostgREST. Values are UUIDs so no quotes required.
        const inList = assignmentIds.join(',')
        const dsUrl = `${API_BASE}/rest/v1/driving_sessions?job_assignment_id=in.(${encodeURIComponent(inList)})&select=*&order=updated_at.asc`
        const dsRes = await fetch(dsUrl, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        })

        if (dsRes.ok) {
          const dsRows = (await dsRes.json()) as any[]
          // Choose latest per job_assignment_id by updated_at (or fallback to last encountered)
          for (const row of dsRows) {
            const key = String(row.job_assignment_id ?? row.job_assignment ?? '')
            if (!key) continue
            const existing = dsByAssignment[key]
            const curUpdated = row.updated_at ? Date.parse(String(row.updated_at)) : 0
            const exUpdated = existing && existing.updated_at ? Date.parse(String(existing.updated_at)) : 0
            if (!existing || curUpdated >= exUpdated) {
              dsByAssignment[key] = row
            }
          }
        } else {
          // Non-fatal: continue without driving sessions but surface debug error
          console.debug('[MyJobs] driving_sessions fetch failed', await dsRes.text())
        }
      }

      const mapped: JobRow[] = (jaData as any[]).map((row: any) => {
        const j = row.job_offer ?? {}

        const ds = dsByAssignment[String(row.id)] ?? null
        const authoritativePhase = ds?.phase ?? row.status ?? null
        const normalizedStatus = normalizePhase(authoritativePhase)

        // Compute deadline expired flag client-side so other components can use it.
        const deliveryDeadline = j.delivery_deadline ?? null
        const isDeadlineExpired =
          deliveryDeadline != null && !Number.isNaN(Date.parse(String(deliveryDeadline)))
            ? new Date(String(deliveryDeadline)) < new Date()
            : false

        return {
          // NOTE: JobRow.id intentionally set to job_offer.id to preserve existing JobCard expectations.
          id: j.id,
          pickup_time: j.pickup_time ?? null,
          delivery_deadline: j.delivery_deadline ?? null,
          transport_mode: j.transport_mode ?? null,
          weight_kg: j.weight_kg ?? null,
          volume_m3: j.volume_m3 ?? null,
          pallets: j.pallets ?? null,
          reward_trailer_cargo: j.reward_trailer_cargo ?? null,
          reward_load_cargo: j.reward_load_cargo ?? null,
          distance_km: j.distance_km ?? null,
          origin_city_name: j.origin_city?.city_name ?? null,
          destination_city_name: j.destination_city?.city_name ?? null,
          origin_country_code: j.origin_city?.country_code ?? null,
          destination_country_code: j.destination_city?.country_code ?? null,
          cargo_type: j.cargo_type_obj?.name ?? null,
          cargo_item: j.cargo_item_obj?.name ?? null,
          // company fields intentionally left null for now (safe)
          origin_client_company_id: null,
          origin_client_company_name: null,
          destination_client_company_id: null,
          destination_client_company_name: null,
          // Preserve assignment metadata from job_assignments row
          status: row.status ?? null,
          assignment_status: row.status ?? null,
          // driving session authoritative fields
          driving_session_phase: ds?.phase ?? null,
          driving_session_pickup_city_id: ds?.pickup_city_id ?? null,
          driving_session_delivery_city_id: ds?.delivery_city_id ?? null,
          driving_session_updated_at: ds?.updated_at ?? null,
          // provide normalized status used by UI split logic
          computed_status: normalizedStatus,
          pickup_started_at: row.pickup_started_at ?? row.driving_session_started_at ?? null,
          // retain assignment id for cancellation flows so we can reference server-side resource
          assignment_id: row.id ?? null,
          // logos left null until we introduce a safe separate company fetch
          origin_client_company_logo: null,
          destination_client_company_logo: null,
          // computed deadline expired flag (client-side)
          is_deadline_expired: isDeadlineExpired,
        } as JobRow
      })

      setJobs(mapped)
    } catch (e: any) {
      setError(e.message ?? String(e))
      setJobs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.company_id])

  /**
   * handleOpenConfirm
   *
   * Ensure the selected driver is persisted into the assignment_previews row
   * (driver_id) before opening the confirmation modal so finalize flows can
   * read who was assigned.
   *
   * @param job JobRow - the job user wants to accept/confirm
   */
  async function handleOpenConfirm(job: JobRow) {
    // Try to read the selected driver id from staging UI state.
    const selectedDriverId = localStorage.getItem('staging_selected_driver') ?? null

    const previewId = (job as any)?.assignment_preview_id ?? (job as any)?.preview_id ?? null

    if (previewId && selectedDriverId) {
      try {
        const API_BASE = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'
        const SUPABASE_ANON_KEY =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

        const res = await fetch(
          `${API_BASE}/rest/v1/assignment_previews?id=eq.${encodeURIComponent(previewId)}`,
          {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify({ driver_id: selectedDriverId }),
          }
        )

        if (!res.ok) {
          console.debug('[MyJobs] Failed to update assignment_previews driver_id:', await res.text())
        }
      } catch (e) {
        console.debug('[MyJobs] Exception updating preview driver', e)
      }
    } else {
      if (!previewId) console.debug('[MyJobs] No preview id present on job; skipping driver persist')
      if (!selectedDriverId) console.debug('[MyJobs] No selected driver id found in staging state; skipping persist')
    }

    setSelectedJob(job)
    setConfirmOpen(true)
  }

  /**
   * handleConfirmAccept
   *
   * Called when the user confirms acceptance in the modal.
   * Currently performs a UI update (removes job) to simulate confirmation.
   *
   * @param truckId string - optional truck id entered by user in modal
   */
  async function handleConfirmAccept(truckId: string) {
    if (!selectedJob) return

    // TODO: Persist changes via API (job_assignments update) if desired.
    setJobs((s) => s.filter((j) => j.id !== selectedJob.id))

    setSuccessMessage(
      `Confirmed: ${selectedJob.origin_city_name ?? '—'} → ${selectedJob.destination_city_name ?? '—'} (${selectedJob.transport_mode ?? '—'})`
    )

    setConfirmOpen(false)
    setSelectedJob(null)

    window.setTimeout(() => setSuccessMessage(null), 5000)
  }

  /**
   * handleCancelLoad
   *
   * Cancel a previously accepted job. This is a local UI action (removes job)
   * and shows a temporary success message. Replace with API call if persistence is needed.
   *
   * @param job JobRow - job to cancel
   */
  function handleCancelLoad(job: JobRow) {
    setJobs((s) => s.filter((j) => j.id !== job.id))
    setSuccessMessage(`Cancelled load: ${job.origin_city_name ?? '—'} → ${job.destination_city_name ?? '—'}`)
    window.setTimeout(() => setSuccessMessage(null), 5000)
  }

  /**
   * openCancelModal
   *
   * Open the cancel confirmation modal for a job. Attempts to fetch an estimated
   * penalty from the API using the assignment_id when available. If the penalty
   * cannot be fetched it will remain unknown (displayed as '—').
   *
   * @param job JobRow - job user wants to cancel
   */
  async function openCancelModal(job: JobRow) {
    setCancelJob(job)
    setCancelPenalty(null)
    setCancelOpen(true)

    // Attempt to fetch a server-side penalty using the assignment id when available.
    try {
      const API_BASE = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'
      const SUPABASE_ANON_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

      // Prefer explicit assignment_id if present, otherwise fallback to job.id
      const assignmentId = (job as any)?.assignment_id ?? job.id
      if (!assignmentId) return

      // This endpoint may not exist on all instances. Try job_assignments select as a best-effort.
      const url = `${API_BASE}/rest/v1/job_assignments?id=eq.${encodeURIComponent(assignmentId)}&select=accepted_at`
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      })
      if (!res.ok) {
        // Non-fatal: simply leave penalty unknown.
        console.debug('[MyJobs] penalty fetch failed', await res.text())
        return
      }
      const rows = (await res.json()) as any[]
      if (!rows || rows.length === 0) return
      const acceptedAt = rows[0].accepted_at ? Date.parse(String(rows[0].accepted_at)) : null
      if (!acceptedAt) {
        setCancelPenalty(null)
        return
      }

      // Compute a simple estimated penalty heuristic:
      // - <=12 hours: 0
      // - >12h: base 100 * min(1.2, 0.01 * hours_since)
      const hours = (Date.now() - acceptedAt) / (1000 * 60 * 60)
      if (hours <= 12) {
        setCancelPenalty(0)
      } else {
        const pct = Math.min(1.2, 0.01 * Math.floor(hours))
        const estimatedBase = 100 // lightweight placeholder base amount (server should compute real value)
        setCancelPenalty(Math.round(estimatedBase * pct * 100) / 100)
      }
    } catch (e) {
      console.debug('[MyJobs] Exception fetching penalty', e)
    }
  }

  /**
   * handleConfirmCancel
   *
   * Called when the user confirms cancellation in the penalty modal. Performs
   * optional server call (non-blocking) and updates UI by removing the job.
   *
   * @returns Promise<void>
   */
  async function handleConfirmCancel() {
    if (!cancelJob) return
    setCancelLoading(true)

    try {
      // Attempt to notify server about cancellation - best-effort only.
      try {
        const API_BASE = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'
        const SUPABASE_ANON_KEY =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

        const assignmentId = (cancelJob as any)?.assignment_id ?? cancelJob.id
        if (assignmentId) {
          // Example: PATCH job_assignments to set status=cancelled - adapt if your backend provides a specific RPC.
          await fetch(`${API_BASE}/rest/v1/job_assignments?id=eq.${encodeURIComponent(assignmentId)}`, {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify({ status: 'cancelled' }),
          })
        }
      } catch (e) {
        // Non-fatal - continue with UI update.
        console.debug('[MyJobs] server cancellation attempt failed', e)
      }

      // Local UI update
      handleCancelLoad(cancelJob)
    } finally {
      setCancelLoading(false)
      setCancelOpen(false)
      setCancelJob(null)
      setCancelPenalty(null)
    }
  }

  // Split into Waiting, Active and hide cancelled/completed
  const { waitingJobs, activeJobs } = useMemo(() => {
    const wait: JobRow[] = []
    const active: JobRow[] = []

    for (const j of jobs) {
      // computed_status was set during mapping: prefers driving_sessions.phase.
      const status = (j as any)?.computed_status ?? (j.status ?? '').toString().toLowerCase()

      // Waiting: only 'assigned'
      if (status === 'assigned') {
        wait.push(j)
        continue
      }

      // Hidden: completed or cancelled
      if (status === 'completed' || status === 'cancelled') {
        continue
      }

      // Active: everything else (driving phases such as "to pickup", "loading", "to delivery", "unloading", etc.)
      active.push(j)
    }

    return { waitingJobs: wait, activeJobs: active }
  }, [jobs])

  const content = (
    <div className="flex flex-col gap-4">
      {loading && <div className="text-sm text-slate-500">Loading jobs…</div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {!loading && jobs.length === 0 && !error && <div className="text-sm text-slate-500">No jobs found.</div>}

      {/* Waiting section: assignments with status === 'assigned' and NOT started */}
      <SectionBox title="Waiting" subtitle="Assignments awaiting confirmation (status: assigned)" count={waitingJobs.length}>
        {waitingJobs.length === 0 ? (
          <div className="text-sm text-slate-500">No waiting jobs.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {waitingJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onAccept={(j) => {
                  handleOpenConfirm(j)
                }}
                onView={() => {}}
                variant="waiting"
                actionsVariant="my-jobs"
                onCancel={(j) => {
                  openCancelModal(j)
                }}
              />
            ))}
          </div>
        )}
      </SectionBox>

      {/* Active section: all assignments except waiting (includes started driving) */}
      <SectionBox title="Active" subtitle="Active assignments (authoritative: driving_sessions.phase)" count={activeJobs.length}>
        {activeJobs.length === 0 ? (
          <div className="text-sm text-slate-500">No active jobs.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onAccept={(j) => {
                  handleOpenConfirm(j)
                }}
                onView={() => {}}
                variant="active"
                actionsVariant="my-jobs"
                onCancel={(j) => {
                  openCancelModal(j)
                }}
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

        <ConfirmAcceptModal open={confirmOpen} job={selectedJob} onClose={() => setConfirmOpen(false)} onConfirm={handleConfirmAccept} />

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