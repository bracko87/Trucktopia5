/**
 * Trucks.tsx
 *
 * Trucks management page.
 *
 * Page component that fetches user_trucks (RLS enforces owner access) and
 * includes the related truck_models in the same REST select so the client
 * receives both sources in a single request. Frontend does NOT duplicate
 * ownership filtering – rely on backend RLS only.
 */

import React, { useEffect, useState, useMemo } from 'react'
import Layout from '../components/Layout'
import TrucksList from '../components/trucks/TrucksList'
import type { PublicTruck } from '../lib/db/modules/publicTrucks'
import { supabaseFetch } from '../lib/supabaseController'
import TrucksFilter from '../components/trucks/TrucksFilter'

/**
 * TrucksPage
 *
 * Page component that fetches user_trucks joined with truck_models using a
 * single REST select so both row-level data (user_trucks) and model reference
 * data (truck_models) are available to TruckCard without additional requests.
 *
 * Important rules implemented here:
 * - Do not add client-side owner_user_id filtering; RLS enforces ownership.
 * - Use a single .select() with join to truck_models.
 *
 * @returns JSX.Element
 */
export default function TrucksPage(): JSX.Element {
  /**
   * navigate
   *
   * Lightweight navigation helper that updates the window hash.
   *
   * @param path - target path (e.g. "/new-trucks-market")
   */
  const navigate = (path: string) => {
    const normalized = path.startsWith('#') ? path : `#${path}`
    if (typeof window !== 'undefined') {
      window.location.hash = normalized
    }
  }

  const [trucks, setTrucks] = useState<PublicTruck[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  /**
   * loadTrucks
   *
   * Fetch user_trucks rows joined with truck_models using a single REST select.
   * Do NOT apply client-side owner filters; rely on row-level security on server.
   */
  async function loadTrucks() {
    setLoading(true)
    setError(null)
    try {
      // Single select that returns user_trucks plus embedded truck_models (array)
      // No owner_user_id or auth checks performed here – backend RLS restricts results.
      const qs = encodeURI(`/rest/v1/user_trucks?select=*,truck_models:truck_models!user_trucks_master_truck_id_fkey(*)&order=created_at.desc&limit=500`)
      const res = await supabaseFetch(qs)

      if (!res) {
        setError('No response from backend.')
        setTrucks([])
        setLoading(false)
        return
      }

      if (typeof res.status === 'number' && (res.status < 200 || res.status >= 300)) {
        // surface a simple message to UI
        // eslint-disable-next-line no-console
        console.debug('user_trucks fetch failed', res)
        setError('Failed to load trucks (server error).')
        setTrucks([])
        setLoading(false)
        return
      }

      // Expect an array of user_trucks. Each item may contain a `truck_models` array
      // with a single element if the join succeeded.
      const rows: PublicTruck[] = Array.isArray(res.data) ? res.data : []
      setTrucks(rows)
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('TrucksPage loadTrucks error:', err)
      setError('Failed to load trucks.')
      setTrucks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrucks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * filteredTrucks
   *
   * Compute client-side filtered list based on searchTerm and statusFilter.
   * Do not attempt to re-filter by ownership here.
   */
  const filteredTrucks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return trucks.filter((t) => {
      // Status filter
      if (statusFilter) {
        const s = ((t.status as unknown as string) ?? '').toLowerCase()
        if (s !== statusFilter) return false
      }

      if (!q) return true

      // Search by name, registration or id
      const name = ((t as any).name ?? '').toString().toLowerCase()
      const reg = ((t as any).registration ?? '').toString().toLowerCase()
      const id = (t.id ?? '').toString().toLowerCase()
      // Also include joined model fields in search
      const modelName = ((t.truck_models && t.truck_models[0] && (t.truck_models[0].model ?? t.truck_models[0].make)) ?? '')
        .toString()
        .toLowerCase()
      return name.includes(q) || reg.includes(q) || id.includes(q) || modelName.includes(q)
    })
  }, [trucks, searchTerm, statusFilter])

  return (
    // Request full width layout so the white section and cards can expand
    <Layout fullWidth>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Trucks</h1>
            <p className="text-sm text-slate-500">All trucks owned or leased by your company</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                navigate('/new-trucks-market')
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-sm"
            >
              Purchase new truck
            </button>

            <button
              onClick={async () => {
                await loadTrucks()
              }}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded shadow-sm"
            >
              Purchase used truck
            </button>
          </div>
        </header>

        <section className="bg-white p-6 rounded-lg shadow-sm w-full">
          {/* Search + filter form */}
          <TrucksFilter
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            statusValue={statusFilter}
            onStatusChange={setStatusFilter}
            onRefresh={loadTrucks}
          />

          {loading ? (
            <div className="text-sm text-slate-500">Loading trucks…</div>
          ) : error ? (
            <div className="text-sm text-rose-600">{error}</div>
          ) : filteredTrucks.length === 0 ? (
            <div className="text-sm text-slate-500">No trucks found for your account.</div>
          ) : (
            <div className="max-w-full">
              <TrucksList trucks={filteredTrucks} />
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
