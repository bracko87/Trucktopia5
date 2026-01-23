/**
 * MyJobs.tsx
 *
 * Page that lists job_offers which have been accepted/assigned.
 *
 * Behavior:
 * - Fetches job_offers rows with status = 'assigned' from the public REST endpoint.
 * - Normalizes related origin/destination city and client company fields for display.
 * - Shows a simple list using the existing JobCard component from the market components.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import JobCard, { JobRow } from '../components/market/JobCard'
import { useAuth } from '../context/AuthContext'

/**
 * Supabase REST configuration (uses the same public anon key / base used elsewhere).
 * NOTE: In production move the anon key to a secure environment variable.
 */
const API_BASE = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

/**
 * pickString
 *
 * Safely pick a human-friendly string from a related object by trying common fields.
 *
 * @param obj - related object
 * @returns string or null
 */
function pickString(obj: any): string | null {
  if (!obj) return null
  return (
    obj.name ??
    obj.title ??
    obj.label ??
    obj.display_name ??
    obj.item_name ??
    obj.type ??
    obj.description ??
    null
  )
}

/**
 * pickLogo
 *
 * Safely pick a likely logo/image/url field from a related object.
 *
 * @param obj - related object
 * @returns URL string or null
 */
function pickLogo(obj: any): string | null {
  if (!obj) return null
  return obj.company_image_url ?? obj.logo_url ?? obj.logo ?? obj.image_url ?? obj.icon_url ?? null
}

/**
 * fetchAssignedJobs
 *
 * Fetch job_offers with status = 'assigned' and expand useful related fields.
 *
 * @returns Promise<JobRow[]>
 */
async function fetchAssignedJobs(): Promise<JobRow[]> {
  const select =
    '*,origin_city:origin_city_id(city_name,country_code),' +
    'destination_city:destination_city_id(city_name,country_code),' +
    "origin_company:origin_client_company_id(id,name,company_image_url)," +
    "destination_company:destination_client_company_id(id,name,company_image_url)," +
    'cargo_type_obj:cargo_type_id(*),' +
    'cargo_item_obj:cargo_item_id(*)'

  const fields = [
    'weight_kg',
    'volume_m3',
    'pallets',
    'temperature_control',
    'hazardous',
    'special_requirements',
    'currency',
    'transport_mode',
    'pickup_time',
    'delivery_deadline',
    'destination',
    'reward_trailer_cargo',
    'reward_load_cargo',
    'created_at',
    'id',
    'status',
    'assigned_user_truck_id',
    'posted_by_user_id',
  ]

  const url = `${API_BASE}/rest/v1/job_offers?select=${encodeURIComponent(select + ',' + fields.join(','))}&status=eq.assigned`

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Range: '0-99999',
    },
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Failed to fetch assigned jobs: ${res.status} ${txt}`)
  }

  const data = await res.json()

  return (data as any[]).map((j) => {
    const cargoTypeName = pickString(j.cargo_type_obj)
    const cargoItemName = pickString(j.cargo_item_obj)

    const originCompany = j.origin_company ?? null
    const destinationCompany = j.destination_company ?? null

    return {
      ...j,
      origin_city_name: j.origin_city?.city_name ?? null,
      destination_city_name: j.destination_city?.city_name ?? null,
      origin_country_code: j.origin_city?.country_code ?? null,
      destination_country_code: j.destination_city?.country_code ?? null,
      cargo_type: cargoTypeName ?? null,
      cargo_item: cargoItemName ?? null,
      weight_kg: j.weight_kg ?? null,
      volume_m3: j.volume_m3 ?? null,
      pallets: j.pallets ?? null,
      temperature_control: j.temperature_control ?? false,
      hazardous: j.hazardous ?? false,
      special_requirements: j.special_requirements ?? null,
      currency: j.currency ?? null,
      transport_mode: j.transport_mode ?? null,
      origin_client_company_id: originCompany?.id ?? null,
      origin_client_company_name: originCompany?.name ?? null,
      origin_client_company_logo: pickLogo(originCompany),
      destination_client_company_id: destinationCompany?.id ?? null,
      destination_client_company_name: destinationCompany?.name ?? null,
      destination_client_company_logo: pickLogo(destinationCompany),
      posted_by_user_id: j.posted_by_user_id ?? null,
      reward_trailer_cargo: j.reward_trailer_cargo ?? null,
      reward_load_cargo: j.reward_load_cargo ?? null,
      destination_text: j.destination ?? null,
    } as JobRow
  }) as JobRow[]
}

/**
 * MyJobsPage
 *
 * Renders the list of accepted/assigned jobs. When a user is present the page
 * attempts to fetch assigned jobs and shows them in a single-column list.
 */
export default function MyJobsPage(): JSX.Element {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchAssignedJobs()
        if (!mounted) return
        setJobs(data)
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('MyJobs.load error', err)
        if (!mounted) return
        setError(err?.message ?? 'Failed to load jobs')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    // Always attempt to load — the REST endpoint will return what's allowed.
    load()
    return () => {
      mounted = false
    }
  }, [user])

  const content = useMemo(() => {
    if (loading) return <div className="text-sm text-slate-600">Loading your accepted jobs…</div>
    if (error)
      return (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-700 shadow-sm">
          <strong className="mr-2">Error:</strong> {error}
        </div>
      )
    if (jobs.length === 0)
      return <div className="text-sm text-slate-600">No accepted jobs found. Accepted jobs will appear here.</div>

    return (
      <div className="flex flex-col gap-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} onAccept={() => {}} onView={() => {}} />
        ))}
      </div>
    )
  }, [jobs, loading, error])

  return (
    <Layout fullWidth>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">My Jobs</h1>
          <p className="text-sm text-black/70">Jobs your company accepted and is performing</p>
        </header>

        <section className="bg-white p-6 rounded shadow">{content}</section>
      </div>
    </Layout>
  )
}
