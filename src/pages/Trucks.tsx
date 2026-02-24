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
 *
 * Fixes included:
 * - Blue filter uses truck_models.cargo_type_id, truck_models.cargo_type_id_secondary and truck_models.gcw
 * - Blue filter labels resolve cargo names from cargo_types table (no masked IDs when possible)
 * - Red filter uses ONLY user_trucks.location_city_id for filtering (labels may still show city names)
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

function shortId(value?: string | null, len = 8): string {
  const s = String(value ?? '').trim()
  if (!s) return ''
  return s.length > len ? `${s.slice(0, len)}…` : s
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
 * getTruckLocationId
 *
 * Red filter requirement: use ONLY user_trucks.location_city_id for filtering.
 */
function getTruckLocationId(truck: any): string {
  return String(truck?.location_city_id ?? '').trim()
}

/**
 * getTruckLocationLabel
 *
 * Display label for location select (filter value is still location_city_id).
 */
function getTruckLocationLabel(truck: any): string {
  return (
    extractCityNameFromEmbeddedRelation(truck?.location_city) ||
    extractCityNameFromEmbeddedRelation(truck?.cities) ||
    String(truck?.location_city_name ?? '').trim() ||
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
 * normalizeGcwToken
 *
 * Produces stable token for GCW filter values from truck_models.gcw.
 */
function normalizeGcwToken(raw: any): string {
  if (raw === null || raw === undefined) return ''

  const n = Number(raw)
  if (!Number.isNaN(n)) {
    return Number.isInteger(n) ? String(n) : String(n)
  }

  const s = String(raw).trim()
  return s
}

/**
 * getTruckGcwRawToken
 *
 * BLUE filter requirement: use truck_models.gcw.
 */
function getTruckGcwRawToken(truck: any): string {
  const embeddedModel = extractEmbeddedTruckModel(truck?.truck_models)
  return normalizeGcwToken(embeddedModel?.gcw ?? truck?.gcw ?? null)
}

/**
 * getTruckGcwDisplayLabelByToken
 *
 * Friendly label. If GCW is 1/2/3, map to A/B/C like cards. Otherwise show raw number.
 */
function getTruckGcwDisplayLabelByToken(token?: string | null): string {
  const t = String(token ?? '').trim()
  if (!t) return ''

  const mapping: Record<string, string> = {
    '1': 'A',
    '2': 'B',
    '3': 'C',
  }

  if (mapping[t]) return `GCW ${mapping[t]}`
  return `GCW ${t}`
}

/**
 * getTruckGcwDisplayLabel
 */
function getTruckGcwDisplayLabel(truck: any): string {
  return getTruckGcwDisplayLabelByToken(getTruckGcwRawToken(truck))
}

/**
 * getTruckCargoTypeEntries
 *
 * BLUE filter requirement: use truck_models.cargo_type_id / cargo_type_id_secondary.
 * Filtering values are IDs. Labels are resolved from:
 * 1) embedded names
 * 2) denormalized names
 * 3) cargoTypeNameById lookup fetched from cargo_types
 * 4) fallback short ID label
 */
function getTruckCargoTypeEntries(
  truck: any,
  cargoTypeNameById?: Record<string, string>
): Array<{ id: string; label: string }> {
  const embeddedModel = extractEmbeddedTruckModel(truck?.truck_models)

  // Prefer truck_models columns exactly as requested.
  // Fallback to user_trucks columns only if embedded model fields are missing.
  const primaryIdFromModel = String(embeddedModel?.cargo_type_id ?? '').trim()
  const secondaryIdFromModel = String(embeddedModel?.cargo_type_id_secondary ?? '').trim()

  const primaryId = primaryIdFromModel || String(truck?.cargo_type_id ?? '').trim()
  const secondaryId = secondaryIdFromModel || String(truck?.cargo_type_id_secondary ?? '').trim()

  const primaryNameEmbedded =
    String(
      extractNameFromEmbeddedRelation(embeddedModel?.cargo_type_primary) ??
      extractNameFromEmbeddedRelation(embeddedModel?.cargo_type) ??
      embeddedModel?.cargo_type_name ??
      truck?.cargo_type_name ??
      ''
    ).trim()

  const secondaryNameEmbedded =
    String(
      extractNameFromEmbeddedRelation(embeddedModel?.cargo_type_secondary) ??
      embeddedModel?.cargo_type_secondary_name ??
      truck?.cargo_type_secondary_name ??
      ''
    ).trim()

  const out: Array<{ id: string; label: string }> = []
  const seen = new Set<string>()

  function pushEntry(id: string, preferredName: string) {
    if (!id || seen.has(id)) return
    seen.add(id)

    const lookupName = cargoTypeNameById?.[id] ?? ''
    const label = preferredName || lookupName || `Cargo ${shortId(id)}`
    out.push({ id, label })
  }

  pushEntry(primaryId, primaryNameEmbedded)
  pushEntry(secondaryId, secondaryNameEmbedded)

  return out
}

/**
 * getTruckCargoTypeIds
 */
function getTruckCargoTypeIds(truck: any): string[] {
  return getTruckCargoTypeEntries(truck).map((e) => e.id)
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
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

  // Lookup maps (to avoid showing raw IDs in blue filter labels)
  const [cargoTypeNameById, setCargoTypeNameById] = useState<Record<string, string>>({})

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Additional filters
  // First filter supports cargo IDs + GCW values
  // Values are encoded as "cargo-id:<uuid>" or "gcw:<token>"
  const [cargoOrGcwFilter, setCargoOrGcwFilter] = useState<string>('')
  // Current location filter uses ONLY location_city_id values
  const [locationFilter, setLocationFilter] = useState<string>('')
  const [hubFilter, setHubFilter] = useState<string>('')
  const [classFilter, setClassFilter] = useState<string>('')

  // Pagination
  const [page, setPage] = useState<number>(1)

  /**
   * loadTrucks
   *
   * Fetch user_trucks rows joined with truck_models using a single REST select.
   * Tries enriched query first, then safe fallbacks.
   */
  async function loadTrucks() {
    setLoading(true)
    setError(null)

    try {
      // 1) Enriched query (location city + nested cargo type names if FK aliases match in your DB)
      const enrichedQs = encodeURI(
        `/rest/v1/user_trucks?select=*,location_city:cities(id,city_name),truck_models:truck_models!user_trucks_master_truck_id_fkey(*,cargo_type_primary:cargo_types!truck_models_cargo_type_id_fkey(name),cargo_type_secondary:cargo_types!truck_models_cargo_type_id_secondary_fkey(name))&order=created_at.desc&limit=500`
      )

      let res = await supabaseFetch(enrichedQs)

      // 2) Fallback: keep location alias + truck_models join, drop nested cargo aliases
      if (res && typeof res.status === 'number' && (res.status < 200 || res.status >= 300)) {
        // eslint-disable-next-line no-console
        console.debug('Enriched user_trucks query failed, falling back to location+model query', res)

        const fallbackQs = encodeURI(
          `/rest/v1/user_trucks?select=*,location_city:cities(id,city_name),truck_models:truck_models!user_trucks_master_truck_id_fkey(*)&order=created_at.desc&limit=500`
        )
        res = await supabaseFetch(fallbackQs)
      }

      // 3) Final fallback: original base query
      if (res && typeof res.status === 'number' && (res.status < 200 || res.status >= 300)) {
        // eslint-disable-next-line no-console
        console.debug('Location+model query failed, falling back to base query', res)

        const baseQs = encodeURI(
          `/rest/v1/user_trucks?select=*,truck_models:truck_models!user_trucks_master_truck_id_fkey(*)&order=created_at.desc&limit=500`
        )
        res = await supabaseFetch(baseQs)
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
   * Load cargo type names for all cargo_type_id / cargo_type_id_secondary values found in trucks.
   * This fixes the blue filter showing raw IDs instead of real cargo names.
   */
  useEffect(() => {
    let mounted = true

    async function loadCargoTypeNames() {
      const idsSet = new Set<string>()

      trucks.forEach((t) => {
        const anyT = t as any
        const embeddedModel = extractEmbeddedTruckModel(anyT?.truck_models)

        const ids = [
          String(embeddedModel?.cargo_type_id ?? '').trim(),
          String(embeddedModel?.cargo_type_id_secondary ?? '').trim(),
          // fallback only if model IDs not present on some rows
          String(anyT?.cargo_type_id ?? '').trim(),
          String(anyT?.cargo_type_id_secondary ?? '').trim(),
        ].filter(Boolean)

        ids.forEach((id) => idsSet.add(id))
      })

      const allIds = Array.from(idsSet)
      if (allIds.length === 0) {
        if (mounted) setCargoTypeNameById({})
        return
      }

      const nextMap: Record<string, string> = {}

      try {
        // chunk to avoid URL length issues
        const chunks = chunkArray(allIds, 80)

        for (const chunk of chunks) {
          const inList = chunk.join(',')
          const qs = encodeURI(`/rest/v1/cargo_types?select=id,name&id=in.(${inList})`)
          const res = await supabaseFetch(qs)

          if (!res || (typeof res.status === 'number' && (res.status < 200 || res.status >= 300))) {
            // eslint-disable-next-line no-console
            console.debug('cargo_types lookup chunk failed', { chunk, res })
            continue
          }

          const rows = Array.isArray(res.data) ? res.data : []
          rows.forEach((r: any) => {
            const id = String(r?.id ?? '').trim()
            const name = String(r?.name ?? '').trim()
            if (id && name) nextMap[id] = name
          })
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug('Failed to resolve cargo type names for filters', err)
      }

      if (mounted) {
        setCargoTypeNameById(nextMap)
      }
    }

    void loadCargoTypeNames()

    return () => {
      mounted = false
    }
  }, [trucks])

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

      // Cargo entries — filter by IDs from truck_models (primary + secondary)
      getTruckCargoTypeEntries(truck, cargoTypeNameById).forEach((entry) => {
        const value = `cargo-id:${entry.id.toLowerCase()}`
        // Prefer non-fallback label if we see one later
        const prev = entries.get(value)
        const next = entry.label
        const prevLooksFallback = typeof prev === 'string' && prev.startsWith('Cargo ')
        const nextLooksReal = next && !next.startsWith('Cargo ')
        if (!prev || (prevLooksFallback && nextLooksReal)) {
          entries.set(value, next)
        }
      })

      // GCW entries — filter by raw GCW token from truck_models.gcw
      const gcwToken = getTruckGcwRawToken(truck)
      if (gcwToken) {
        const value = `gcw:${gcwToken.toLowerCase()}`
        const label = getTruckGcwDisplayLabelByToken(gcwToken)
        if (!entries.has(value)) entries.set(value, label || `GCW ${gcwToken}`)
      }
    })

    return Array.from(entries.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [trucks, cargoTypeNameById])

  const locationOptions = useMemo(() => {
    // RED filter values are location_city_id only
    const map = new Map<string, string>()

    trucks.forEach((t) => {
      const truck = t as any
      const locationId = getTruckLocationId(truck)
      if (!locationId) return

      const cityName = getTruckLocationLabel(truck)
      const label = cityName || `City ${shortId(locationId)}`
      const prev = map.get(locationId)

      // Prefer a real city name if previously stored label was fallback
      if (!prev || (prev.startsWith('City ') && cityName)) {
        map.set(locationId, label)
      }
    })

    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
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

      // Blue filter sources (IDs + GCW)
      const cargoEntries = getTruckCargoTypeEntries(anyT, cargoTypeNameById)
      const cargoTypeIdsLower = cargoEntries.map((e) => e.id.toLowerCase())
      const cargoLabelsLower = cargoEntries.map((e) => e.label.toLowerCase())

      const gcwToken = getTruckGcwRawToken(anyT).toLowerCase()
      const gcwLabel = getTruckGcwDisplayLabel(anyT).toLowerCase()

      // Red filter source (ONLY location_city_id)
      const locationCityId = getTruckLocationId(anyT).toLowerCase()
      const locationCityLabel = getTruckLocationLabel(anyT).toLowerCase()

      const hubCity = getTruckHubName(anyT).toLowerCase()
      const truckClass = getTruckClass(anyT).toLowerCase()

      // Status filter
      if (statusFilter && effectiveStatusCode !== statusFilter) return false

      // First filter: cargo IDs OR GCW values
      if (cargoOrGcwFilter) {
        const selected = cargoOrGcwFilter.toLowerCase()

        if (selected.startsWith('cargo-id:')) {
          const selectedCargoId = selected.slice('cargo-id:'.length)
          if (!cargoTypeIdsLower.includes(selectedCargoId)) return false
        } else if (selected.startsWith('gcw:')) {
          const selectedGcw = selected.slice('gcw:'.length)
          if (!gcwToken || gcwToken !== selectedGcw) return false
        }
      }

      // Red filter: ONLY location_city_id exact match
      if (locationFilter && locationCityId !== locationFilter.toLowerCase()) return false

      if (hubFilter && hubCity !== hubFilter.toLowerCase()) return false
      if (classFilter && truckClass !== classFilter.toLowerCase()) return false

      if (!q) return true

      // Search by name, registration, id + model + status + filter-related fields
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
        cargoTypeIdsLower.some((c) => c.includes(q)) ||
        cargoLabelsLower.some((c) => c.includes(q)) ||
        (gcwToken ? `gcw ${gcwToken}`.includes(q) : false) ||
        gcwLabel.includes(q) ||
        locationCityId.includes(q) ||
        locationCityLabel.includes(q) ||
        hubCity.includes(q) ||
        truckClass.includes(q)
      )
    })
  }, [trucks, searchTerm, statusFilter, cargoOrGcwFilter, locationFilter, hubFilter, classFilter, statusNameByCode, cargoTypeNameById])

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
          {/* Search + status + in-panel refresh */}
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
                  {locationOptions.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.label}
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