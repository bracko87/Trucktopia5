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

interface TruckModelRow {
  id: string
  make?: string | null
  model?: string | null
  country?: string | null
  year?: number | null
  [k: string]: any
}

interface MarketListRow {
  id: string
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
    } catch {}
  })

  return removed
}

export default function NewTrucksMarketPage(): JSX.Element {
  const [items, setItems] = useState<MarketListRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const ITEMS_PER_PAGE = 10
  const [currentPage, setCurrentPage] = useState<number>(1)

  async function loadModels() {
    setLoading(true)
    setError(null)

    try {
      const res = await supabaseFetch(
        `/rest/v1/truck_models?select=*&order=make.asc,model.asc&limit=500`
      )

      if (!res) {
        setError('No response from backend.')
        setItems([])
        return
      }

      if (
        typeof res.status === 'number' &&
        (res.status < 200 || res.status >= 300)
      ) {
        console.debug('truck_models fetch failed', res)
        setError('Failed to load market listings (server error).')
        setItems([])
        return
      }

      const rows: TruckModelRow[] = Array.isArray(res.data)
        ? res.data
        : []

      const mapped: MarketListRow[] = rows.map((r) => {
        const displayName =
          [r.make, r.model].filter(Boolean).join(' ') ||
          `${r.model ?? r.make ?? 'Model'}`

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
      console.error('Failed to load truck models for market', err)
      setError('Failed to load market listings.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModels()
  }, [])

  useEffect(() => {
    removeDebugButtons()

    const observer = new MutationObserver(() => {
      removeDebugButtons()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [])

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return items.filter((t) => {
      if (statusFilter) {
        const s =
          ((t.status as unknown as string) ?? '').toLowerCase()
        if (s !== statusFilter) return false
      }

      if (!q) return true

      const name = ((t as any).name ?? '').toLowerCase()
      const model = ((t as any).model ?? '').toLowerCase()
      const id = (t.id ?? '').toLowerCase()

      return (
        name.includes(q) ||
        model.includes(q) ||
        id.includes(q)
      )
    })
  }, [items, searchTerm, statusFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, items.length])

  const totalItems = filteredItems.length
  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / ITEMS_PER_PAGE)
  )

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = Math.min(
    startIndex + ITEMS_PER_PAGE,
    totalItems
  )

  const paginatedItems = filteredItems.slice(
    startIndex,
    endIndex
  )

  function changePage(page: number) {
    const p = Math.max(1, Math.min(totalPages, page))
    setCurrentPage(p)

    const el = document.querySelector(
      'section.bg-white.p-6'
    )

    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              New trucks Market
            </h1>
            <p className="text-sm text-slate-500">
              Browse and purchase new truck models
              available for your company
            </p>
          </div>

          <div>
            <a
              href="#/trucks"
              className="text-sm text-sky-600 hover:underline"
            >
              Back to Trucks Page
            </a>
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
            <div className="text-sm text-slate-500">
              Loading market listings…
            </div>
          ) : error ? (
            <div className="text-sm text-rose-600">
              {error}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-sm text-slate-500">
              No trucks found.
            </div>
          ) : (
            <div className="w-full">
              <div className="flex flex-col gap-4 w-full">
                {paginatedItems.map((t) => (
                  <div key={t.id} className="w-full">
                    <TruckModelCard
                      truck={t}
                      defaultName={
                        t.name ?? undefined
                      }
                      defaultRegistration={
                        t.registration ?? undefined
                      }
                      isMarket
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing{' '}
                  <span className="font-medium">
                    {startIndex + 1}
                  </span>
                  –
                  <span className="font-medium">
                    {endIndex}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">
                    {totalItems}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      changePage(currentPage - 1)
                    }
                    disabled={currentPage <= 1}
                    className={`px-3 py-1 text-sm rounded border ${
                      currentPage <= 1
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    Prev
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      changePage(currentPage + 1)
                    }
                    disabled={
                      currentPage >= totalPages
                    }
                    className={`px-3 py-1 text-sm rounded border ${
                      currentPage >= totalPages
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <CargoTypesLegend />
          </div>
        </section>
      </div>
    </Layout>
  )
}
