/**
 * Market.tsx
 *
 * Market page showing available job offers.
 *
 * Responsibilities:
 * - Fetch job offers from GET /api/jobs
 * - Allow filtering, sorting and basic selection
 * - Allow accepting a job via POST /api/jobs/{job_id}/accept
 *
 * Notes:
 * - This UI is client-only; server-side validation / atomic operations should
 *   be implemented server-side in production.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import FilterBar, { MarketFilters } from '../components/market/FilterBar'
import JobCard, { JobRow } from '../components/market/JobCard'
import AcceptModal from '../components/market/AcceptModal'
import { useAuth } from '../context/AuthContext'

/**
 * fetchJobs
 *
 * Fetch open jobs from the backend API.
 *
 * @returns an array of JobRow
 */
async function fetchJobs(): Promise<JobRow[]> {
  const res = await fetch('/api/jobs')
  if (!res.ok) {
    throw new Error(`Failed to fetch jobs: ${res.status}`)
  }
  const data = await res.json()
  return data as JobRow[]
}

/**
 * acceptJobRequest
 *
 * Calls the accept endpoint for a job.
 *
 * @param jobId - id of the job to accept
 * @param userId - id of the accepting user
 * @param truckId - truck id string (may be empty)
 */
async function acceptJobRequest(jobId: string, userId: string, truckId?: string) {
  const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/accept`, {
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
 * Main page component for the Market.
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
   */
  function jobBestReward(j: JobRow) {
    return Math.max(j.reward_trailer_cargo ?? 0, j.reward_load_cargo ?? 0)
  }

  /**
   * Apply filters and sorting locally.
   */
  const filteredSortedJobs = useMemo(() => {
    const out = jobs.filter((j) => {
      // min reward
      if (filters.minReward !== null) {
        if (jobBestReward(j) < filters.minReward) return false
      }
      // max distance
      if (filters.maxDistance !== null) {
        const d = j.distance_km ?? 0
        if (d > filters.maxDistance) return false
      }
      // transport mode
      if (filters.transportMode !== 'all' && j.transport_mode !== filters.transportMode) return false
      // cargo type
      if (filters.cargoType !== 'all') {
        if ((j.cargo_type ?? j.cargo_item ?? '').toLowerCase() !== filters.cargoType.toLowerCase()) return false
      }
      return true
    })

    // sort
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
   */
  function onAccept(job: JobRow) {
    setActionError(null)
    setAcceptingJobId(job.id)
  }

  /**
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
      // remove job from local list
      setJobs((prev) => prev.filter((j) => j.id !== jobId))
      setSuccessMessage('Job accepted')
    } catch (err: any) {
      console.error(err)
      setActionError(err?.message ?? 'Failed to accept job')
    } finally {
      setAcceptingJobId(null)
      // clear success message after a short delay
      setTimeout(() => setSuccessMessage(null), 3500)
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Market – Available Jobs</h1>
            <p className="text-sm text-slate-600 mt-1">Browse open job offers and accept ones that fit your trucks.</p>
          </div>
        </header>

        <section>
          <FilterBar filters={filters} cargoTypes={cargoTypes} onChange={setFilters} />
        </section>

        <section>
          {loading && <div className="p-6 bg-white rounded shadow text-center text-slate-600">Loading jobs…</div>}
          {error && <div className="p-4 bg-rose-50 border border-rose-100 rounded text-rose-700">Error: {error}</div>}
          {actionError && <div className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-700">{actionError}</div>}
          {successMessage && <div className="p-3 bg-emerald-50 border border-emerald-100 rounded text-emerald-700">{successMessage}</div>}

          {!loading && !error && filteredSortedJobs.length === 0 && (
            <div className="p-6 bg-white rounded shadow text-center text-slate-500">No matching job offers at the moment.</div>
          )}

          <div className="space-y-3">
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