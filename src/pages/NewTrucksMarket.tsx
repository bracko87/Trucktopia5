/**
 * NewTrucksMarket.tsx
 *
 * Page that shows the marketplace for new trucks. Fetches entries from the
 * public.truck_models table and renders them using the same TrucksList/TruckCard
 * layout used on the Trucks page. Adds a cargo types legend box below the
 * listings that fetches data from public.cargo_types.
 *
 * This file additionally enforces removal of any injected "Show debug" button
 * nodes from the DOM for this page using a MutationObserver so popup/debug
 * helpers cannot re-insert the button while the page is active.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import TruckModelCard from '../components/trucks/TruckModelCard'
import TrucksFilter from '../components/trucks/TrucksFilter'
import CargoTypesLegend from '../components/trucks/CargoTypesLegend'
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
 * removeDebugButtons
 *
 * Remove any button nodes whose visible text equals "Show debug".
 *
 * This helper intentionally uses trimmed textContent equality to avoid removing
 * unrelated buttons. It returns the number of removed elements for debugging.
 *
 * @returns number removed
 */
function removeDebugButtons(): number {
  const buttons = Array.from(document.querySelectorAll('button'))
  let removed = 0
  buttons.forEach((b) => {
    try {
      const txt = (b.textContent || '').trim()
      if (txt === 'Show debug') {
        b.remove()
        removed += 1
      }
    } catch {
      // ignore
    }
  })
  return removed
}

/**
 * NewTrucksMarketPage
 *
 * Renders a searchable / filterable list of available new truck models pulled
 * from the truck_models table. Each model is mapped into a MarketListRow so the
 * existing TrucksList and TruckCard components can render them with minimal changes.
 *
 * The page now also renders CargoTypesLegend below the trucks listing without
 * changing the existing design/layout.
 *
 * This variant adds simple client-side pagination showing 10 entries per page.
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

  // Pagination state: show 10 items per page
  const ITEMS_PER_PAGE = 10
  const [currentPage, setCurrentPage] = useState<number>(1)

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
      const res = await supabaseFetch(`/rest/v1/truck_models?select=*&order=make.asc,model.asc&limit=500`)
      if (!res) {
        setError('No response from backend.')
        setItems([])
        return
      }
      if (typeof res.status === 'number' && (res.status < 200 || res.status >= 300)) {
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
          registration: null,
          status: 'available',
          mileage_km: 0,
          condition_score: 100,
          make: r.make ?? null,
          model: r.model ?? null,
          country: r.country ?? null,
          year: r.year ?? null,
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
   * DOM cleanup effect
   *
   * Removes any "Show debug" buttons present at mount and watches the document
   * for new nodes so the button cannot be re-inserted (eg by a popup). This
   * avoids touching other components' source code while ensuring the page does
   * not display the debug button.
   */
  useEffect(() => {
    // initial pass
    removeDebugButtons()

    // observe for new buttons being added dynamically and remove them
    const observer = new MutationObserver(() => {
      removeDebugButtons()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
    }
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

  // Reset page when filters/search change so user always sees first page of results
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, items.length])

  // Pagination calculations
  const totalItems = filteredItems.length
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE))
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems)
  const paginatedItems = filteredItems.slice(startIndex, endIndex)

  /**
   * changePage
   *
   * Change current page ensuring bounds.
   *
   * @param page - target page number
   */
  function changePage(page: number) {
    const p = Math.max(1, Math.min(totalPages, page))
    setCurrentPage(p)
    // scroll the listing into view for better UX when changing pages
    const el = document.querySelector('section.bg-white.p-6')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">New trucks Market</h1>
            <p className="text-sm text-slate-500">Browse and purchase new truck models available for your company</p>
          </div>

          <div>
            <a href="#/trucks" className="text-sm text-sky-600 hover:underline">Back to Trucks Page</a>
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
              {/* Render only TruckModelCard for market page to ensure no editable TruckCard appears */}
              <div className="-mx-6 px-6 flex flex-col gap-4 w-full">
                {paginatedItems.map((t) => (
                  <div key={t.id} className="w-full">
                    <TruckModelCard truck={t} defaultName={t.name ?? undefined} defaultRegistration={t.registration ?? undefined} isMarket />
                  </div>
                ))}
              </div>

              {/* Pagination controls */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing <span className="font-medium">{startIndex + 1}</span>–<span className="font-medium">{endIndex}</span> of <span className="font-medium">{totalItems}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className={`px-3 py-1 text-sm rounded border ${currentPage <= 1 ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white hover:bg-slate-100 border-slate-200'}`}
                  >
                    Prev
                  </button>

                  {/* Simple numeric page buttons for up to 7 pages; if many pages show condensed view */}
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const page = idx + 1
                      // show first, last, current, and neighbors; collapse others
                      if (
                        totalPages > 7 &&
                        page !== 1 &&
                        page !== totalPages &&
                        Math.abs(page - currentPage) > 1
                      ) {
                        // render ellipsis for collapsed ranges
                        const shouldShowEllipsis =
                          (page === currentPage - 2 && page > 2) || (page === currentPage + 2 && page < totalPages - 1)
                        return shouldShowEllipsis ? <span key={`e-${page}`} className="px-2 text-sm text-slate-400">…</span> : null
                      }
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => changePage(page)}
                          aria-current={page === currentPage ? 'page' : undefined}
                          className={`px-3 py-1 text-sm rounded border ${page === currentPage ? 'bg-sky-600 text-white border-sky-600' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'}`}
                        >
                          {page}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className={`px-3 py-1 text-sm rounded border ${currentPage >= totalPages ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white hover:bg-slate-100 border-slate-200'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cargo types legend box shown below the listings. Keeps layout intact. */}
          <div className="mt-6">
            <CargoTypesLegend />
          </div>
        </section>
      </div>
    </Layout>
  )
}
