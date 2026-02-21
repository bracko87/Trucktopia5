
/**
 * Trailers.tsx
 *
 * Trailers management page.
 * Mirrors Trucks.tsx behaviour for user_trailers.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { supabaseFetch } from '../lib/supabaseController'
import type { TrailerCardRow } from '../lib/api/trailersApi'
import { mapTrailerRow } from '../lib/api/trailersApi'
import TrailerCard from '../components/trailers/TrailerCard'

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
  const [searchTerm, setSearchTerm] = useState<string>('')

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
        `/rest/v1/user_trailers?select=*,trailer_models(*)&order=created_at.desc&limit=500`
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
        m.status = r.status ?? m.status
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
   * filteredTrailers
   *
   * Apply simple client-side search over common trailer fields.
   */
  const filteredTrailers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return trailers

    return trailers.filter((t) => {
      const label = (t.label ?? '').toString().toLowerCase()
      const id = (t.id ?? '').toString().toLowerCase()
      const status = (t.status ?? '').toString().toLowerCase()

      return label.includes(q) || id.includes(q) || status.includes(q)
    })
  }, [trailers, searchTerm])

  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Trailers</h1>
          <p className="text-sm text-slate-500">All trailers owned or leased by your company</p>
        </header>

        <section className="bg-white p-6 rounded-lg shadow-sm w-full">
          <div className="flex gap-3 mb-4">
            <input
              placeholder="Search trailers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-2 w-80"
            />

            <button
              onClick={() => void loadTrailers()}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">Loading trailers…</div>
          ) : error ? (
            <div className="text-sm text-rose-600">{error}</div>
          ) : filteredTrailers.length === 0 ? (
            <div className="text-sm text-slate-500">No trailers found for your account.</div>
          ) : (
            <div className="space-y-3">
              {filteredTrailers.map((t) => (
                <TrailerCard key={t.id} trailer={t} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
