/**
 * src/pages/GameDatabase.tsx
 *
 * Game Database page rebuilt into a 3-tab explorer:
 * - Countries & Cities
 * - Truck & Trailer Models
 * - Cargo Types & Items
 *
 * Updates:
 * - Lazy tab loading (Geography first; Assets/Cargo on demand)
 * - Per-tab loading/error state
 * - Resilient selectWithFallback() for schema drift
 * - job_offers uses city IDs / join-based safe loading (no origin_city/destination_city text dependency)
 * - user_trailers uses master_trailer_id only
 * - RPC-first analytics:
 *   - game_db_city_demand
 *   - game_db_asset_top_owners
 *   - game_db_cargo_item_analytics
 */

import React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

type MainTab = 'geography' | 'assets' | 'cargo'
type AssetKind = 'truck' | 'trailer'
type TimeRange = '7d' | '30d'

type ChartDatum = {
  name: string
  value: number
}

type CityRow = {
  id: string
  city_name?: string | null
  country_name?: string | null
  country_code?: string | null
}

type ClientCompanyRow = {
  id: string
  name?: string | null
  country?: string | null
  city?: string | null
  is_active?: boolean | null
}

type UserCompanyRow = {
  id: string
  name?: string | null
  hub_city?: string | null
  hub_country?: string | null
  trucks?: number | null
  trailers?: number | null
  employees?: number | null
  balance?: number | null
}

type AssetModelRow = {
  id: string
  make?: string | null
  model?: string | null
  name?: string | null
  producer?: string | null
  brand?: string | null
  [key: string]: unknown
}

type CargoTypeRow = {
  id: string
  name?: string | null
  description?: string | null
}

type CargoItemRow = {
  id: string
  name?: string | null
  cargo_type_id?: string | null
  typical_weight_kg?: number | null
  typical_volume_m3?: number | null
  is_hazardous?: boolean | null
}

type JobOfferRow = {
  id: string
  cargo_type_id?: string | null
  cargo_item_id?: string | null
  origin_city_id?: string | null
  destination_city_id?: string | null
  origin_city_name?: string | null
  destination_city_name?: string | null
  origin_country_name?: string | null
  destination_country_name?: string | null
  created_at?: string | null
}

type UserTruckRow = {
  id: string
  master_truck_id?: string | null
  owner_company_id?: string | null
  status?: string | null
}

type UserTrailerRow = {
  id: string
  master_trailer_id?: string | null
  owner_company_id?: string | null
  status?: string | null
}

const CHART_COLORS = ['#1d4ed8', '#0f172a'] as const

function normalize(value: unknown): string {
  return String(value ?? '').trim()
}

function sameText(a: unknown, b: unknown): boolean {
  return normalize(a).toLowerCase() === normalize(b).toLowerCase()
}

function countByKey<T>(rows: T[], getKey: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {}

  rows.forEach((row) => {
    const key = normalize(getKey(row)) || 'Unknown'
    counts[key] = (counts[key] ?? 0) + 1
  })

  return counts
}

function topN(counts: Record<string, number>, limit: number): ChartDatum[] {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }))
}

async function selectWithFallback(
  table: string,
  selectors: string[],
  opts: { orderBy?: string | string[]; limit?: number } = {}
): Promise<{ data: any[]; usedSelector?: string; error?: any }> {
  let lastErr: any = null

  for (const selector of selectors) {
    let query = supabase.from(table).select(selector)

    if (opts.orderBy) {
      const fields = Array.isArray(opts.orderBy) ? opts.orderBy : [opts.orderBy]
      fields.forEach((field) => {
        query = query.order(field)
      })
    }

    if (typeof opts.limit === 'number') {
      query = query.limit(opts.limit)
    }

    const res = await query
    if (!res.error) {
      return {
        data: Array.isArray(res.data) ? res.data : [],
        usedSelector: selector,
      }
    }

    lastErr = res.error
  }

  return { data: [], error: lastErr }
}

function CompanyQuickModal({
  open,
  company,
  onClose,
}: {
  open: boolean
  company: UserCompanyRow | null
  onClose: () => void
}): JSX.Element | null {
  if (!open || !company) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg bg-white shadow-xl border border-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-black/10">
          <h3 className="text-base font-semibold">{company.name ?? 'Company profile'}</h3>
          <button className="text-sm text-black/60 hover:text-black" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded border border-black/10 bg-black/[0.02] p-3">
            <div className="text-xs text-black/60">Hub</div>
            <div className="font-medium">
              {company.hub_city ?? '—'}, {company.hub_country ?? '—'}
            </div>
          </div>

          <div className="rounded border border-black/10 bg-black/[0.02] p-3">
            <div className="text-xs text-black/60">Balance</div>
            <div className="font-medium">
              ${Number(company.balance ?? 0).toLocaleString()}
            </div>
          </div>

          <div className="rounded border border-black/10 bg-black/[0.02] p-3">
            <div className="text-xs text-black/60">Fleet</div>
            <div className="font-medium">
              {company.trucks ?? 0} trucks / {company.trailers ?? 0} trailers
            </div>
          </div>

          <div className="rounded border border-black/10 bg-black/[0.02] p-3">
            <div className="text-xs text-black/60">Employees</div>
            <div className="font-medium">{company.employees ?? 0}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GameDatabasePage(): JSX.Element {
  const [activeTab, setActiveTab] = React.useState<MainTab>('geography')

  const [loading, setLoading] = React.useState<Record<MainTab, boolean>>({
    geography: false,
    assets: false,
    cargo: false,
  })

  const [error, setError] = React.useState<Record<MainTab, string | null>>({
    geography: null,
    assets: null,
    cargo: null,
  })

  const [loadedTabs, setLoadedTabs] = React.useState<Record<MainTab, boolean>>({
    geography: false,
    assets: false,
    cargo: false,
  })

  const [cities, setCities] = React.useState<CityRow[]>([])
  const [clientCompanies, setClientCompanies] = React.useState<ClientCompanyRow[]>([])
  const [userCompanies, setUserCompanies] = React.useState<UserCompanyRow[]>([])

  const [truckModels, setTruckModels] = React.useState<AssetModelRow[]>([])
  const [trailerModels, setTrailerModels] = React.useState<AssetModelRow[]>([])
  const [userTrucks, setUserTrucks] = React.useState<UserTruckRow[]>([])
  const [userTrailers, setUserTrailers] = React.useState<UserTrailerRow[]>([])

  const [cargoTypes, setCargoTypes] = React.useState<CargoTypeRow[]>([])
  const [cargoItems, setCargoItems] = React.useState<CargoItemRow[]>([])
  const [cargoJobs, setCargoJobs] = React.useState<JobOfferRow[]>([])

  const [selectedCountry, setSelectedCountry] = React.useState('')
  const [selectedCity, setSelectedCity] = React.useState('')
  const [modalCompany, setModalCompany] = React.useState<UserCompanyRow | null>(null)

  const [assetKind, setAssetKind] = React.useState<AssetKind>('truck')
  const [selectedMake, setSelectedMake] = React.useState('')
  const [selectedModelId, setSelectedModelId] = React.useState('')
  const [assetTopCompanies, setAssetTopCompanies] = React.useState<ChartDatum[]>([])

  const [selectedCargoTypeId, setSelectedCargoTypeId] = React.useState('')
  const [selectedCargoItemId, setSelectedCargoItemId] = React.useState('')
  const [timeRange, setTimeRange] = React.useState<TimeRange>('7d')

  const [cityDemand, setCityDemand] = React.useState<{
    importTop: ChartDatum[]
    exportTop: ChartDatum[]
  }>({ importTop: [], exportTop: [] })

  const [cargoUsageCount, setCargoUsageCount] = React.useState(0)
  const [cargoTopImport, setCargoTopImport] = React.useState<ChartDatum[]>([])
  const [cargoTopExport, setCargoTopExport] = React.useState<ChartDatum[]>([])

  const setTabLoading = React.useCallback((tab: MainTab, value: boolean) => {
    setLoading((prev) => ({ ...prev, [tab]: value }))
  }, [])

  const setTabError = React.useCallback((tab: MainTab, value: string | null) => {
    setError((prev) => ({ ...prev, [tab]: value }))
  }, [])

  const setTabLoaded = React.useCallback((tab: MainTab, value: boolean) => {
    setLoadedTabs((prev) => ({ ...prev, [tab]: value }))
  }, [])

  const cargoTypeNameById = React.useMemo(() => {
    const map: Record<string, string> = {}

    cargoTypes.forEach((ct) => {
      const id = normalize(ct.id)
      if (id) map[id] = normalize(ct.name) || 'Unnamed cargo type'
    })

    return map
  }, [cargoTypes])

  const cargoItemNameById = React.useMemo(() => {
    const map: Record<string, string> = {}

    cargoItems.forEach((ci) => {
      const id = normalize(ci.id)
      if (id) map[id] = normalize(ci.name) || 'Unnamed cargo item'
    })

    return map
  }, [cargoItems])

  const cityById = React.useMemo(() => {
    const map: Record<string, CityRow> = {}

    cities.forEach((c) => {
      const id = normalize(c.id)
      if (id) map[id] = c
    })

    return map
  }, [cities])

  const getJobCargoLabel = React.useCallback(
    (job: JobOfferRow): string => {
      const itemName = cargoItemNameById[normalize(job.cargo_item_id)]
      if (itemName) return itemName

      const typeName = cargoTypeNameById[normalize(job.cargo_type_id)]
      if (typeName) return typeName

      return 'Unknown cargo'
    },
    [cargoItemNameById, cargoTypeNameById]
  )

  const hydrateJobRows = React.useCallback(
    (rows: any[]): JobOfferRow[] => {
      return rows.map((row: any) => {
        const originJoin = row?.origin_city
        const destinationJoin = row?.destination_city

        const originCityId = normalize(row?.origin_city_id) || null
        const destinationCityId = normalize(row?.destination_city_id) || null

        const originLookup = originCityId ? cityById[originCityId] : undefined
        const destinationLookup = destinationCityId ? cityById[destinationCityId] : undefined

        return {
          id: normalize(row?.id),
          cargo_type_id: normalize(row?.cargo_type_id) || null,
          cargo_item_id: normalize(row?.cargo_item_id) || null,
          origin_city_id: originCityId,
          destination_city_id: destinationCityId,
          origin_city_name:
            normalize(originJoin?.city_name) || normalize(originLookup?.city_name) || null,
          destination_city_name:
            normalize(destinationJoin?.city_name) ||
            normalize(destinationLookup?.city_name) ||
            null,
          origin_country_name:
            normalize(originJoin?.country_name) || normalize(originLookup?.country_name) || null,
          destination_country_name:
            normalize(destinationJoin?.country_name) ||
            normalize(destinationLookup?.country_name) ||
            null,
          created_at: normalize(row?.created_at) || null,
        }
      })
    },
    [cityById]
  )

  const loadGeography = React.useCallback(async () => {
    setTabLoading('geography', true)
    setTabError('geography', null)

    try {
      const [citiesRes, clientRes, companiesRes] = await Promise.all([
        selectWithFallback(
          'cities',
          ['id,city_name,country_name,country_code'],
          { orderBy: ['country_name', 'city_name'], limit: 2000 }
        ),
        selectWithFallback(
          'client_companies',
          ['id,name,country,city,is_active'],
          { orderBy: 'name', limit: 2000 }
        ),
        selectWithFallback(
          'companies',
          ['id,name,hub_city,hub_country,trucks,trailers,employees,balance'],
          { orderBy: 'name', limit: 2000 }
        ),
      ])

      if (citiesRes.error && clientRes.error && companiesRes.error) {
        throw citiesRes.error || clientRes.error || companiesRes.error
      }

      setCities(citiesRes.data as CityRow[])
      setClientCompanies(clientRes.data as ClientCompanyRow[])
      setUserCompanies(companiesRes.data as UserCompanyRow[])
    } catch (err: unknown) {
      setTabError(
        'geography',
        err instanceof Error ? err.message : 'Failed to load geography data.'
      )
    } finally {
      setTabLoading('geography', false)
      setTabLoaded('geography', true)
    }
  }, [setTabError, setTabLoaded, setTabLoading])

  const loadAssets = React.useCallback(async () => {
    setTabLoading('assets', true)
    setTabError('assets', null)

    try {
      const [truckRes, trailerRes, userTrucksRes, userTrailersRes] = await Promise.all([
        selectWithFallback('truck_models', ['*'], { orderBy: 'make', limit: 2000 }),
        selectWithFallback('trailer_models', ['*'], { orderBy: 'make', limit: 2000 }),
        selectWithFallback(
          'user_trucks',
          ['id,master_truck_id,owner_company_id,status'],
          { limit: 5000 }
        ),
        // trailer_model_id does not exist in some DBs; prefer master_trailer_id
        selectWithFallback(
          'user_trailers',
          ['id,master_trailer_id,owner_company_id,status'],
          { limit: 5000 }
        ),
      ])

      if (truckRes.error && trailerRes.error && userTrucksRes.error && userTrailersRes.error) {
        throw truckRes.error || trailerRes.error || userTrucksRes.error || userTrailersRes.error
      }

      setTruckModels(truckRes.data as AssetModelRow[])
      setTrailerModels(trailerRes.data as AssetModelRow[])
      setUserTrucks(userTrucksRes.data as UserTruckRow[])
      setUserTrailers(userTrailersRes.data as UserTrailerRow[])
    } catch (err: unknown) {
      setTabError('assets', err instanceof Error ? err.message : 'Failed to load assets data.')
    } finally {
      setTabLoading('assets', false)
      setTabLoaded('assets', true)
    }
  }, [setTabError, setTabLoaded, setTabLoading])

  const loadCargo = React.useCallback(async () => {
    setTabLoading('cargo', true)
    setTabError('cargo', null)

    try {
      const [cargoTypesRes, cargoItemsRes, jobsRes] = await Promise.all([
        selectWithFallback(
          'cargo_types',
          ['id,name,description'],
          { orderBy: 'name', limit: 1000 }
        ),
        selectWithFallback(
          'cargo_items',
          ['id,name,cargo_type_id,typical_weight_kg,typical_volume_m3,is_hazardous'],
          { orderBy: 'name', limit: 3000 }
        ),
        selectWithFallback(
          'job_offers',
          [
            // Prefer join-based read via origin_city_id/destination_city_id
            'id,cargo_type_id,cargo_item_id,origin_city_id,destination_city_id,created_at,origin_city:cities!job_offers_origin_city_id_fkey(city_name,country_name),destination_city:cities!job_offers_destination_city_id_fkey(city_name,country_name)',
            // Fallback if FK alias names differ: still use *_city_id and hydrate from cities map
            'id,cargo_type_id,cargo_item_id,origin_city_id,destination_city_id,created_at',
          ],
          { orderBy: 'created_at', limit: 5000 }
        ),
      ])

      if (cargoTypesRes.error && cargoItemsRes.error && jobsRes.error) {
        throw cargoTypesRes.error || cargoItemsRes.error || jobsRes.error
      }

      setCargoTypes(cargoTypesRes.data as CargoTypeRow[])
      setCargoItems(cargoItemsRes.data as CargoItemRow[])
      setCargoJobs(hydrateJobRows(jobsRes.data))
    } catch (err: unknown) {
      setTabError('cargo', err instanceof Error ? err.message : 'Failed to load cargo data.')
    } finally {
      setTabLoading('cargo', false)
      setTabLoaded('cargo', true)
    }
  }, [hydrateJobRows, setTabError, setTabLoaded, setTabLoading])

  React.useEffect(() => {
    void loadGeography()
  }, [loadGeography])

  React.useEffect(() => {
    if (activeTab === 'assets' && !loadedTabs.assets) void loadAssets()
    if (activeTab === 'cargo' && !loadedTabs.cargo) void loadCargo()
  }, [activeTab, loadedTabs.assets, loadedTabs.cargo, loadAssets, loadCargo])

  const countryOptions = React.useMemo(() => {
    const set = new Set<string>()

    cities.forEach((c) => {
      const name = normalize(c.country_name || c.country_code)
      if (name) set.add(name)
    })

    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [cities])

  React.useEffect(() => {
    if (countryOptions.length === 0) {
      if (selectedCountry) setSelectedCountry('')
      return
    }

    if (!countryOptions.some((country) => sameText(country, selectedCountry))) {
      setSelectedCountry(countryOptions[0])
    }
  }, [countryOptions, selectedCountry])

  const cityOptions = React.useMemo(() => {
    const set = new Set<string>()

    cities
      .filter((c) => sameText(c.country_name || c.country_code, selectedCountry))
      .forEach((c) => {
        const city = normalize(c.city_name)
        if (city) set.add(city)
      })

    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [cities, selectedCountry])

  React.useEffect(() => {
    if (cityOptions.length === 0) {
      if (selectedCity) setSelectedCity('')
      return
    }

    if (!cityOptions.some((city) => sameText(city, selectedCity))) {
      setSelectedCity(cityOptions[0])
    }
  }, [cityOptions, selectedCity])

  const cityClientCompanies = React.useMemo(() => {
    return clientCompanies.filter(
      (c) => sameText(c.country, selectedCountry) && sameText(c.city, selectedCity)
    )
  }, [clientCompanies, selectedCountry, selectedCity])

  const cityUserCompanies = React.useMemo(() => {
    return userCompanies.filter(
      (c) => sameText(c.hub_country, selectedCountry) && sameText(c.hub_city, selectedCity)
    )
  }, [userCompanies, selectedCountry, selectedCity])

  React.useEffect(() => {
    async function loadCityDemand() {
      if (!selectedCity) {
        setCityDemand({ importTop: [], exportTop: [] })
        return
      }

      const rpc = await supabase.rpc('game_db_city_demand', {
        p_city_name: selectedCity,
        p_country_name: selectedCountry || null,
        p_limit: 5,
      })

      if (!rpc.error) {
        const rows = Array.isArray(rpc.data) ? rpc.data : []
        setCityDemand({
          importTop: rows
            .filter((r: any) => r.direction === 'import')
            .map((r: any) => ({
              name: normalize(r.cargo_type_name) || 'Unknown',
              value: Number(r.jobs_count ?? 0),
            })),
          exportTop: rows
            .filter((r: any) => r.direction === 'export')
            .map((r: any) => ({
              name: normalize(r.cargo_type_name) || 'Unknown',
              value: Number(r.jobs_count ?? 0),
            })),
        })
        return
      }

      const importRows = cargoJobs.filter(
        (j) =>
          sameText(j.destination_country_name, selectedCountry) &&
          sameText(j.destination_city_name, selectedCity)
      )

      const exportRows = cargoJobs.filter(
        (j) =>
          sameText(j.origin_country_name, selectedCountry) &&
          sameText(j.origin_city_name, selectedCity)
      )

      setCityDemand({
        importTop: topN(countByKey(importRows, getJobCargoLabel), 8),
        exportTop: topN(countByKey(exportRows, getJobCargoLabel), 8),
      })
    }

    void loadCityDemand()
  }, [selectedCity, selectedCountry, cargoJobs, getJobCargoLabel])

  const assetModels = assetKind === 'truck' ? truckModels : trailerModels

  const makeOptions = React.useMemo(() => {
    const set = new Set<string>()

    assetModels.forEach((m) => {
      const make = normalize(m.make || m.producer || m.brand)
      if (make) set.add(make)
    })

    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [assetModels])

  React.useEffect(() => {
    if (makeOptions.length === 0) {
      if (selectedMake) setSelectedMake('')
      return
    }

    if (!makeOptions.some((make) => sameText(make, selectedMake))) {
      setSelectedMake(makeOptions[0])
    }
  }, [makeOptions, selectedMake])

  const modelOptions = React.useMemo(() => {
    return assetModels
      .filter((m) => sameText(m.make || m.producer || m.brand, selectedMake))
      .sort((a, b) =>
        normalize(a.model || a.name || a.id).localeCompare(normalize(b.model || b.name || b.id))
      )
  }, [assetModels, selectedMake])

  React.useEffect(() => {
    if (modelOptions.length === 0) {
      if (selectedModelId) setSelectedModelId('')
      return
    }

    const found = modelOptions.some((m) => sameText(m.id, selectedModelId))
    if (!found) setSelectedModelId(normalize(modelOptions[0]?.id))
  }, [modelOptions, selectedModelId])

  const selectedAsset = React.useMemo(() => {
    return modelOptions.find((m) => sameText(m.id, selectedModelId)) ?? null
  }, [modelOptions, selectedModelId])

  const activeUnitsCount = React.useMemo(() => {
    if (!selectedAsset) return 0

    if (assetKind === 'truck') {
      return userTrucks.filter((u) => sameText(u.master_truck_id, selectedAsset.id)).length
    }

    return userTrailers.filter((u) => sameText(u.master_trailer_id, selectedAsset.id)).length
  }, [selectedAsset, assetKind, userTrucks, userTrailers])

  React.useEffect(() => {
    async function loadAssetTopCompanies() {
      if (!selectedAsset) {
        setAssetTopCompanies([])
        return
      }

      const rpc = await supabase.rpc('game_db_asset_top_owners', {
        p_asset_kind: assetKind,
        p_model_id: selectedAsset.id,
        p_limit: 5,
      })

      if (!rpc.error) {
        const rows = Array.isArray(rpc.data) ? rpc.data : []
        setAssetTopCompanies(
          rows.map((r: any) => ({
            name: normalize(r.company_name) || 'Unknown company',
            value: Number(r.units_count ?? 0),
          }))
        )
        return
      }

      const fallbackRows =
        assetKind === 'truck'
          ? userTrucks.filter((u) => normalize(u.master_truck_id) === normalize(selectedAsset.id))
          : userTrailers.filter(
              (u) => normalize(u.master_trailer_id) === normalize(selectedAsset.id)
            )

      const byCompany = countByKey(fallbackRows, (r: any) => {
        const company = userCompanies.find((c) => sameText(c.id, r.owner_company_id))
        return company?.name ?? 'Unknown company'
      })

      setAssetTopCompanies(topN(byCompany, 5))
    }

    void loadAssetTopCompanies()
  }, [assetKind, selectedAsset, userTrucks, userTrailers, userCompanies])

  React.useEffect(() => {
    if (!selectedCargoTypeId && cargoTypes[0]?.id) {
      setSelectedCargoTypeId(cargoTypes[0].id)
    }
  }, [cargoTypes, selectedCargoTypeId])

  const itemsForType = React.useMemo(
    () => cargoItems.filter((ci) => sameText(ci.cargo_type_id, selectedCargoTypeId)),
    [cargoItems, selectedCargoTypeId]
  )

  React.useEffect(() => {
    if (itemsForType.length === 0) {
      setSelectedCargoItemId('')
      return
    }

    if (!itemsForType.some((i) => sameText(i.id, selectedCargoItemId))) {
      setSelectedCargoItemId(itemsForType[0]?.id ?? '')
    }
  }, [itemsForType, selectedCargoItemId])

  React.useEffect(() => {
    async function loadCargoAnalytics() {
      if (!selectedCargoItemId) {
        setCargoUsageCount(0)
        setCargoTopImport([])
        setCargoTopExport([])
        return
      }

      const days = timeRange === '7d' ? 7 : 30

      const rpc = await supabase.rpc('game_db_cargo_item_analytics', {
        p_cargo_item_id: selectedCargoItemId,
        p_days: days,
        p_limit: 5,
      })

      if (!rpc.error) {
        const rows = Array.isArray(rpc.data) ? rpc.data : []
        setCargoUsageCount(
          Number(rows[0]?.usage_count ?? rows.reduce((sum: number, r: any) => sum + Number(r.jobs_count ?? 0), 0))
        )
        setCargoTopImport(
          rows
            .filter((r: any) => r.direction === 'import')
            .map((r: any) => ({
              name: normalize(r.city_name) || 'Unknown',
              value: Number(r.jobs_count ?? 0),
            }))
        )
        setCargoTopExport(
          rows
            .filter((r: any) => r.direction === 'export')
            .map((r: any) => ({
              name: normalize(r.city_name) || 'Unknown',
              value: Number(r.jobs_count ?? 0),
            }))
        )
        return
      }

      const now = Date.now()
      const rangeMs = days * 24 * 60 * 60 * 1000

      const filtered = cargoJobs.filter((j) => {
        const ts = new Date(j.created_at ?? '').getTime()
        return Number.isFinite(ts) && now - ts <= rangeMs && sameText(j.cargo_item_id, selectedCargoItemId)
      })

      setCargoUsageCount(filtered.length)
      setCargoTopImport(topN(countByKey(filtered, (j) => normalize(j.destination_city_name)), 5))
      setCargoTopExport(topN(countByKey(filtered, (j) => normalize(j.origin_city_name)), 5))
    }

    void loadCargoAnalytics()
  }, [selectedCargoItemId, timeRange, cargoJobs])

  const currentTabLoading = loading[activeTab]
  const currentTabError = error[activeTab]

  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Game Database</h1>
          <p className="text-sm text-black/70">
            Browse geography, equipment, and cargo data from one unified explorer.
          </p>
        </header>

        <section className="bg-white rounded shadow border border-black/10 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-black/10 px-4 pt-3">
            {[
              { id: 'geography', label: 'Countries & Cities' },
              { id: 'assets', label: 'Truck & Trailer Models' },
              { id: 'cargo', label: 'Cargo Types & Items' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`py-2 px-3 -mb-px text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-b-2 border-black text-black'
                    : 'text-black/60 hover:text-black'
                }`}
                onClick={() => setActiveTab(tab.id as MainTab)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            {currentTabLoading && (
              <div className="rounded border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-black/70">
                Loading {activeTab} data...
              </div>
            )}

            {!currentTabLoading && currentTabError && (
              <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {currentTabError}
              </div>
            )}

            {!currentTabLoading && !currentTabError && activeTab === 'geography' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    className="rounded border border-black/15 px-3 py-2 text-sm"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                  >
                    {countryOptions.length === 0 ? (
                      <option value="">No countries available</option>
                    ) : (
                      countryOptions.map((country) => <option key={country}>{country}</option>)
                    )}
                  </select>

                  <select
                    className="rounded border border-black/15 px-3 py-2 text-sm"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                  >
                    {cityOptions.length === 0 ? (
                      <option value="">No cities available</option>
                    ) : (
                      cityOptions.map((city) => <option key={city}>{city}</option>)
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded border border-black/10 p-3">
                    <h3 className="font-semibold text-sm">Client companies in city</h3>
                    <div className="mt-2 space-y-2 max-h-56 overflow-auto pr-1 text-sm">
                      {cityClientCompanies.length === 0 ? (
                        <div className="text-black/60">No client companies found.</div>
                      ) : (
                        cityClientCompanies.map((c) => (
                          <a
                            key={c.id}
                            className="block rounded border border-black/10 px-2 py-1 hover:bg-black/[0.03]"
                            href={`#/company/${c.id}`}
                          >
                            {c.name}
                          </a>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded border border-black/10 p-3">
                    <h3 className="font-semibold text-sm">User companies in city</h3>
                    <div className="mt-2 space-y-2 max-h-56 overflow-auto pr-1 text-sm">
                      {cityUserCompanies.length === 0 ? (
                        <div className="text-black/60">No user companies found.</div>
                      ) : (
                        cityUserCompanies.map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left rounded border border-black/10 px-2 py-1 hover:bg-black/[0.03]"
                            onClick={() => setModalCompany(c)}
                          >
                            {c.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded border border-black/10 p-3 h-72">
                    <h3 className="text-sm font-semibold mb-2">
                      Top import demand ({selectedCity || '—'})
                    </h3>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart data={cityDemand.importTop}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" hide />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#1d4ed8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded border border-black/10 p-3 h-72">
                    <h3 className="text-sm font-semibold mb-2">
                      Top export demand ({selectedCity || '—'})
                    </h3>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart data={cityDemand.exportTop}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" hide />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#0f172a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {!currentTabLoading && !currentTabError && activeTab === 'assets' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    className="rounded border border-black/15 px-3 py-2 text-sm"
                    value={assetKind}
                    onChange={(e) => setAssetKind(e.target.value as AssetKind)}
                  >
                    <option value="truck">Truck</option>
                    <option value="trailer">Trailer</option>
                  </select>

                  <select
                    className="rounded border border-black/15 px-3 py-2 text-sm"
                    value={selectedMake}
                    onChange={(e) => setSelectedMake(e.target.value)}
                  >
                    {makeOptions.length === 0 ? (
                      <option value="">No makes available</option>
                    ) : (
                      makeOptions.map((make) => <option key={make}>{make}</option>)
                    )}
                  </select>

                  <select
                    className="rounded border border-black/15 px-3 py-2 text-sm"
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                  >
                    {modelOptions.length === 0 ? (
                      <option value="">No models available</option>
                    ) : (
                      modelOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {normalize(m.model || m.name || m.id)}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="rounded border border-black/10 p-4 text-sm">
                  {!selectedAsset ? (
                    <div className="text-black/60">No model selected.</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="font-semibold text-base">
                        {normalize(selectedAsset.make || selectedAsset.producer || selectedAsset.brand)}{' '}
                        {normalize(selectedAsset.model || selectedAsset.name || selectedAsset.id)}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(selectedAsset)
                          .slice(0, 12)
                          .map(([k, v]) => (
                            <div
                              key={k}
                              className="rounded border border-black/10 px-2 py-1 bg-black/[0.02]"
                            >
                              <span className="text-black/60">{k}: </span>
                              <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded border border-black/10 p-3 h-72">
                    <h3 className="text-sm font-semibold mb-1">
                      Active units of selected model: {activeUnitsCount}
                    </h3>
                    <ResponsiveContainer width="100%" height="88%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Active', value: activeUnitsCount },
                            {
                              name: 'Other',
                              value: Math.max(
                                (assetKind === 'truck' ? userTrucks.length : userTrailers.length) -
                                  activeUnitsCount,
                                0
                              ),
                            },
                          ]}
                          dataKey="value"
                          outerRadius={90}
                        >
                          <Cell fill="#1d4ed8" />
                          <Cell fill="#e5e7eb" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded border border-black/10 p-3 h-72">
                    <h3 className="text-sm font-semibold mb-1">
                      Top 5 companies by selected {assetKind}
                    </h3>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart data={assetTopCompanies}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" hide />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#0ea5e9" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {!currentTabLoading && !currentTabError && activeTab === 'cargo' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <select
                    className="rounded border border-black/15 px-3 py-2 text-sm md:col-span-2"
                    value={selectedCargoTypeId}
                    onChange={(e) => setSelectedCargoTypeId(e.target.value)}
                  >
                    {cargoTypes.length === 0 ? (
                      <option value="">No cargo types available</option>
                    ) : (
                      cargoTypes.map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.name}
                        </option>
                      ))
                    )}
                  </select>

                  <select
                    className="rounded border border-black/15 px-3 py-2 text-sm md:col-span-2"
                    value={selectedCargoItemId}
                    onChange={(e) => setSelectedCargoItemId(e.target.value)}
                  >
                    {itemsForType.length === 0 ? (
                      <option value="">No cargo items available</option>
                    ) : (
                      itemsForType.map((ci) => (
                        <option key={ci.id} value={ci.id}>
                          {ci.name}
                        </option>
                      ))
                    )}
                  </select>

                  <div className="md:col-span-4 flex gap-2">
                    {(['7d', '30d'] as TimeRange[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setTimeRange(r)}
                        className={`px-3 py-1.5 text-xs rounded border ${
                          timeRange === r
                            ? 'border-black bg-black text-white'
                            : 'border-black/20 text-black/70'
                        }`}
                      >
                        Last {r === '7d' ? '7 days' : '30 days'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded border border-black/10 p-3 text-sm">
                  Usage in job offers ({timeRange}):{' '}
                  <span className="font-semibold">{cargoUsageCount}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[
                    { title: 'Top 5 import cities', data: cargoTopImport },
                    { title: 'Top 5 export cities', data: cargoTopExport },
                  ].map((block, idx) => (
                    <div key={block.title} className="rounded border border-black/10 p-3 h-72">
                      <h3 className="text-sm font-semibold mb-1">{block.title}</h3>
                      <ResponsiveContainer width="100%" height="88%">
                        <BarChart data={block.data}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" hide />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="value" fill={CHART_COLORS[idx]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <CompanyQuickModal
        open={Boolean(modalCompany)}
        company={modalCompany}
        onClose={() => setModalCompany(null)}
      />
    </Layout>
  )
}