/**
 * ActiveAssignments.tsx
 *
 * Loads active job assignments for the current user's company and renders them
 * in a compact list. This version avoids querying driving_sessions (which may
 * not exist in some backends) and does not request non-existent columns like
 * `accepted_at` when selecting job_assignments.
 *
 * File-level notes:
 * - Uses created_at as ordering timestamp for job_assignments.
 * - Uses the job_assignments.status field as the source of truth for "phase".
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import JobCard from '../market/JobCard'

const API_BASE = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

/**
 * JobRow
 *
 * Minimal shape used by this component.
 */
interface JobRow {
  id: string
  assignment_id?: string
  pickup_time?: string | null
  delivery_deadline?: string | null
  transport_mode?: string | null
  distance_km?: number | null
  weight_kg?: number | null
  remaining_payload?: number | null
  reward_load_cargo?: number | null
  reward_trailer_cargo?: number | null
  origin_city_name?: string | null
  destination_city_name?: string | null
  origin_country_code?: string | null
  destination_country_code?: string | null
  cargo_type?: string | null
  cargo_item?: string | null
  status?: string | null
  assignment_status?: string | null
  driving_session_phase?: string | null
  [k: string]: any
}

/**
 * normalizePhase
 *
 * Normalize DB phase/status values to uppercase underscore form used elsewhere.
 */
function normalizePhase(raw: any): string {
  if (!raw) return ''
  return String(raw).trim().toUpperCase().replace(/\s+/g, '_')
}

/**
 * isActivePhaseOrStatus
 *
 * Consider non-terminal phases as active. Uses a small terminal set.
 */
function isActivePhaseOrStatus(raw: any): boolean {
  const p = normalizePhase(raw)
  if (!p) return false
  const done = new Set(['COMPLETED', 'DELIVERED', 'CANCELLED', 'FAILED'])
  return !done.has(p)
}

/**
 * resolveCompanyIdFromAuth
 *
 * Best-effort attempt to find the app company_id for the currently logged-in auth user.
 * Falls back to calling public users REST endpoint.
 */
async function resolveCompanyIdFromAuth(user: any): Promise<string | null> {
  if (user?.company_id) return String(user.company_id)

  const session = await supabase.auth.getSession()
  const authUserId = session.data.session?.user?.id
  const token = session.data.session?.access_token
  if (!authUserId || !token) return null

  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}` }

  for (const field of ['auth_user_id', 'id'] as const) {
    const url = `${API_BASE}/rest/v1/users?select=company_id&${field}=eq.${encodeURIComponent(
      authUserId
    )}&limit=1`
    const r = await fetch(url, { headers })
    if (!r.ok) continue
    const rows = await r.json().catch(() => [])
    const companyId = Array.isArray(rows) ? rows[0]?.company_id : null
    if (companyId) return String(companyId)
  }

  return null
}

/**
 * ActiveAssignments
 *
 * Main exported component.
 */
export default function ActiveAssignments(): JSX.Element {
  const { user } = useAuth()
  const [activeJobs, setActiveJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugHint, setDebugHint] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      setLoading(true)
      setError(null)
      setDebugHint(null)

      try {
        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token
        if (!token) throw new Error('Not logged in')

        const companyId = await resolveCompanyIdFromAuth(user)
        if (!companyId) throw new Error('No company linked to this user')

        const headers = { apikey: ANON_KEY, Authorization: `Bearer ${token}` }

        // Request job_assignments with nested job_offer info.
        // Note: we DO NOT request `accepted_at` (some schemas don't include it).
        const jaUrl =
          `${API_BASE}/rest/v1/job_assignments` +
          `?carrier_company_id=eq.${encodeURIComponent(companyId)}` +
          `&select=id,status,job_offer:job_offer_id(` +
          `id,transport_mode,pickup_time,delivery_deadline,distance_km,weight_kg,remaining_payload,` +
          `reward_load_cargo,reward_trailer_cargo,` +
          `origin_city:origin_city_id(city_name,country_code),` +
          `destination_city:destination_city_id(city_name,country_code),` +
          `cargo_type_obj:cargo_type_id(name),` +
          `cargo_item_obj:cargo_item_id(name)` +
          `)` +
          `&order=created_at.desc`

        const jaRes = await fetch(jaUrl, { headers })
        if (!jaRes.ok) throw new Error(await jaRes.text())
        const jaRows = (await jaRes.json().catch(() => [])) as any[]

        if (jaRows.length === 0) {
          setDebugHint(
            'No rows returned from job_assignments. If you KNOW assignments exist, this is almost certainly an RLS SELECT policy issue on job_assignments.'
          )
          if (mounted) setActiveJobs([])
          return
        }

        const mapped: JobRow[] = jaRows
          .map((row) => {
            const offer = row.job_offer ?? {}
            // We don't have driving_sessions here; use assignment status as phase.
            const phaseOrStatus = row.status ?? null

            return {
              id: offer.id,
              assignment_id: row.id,
              pickup_time: offer.pickup_time ?? null,
              delivery_deadline: offer.delivery_deadline ?? null,
              transport_mode: offer.transport_mode ?? null,
              distance_km: offer.distance_km ?? null,
              weight_kg: offer.weight_kg ?? null,
              remaining_payload: offer.remaining_payload ?? offer.weight_kg ?? null,
              reward_load_cargo: offer.reward_load_cargo ?? null,
              reward_trailer_cargo: offer.reward_trailer_cargo ?? null,
              origin_city_name: offer.origin_city?.city_name ?? null,
              destination_city_name: offer.destination_city?.city_name ?? null,
              origin_country_code: offer.origin_city?.country_code ?? null,
              destination_country_code: offer.destination_city?.country_code ?? null,
              cargo_type: offer.cargo_type_obj?.name ?? null,
              cargo_item: offer.cargo_item_obj?.name ?? null,
              status: row.status ?? null,
              assignment_status: phaseOrStatus,
              driving_session_phase: null,
            } as JobRow
          })
          .filter((j) => isActivePhaseOrStatus(j.assignment_status ?? j.status))

        if (mounted) setActiveJobs(mapped)
      } catch (e: any) {
        if (mounted) {
          setActiveJobs([])
          setError(e?.message ?? 'Failed to load active assignments')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [user?.id, user?.company_id])

  if (loading) return <div className="text-sm text-slate-500">Loading active assignments…</div>
  if (error) return <div className="text-sm text-rose-600">{error}</div>

  if (activeJobs.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-slate-500">No active assignments.</div>
        {debugHint && <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">{debugHint}</div>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {activeJobs.map((job: any) => (
        <JobCard
          key={`${job.id}-${job.assignment_id ?? ''}`}
          job={job}
          variant="active"
          actionsVariant="my-jobs"
          onAccept={() => {}}
          onView={() => {}}
        />
      ))}
    </div>
  )
}
