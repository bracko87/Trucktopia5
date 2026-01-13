/**
 * Market.tsx
 *
 * Market page showing available job offers.
 *
 * Uses a smart API_BASE resolver to call the correct backend depending on the
 * runtime host, and shares the same page layout/template as the Trucks page
 * (full width layout, white card sections, header style).
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import FilterBar, { MarketFilters } from '../components/market/FilterBar'
import JobCard, { JobRow } from '../components/market/JobCard'
import AcceptModal from '../components/market/AcceptModal'
import { useAuth } from '../context/AuthContext'

/**
 * API_BASE
 *
 * Smart base URL selection for the backend API based on runtime hostname.
 * - Local dev (localhost) → http://localhost:8888
 * - Netlify frontend (trucktopia5.netlify.app) → https://www.trucktopi.org
 * - Sider editor (sider.ai) → https://www.trucktopi.org
 * - Fallback → https://www.trucktopi.org
 */
const API_BASE: string = (() => {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'development' ? 'http://localhost:8888' : 'https://www.trucktopi.org'
  }

  const host = window.location.hostname

  if (host.includes('localhost')) return 'http://localhost:8888'
  if (host.includes('trucktopia5.netlify.app')) return 'https://www.trucktopi.org'
  if (host.includes('sider.ai')) return 'https://www.trucktopi.org'

  return 'https://www.trucktopi.org'
})()

/**
 * fetchJobs
 *
 * Fetch open jobs from the backend API using the resolved API_BASE.
 *
 * @returns Promise<JobRow[]>
 */
async function fetchJobs(): Promise<JobRow[]> {
  const res = await fetch(`${API_BASE}/api/jobs`)
  if (!res.ok) {
    throw new Error(`Failed to fetch jobs: ${res.status}`)
  }
  const data = await res.json()
  return data as JobRow[]
}

/**
 * acceptJobRequest
 *
 * Calls the accept endpoint for a job on the chosen backend.
 *
 * @param jobId - id of the job to accept
 * @param userId - id of the accepting user
 * @param truckId - optional truck id string
 */
async function acceptJobRequest(jobId: string, userId: string, truckId?: string) {
  const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, truck_id: truckId ?? null }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Accept failed: ${res.status} ${txt}`)
  }
  return res.json().catch(() => null)
}

/**
 * MarketPage
 *
 * Main page component for the Market. Uses the same layout/template style
 * as the Trucks page (fullWidth Layout, white card filter area, consistent
 * header).
 *
 * @returns JSX.Element
 */
export default function MarketPage(): JSX.Element {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<MarketFilters>({
    minReward: null,
    maxDistance: null,
    transportMode: 'all',
    cargoType: 'all',
    sortBy: 'reward_desc',
  })

  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchJobs()
        if (!mounted) return
        setJobs(data)
      } catch (err: any) {
        console.error(err)
        if (!mounted) return
        setError(err?.message ?? 'Failed to load jobs')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  /**
   * Derived list of available cargo types for the cargo type dropdown.
   */
  const cargoTypes = useMemo(() => {
    const set = new Set<string>()
    for (const j of jobs) {
      if (j.cargo_type) set.add(j.cargo_type)
    }
    return Array.from(set)
  }, [jobs])

  /**
   * Helper: compute numeric "best reward" for a job used for filtering/sorting.
   *
   * @param j - job row
   */
  function jobBestReward(j: JobRow) {
    return Math.max(j.reward_trailer_cargo ?? 0, j.reward_load_cargo ?? 0)
  }

  /**
   * Apply filters and sorting locally.
   */
  const filteredSortedJobs = useMemo(() => {
    const out = jobs.filter((j) => {
      if (filters.minReward !== null) {
        if (jobBestReward(j) < filters.minReward) return false
      }
      if (filters.maxDistance !== null) {
        const d = j.distance_km ?? 0
        if (d > filters.maxDistance) return false
      }
      if (filters.transportMode !== 'all' && j.transport_mode !== filters.transportMode) return false
      if (filters.cargoType !== 'all') {
        if ((j.cargo_type ?? j.cargo_item ?? '').toLowerCase() !== filters.cargoType.toLowerCase()) return false
      }
      return true
    })

    out.sort((a, b) => {
      switch (filters.sortBy) {
        case 'reward_desc':
          return jobBestReward(b) - jobBestReward(a)
        case 'reward_asc':
          return jobBestReward(a) - jobBestReward(b)
        case 'distance_asc':
          return (a.distance_km ?? 0) - (b.distance_km ?? 0)
        case 'distance_desc':
          return (b.distance_km ?? 0) - (a.distance_km ?? 0)
        case 'deadline_soonest': {
          const da = a.delivery_deadline ? new Date(a.delivery_deadline).getTime() : Infinity
          const db = b.delivery_deadline ? new Date(b.delivery_deadline).getTime() : Infinity
          return da - db
        }
        default:
          return 0
      }
    })

    return out
  }, [jobs, filters])

  /**
   * onAccept
   *
   * Trigger accept modal for a job.
   *
   * @param job - JobRow selected
   */
  function onAccept(job: JobRow) {
    setActionError(null)
    setAcceptingJobId(job.id)
  }

  /**
   * confirmAccept
   *
   * Confirm accept flow: call API and remove job from list on success.
   *
   * @param truckId - truck id provided by user
   */
  async function confirmAccept(truckId: string) {
    setActionError(null)
    setSuccessMessage(null)
    if (!user) {
      setActionError('Please log in to accept jobs')
      setAcceptingJobId(null)
      return
    }
    const jobId = acceptingJobId
    if (!jobId) {
      setActionError('No job selected')
      return
    }
    try {
      await acceptJobRequest(jobId, user.id, truckId || undefined)
      setJobs((prev) => prev.filter((j) => j.id !== jobId))
      setSuccessMessage('Job accepted')
    } catch (err: any) {
      console.error(err)
      setActionError(err?.message ?? 'Failed to accept job')
    } finally {
      setAcceptingJobId(null)
      setTimeout(() => setSuccessMessage(null), 3500)
    }
  }

  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Market – Available Jobs</h1>
            <p className="text-sm text-slate-600 mt-1">Browse open job offers and accept ones that fit your trucks.</p>
          </div>
        </header>

        <section className="bg-white p-6 rounded-lg shadow-sm w-full">
          <FilterBar filters={filters} cargoTypes={cargoTypes} onChange={setFilters} />
        </section>

        <section className="bg-white p-6 rounded-lg shadow-sm w-full">
          {loading && <div className="text-sm text-slate-600">Loading jobs…</div>}
          {error && <div className="text-sm text-rose-700">Error: {error}</div>}
          {actionError && <div className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-700">{actionError}</div>}
          {successMessage && <div className="p-3 bg-emerald-50 border border-emerald-100 rounded text-emerald-700">{successMessage}</div>}

          {!loading && !error && filteredSortedJobs.length === 0 && (
            <div className="text-sm text-slate-500">No matching job offers at the moment.</div>
          )}

          <div className="space-y-3 mt-4">
            {filteredSortedJobs.map((job) => (
              <JobCard key={job.id} job={job} onView={() => alert('View details — placeholder')} onAccept={onAccept} />
            ))}
          </div>
        </section>
      </div>

      <AcceptModal
        open={Boolean(acceptingJobId)}
        jobId={acceptingJobId}
        onClose={() => setAcceptingJobId(null)}
        onConfirm={(truckId) => confirmAccept(truckId)}
      />
    </Layout>
  )
}
