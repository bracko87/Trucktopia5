/**
 * NewTrucksMarket.tsx
 *
 * Page that shows the marketplace for new trucks. Fetches entries from the
 * public.truck_models table and renders them using the same TrucksList/TruckCard
 * layout used on the Trucks page. Model rows are transformed into the shape
 * expected by the list components so the UI is consistent.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import TrucksList from '../components/trucks/TrucksList'
import TrucksFilter from '../components/trucks/TrucksFilter'
import { supabaseFetch } from '../lib/supabase'

/**
 * TruckModelRow
 *
 * Basic shape of a truck_models row (partial). Kept minimal to avoid over-typing.
 */
interface TruckModelRow {
  id: string
  make?: string | null
  model?: string | null
  country?: string | null
  year?: number | null
  [k: string]: any
}

/**
 * MarketListRow
 *
 * Shape used by the TrucksList. We create a lightweight wrapper around a
 * truck model to make it compatible with TruckCard/TrucksList while keeping
 * items clearly identified as market listings via an id prefix.
 */
interface MarketListRow {
  id: string // "model-<truck_model_id>"
  master_truck_id?: string | null
  name?: string | null
  registration?: string | null
  status?: string | null
  mileage_km?: number | null
  condition_score?: number | null
  make?: string | null
  model?: string | null
  country?: string | null
  year?: number | null
  [k: string]: any
}

/**
 * NewTrucksMarketPage
 *
 * Renders a searchable / filterable list of available new truck models pulled
 * from the truck_models table. Each model is mapped into a MarketListRow so the
 * existing TrucksList and TruckCard components can render them with minimal changes.
 *
 * @returns JSX.Element
 */
export default function NewTrucksMarketPage(): JSX.Element {
  const [items, setItems] = useState<MarketListRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Search and filter state (same UI as Trucks)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  /**
   * loadModels
   *
   * Fetch truck model rows from public.truck_models and map them to the list row
   * shape used by the TrucksList. Use a conservative select (*) so missing
   * optional columns won't cause a failing request.
   */
  async function loadModels() {
    setLoading(true)
    setError(null)
    try {
      // Use select=* to avoid selecting non-existent columns which can cause errors
      const res = await supabaseFetch(`/rest/v1/truck_models?select=*&order=make.asc,model.asc&limit=500`)
      // When supabaseFetch returns an HTTP-style object check for status/data
      if (!res) {
        setError('No response from backend.')
        setItems([])
        return
      }
      if (typeof res.status === 'number' && (res.status < 200 || res.status >= 300)) {
        // Log backend error for debugging and surface a simple message to UI
        // eslint-disable-next-line no-console
        console.debug('truck_models fetch failed', res)
        setError('Failed to load market listings (server error).')
        setItems([])
        return
      }
      const rows: TruckModelRow[] = Array.isArray(res.data) ? res.data : []
      const mapped: MarketListRow[] = rows.map((r) => {
        const displayName = [r.make, r.model].filter(Boolean).join(' ') || `${r.model ?? r.make ?? 'Model'}`
        return {
          id: `model-${r.id}`,
          master_truck_id: r.id,
          name: displayName,
          registration: null, // market items are not yet purchased -> no registration
          status: 'available',
          mileage_km: 0,
          condition_score: 100,
          make: r.make ?? null,
          model: r.model ?? null,
          country: r.country ?? null,
          year: r.year ?? null,
          // pass through any other fields if present
          ...r,
        }
      })
      setItems(mapped)
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to load truck models for market', err)
      setError('Failed to load market listings.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * filteredItems
   *
   * Applies client-side search and simple status filter to the market items.
   */
  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return items.filter((t) => {
      if (statusFilter) {
        const s = ((t.status as unknown as string) ?? '').toLowerCase()
        if (s !== statusFilter) return false
      }
      if (!q) return true
      const name = ((t as any).name ?? '').toString().toLowerCase()
      const model = ((t as any).model ?? '').toString().toLowerCase()
      const id = (t.id ?? '').toString().toLowerCase()
      return name.includes(q) || model.includes(q) || id.includes(q)
    })
  }, [items, searchTerm, statusFilter])

  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">New trucks Market</h1>
            <p className="text-sm text-slate-500">Browse and purchase new truck models available for your company</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                await loadModels()
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-sm"
            >
              Refresh listings
            </button>

            <button
              onClick={async () => {
                // keep parity with the Trucks page behaviour (opens filter UI in that page)
                await loadModels()
              }}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded shadow-sm"
            >
              Filter options
            </button>
          </div>
        </header>

        <section className="bg-white p-6 rounded-lg shadow-sm w-full">
          <TrucksFilter
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            statusValue={statusFilter}
            onStatusChange={setStatusFilter}
            onRefresh={loadModels}
          />

          {loading ? (
            <div className="text-sm text-slate-500">Loading market listings…</div>
          ) : error ? (
            <div className="text-sm text-rose-600">{error}</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-sm text-slate-500">No trucks found.</div>
          ) : (
            <div className="max-w-full">
              <TrucksList trucks={filteredItems} />
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}