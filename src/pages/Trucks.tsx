/**
 * Trucks.tsx
 *
 * Trucks management page.
 *
 * Page component that fetches user_trucks (RLS enforces owner access) and
 * includes the related truck_models in the same REST select so the client
 * receives both sources in a single request. Frontend does NOT duplicate
 * ownership filtering – rely on backend RLS only.
 *
 * Enhancements:
 * - Dynamic status filter (supports all provided truck statuses)
 * - Additional client-side filters (cargo type / GCW, current location, hub, class)
 * - Pagination (10 entries per page)
 * - Robust filtering for embedded relation payloads (object or array)
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import TrucksList from '../components/trucks/TrucksList'
import type { PublicTruck } from '../lib/db/modules/publicTrucks'
import { supabaseFetch } from '../lib/supabaseController'

const PAGE_SIZE = 10

const KNOWN_TRUCK_STATUSES: Array<{ code: string; name: string }> = [
  { code: 'BROKEN', name: 'Broken' },
  { code: 'DELIVERING', name: 'Delivering' },
  { code: 'DESTROYED', name: 'Destroyed' },
  { code: 'IDLE', name: 'Idle' },
  { code: 'IN_TRANSIT', name: 'In Transit' },
  { code: 'LOADING', name: 'Loading' },
  { code: 'OUT_OF_SERVICE', name: 'Out of service' },
  { code: 'PICKING_LOAD', name: 'Picking load' },
  { code: 'RELOCATING', name: 'Relocating' },
  { code: 'REPAIRING', name: 'Repairing' },
  { code: 'RETURNING_TO_HUB', name: 'Returning to hub' },
  { code: 'UNLOADING', name: 'Unloading' },
]

/**
 * extractEmbeddedTruckModel
 *
 * PostgREST relationship payloads may be returned as an object (many-to-one)
 * or an array (ambiguous/overridden cardinality). This helper normalizes both.
 */
function extractEmbeddedTruckModel(value: any): any | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  if (typeof value === 'object') return value
  return null
}

/**
 * extractNameFromEmbeddedRelation
 *
 * Safely reads `.name` from a PostgREST embedded relation that may be object/array.
 */
function extractNameFromEmbeddedRelation(value: any): string | null {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first?.name === 'string' && first.name.trim() ? first.name.trim() : null
  }
  if (typeof value === 'object') {
    return typeof value?.name === 'string' && value.name.trim() ? value.name.trim() : null
  }
  return null
}

/**
 * extractCityNameFromEmbeddedRelation
 *
 * Safely reads `.city_name` from a PostgREST embedded relation that may be object/array.
 */
function extractCityNameFromEmbeddedRelation(value: any): string | null {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first?.city_name === 'string' && first.city_name.trim() ? first.city_name.trim() : null
  }
  if (typeof value === 'object') {
    return typeof value?.city_name === 'string' && value.city_name.trim() ? value.city_name.trim() : null
  }
  return null
}

/**
 * formatUiLabel
 *
 * Human-readable UI labels for enum-like strings.
 */
function formatUiLabel(value?: string | null): string {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Unknown'

  const normalized = raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()

  return normalized.replace(/\b\w/g, (m) => m.toUpperCase())
}

/**
 * normalizeStatusCode
 *
 * Normalizes stored/legacy status values to canonical status codes used by filter UI.
 */
function normalizeStatusCode(value?: string | null): string {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')

  if (!raw) return ''

  const aliases: Record<string, string> = {
    AVAILABLE: 'IDLE',
    ASSIGNED: 'DELIVERING',
    IN_USE: 'DELIVERING',
    PICKING_UP: 'PICKING_LOAD',
    PICKUP: 'PICKING_LOAD',
    IN_REPAIR: 'REPAIRING',
    MAINTENANCE: 'REPAIRING',
    OUT_OF_ORDER: 'OUT_OF_SERVICE',
  }

  return aliases[raw] ?? raw
}

/**
 * isTruckInTransitRow
 *
 * Matches TruckCard logic: treat truck as in transit if status is IN_TRANSIT
 * OR available_from_at is in the future.
 */
function isTruckInTransitRow(truck: any): boolean {
  const rawStatus = String(truck?.status ?? '').toUpperCase()
  if (rawStatus === 'IN_TRANSIT') return true

  const availableFrom = truck?.available_from_at
  if (!availableFrom) return false

  const t = new Date(availableFrom).getTime()
  if (Number.isNaN(t)) return false

  return Date.now() < t
}

/**
 * getEffectiveStatusCode
 *
 * Computes status code used by filtering/UI. Keeps "IN_TRANSIT" aligned with card visuals.
 */
function getEffectiveStatusCode(truck: any): string {
  if (isTruckInTransitRow(truck)) return 'IN_TRANSIT'
  return normalizeStatusCode(truck?.status)
}

/**
 * getTruckLocationName
 *
 * Prefer denormalized location_city_name, then embedded relation alias.
 */
function getTruckLocationName(truck: any): string {
  return (
    String(truck?.location_city_name ?? '').trim() ||
    String(truck?.current_location_city ?? '').trim() ||
    extractCityNameFromEmbeddedRelation(truck?.location_city) ||
    extractCityNameFromEmbeddedRelation(truck?.cities) ||
    ''
  )
}

/**
 * getTruckHubName
 */
function getTruckHubName(truck: any): string {
  return String(truck?.hub ?? truck?.hub_city ?? '').trim()
}

/**
 * getTruckClass
 */
function getTruckClass(truck: any): string {
  const embeddedModel = extractEmbeddedTruckModel(truck?.truck_models)
  return String(
    truck?.model_class ??
      truck?.truck_class ??
      truck?.class ??
      embeddedModel?.class ??
      ''
  ).trim()
}

/**
 * getTruckCargoNames
 *
 * Resolves primary/secondary cargo names from:
 * - denormalized user_trucks fields
 * - embedded truck_models fields
 * - nested cargo_types relation (if present in enriched select)
 */
function getTruckCargoNames(truck: any): string[] {
  const embeddedModel = extractEmbeddedTruckModel(truck?.truck_models)

  const primaryCandidates = [
    truck?.cargo_type_name,
    embeddedModel?.cargo_type_name,
    extractNameFromEmbeddedRelation(embeddedModel?.cargo_type_primary),
    extractNameFromEmbeddedRelation(embeddedModel?.cargo_type),
  ]

  const secondaryCandidates = [
    truck?.cargo_type_secondary_name,
    embeddedModel?.cargo_type_secondary_name,
    extractNameFromEmbeddedRelation(embeddedModel?.cargo_type_secondary),
  ]

  const out = new Set<string>()

  ;[...primaryCandidates, ...secondaryCandidates].forEach((v) => {
    const s = String(v ?? '').trim()
    if (s) out.add(s)
  })

  return Array.from(out)
}

/**
 * getTruckGcwLabel
 *
 * Maps numeric GCW values to category labels A/B/C.
 */
function getTruckGcwLabel(truck: any): string {
  const embeddedModel = extractEmbeddedTruckModel(truck?.truck_models)
  const raw = embeddedModel?.gcw ?? truck?.gcw ?? null
  const num = raw !== null && raw !== undefined && !Number.isNaN(Number(raw)) ? Number(raw) : null
  const mapping: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' }
  return num != null ? mapping[num] ?? '' : ''
}

/**
 * TrucksPage
 *
 * @returns JSX.Element
 */
export default function TrucksPage(): JSX.Element {
  /**
   * navigate
   *
   * Lightweight navigation helper that updates the window hash.
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

  // Additional filters
  // NOTE: this first filter now supports BOTH cargo names and GCW categories.
  // Values are encoded as "cargo:<name>" or "gcw:<A|B|C>".
  const [cargoOrGcwFilter, setCargoOrGcwFilter] = useState<string>('')
  const [locationFilter, setLocationFilter] = useState<string>('')
  const [hubFilter, setHubFilter] = useState<string>('')
  const [classFilter, setClassFilter] = useState<string>('')

  // Pagination
  const [page, setPage] = useState<number>(1)

  /**
   * loadTrucks
   *
   * Fetch user_trucks rows joined with truck_models using a single REST select.
   * First tries an enriched select (location city + nested cargo names for options).
   * Falls back to the original query if the enriched relation aliases/FKs are not accepted.
   */
  async function loadTrucks() {
    setLoading(true)
    setError(null)

    try {
      // Enriched query: adds current location city alias and (if available) nested cargo type names.
      const enrichedQs = encodeURI(
        `/rest/v1/user_trucks?select=*,location_city:cities(city_name),truck_models:truck_models!user_trucks_master_truck_id_fkey(*,cargo_type_primary:cargo_types!truck_models_cargo_type_id_fkey(name),cargo_type_secondary:cargo_types!truck_models_cargo_type_id_secondary_fkey(name))&order=created_at.desc&limit=500`
      )

      let res = await supabaseFetch(enrichedQs)

      // If enriched query fails (e.g. FK alias names differ), fall back to original simpler query.
      if (res && typeof res.status === 'number' && (res.status < 200 || res.status >= 300)) {
        // eslint-disable-next-line no-console
        console.debug('Enriched user_trucks query failed, falling back to base query', res)

        const fallbackQs = encodeURI(
          `/rest/v1/user_trucks?select=*,truck_models:truck_models!user_trucks_master_truck_id_fkey(*)&order=created_at.desc&limit=500`
        )
        res = await supabaseFetch(fallbackQs)
      }

      if (!res) {
        setError('No response from backend.')
        setTrucks([])
        return
      }

      if (typeof res.status === 'number' && (res.status < 200 || res.status >= 300)) {
        // eslint-disable-next-line no-console
        console.debug('user_trucks fetch failed', res)
        setError('Failed to load trucks (server error).')
        setTrucks([])
        return
      }

      const rows: PublicTruck[] = Array.isArray(res.data) ? res.data : []
      setTrucks(rows)
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('TrucksPage loadTrucks error:', err)
      setError(err?.message ? String(err.message) : 'Failed to load trucks.')
      setTrucks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTrucks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Status filter options:
   * - Starts from provided canonical statuses
   * - Adds any unexpected statuses found in live data
   */
  const statusOptions = useMemo(() => {
    const map = new Map<string, string>()
    KNOWN_TRUCK_STATUSES.forEach((s) => map.set(s.code, s.name))

    trucks.forEach((t) => {
      const code = getEffectiveStatusCode(t as any)
      if (!code) return
      if (!map.has(code)) {
        map.set(code, formatUiLabel(code))
      }
    })

    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [trucks])

  const statusNameByCode = useMemo(() => {
    const map: Record<string, string> = {}
    statusOptions.forEach((s) => {
      map[s.code] = s.name
    })
    return map
  }, [statusOptions])

  /**
   * Additional filter options derived from loaded data
   */
  const cargoOrGcwOptions = useMemo(() => {
    const entries = new Map<string, string>()

    trucks.forEach((t) => {
      const truck = t as any

      // Cargo names
      getTruckCargoNames(truck).forEach((name) => {
        const value = `cargo:${name.toLowerCase()}`
        if (!entries.has(value)) entries.set(value, name)
      })

      // GCW categories (A/B/C) — included in the first filter as requested
      const gcwLabel = getTruckGcwLabel(truck)
      if (gcwLabel) {
        const value = `gcw:${gcwLabel.toLowerCase()}`
        if (!entries.has(value)) entries.set(value, `GCW ${gcwLabel}`)
      }
    })

    return Array.from(entries.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [trucks])

  const locationOptions = useMemo(() => {
    const vals = new Set<string>()
    trucks.forEach((t) => {
      const loc = getTruckLocationName(t as any)
      if (loc) vals.add(loc)
    })
    return Array.from(vals).sort((a, b) => a.localeCompare(b))
  }, [trucks])

  const hubOptions = useMemo(() => {
    const vals = new Set<string>()
    trucks.forEach((t) => {
      const hub = getTruckHubName(t as any)
      if (hub) vals.add(hub)
    })
    return Array.from(vals).sort((a, b) => a.localeCompare(b))
  }, [trucks])

  const classOptions = useMemo(() => {
    const vals = new Set<string>()
    trucks.forEach((t) => {
      const cls = getTruckClass(t as any)
      if (cls) vals.add(cls)
    })
    return Array.from(vals).sort((a, b) => a.localeCompare(b))
  }, [trucks])

  /**
   * filteredTrucks
   *
   * Compute client-side filtered list based on searchTerm and filters.
   * Do not attempt to re-filter by ownership here.
   */
  const filteredTrucks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return trucks.filter((t) => {
      const anyT = t as any
      const embeddedModel = extractEmbeddedTruckModel(anyT?.truck_models)

      const effectiveStatusCode = getEffectiveStatusCode(anyT)
      const effectiveStatusName = (statusNameByCode[effectiveStatusCode] ?? formatUiLabel(effectiveStatusCode)).toLowerCase()

      const cargoNames = getTruckCargoNames(anyT)
      const cargoNamesLower = cargoNames.map((c) => c.toLowerCase())
      const gcwLabel = getTruckGcwLabel(anyT).toLowerCase()

      const locationCity = getTruckLocationName(anyT).toLowerCase()
      const hubCity = getTruckHubName(anyT).toLowerCase()
      const truckClass = getTruckClass(anyT).toLowerCase()

      // Status filter
      if (statusFilter && effectiveStatusCode !== statusFilter) return false

      // First filter: cargo OR GCW
      if (cargoOrGcwFilter) {
        if (cargoOrGcwFilter.startsWith('cargo:')) {
          const selectedCargo = cargoOrGcwFilter.slice('cargo:'.length)
          if (!cargoNamesLower.includes(selectedCargo)) return false
        } else if (cargoOrGcwFilter.startsWith('gcw:')) {
          const selectedGcw = cargoOrGcwFilter.slice('gcw:'.length)
          if (!gcwLabel || gcwLabel !== selectedGcw) return false
        }
      }

      if (locationFilter && locationCity !== locationFilter.toLowerCase()) return false
      if (hubFilter && hubCity !== hubFilter.toLowerCase()) return false
      if (classFilter && truckClass !== classFilter.toLowerCase()) return false

      if (!q) return true

      // Search by name, registration, id + model + status + filters
      const name = (anyT.name ?? '').toString().toLowerCase()
      const reg = (anyT.registration ?? '').toString().toLowerCase()
      const id = (t.id ?? '').toString().toLowerCase()

      const modelMake = (embeddedModel?.make ?? anyT?.model_make ?? '').toString().toLowerCase()
      const modelModel = (embeddedModel?.model ?? anyT?.model_model ?? '').toString().toLowerCase()
      const modelCombined = `${modelMake} ${modelModel}`.trim()

      return (
        name.includes(q) ||
        reg.includes(q) ||
        id.includes(q) ||
        modelMake.includes(q) ||
        modelModel.includes(q) ||
        modelCombined.includes(q) ||
        effectiveStatusCode.toLowerCase().includes(q) ||
        effectiveStatusName.includes(q) ||
        cargoNamesLower.some((c) => c.includes(q)) ||
        (gcwLabel ? `gcw ${gcwLabel}`.includes(q) : false) ||
        locationCity.includes(q) ||
        hubCity.includes(q) ||
        truckClass.includes(q)
      )
    })
  }, [trucks, searchTerm, statusFilter, cargoOrGcwFilter, locationFilter, hubFilter, classFilter, statusNameByCode])

  // Reset page on any filter/search change
  useEffect(() => {
    setPage(1)
  }, [searchTerm, statusFilter, cargoOrGcwFilter, locationFilter, hubFilter, classFilter])

  const totalPages = useMemo(() => {
    const raw = Math.ceil(filteredTrucks.length / PAGE_SIZE)
    return raw > 0 ? raw : 1
  }, [filteredTrucks.length])

  // Clamp page if list shrinks
  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p < 1 ? 1 : p))
  }, [totalPages])

  const pagedTrucks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredTrucks.slice(start, start + PAGE_SIZE)
  }, [filteredTrucks, page])

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

  const showingFrom = filteredTrucks.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(page * PAGE_SIZE, filteredTrucks.length)

  return (
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
              onClick={() => {
                void loadTrucks()
              }}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded shadow-sm"
            >
              Refresh
            </button>
          </div>
        </header>

        <section className="bg-white p-6 rounded-lg shadow-sm w-full">
          {/* Search + status + in-panel refresh (replaces TrucksFilter so statuses/options are guaranteed to work) */}
          <div className="mb-4">
            <div className="flex flex-col xl:flex-row xl:items-center gap-3">
              <div className="flex-1">
                <input
                  placeholder="Search by name, registration or id"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
                />
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400 min-w-[180px]"
                  aria-label="Filter by truck status"
                >
                  <option value="">All statuses</option>
                  {statusOptions.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    void loadTrucks()
                  }}
                  className="h-11 px-4 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Additional filters + summary */}
          <div className="mt-4 mb-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cargo type / GCW</label>
                <select
                  value={cargoOrGcwFilter}
                  onChange={(e) => setCargoOrGcwFilter(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
                >
                  <option value="">All cargo / GCW</option>
                  {cargoOrGcwOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Current location</label>
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

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hub</label>
                <select
                  value={hubFilter}
                  onChange={(e) => setHubFilter(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
                >
                  <option value="">All hubs</option>
                  {hubOptions.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
                >
                  <option value="">All classes</option>
                  {classOptions.map((cls) => (
                    <option key={cls} value={cls}>
                      {formatUiLabel(cls)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Showing <span className="font-medium text-slate-700">{showingFrom}</span>–
                <span className="font-medium text-slate-700">{showingTo}</span> of{' '}
                <span className="font-medium text-slate-700">{filteredTrucks.length}</span> trucks
                <span className="ml-2 text-slate-400">(10 per page)</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('')
                  setCargoOrGcwFilter('')
                  setLocationFilter('')
                  setHubFilter('')
                  setClassFilter('')
                  setPage(1)
                }}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded"
              >
                Clear filters
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">Loading trucks…</div>
          ) : error ? (
            <div className="text-sm text-rose-600">{error}</div>
          ) : filteredTrucks.length === 0 ? (
            <div className="text-sm text-slate-500">No trucks found for your account.</div>
          ) : (
            <>
              <div className="max-w-full">
                <TrucksList trucks={pagedTrucks} />
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