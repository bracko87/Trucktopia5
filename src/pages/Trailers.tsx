/**
 * Trailers.tsx
 *
 * Trailers management page.
 * Mirrors Trucks.tsx behaviour for user_trailers.
 *
 * Enhancements:
 * - Client-side search + multiple filters (status, cargo type, location)
 * - Pagination (10 entries per page)
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { supabaseFetch } from '../lib/supabaseController'
import type { TrailerCardRow } from '../lib/api/trailersApi'
import { mapTrailerRow } from '../lib/api/trailersApi'
import TrailerCard from '../components/trailers/TrailerCard'

const PAGE_SIZE = 10

/**
 * formatStatusLabel
 *
 * Convert status enum-ish values to a nicer UI label.
 */
function formatStatusLabel(value?: string | null): string {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Unknown'
  return raw.replace(/_/g, ' ')
}

/**
 * TrailersPage
 *
 * Page component fetching trailers owned by the user/company.
 * RLS on the backend enforces ownership; we only request rows and render them.
 *
 * @returns JSX.Element
 */
export default function TrailersPage(): JSX.Element {
  const [trailers, setTrailers] = useState<TrailerCardRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Search + filters
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [cargoFilter, setCargoFilter] = useState<string>('')
  const [locationFilter, setLocationFilter] = useState<string>('')

  // Pagination
  const [page, setPage] = useState<number>(1)

  /**
   * loadTrailers
   *
   * Fetch user_trailers rows from Supabase REST endpoint and map into TrailerCardRow.
   */
  async function loadTrailers() {
    setLoading(true)
    setError(null)

    try {
      const qs = encodeURI(
        `/rest/v1/user_trailers?select=*,trailer_models(*),location_city:cities(id,city_name),cargo_type:cargo_types(id,name)&order=created_at.desc&limit=500`
      )

      const res = await supabaseFetch(qs)

      if (!res) {
        setError('No response from backend.')
        setTrailers([])
        setLoading(false)
        return
      }

      if (typeof res.status === 'number' && (res.status < 200 || res.status >= 300)) {
        setError('Failed to load trailers.')
        setTrailers([])
        setLoading(false)
        return
      }

      const rows = Array.isArray(res.data) ? res.data : []
      const mapped: TrailerCardRow[] = rows.map((r: any) => {
        // Use shared mapper to ensure TrailerCardRow shape
        const m = mapTrailerRow(r)
        // keep status on the mapped object for UI display
        ;(m as any).status = r.status ?? (m as any).status
        return m
      })

      // Debug helper
      // eslint-disable-next-line no-console
      console.log('Trailers loaded:', mapped)

      setTrailers(mapped)
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('TrailersPage load error:', err)
      setError(err?.message ? String(err.message) : 'Failed to load trailers.')
      setTrailers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTrailers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Filter options
   */
  const statusOptions = useMemo(() => {
    const vals = new Set<string>()
    trailers.forEach((t) => {
      const s = String((t as any)?.status ?? '').trim()
      if (s) vals.add(s)
    })
    return Array.from(vals).sort((a, b) => a.localeCompare(b))
  }, [trailers])

  const cargoOptions = useMemo(() => {
    const vals = new Set<string>()
    trailers.forEach((t) => {
      const c = String((t as any)?.cargoTypeName ?? '').trim()
      if (c) vals.add(c)
    })
    return Array.from(vals).sort((a, b) => a.localeCompare(b))
  }, [trailers])

  const locationOptions = useMemo(() => {
    const vals = new Set<string>()
    trailers.forEach((t) => {
      const l = String((t as any)?.locationCityName ?? '').trim()
      if (l) vals.add(l)
    })
    return Array.from(vals).sort((a, b) => a.localeCompare(b))
  }, [trailers])

  /**
   * filteredTrailers
   *
   * Apply client-side search over common trailer fields + filters.
   */
  const filteredTrailers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return trailers.filter((t) => {
      const anyT = t as any

      const label = String(t.label ?? '').toLowerCase()
      const id = String(t.id ?? '').toLowerCase()
      const status = String(anyT.status ?? '').toLowerCase()

      const dbName = String(anyT?._raw?.name ?? '').toLowerCase()
      const cargoType = String(anyT?.cargoTypeName ?? '').toLowerCase()
      const locationCity = String(anyT?.locationCityName ?? '').toLowerCase()

      const modelMake = String(anyT?.model?.make ?? '').toLowerCase()
      const modelModel = String(anyT?.model?.model ?? '').toLowerCase()
      const modelCombined = `${modelMake} ${modelModel}`.trim().toLowerCase()

      if (statusFilter && status !== statusFilter.toLowerCase()) return false
      if (cargoFilter && cargoType !== cargoFilter.toLowerCase()) return false
      if (locationFilter && locationCity !== locationFilter.toLowerCase()) return false

      if (!q) return true

      return (
        label.includes(q) ||
        dbName.includes(q) ||
        id.includes(q) ||
        status.includes(q) ||
        cargoType.includes(q) ||
        locationCity.includes(q) ||
        modelMake.includes(q) ||
        modelModel.includes(q) ||
        modelCombined.includes(q)
      )
    })
  }, [trailers, searchTerm, statusFilter, cargoFilter, locationFilter])

  // Reset page when filters/search change
  useEffect(() => {
    setPage(1)
  }, [searchTerm, statusFilter, cargoFilter, locationFilter])

  const totalPages = useMemo(() => {
    const raw = Math.ceil(filteredTrailers.length / PAGE_SIZE)
    return raw > 0 ? raw : 1
  }, [filteredTrailers.length])

  // Clamp page if data shrinks
  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p < 1 ? 1 : p))
  }, [totalPages])

  const pagedTrailers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredTrailers.slice(start, start + PAGE_SIZE)
  }, [filteredTrailers, page])

  const pageNumbers = useMemo(() => {
    const windowSize = 5
    const half = Math.floor(windowSize / 2)

    let start = page - half
    let end = page + half

    if (start < 1) {
      const shift = 1 - start
      start = 1
      end += shift
    }

    if (end > totalPages) {
      const shift = end - totalPages
      end = totalPages
      start -= shift
    }

    if (start < 1) start = 1

    const nums: number[] = []
    for (let i = start; i <= end; i += 1) nums.push(i)
    return nums
  }, [page, totalPages])

  const showingFrom = filteredTrailers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(page * PAGE_SIZE, filteredTrailers.length)

  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Trailers</h1>
          <p className="text-sm text-slate-500">All trailers owned or leased by your company</p>
        </header>

        <section className="bg-white p-6 rounded-lg shadow-sm w-full">
          {/* Search + filters + refresh */}
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <div className="xl:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Search</label>
                <input
                  placeholder="Search trailers, model, cargo, location, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
                >
                  <option value="">All statuses</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {formatStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cargo type</label>
                <select
                  value={cargoFilter}
                  onChange={(e) => setCargoFilter(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
                >
                  <option value="">All cargo types</option>
                  {cargoOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
                >
                  <option value="">All locations</option>
                  {locationOptions.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Showing{' '}
                <span className="font-medium text-slate-700">{showingFrom}</span>–<span className="font-medium text-slate-700">{showingTo}</span>{' '}
                of <span className="font-medium text-slate-700">{filteredTrailers.length}</span> trailers
                <span className="ml-2 text-slate-400">(10 per page)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('')
                    setCargoFilter('')
                    setLocationFilter('')
                    setPage(1)
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded"
                >
                  Clear filters
                </button>

                <button
                  type="button"
                  onClick={() => void loadTrailers()}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">Loading trailers…</div>
          ) : error ? (
            <div className="text-sm text-rose-600">{error}</div>
          ) : filteredTrailers.length === 0 ? (
            <div className="text-sm text-slate-500">No trailers found for your account.</div>
          ) : (
            <>
              <div className="space-y-3">
                {pagedTrailers.map((t) => (
                  <TrailerCard key={t.id} trailer={t} />
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-500">
                  Page <span className="font-medium text-slate-700">{page}</span> of{' '}
                  <span className="font-medium text-slate-700">{totalPages}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>

                  {pageNumbers.length > 0 && pageNumbers[0] > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPage(1)}
                        className="h-9 min-w-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
                      >
                        1
                      </button>
                      {pageNumbers[0] > 2 ? <span className="px-1 text-slate-400">…</span> : null}
                    </>
                  )}

                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`h-9 min-w-9 px-3 rounded-md border text-sm ${
                        n === page
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                      aria-current={n === page ? 'page' : undefined}
                    >
                      {n}
                    </button>
                  ))}

                  {pageNumbers.length > 0 && pageNumbers[pageNumbers.length - 1] < totalPages && (
                    <>
                      {pageNumbers[pageNumbers.length - 1] < totalPages - 1 ? (
                        <span className="px-1 text-slate-400">…</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPage(totalPages)}
                        className="h-9 min-w-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </Layout>
  )
}