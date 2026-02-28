/**
 * src/pages/GameDatabase.tsx
 *
 * Game Database page rebuilt into a 3-tab explorer:
 * - Countries & Cities
 * - Truck & Trailer Models
 * - Cargo Types & Items
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
  origin_city?: string | null
  destination_city?: string | null
  origin_country?: string | null
  destination_country?: string | null
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
  trailer_model_id?: string | null
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

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [cities, setCities] = React.useState<CityRow[]>([])
  const [clientCompanies, setClientCompanies] = React.useState<ClientCompanyRow[]>([])
  const [userCompanies, setUserCompanies] = React.useState<UserCompanyRow[]>([])
  const [truckModels, setTruckModels] = React.useState<AssetModelRow[]>([])
  const [trailerModels, setTrailerModels] = React.useState<AssetModelRow[]>([])
  const [cargoTypes, setCargoTypes] = React.useState<CargoTypeRow[]>([])
  const [cargoItems, setCargoItems] = React.useState<CargoItemRow[]>([])
  const [jobOffers, setJobOffers] = React.useState<JobOfferRow[]>([])
  const [userTrucks, setUserTrucks] = React.useState<UserTruckRow[]>([])
  const [userTrailers, setUserTrailers] = React.useState<UserTrailerRow[]>([])

  const [selectedCountry, setSelectedCountry] = React.useState('')
  const [selectedCity, setSelectedCity] = React.useState('')
  const [modalCompany, setModalCompany] = React.useState<UserCompanyRow | null>(null)

  const [assetKind, setAssetKind] = React.useState<AssetKind>('truck')
  const [selectedMake, setSelectedMake] = React.useState('')
  const [selectedModelId, setSelectedModelId] = React.useState('')

  const [selectedCargoTypeId, setSelectedCargoTypeId] = React.useState('')
  const [selectedCargoItemId, setSelectedCargoItemId] = React.useState('')
  const [timeRange, setTimeRange] = React.useState<TimeRange>('7d')

  React.useEffect(() => {
    let mounted = true

    async function loadAll() {
      setLoading(true)
      setError(null)

      try {
        const [
          citiesRes,
          clientRes,
          companiesRes,
          truckModelsRes,
          trailerModelsRes,
          cargoTypesRes,
          cargoItemsRes,
          jobsRes,
          userTrucksRes,
          userTrailersRes,
        ] = await Promise.all([
          supabase
            .from('cities')
            .select('id,city_name,country_name,country_code')
            .order('country_name')
            .order('city_name')
            .limit(2000),
          supabase
            .from('client_companies')
            .select('id,name,country,city,is_active')
            .order('name')
            .limit(2000),
          supabase
            .from('companies')
            .select('id,name,hub_city,hub_country,trucks,trailers,employees,balance')
            .order('name')
            .limit(2000),
          supabase.from('truck_models').select('*').order('make').order('model').limit(2000),
          supabase.from('trailer_models').select('*').order('make').order('model').limit(2000),
          supabase
            .from('cargo_types')
            .select('id,name,description')
            .order('name')
            .limit(1000),
          supabase
            .from('cargo_items')
            .select('id,name,cargo_type_id,typical_weight_kg,typical_volume_m3,is_hazardous')
            .order('name')
            .limit(3000),
          supabase
            .from('job_offers')
            .select(
              'id,cargo_type_id,cargo_item_id,origin_city,destination_city,origin_country,destination_country,created_at'
            )
            .order('created_at', { ascending: false })
            .limit(5000),
          supabase
            .from('user_trucks')
            .select('id,master_truck_id,owner_company_id,status')
            .limit(5000),
          supabase
            .from('user_trailers')
            .select('id,trailer_model_id,master_trailer_id,owner_company_id,status')
            .limit(5000),
        ])

        const maybeErr = [
          citiesRes.error,
          clientRes.error,
          companiesRes.error,
          truckModelsRes.error,
          trailerModelsRes.error,
          cargoTypesRes.error,
          cargoItemsRes.error,
          jobsRes.error,
          userTrucksRes.error,
          userTrailersRes.error,
        ].find(Boolean)

        if (maybeErr) throw maybeErr
        if (!mounted) return

        setCities(Array.isArray(citiesRes.data) ? (citiesRes.data as CityRow[]) : [])
        setClientCompanies(
          Array.isArray(clientRes.data) ? (clientRes.data as ClientCompanyRow[]) : []
        )
        setUserCompanies(
          Array.isArray(companiesRes.data) ? (companiesRes.data as UserCompanyRow[]) : []
        )
        setTruckModels(
          Array.isArray(truckModelsRes.data) ? (truckModelsRes.data as AssetModelRow[]) : []
        )
        setTrailerModels(
          Array.isArray(trailerModelsRes.data) ? (trailerModelsRes.data as AssetModelRow[]) : []
        )
        setCargoTypes(
          Array.isArray(cargoTypesRes.data) ? (cargoTypesRes.data as CargoTypeRow[]) : []
        )
        setCargoItems(
          Array.isArray(cargoItemsRes.data) ? (cargoItemsRes.data as CargoItemRow[]) : []
        )
        setJobOffers(Array.isArray(jobsRes.data) ? (jobsRes.data as JobOfferRow[]) : [])
        setUserTrucks(
          Array.isArray(userTrucksRes.data) ? (userTrucksRes.data as UserTruckRow[]) : []
        )
        setUserTrailers(
          Array.isArray(userTrailersRes.data) ? (userTrailersRes.data as UserTrailerRow[]) : []
        )
      } catch (err: unknown) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to load database explorer data.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadAll()

    return () => {
      mounted = false
    }
  }, [])

  const cargoTypeNameById = React.useMemo(() => {
    const map: Record<string, string> = {}

    cargoTypes.forEach((ct) => {
      const id = normalize(ct.id)
      if (id) {
        map[id] = normalize(ct.name) || 'Unnamed cargo type'
      }
    })

    return map
  }, [cargoTypes])

  const cargoItemNameById = React.useMemo(() => {
    const map: Record<string, string> = {}

    cargoItems.forEach((ci) => {
      const id = normalize(ci.id)
      if (id) {
        map[id] = normalize(ci.name) || 'Unnamed cargo item'
      }
    })

    return map
  }, [cargoItems])

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

  const cityImportExport = React.useMemo(() => {
    const importRows = jobOffers.filter(
      (j) =>
        sameText(j.destination_country, selectedCountry) &&
        sameText(j.destination_city, selectedCity)
    )

    const exportRows = jobOffers.filter(
      (j) => sameText(j.origin_country, selectedCountry) && sameText(j.origin_city, selectedCity)
    )

    return {
      importTop: topN(countByKey(importRows, getJobCargoLabel), 8),
      exportTop: topN(countByKey(exportRows, getJobCargoLabel), 8),
    }
  }, [jobOffers, selectedCountry, selectedCity, getJobCargoLabel])

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
    return assetModels.filter((m) => sameText(m.make || m.producer || m.brand, selectedMake))
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

    return userTrailers.filter((u) => {
      const modelId = normalize(u.trailer_model_id || u.master_trailer_id)
      return sameText(modelId, selectedAsset.id)
    }).length
  }, [selectedAsset, assetKind, userTrucks, userTrailers])

  const topCompaniesForAsset = React.useMemo(() => {
    if (!selectedAsset) return []

    const rows =
      assetKind === 'truck'
        ? userTrucks.filter((u) => sameText(u.master_truck_id, selectedAsset.id))
        : userTrailers.filter((u) =>
            sameText(u.trailer_model_id || u.master_trailer_id, selectedAsset.id)
          )

    const byCompany = countByKey(rows, (row) => {
      const ownerId = (row as UserTruckRow | UserTrailerRow).owner_company_id
      const company = userCompanies.find((c) => sameText(c.id, ownerId))
      return company?.name ?? 'Unknown company'
    })

    return topN(byCompany, 5)
  }, [selectedAsset, assetKind, userTrucks, userTrailers, userCompanies])

  React.useEffect(() => {
    if (cargoTypes.length === 0) {
      if (selectedCargoTypeId) setSelectedCargoTypeId('')
      return
    }

    const found = cargoTypes.some((ct) => sameText(ct.id, selectedCargoTypeId))
    if (!found) setSelectedCargoTypeId(normalize(cargoTypes[0]?.id))
  }, [cargoTypes, selectedCargoTypeId])

  const itemsForType = React.useMemo(() => {
    return cargoItems.filter((ci) => sameText(ci.cargo_type_id, selectedCargoTypeId))
  }, [cargoItems, selectedCargoTypeId])

  React.useEffect(() => {
    if (itemsForType.length === 0) {
      if (selectedCargoItemId) setSelectedCargoItemId('')
      return
    }

    const found = itemsForType.some((ci) => sameText(ci.id, selectedCargoItemId))
    if (!found) setSelectedCargoItemId(normalize(itemsForType[0]?.id))
  }, [itemsForType, selectedCargoItemId])

  const filteredJobsByRange = React.useMemo(() => {
    const now = Date.now()
    const rangeMs =
      timeRange === '7d'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000

    return jobOffers.filter((j) => {
      const ts = new Date(j.created_at ?? '').getTime()
      if (!Number.isFinite(ts)) return false
      return now - ts <= rangeMs
    })
  }, [jobOffers, timeRange])

  const usageForSelectedItem = React.useMemo(() => {
    if (!selectedCargoItemId) return 0

    return filteredJobsByRange.filter((j) => sameText(j.cargo_item_id, selectedCargoItemId)).length
  }, [filteredJobsByRange, selectedCargoItemId])

  const topImportCitiesForItem = React.useMemo(() => {
    return topN(
      countByKey(
        filteredJobsByRange.filter((j) => sameText(j.cargo_item_id, selectedCargoItemId)),
        (j) => normalize(j.destination_city)
      ),
      5
    )
  }, [filteredJobsByRange, selectedCargoItemId])

  const topExportCitiesForItem = React.useMemo(() => {
    return topN(
      countByKey(
        filteredJobsByRange.filter((j) => sameText(j.cargo_item_id, selectedCargoItemId)),
        (j) => normalize(j.origin_city)
      ),
      5
    )
  }, [filteredJobsByRange, selectedCargoItemId])

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
            {loading && (
              <div className="rounded border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-black/70">
                Loading database explorer data...
              </div>
            )}

            {!loading && error && (
              <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && activeTab === 'geography' && (
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
                      <BarChart data={cityImportExport.importTop}>
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
                      <BarChart data={cityImportExport.exportTop}>
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

            {!loading && !error && activeTab === 'assets' && (
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
                        {normalize(selectedAsset.make)}{' '}
                        {normalize(selectedAsset.model || selectedAsset.name)}
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
                              <span>
                                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </span>
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
                      <BarChart data={topCompaniesForAsset}>
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

            {!loading && !error && activeTab === 'cargo' && (
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
                  <span className="font-semibold">{usageForSelectedItem}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[
                    { title: 'Top 5 import cities', data: topImportCitiesForItem },
                    { title: 'Top 5 export cities', data: topExportCitiesForItem },
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