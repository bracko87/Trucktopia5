/**
 * StagingTabs.tsx
 *
 * Tabbed view for the Staging Area.
 *
 * Renders tabbed lists (trucks, trailers, drivers, cargo). This file keeps UI
 * layout and visuals unchanged while ensuring drivers shown are only those with
 * activity_id in ('free','standby') for both hired_staff and staff_profiles.
 *
 * Important fix: prevent staging assignment of cargo before pickup time by
 * greying-out cargo rows and disabling drag/start when pickup is in the future.
 *
 * This version also removes the yellow "recommended" visual highlights and
 * ensures relocation info is rendered on a single inline row to save vertical space.
 *
 * Update:
 * - Fixed Staging cargo continuity for multi-run jobs:
 *   - cargo list now includes active statuses too
 *   - weight display prefers assignment.payload_remaining_kg when available
 *   - remainder cargo stays visible after one run is confirmed instead of disappearing
 *
 * Additional update:
 * - Fixed Staging Cargo filtering so trailer jobs only appear in Cargo while still assigned.
 *   Once they move to active phases (picking_load, in_progress, etc.), they no longer remain in Cargo.
 *   Load-cargo jobs still stay visible while there is remaining payload.
 *
 * Latest update:
 * - Ensured trailer service uses resolved company id state in Staging tabs
 *   (not only initial auth snapshot), improving trailer fetch reliability
 *   when company context resolves asynchronously.
 *
 * Newest update:
 * - Fixed the staging regression where Active assignments could show 0 by wiring
 *   AssignmentPanel to pass the resolved company id (effectiveCompanyId), instead
 *   of only the initial auth snapshot (initialCompanyId). This keeps Active
 *   loading aligned with the rest of staging tabs when company id resolves asynchronously.
 */

import React, { useEffect, useMemo, useState, useRef } from 'react'
import type { TruckCardRow } from '../../lib/trucksApi'
import { useTrucksService } from '../../services/trucksService'
import AssignmentPanel from './AssignmentPanel'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { normalizeGcwLetter } from '../../lib/gcw'
import { Flag } from 'lucide-react'
import DeadlineTimestamp from '../common/DeadlineTimestamp'
import { truckCanHandleCargo, gcwAllowsTrailer } from './cargoCompatibility'
import { useTrailersService } from '../../services/trailersService'
import type { TrailerCardRow } from '../../lib/api/trailersApi'
import { recommendTruck } from '../../utils/assignmentRecommendations'
import { rankTrailersForJob, rankDriversForJob } from '../../lib/recommendations'

/**
 * TabKey
 *
 * Type for the available tabs.
 */
type TabKey = 'trucks' | 'trailers' | 'drivers' | 'cargo'

/**
 * HiredDriverRow
 *
 * Minimal shape for hired_staff rows used in the drivers list.
 */
interface HiredDriverRow {
  id: string
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  activity_id?: string | null
  hired_at?: string | null
  experience?: number | null
  fatigue?: number | null
  happiness?: number | null
  skill1?: { id: string; name?: string } | null
  skill2?: { id: string; name?: string } | null
  skill3?: { id: string; name?: string } | null
  roles?: string[]
  source?: 'hired' | 'profile'
  location?: string | null
  location_city_id?: string | null
  /**
   * Added alias for clarity: current_location_id (mapped from staff current_location_id).
   * Keeps compatibility with existing code while making intent explicit.
   */
  current_location_id?: string | null
}

/**
 * getCountryCodeFromName
 *
 * Attempt to normalise a country name to a 2-letter ISO code.
 */
function getCountryCodeFromName(name?: string | null): string | null {
  if (!name) return null
  const n = String(name).trim().toLowerCase()
  if (n.length === 2) return n
  // countryNameToCode is expected to exist in file scope; fall back to null if not
  // @ts-ignore
  return (globalThis as any)?.countryNameToCode?.[n] ?? null
}

function getCountryCodeForCity(cityName?: string | null): string | null {
  if (!cityName) return null
  // cityToCountryCode expected to exist in file scope
  // @ts-ignore
  return (globalThis as any)?.cityToCountryCode?.[String(cityName).trim().toLowerCase()] ?? null
}

function getFlagUrlForCode(code: string): string {
  const c = code.toLowerCase()
  return `https://flagcdn.com/w20/${c}.png`
}

function resolveFlagForLocation(obj: any, altLabel?: string): string | null {
  if (obj && typeof obj === 'object') {
    const cc =
      (obj.country_code as string) ??
      (obj.country as string) ??
      (obj.countryName as string) ??
      (obj.country_name as string)
    const fromName = getCountryCodeFromName(cc)
    if (fromName) return getFlagUrlForCode(fromName)
    const city = (obj.city_name as string) ?? (obj.name as string) ?? null
    const cityCode = getCountryCodeForCity(city)
    if (cityCode) return getFlagUrlForCode(cityCode)
    return null
  }

  if (typeof obj === 'string') {
    const cc = getCountryCodeFromName(obj)
    if (cc) return getFlagUrlForCode(cc)
    const cityCode = getCountryCodeForCity(obj)
    if (cityCode) return getFlagUrlForCode(cityCode)
  }

  if (altLabel) {
    const cityCode = getCountryCodeForCity(altLabel)
    if (cityCode) return getFlagUrlForCode(cityCode)
    const cc = getCountryCodeFromName(altLabel)
    if (cc) return getFlagUrlForCode(cc)
  }

  return null
}

/**
 * percentToRedGreenColor
 *
 * Returns a smooth color between red and green for a percentage value.
 */
function percentToRedGreenColor(value: number, invert = false): string {
  const v = Math.max(0, Math.min(100, value))
  const pct = invert ? 100 - v : v

  const r = Math.round((255 * (100 - pct)) / 100)
  const g = Math.round((255 * pct) / 100)

  return `rgb(${r}, ${g}, 0)`
}

/**
 * Cargo type color mapping
 * Ensures each cargo type has a consistent visual identity.
 */
const CARGO_TYPE_COLORS: Record<string, string> = {
  'Frozen / Refrigerated': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'Waste & Recycling': 'bg-lime-100 text-lime-800 border-lime-300',
  'Dry Goods': 'bg-amber-100 text-amber-800 border-amber-300',
  'Liquid - Industrial / Chemical': 'bg-purple-100 text-purple-800 border-purple-300',
  Livestock: 'bg-orange-100 text-orange-800 border-orange-300',
  'Agricultural Bulk': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Construction Material': 'bg-stone-100 text-stone-800 border-stone-300',
  'Construction Debris': 'bg-gray-200 text-gray-800 border-gray-400',
  'Corrosive Chemicals': 'bg-red-100 text-red-800 border-red-300',
  'Liquid - Clean / Food Grade': 'bg-blue-100 text-blue-800 border-blue-300',
  'Hazardous Materials': 'bg-rose-100 text-rose-800 border-rose-300',
  'Containerized / Intermodal': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Compressed Gases': 'bg-sky-100 text-sky-800 border-sky-300',
  'Heavy Machinery / Oversized': 'bg-slate-200 text-slate-800 border-slate-400',
  'Bulk Powder / Cement': 'bg-neutral-200 text-neutral-800 border-neutral-400',
  'Extra Long Loads': 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
  Vehicles: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

/**
 * CargoTypeBadge
 *
 * Small presentational badge for cargo types using the color mapping.
 */
function CargoTypeBadge({ name }: { name?: string | null }) {
  const style =
    (name && (CARGO_TYPE_COLORS as Record<string, string>)[name]) ||
    'bg-slate-100 text-slate-700 border-slate-300'

  return (
    <span className={`text-xs font-medium whitespace-nowrap px-2 py-1 rounded-md border ${style}`}>
      {name || '—'}
    </span>
  )
}

/**
 * StagingTabs
 *
 * Renders the tabbed staging area with trucks, trailers, drivers and cargo lists.
 * The trailer tab is wired to useTrailersService and the drivers tab excludes
 * staff_profiles whose latest stats show activity 'assigned' or 'relocating'.
 *
 * @returns JSX.Element
 */
export default function StagingTabs(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>('trucks')

  // Shared trucks service
  const { trucks, loading: loadingTrucks, error: trucksError, refresh } =
    useTrucksService({ mode: 'private' })

  const { user } = useAuth()
  const initialCompanyId =
    (user as any)?.company_id || (user as any)?.companyId || null
  const [effectiveCompanyId, setEffectiveCompanyId] = useState<string | null>(initialCompanyId)

  // Trailers service (new)
  const {
    trailers,
    loading: loadingTrailers,
    error: trailersError,
    refresh: refreshTrailers,
  } = useTrailersService(effectiveCompanyId || undefined)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const cid = await resolveCompanyId()
      if (!mounted) return
      if (cid) setEffectiveCompanyId(String(cid))
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fallback direct company trucks
  const [companyTrucks, setCompanyTrucks] = useState<TruckCardRow[]>([])
  const [loadingCompanyTrucks, setLoadingCompanyTrucks] = useState(false)
  const [companyTrucksError, setCompanyTrucksError] = useState<string | null>(null)

  // Drivers
  const [drivers, setDrivers] = useState<HiredDriverRow[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [driversError, setDriversError] = useState<string | null>(null)

  // Cargo / assigned jobs
  const [cargoJobs, setCargoJobs] = useState<any[]>([])
  const [loadingCargo, setLoadingCargo] = useState(false)
  const [cargoError, setCargoError] = useState<string | null>(null)

  // Assignment snapshot received from the AssignmentPanel (UI-owned)
  const [assignment, setAssignment] = useState<any>(null)

  // Recommended ids for visual hints — logic remains but visuals removed
  const [recommendedTruckId, setRecommendedTruckId] = useState<string | null>(null)
  const [recommendedTrailerId, setRecommendedTrailerId] = useState<string | null>(null)
  const [recommendedDriverId, setRecommendedDriverId] = useState<string | null>(null)

  /**
   * relocationInfo
   *
   * Map of driver id -> { km, hours, cost } used to show relocation preview
   * shown under the driver's Location line when the driver is in a different city
   * than the currently selected assignment truck.
   */
  const [relocationInfo, setRelocationInfo] = useState<Record<string, any>>({})

  const trailersToShow = useMemo(() => {
    if (!Array.isArray(trailers) || trailers.length === 0) return trailers
    if (!recommendedTrailerId) return trailers
    const idx = trailers.findIndex(
      (tr) => String(tr.id ?? tr._raw?.id ?? '') === String(recommendedTrailerId)
    )
    if (idx <= 0) return trailers
    const ordered = [...trailers]
    const [best] = ordered.splice(idx, 1)
    ordered.unshift(best)
    return ordered
  }, [trailers, recommendedTrailerId])

  useEffect(() => {
    if (!assignment) return

    const cargo = assignment.cargo
    const truck = assignment.truck
    const trailer = assignment.trailer
    const driversAssigned = assignment.drivers ?? []

    if (!cargo) {
      setActiveTab('cargo')
      return
    }

    if (!truck) {
      setActiveTab('trucks')
      return
    }

    const requiresTrailer =
      (assignment?.cargo?.job_offer?.transport_mode ?? assignment?.cargo?.transport_mode) === 'trailer_cargo'

    if (requiresTrailer) {
      if (driversAssigned.length === 0) {
        setActiveTab('drivers')
        return
      }
      return
    }

    const truckClass = String((truck as any)?.model?.class ?? '').toLowerCase()
    if (truckClass === 'big' && !trailer) {
      setActiveTab('trailers')
      return
    }

    if (driversAssigned.length === 0) {
      setActiveTab('drivers')
      return
    }
  }, [assignment])

  useEffect(() => {
    if (!assignment?.cargo) {
      setRecommendedTruckId(null)
      return
    }

    const trucksToConsider: any[] = trucks.length > 0 ? trucks : companyTrucks
    if (!trucksToConsider || trucksToConsider.length === 0) {
      setRecommendedTruckId(null)
      return
    }

    try {
      const best = recommendTruck(trucksToConsider as any[], assignment.cargo)
      setRecommendedTruckId(best?.id ?? best?._raw?.id ?? null)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug('recommendTruck error', err)
      setRecommendedTruckId(null)
    }
  }, [assignment?.cargo, trucks, companyTrucks])

  useEffect(() => {
    if (!assignment?.cargo || !assignment?.truck) {
      setRecommendedTrailerId(null)
      return
    }

    if (!Array.isArray(trailers) || trailers.length === 0) {
      setRecommendedTrailerId(null)
      return
    }

    try {
      const jobOffer = assignment.cargo.job_offer ?? assignment.cargo
      const ranked = rankTrailersForJob(trailers as any[], jobOffer)
      const truck = assignment.truck
      const compatible = ranked.find((tr) => gcwAllowsTrailer(truck, tr))
      const chosen = compatible ?? ranked[0] ?? null
      setRecommendedTrailerId(chosen ? String(chosen.id ?? chosen._raw?.id ?? '') : null)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug('rankTrailersForJob error', err)
      setRecommendedTrailerId(null)
    }
  }, [assignment?.cargo, assignment?.truck, trailers])

  useEffect(() => {
    if (!assignment?.cargo || !assignment?.truck) {
      setRecommendedDriverId(null)
      return
    }

    if (!Array.isArray(drivers) || drivers.length === 0) {
      setRecommendedDriverId(null)
      return
    }

    try {
      const truckCityId =
        assignment.truck?.location_city_id ??
        assignment.truck?._raw?.location_city_id ??
        null

      if (!truckCityId) {
        setRecommendedDriverId(null)
        return
      }

      // Only drivers in same city as truck
      const sameCityDrivers = drivers.filter(
        (d) =>
          String(d.location_city_id ?? d.current_location_id ?? '') ===
          String(truckCityId)
      )

      if (sameCityDrivers.length === 0) {
        setRecommendedDriverId(null)
        return
      }

      const jobOffer =
        assignment.cargo.job_offer ?? assignment.cargo

      const ranked = rankDriversForJob(
        sameCityDrivers as any[],
        jobOffer
      )

      const chosen = ranked[0] ?? null

      setRecommendedDriverId(
        chosen ? String(chosen.id ?? '') : null
      )
    } catch (err) {
      console.debug('rankDriversForJob error', err)
      setRecommendedDriverId(null)
    }
  }, [assignment?.cargo, assignment?.truck, drivers])

  /**
   * Compute relocation preview for drivers when an assignment truck is present.
   *
   * Deterministic engine: no randomness. Uses city_distances.distance_km when
   * available to compute hours and cost. UI decides whether relocation is
   * required by comparing driver.current_location_id (mapped to either
   * current_location_id or location_city_id) against truck.location_city_id.
   */
  useEffect(() => {
    if (!assignment?.truck) {
      setRelocationInfo({})
      return
    }

    const truckCityId =
      assignment.truck?.location_city_id ??
      assignment.truck?._raw?.location_city_id ??
      null

    // If truck has no known city, do not show relocations
    if (!truckCityId) {
      setRelocationInfo({})
      return
    }

    const map: Record<string, any> = {}

    /**
     * For each driver:
     * - Use driver.current_location_id when present, fallback to location_city_id
     * - Skip if same city or missing id
     * - Look up distance_km and compute hours = distanceKm / 70, cost = distanceKm * 0.6
     */
    async function loadRelocations() {
      await Promise.all(
        drivers.map(async (d) => {
          const driverCityId =
            (d as any).current_location_id ?? d.location_city_id ?? null

          // NO relocation if missing or same city
          if (!driverCityId || String(driverCityId) === String(truckCityId)) {
            return
          }

          let distanceKm = 0

          try {
            const { data } = await supabase
              .from('city_distances')
              .select('distance_km')
              .or(
                `and(city_a_id.eq.${driverCityId},city_b_id.eq.${truckCityId}),and(city_a_id.eq.${truckCityId},city_b_id.eq.${driverCityId})`
              )
              .limit(1)
              .maybeSingle()

            distanceKm = Number(data?.distance_km ?? 0)
          } catch (e) {
            // eslint-disable-next-line no-console
            console.debug('relocation distance lookup error', e)
            distanceKm = 0
          }

          const hours = distanceKm > 0 ? distanceKm / 70 : 0
          const cost = distanceKm > 0 ? distanceKm * 0.6 : 0

          map[d.id] = {
            km: distanceKm ? Math.round(distanceKm) : null,
            hours,
            cost,
          }
        })
      )

      setRelocationInfo(map)
    }

    void loadRelocations()
  }, [assignment?.truck, drivers])

  /**
   * resolveCompanyId
   *
   * Attempt to resolve the company id either from the user object shapes or
   * by querying public.users using auth_user_id.
   */
  async function resolveCompanyId(): Promise<string | null> {
    if (initialCompanyId) return initialCompanyId
    if (!user) return null

    const authId =
      (user as any)?.auth_user_id ||
      (user as any)?.id ||
      (user as any)?.user?.id ||
      null

    if (!authId) return null

    try {
      const { data } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', authId)
        .maybeSingle()

      return (data as any)?.company_id ?? null
    } catch (e) {
      // Fail quietly and return null
      // eslint-disable-next-line no-console
      console.debug('resolveCompanyId error', e)
      return null
    }
  }

  /**
   * fetchCompanyTrucksForStaging
   *
   * Direct fallback loader that fetches company trucks with status='available'.
   */
  async function fetchCompanyTrucksForStaging(overrideCompanyId?: string) {
    setLoadingCompanyTrucks(true)
    setCompanyTrucksError(null)

    try {
      const cid = overrideCompanyId || (await resolveCompanyId())
      if (!cid) {
        setCompanyTrucks([])
        setCompanyTrucksError('Company not found')
        setLoadingCompanyTrucks(false)
        return
      }

      const { data, error } = await supabase
        .from('user_trucks')
        .select(
          `
            id,
            master_truck_id,
            owner_company_id,
            name,
            registration,
            purchase_date,
            created_at,
            mileage_km,
            model_year,
            fuel_level_l,
            condition_score,
            status,
            location_city_id,
            hub,
            cargo_type_id,
            cargo_type_id_secondary,
            truck_models:truck_models!user_trucks_master_truck_id_fkey(
              id,
              make,
              model,
              country,
              class,
              year,
              max_load_kg,
              tonnage,
              gcw,
              reliability
            )
          `
        )
        .eq('owner_company_id', cid)
        .in('status', ['IDLE', 'available'])
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      const rows = Array.isArray(data) ? data : []

      const cityIds = new Set<string>()
      const cargoIds = new Set<string>()
      rows.forEach((r: any) => {
        if (r.location_city_id) cityIds.add(String(r.location_city_id))
        if (r.cargo_type_id) cargoIds.add(String(r.cargo_type_id))
        if (r.cargo_type_id_secondary) cargoIds.add(String(r.cargo_type_id_secondary))
      })

      const cityMap: Record<string, string> = {}
      if (cityIds.size > 0) {
        const idsArr = Array.from(cityIds)
        const cityRes = await supabase
          .from('cities')
          .select('id,city_name')
          .in('id', idsArr)
        if (!cityRes.error && Array.isArray(cityRes.data)) {
          cityRes.data.forEach((c: any) => {
            if (c && c.id) cityMap[String(c.id)] = c.city_name ?? ''
          })
        }
      }

      const cargoMap: Record<string, string> = {}
      if (cargoIds.size > 0) {
        const idsArr = Array.from(cargoIds)
        const cargoRes = await supabase
          .from('cargo_types')
          .select('id,name')
          .in('id', idsArr)
        if (!cargoRes.error && Array.isArray(cargoRes.data)) {
          cargoRes.data.forEach((c: any) => {
            if (c && c.id) cargoMap[String(c.id)] = c.name ?? ''
          })
        }
      }

      const mapped: TruckCardRow[] = rows.map((r: any) => {
        const model = r.truck_models ?? null

        const cargoNames = [
          r.cargo_type_id ? cargoMap[String(r.cargo_type_id)] ?? String(r.cargo_type_id) : null,
          r.cargo_type_id_secondary ? cargoMap[String(r.cargo_type_id_secondary)] ?? String(r.cargo_type_id_secondary) : null,
        ].filter(Boolean)

        const enrichedRaw = {
          ...r,
          location_city_name: r.location_city_id ? cityMap[String(r.location_city_id)] ?? String(r.location_city_id) : null,
          cargo_type_names: cargoNames,
        }

        return {
          id: String(r.id),
          name: r.name ?? null,
          registration: r.registration ?? null,
          purchase_date: r.purchase_date ?? null,
          created_at: r.created_at ?? null,
          mileage_km: typeof r.mileage_km === 'number' ? r.mileage_km : r.mileage_km ? Number(r.mileage_km) : null,
          fuel_level_l: typeof r.fuel_level_l === 'number' ? r.fuel_level_l : r.fuel_level_l ? Number(r.fuel_level_l) : null,
          condition_score: typeof r.condition_score === 'number' ? r.condition_score : r.condition_score ? Number(r.condition_score) : null,
          status: r.status ?? null,
          location_city_id: r.location_city_id ?? null,
          model: model
            ? {
                id: model.id,
                make: model.make ?? null,
                model: model.model ?? null,
                country: model.country ?? null,
                class: model.class ?? null,
                max_payload: (model as any).max_load_kg ?? null,
                tonnage: model.tonnage ?? null,
                year: model.year ?? null,
                gcw: (model as any).gcw ?? null,
                reliability: (model as any).reliability ?? null,
              }
            : {
                id: r.master_truck_id,
                make: null,
                model: null,
                country: null,
                class: null,
                max_payload: null,
                tonnage: null,
                year: r.model_year ?? null,
                gcw: null,
                reliability: null,
              },
          _raw: enrichedRaw,
        }
      })

      setCompanyTrucks(mapped)
    } catch (e: any) {
      setCompanyTrucksError(e?.message ?? 'Failed to load trucks')
      setCompanyTrucks([])
    } finally {
      setLoadingCompanyTrucks(false)
    }
  }

  /**
   * fetchAvailableDrivers
   *
   * Loads hired_staff (operational drivers) and pulls staff_profiles for
   * company-owned drivers. Crucially, staff_profiles are filtered so only
   * those with staff_profile_stats.activity_id in ('free','standby') are included.
   */
  async function fetchAvailableDrivers(overrideCompanyId?: string) {
    setLoadingDrivers(true)
    setDriversError(null)

    try {
      const cid = overrideCompanyId || (await resolveCompanyId())
      if (!cid) {
        setDrivers([])
        setDriversError('Company not found')
        setLoadingDrivers(false)
        return
      }

      // STEP 1 — operational hired_staff rows (only free/standby)
      // NOTE: we request current_location_id as a relation named `cities` with (id, city_name)
      const { data: hiredData, error: hiredError } = await supabase
        .from('hired_staff')
        .select(`
          id,
          first_name,
          last_name,
          activity_id,
          hired_at,
          experience,
          fatigue,
          happiness,
          current_location_id,
          skill1:skill1_id(id,name),
          skill2:skill2_id(id,name),
          skill3:skill3_id(id,name),
          cities:current_location_id(id, city_name),
          job_category
        `)
        .eq('company_id', cid)
        .in('activity_id', ['free', 'standby'])
        .eq('job_category', 'drivers')
        .order('hired_at', { ascending: false })

      if (hiredError) throw hiredError

      const hiredDrivers: HiredDriverRow[] = (hiredData ?? []).map((d: any) => {
        const locId = Array.isArray(d.cities) ? d.cities[0]?.id ?? null : d.cities?.id ?? null
        const locName = Array.isArray(d.cities) ? d.cities[0]?.city_name ?? null : d.cities?.city_name ?? null

        return {
          id: String(d.id),
          name: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || undefined,
          first_name: d.first_name ?? null,
          last_name: d.last_name ?? null,
          activity_id: d.activity_id ?? 'free',
          hired_at: d.hired_at ?? null,
          experience: Number(d.experience ?? 0),
          fatigue: Number(d.fatigue ?? 0),
          happiness: Number(d.happiness ?? 100),
          roles: ['DRIVER'],
          source: 'hired',
          location: locName,
          // keep the original field used across the app
          location_city_id: locId,
          // explicit alias to show this came from current_location_id
          current_location_id: locId,
          skill1: d.skill1 ?? null,
          skill2: d.skill2 ?? null,
          skill3: d.skill3 ?? null,
        }
      })

      // STEP 2 — fetch staff_profiles for company and include staff_profile_stats and roles
      // Important: do not include profile drivers whose stats indicate 'assigned' or 'relocating'
      // NOTE: request staff_profile_stats.current_location_id as (id, city_name)
      const { data: profilesData, error: profilesError } = await supabase
        .from('staff_profiles')
        .select(`
          id,
          first_name,
          last_name,
          staff_profile_stats(fatigue, happiness, current_location_id, activity_id, current_location_id(id, city_name)),
          staff_profile_roles(role_key)
        `)
        .eq('company_id', cid)

      if (profilesError) throw profilesError

      // Filter and map profiles: include profiles only if they have at least one stats row with activity free|standby
      const profileDrivers: HiredDriverRow[] = (profilesData ?? [])
        .filter((p: any) => {
          const roles = p.staff_profile_roles
          if (!roles) return false
          const hasDriverRole = Array.isArray(roles)
            ? roles.some((r: any) => String(r.role_key ?? '').toUpperCase() === 'DRIVER')
            : String(roles.role_key ?? '').toUpperCase() === 'DRIVER'
          if (!hasDriverRole) return false

          const statsArr = Array.isArray(p.staff_profile_stats)
            ? p.staff_profile_stats
            : p.staff_profile_stats
            ? [p.staff_profile_stats]
            : []

          if (statsArr.length === 0) return false

          // Require at least one stats row with allowed activity
          const allowed = statsArr.some((s: any) => {
            const act = (s?.activity_id ?? '').toString().toLowerCase()
            return act === 'free' || act === 'standby'
          })

          return allowed
        })
        .map((p: any) => {
          const stats = Array.isArray(p.staff_profile_stats) ? p.staff_profile_stats[0] : p.staff_profile_stats ?? {}
          // stats.current_location_id was requested as (id, city_name)
          const cities = stats?.current_location_id ?? stats?.cities
          const location = Array.isArray(cities) ? cities[0]?.city_name ?? null : cities?.city_name ?? null
          const locId = Array.isArray(cities) ? cities[0]?.id ?? null : cities?.id ?? null

          const rolesArr = Array.isArray(p.staff_profile_roles)
            ? p.staff_profile_roles.map((r: any) => String(r.role_key ?? '').toUpperCase()).filter(Boolean)
            : p.staff_profile_roles
            ? [String(p.staff_profile_roles.role_key ?? '').toUpperCase()].filter(Boolean)
            : ['DRIVER']

          return {
            id: String(p.id),
            name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || undefined,
            first_name: p.first_name ?? null,
            last_name: p.last_name ?? null,
            roles: rolesArr,
            source: 'profile',
            experience: 0,
            fatigue: typeof stats?.fatigue === 'number' ? stats.fatigue : stats?.fatigue ?? null,
            happiness: typeof stats?.happiness === 'number' ? stats.happiness : stats?.happiness ?? null,
            location,
            // keep compatibility: location_city_id (used in other parts)
            location_city_id: locId,
            // explicit alias: current_location_id for clarity (mapped from stats.current_location_id)
            current_location_id: locId,
            }
        })

      // Merge: profile drivers first (owner/CEO visible on top), then hired drivers
      const merged = [...profileDrivers, ...hiredDrivers]

      setDrivers(merged)
    } catch (e: any) {
      setDriversError(e?.message ?? 'Failed to load drivers')
      setDrivers([])
    } finally {
      setLoadingDrivers(false)
    }
  }

  /**
   * fetchAssignedJobs
   *
   * Loads cargo jobs assigned to the company by querying job_assignments and embedding the job_offer.
   *
   * Note: original query included a non-existent job_assignment_id column. That field
   * has been removed to avoid SQL/postgrest errors.
   *
   * Updated for multi-run continuity:
   * includes active statuses so remaining payload jobs stay visible after a run starts.
   *
   * Updated cargo filtering behavior:
   * - trailer_cargo: only show while status is still "assigned"
   * - load_cargo: keep visible while there is remaining payload
   */
  async function fetchAssignedJobs(overrideCompanyId?: string) {
    setLoadingCargo(true)
    setCargoError(null)

    try {
      const cid = overrideCompanyId || (await resolveCompanyId())
      if (!cid) {
        setCargoJobs([])
        setCargoError('Company not found')
        setLoadingCargo(false)
        return
      }

      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          id,
          status,
          accepted_at,
          assigned_payload_kg,
          payload_remaining_kg,
          job_offer:job_offer_id(
            id,
            remaining_payload,
            transport_mode,
            pickup_time,
            delivery_deadline,
            distance_km,
            weight_kg,
            volume_m3,
            pallets,
            reward_load_cargo,
            reward_trailer_cargo,
            cargo_item_id,
            cargo_type_id,
            cargo_items:cargo_item_id(name),
            cargo_types:cargo_type_id(name),
            origin_city:origin_city_id(city_name, country_code, id),
            destination_city:destination_city_id(city_name, country_code, id)
          )
        `)
        .eq('carrier_company_id', cid)
        .in('status', [
          'assigned',
          'picking_load',
          'PICKING_LOAD',
          'to_pickup',
          'TO_PICKUP',
          'in_progress',
          'IN_PROGRESS',
          'delivering',
          'DELIVERING',
        ])
        .order('accepted_at', { ascending: false })

      if (error) throw error

      const normalized = Array.isArray(data) ? data : []

      // Keep Cargo list aligned with My Jobs behavior:
      // - trailer_cargo: one-run jobs should only appear before activation (status=assigned)
      // - load_cargo: keep visible while there is remaining payload
      const filtered = normalized.filter((row: any) => {
        const job = row?.job_offer ?? {}
        const mode = String(job?.transport_mode ?? '').toLowerCase()
        const status = String(row?.status ?? '').toLowerCase()

        if (mode === 'trailer_cargo') {
          return status === 'assigned'
        }

        const rowRemaining = Number(row?.payload_remaining_kg ?? NaN)
        if (Number.isFinite(rowRemaining)) return rowRemaining > 0

        const offerRemaining = Number(job?.remaining_payload ?? NaN)
        if (Number.isFinite(offerRemaining)) return offerRemaining > 0

        const offerWeight = Number(job?.weight_kg ?? NaN)
        return Number.isFinite(offerWeight) && offerWeight > 0
      })

      setCargoJobs(filtered)
    } catch (e: any) {
      setCargoError(e?.message ?? 'Failed to load cargo')
      setCargoJobs([])
    } finally {
      setLoadingCargo(false)
    }
  }

  // Load drivers when Drivers tab becomes active
  useEffect(() => {
    if (activeTab === 'drivers') {
      void fetchAvailableDrivers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Load cargo assigned jobs when Cargo tab becomes active
  useEffect(() => {
    if (activeTab === 'cargo') {
      void fetchAssignedJobs(initialCompanyId || undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  useEffect(() => {
    function reloadAll() {
      try {
        refresh()
      } catch {
        // ignore
      }
      try {
        refreshTrailers()
      } catch {
        // ignore
      }
      void fetchAvailableDrivers(initialCompanyId || undefined)
      void fetchAssignedJobs(initialCompanyId || undefined)
      void fetchCompanyTrucksForStaging(initialCompanyId || undefined)
    }

    window.addEventListener('staging:reload', reloadAll)
    return () => window.removeEventListener('staging:reload', reloadAll)
    // Intentionally empty deps: functions are stable enough for this listener
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (
      activeTab === 'trucks' &&
      !loadingTrucks &&
      trucks.length === 0 &&
      !loadingCompanyTrucks &&
      companyTrucks.length === 0
    ) {
      void fetchCompanyTrucksForStaging(initialCompanyId || undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loadingTrucks, trucks.length])

  function renderTruckLabel(t: TruckCardRow): string {
    return t.name || t.registration || `Truck ${String(t.id).substring(0, 8)}`
  }

  function getGCWDisplay(raw: any, model: any): JSX.Element | null {
    const truckClass = model?.class

    if (!truckClass || String(truckClass).toLowerCase() !== 'big') {
      return null
    }

    const gcwRaw =
      model?.gcw ??
      raw?.gcw_class ??
      raw?.gcw ??
      model?.reliability ??
      raw?.reliability ??
      null

    const letter = normalizeGcwLetter(gcwRaw)

    return <span>GCW: {letter ?? '—'}</span>
  }

  function renderTruckMeta(t: TruckCardRow): JSX.Element {
    const raw: any = t._raw ?? {}
    const model: any = t.model ?? {}

    const locationName = raw.location_city_name ?? raw.location_city_id ?? null
    const cargoNames = Array.isArray(raw.cargo_type_names) ? raw.cargo_type_names : []

    return (
      <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {locationName && (
          <span>
            Location: <span className="font-semibold text-slate-800">{locationName}</span>
          </span>
        )}
        {raw.hub && (
          <span>
            Hub: <span className="font-semibold text-slate-800">{raw.hub}</span>
          </span>
        )}
        {raw.condition_score != null && (
          <span>
            Condition: <span className="font-semibold text-slate-800">{raw.condition_score}</span>
          </span>
        )}
        {model?.class && (
          <span>
            Class: <span className="font-semibold text-slate-800">{model.class}</span>
          </span>
        )}
        {cargoNames.length > 0 && (
          <span>
            Cargo: <span className="font-semibold text-slate-800">{cargoNames.join(', ')}</span>
          </span>
        )}
        {getGCWDisplay(raw, model)}
        {model?.max_payload != null && (
          <span>
            Payload: <span className="font-semibold text-slate-800">{model.max_payload} kg</span>
          </span>
        )}
      </div>
    )
  }

  const trucksToShow: TruckCardRow[] = trucks.length > 0 ? trucks : companyTrucks

  const PAGE_SIZE = 10
  const [truckPage, setTruckPage] = useState<number>(1)
  const totalTruckPages = Math.max(1, Math.ceil(trucksToShow.length / PAGE_SIZE))

  useEffect(() => {
    setTruckPage(1)
  }, [trucksToShow.length, trucks.length, companyTrucks.length])

  const pagedTrucks = useMemo(() => {
    const start = (truckPage - 1) * PAGE_SIZE
    return trucksToShow.slice(start, start + PAGE_SIZE)
  }, [trucksToShow, truckPage])

  const summaryCount =
    activeTab === 'trucks'
      ? trucksToShow.length
      : activeTab === 'drivers'
      ? drivers.length
      : activeTab === 'cargo'
      ? cargoJobs.length
      : activeTab === 'trailers'
      ? trailers.length
      : 0

  const listScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = listScrollRef.current
    if (!el) return

    function onDragOver(e: DragEvent) {
      try {
        e.preventDefault()
        const rect = el.getBoundingClientRect()
        const y = e.clientY - rect.top
        const threshold = 48
        const maxStep = 24

        if (y < threshold) {
          const factor = 1 - y / threshold
          const step = Math.max(2, Math.round(maxStep * factor))
          el.scrollBy({ top: -step })
        } else if (y > rect.height - threshold) {
          const factor = (y - (rect.height - threshold)) / threshold
          const step = Math.max(2, Math.round(maxStep * factor))
          el.scrollBy({ top: step })
        }
      } catch {
        // swallow errors
      }
    }

    el.addEventListener('dragover', onDragOver)
    return () => {
      el.removeEventListener('dragover', onDragOver)
    }
  }, [])

  return (
    <>
      <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2" role="tablist" aria-label="Staging tabs">
            <TabButton id="cargo" active={activeTab === 'cargo'} onClick={() => setActiveTab('cargo')}>
              Cargo
            </TabButton>
            <TabButton id="trucks" active={activeTab === 'trucks'} onClick={() => setActiveTab('trucks')}>
              Trucks
            </TabButton>
            <TabButton id="trailers" active={activeTab === 'trailers'} onClick={() => setActiveTab('trailers')}>
              Trailers
            </TabButton>
            <TabButton id="drivers" active={activeTab === 'drivers'} onClick={() => setActiveTab('drivers')}>
              Drivers
            </TabButton>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm text-slate-600">Showing</div>
            <div className="text-sm font-semibold">{activeTab}</div>
          </div>
        </div>

        <div ref={listScrollRef} className="min-h-[128px] border border-slate-100 rounded p-3 max-h-[320px] overflow-auto">
          {activeTab === 'trucks' ? (
            <>
              {loadingTrucks || loadingCompanyTrucks ? (
                <div className="text-sm text-slate-500">Loading trucks…</div>
              ) : trucksError || companyTrucksError ? (
                <div className="text-sm text-red-600">Error loading trucks: {trucksError || companyTrucksError}</div>
              ) : pagedTrucks.length === 0 ? (
                <div className="text-sm text-slate-500">No trucks yet — will show rows here.</div>
              ) : (
                <ul className="space-y-2">
                  {pagedTrucks.map((t: TruckCardRow) => {
                    const compatible = truckCanHandleCargo(t, assignment?.cargo)

                    return (
                      <li
                        key={t.id}
                        draggable={compatible}
                        onDragStart={(ev) => {
                          if (!compatible) {
                            ev.preventDefault()
                            return
                          }
                          const payload = { type: 'truck', id: t.id, label: renderTruckLabel(t), model: t.model, _raw: t._raw }
                          ev.dataTransfer.setData('application/json', JSON.stringify(payload))
                          ev.dataTransfer.setData('text/plain', `truck:${t.id}:${renderTruckLabel(t)}`)
                        }}
                        className={`p-3 border-b last:border-b-0 ${compatible ? 'border-slate-200 hover:bg-slate-50 cursor-grab flex items-center justify-between' : 'opacity-40 cursor-not-allowed bg-slate-50 flex items-center justify-between'}`}
                      >
                        <div>
                          <div className="font-medium text-slate-800 flex items-center gap-2">
                            <span>{renderTruckLabel(t)}</span>
                          </div>
                          {t.model?.make || t.model?.model ? (
                            <div className="text-xs text-slate-500">
                              {t.model?.make ?? ''} {t.model?.model ?? ''} {t.model?.year ? `• ${t.model.year}` : ''}
                            </div>
                          ) : null}
                          {renderTruckMeta(t)}
                        </div>
                        <div className="text-xs text-slate-500">{t.registration ?? ''}</div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : activeTab === 'trailers' ? (
            <>
              {loadingTrailers ? (
                <div className="text-sm text-slate-500">Loading trailers…</div>
              ) : trailersError ? (
                <div className="text-sm text-red-600">Error loading trailers: {trailersError}</div>
              ) : trailers.length === 0 ? (
                <div className="text-sm text-slate-500">No trailers yet — will show rows here.</div>
              ) : (
                <ul className="space-y-2">
                  {trailersToShow.map((tr: TrailerCardRow) => {
                    const jobCargoTypeId =
                      (assignment?.cargo?.job_offer?.cargo_type_id as string | null) ??
                      (assignment?.cargo?.cargo_type_id as string | null) ??
                      null

                    const basicAvailable =
                      Boolean(tr && tr.isActive !== false && (tr.status ?? 'available') === 'available')

                    const truck = assignment?.truck

                    const compatible = Boolean(
                      tr &&
                        tr.isActive !== false &&
                        (tr.status ?? 'available') === 'available' &&
                        (!jobCargoTypeId || String(tr.cargoTypeId) === String(jobCargoTypeId)) &&
                        (!truck || gcwAllowsTrailer(truck, tr))
                    )

                    const currentId = String(tr.id ?? tr._raw?.id ?? '')
                    return (
                      <li
                        key={tr.id ?? tr._raw?.id ?? Math.random()}
                        draggable={compatible}
                        onDragStart={(ev) => {
                          if (!compatible) {
                            ev.preventDefault()
                            return
                          }
                          const canonicalId = tr.id ?? tr._raw?.id
                          const payload = { type: 'trailer', id: canonicalId, label: tr.label, payloadKg: tr.payloadKg, _raw: tr._raw }
                          ev.dataTransfer.setData('application/json', JSON.stringify(payload))
                          ev.dataTransfer.setData('text/plain', `trailer:${canonicalId}:${tr.label}`)
                        }}
                        className={`p-3 border-b border-slate-200 last:border-b-0 ${compatible ? 'hover:bg-slate-50 cursor-grab flex items-center justify-between' : 'opacity-40 cursor-not-allowed bg-slate-50 flex items-center justify-between'}`}
                      >
                        <div>
                          <div className="font-medium text-slate-800 flex items-center gap-2">
                            <span>{tr.label || `Trailer ${String((tr.id ?? tr._raw?.id ?? '')).substring(0, 8)}`}</span>

                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                            {tr.locationCityName && (
                              <span>
                                Location:{' '}
                                <span className="font-semibold text-slate-800">{tr.locationCityName}</span>
                              </span>
                            )}
                            <span>
                              GCW:{' '}
                              <span className="font-semibold text-slate-800">{tr.gcwClass ?? '—'}</span>
                            </span>
                            <span>
                              Condition:{' '}
                              <span className="font-semibold text-slate-800">{tr.condition ?? 100}</span>
                            </span>
                            <span>
                              Payload:{' '}
                              <span className="font-semibold text-slate-800">{Number(tr.payloadKg ?? 0).toFixed(0)} kg</span>
                            </span>
                            <span>
                              Cargo type:{' '}
                              <span className="font-semibold text-slate-800">{tr.cargoTypeName ?? tr.cargoTypeId ?? '—'}</span>
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-500">{tr.status ?? '—'}</div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : activeTab === 'drivers' ? (
            <>
              {loadingDrivers ? (
                <div className="text-sm text-slate-500">Loading drivers…</div>
              ) : driversError ? (
                <div className="text-sm text-red-600">Error loading drivers: {driversError}</div>
              ) : drivers.length === 0 ? (
                <div className="text-sm text-slate-500">No drivers yet — will show rows here.</div>
              ) : (
                <ul className="space-y-2">
                  {drivers.map((d) => {
                    // --- NEW: same-city / assignable check (driver.current_location_id vs truck.location_city_id)
                    const truckCityId =
                      assignment?.truck?.location_city_id ??
                      assignment?.truck?._raw?.location_city_id ??
                      null

                    const driverCityId =
                      d.current_location_id ?? d.location_city_id ?? null

                    const canAssign =
                      Boolean(truckCityId) &&
                      Boolean(driverCityId)
                    // --- END same-city / assignable check

                    return (
                      <li
                        key={d.id}
                        draggable={canAssign}
                        onDragStart={(ev) => {
                          const payload = { type: 'driver', id: d.id, label: d.name ?? `${d.first_name ?? ''} ${d.last_name ?? ''}` }
                          ev.dataTransfer.setData('application/json', JSON.stringify(payload))
                          ev.dataTransfer.setData('text/plain', `driver:${d.id}:${d.name ?? ''}`)
                        }}
                        className={`p-3 border-b border-slate-200 last:border-b-0 flex items-center justify-between ${canAssign ? 'hover:bg-slate-50 cursor-grab' : 'opacity-40 cursor-not-allowed bg-slate-50'}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            {d.roles && d.roles.length > 0 ? (
                              <div className="flex gap-1 items-center">
                                {d.roles.map((r) => (
                                  <span key={r} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600">
                                    {r}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div className="font-medium text-slate-800 flex items-center gap-2">

                              <span>{d.name ?? `${d.first_name ?? ''} ${d.last_name ?? ''}`}</span>
                            </div>
                          </div>

                          <div className="text-xs text-slate-500 mt-1 flex gap-3 flex-wrap">
                            <span>
                              EXP:{' '}
                              <span className="font-semibold text-slate-800">
                                {d.experience ?? 0}
                              </span>
                            </span>

                            <span>
                              Fatigue:{' '}
                              <span
                                className="font-semibold"
                                style={{
                                  color: percentToRedGreenColor(
                                    Math.round((d.fatigue ?? 0) as number),
                                    true
                                  ),
                                }}
                              >
                                {Math.round((d.fatigue ?? 0) as number)}%
                              </span>
                            </span>

                            <span>
                              Mood:{' '}
                              <span
                                className="font-semibold"
                                style={{
                                  color: percentToRedGreenColor(
                                    Math.round((d.happiness ?? 100) as number)
                                  ),
                                }}
                              >
                                {Math.round((d.happiness ?? 100) as number)}%
                              </span>
                            </span>

                            {d.location && (
                              (() => {
                                const truckCityIdInner =
                                  assignment?.truck?.location_city_id ??
                                  assignment?.truck?._raw?.location_city_id ??
                                  null

                                // Driver's current location id (explicit alias if present)
                                const driverCityIdInner = d.current_location_id ?? d.location_city_id ?? null

                                // Relocation required only when both IDs exist and differ.
                                const needsRelocation = Boolean(
                                  truckCityIdInner &&
                                  driverCityIdInner &&
                                  String(driverCityIdInner) !== String(truckCityIdInner)
                                )

                                return (
                                  <span>
                                    Location:{' '}
                                    <span className="font-semibold text-slate-800">{d.location}</span>

                                    {needsRelocation && relocationInfo[d.id] && (
                                      <span className="text-xs text-amber-600 ml-2 whitespace-nowrap">
                                        • Relocation: {relocationInfo[d.id].km} km • {relocationInfo[d.id].hours.toFixed(1)}h • ${relocationInfo[d.id].cost.toFixed(0)}
                                      </span>
                                    )}
                                  </span>
                                )
                              })()
                            )}
                          </div>

                          <div className="flex gap-2 mt-2 flex-wrap">
                            {(() => {
                              const skills = [d.skill1, d.skill2, d.skill3].filter(Boolean).filter((s: any) => s && s.id)
                              if (skills.length === 0) {
                                return <div className="px-2 py-1 text-xs text-slate-500">no skill</div>
                              }
                              return skills.map((skill: any) => (
                                <div key={skill.id} className="px-2 py-1 text-xs bg-slate-100 border border-slate-200 rounded-md">
                                  <span>{skill.name}</span>
                                </div>
                              ))
                            })()}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">{d.hired_at ? new Date(d.hired_at).toLocaleDateString() : ''}</div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : activeTab === 'cargo' ? (
            <>
              {loadingCargo ? (
                <div className="text-sm text-slate-500">Loading cargo…</div>
              ) : cargoError ? (
                <div className="text-sm text-red-600">Error loading cargo: {cargoError}</div>
              ) : cargoJobs.length === 0 ? (
                <div className="text-sm text-slate-500">No assigned cargo.</div>
              ) : (
                <ul className="space-y-2">
                  {cargoJobs.map((assignment: any) => {
                    const job = assignment.job_offer ?? {}
                    const cargoItemName = job.cargo_items?.name ?? job.cargo_item_id ?? 'Cargo'
                    const cargoTypeName = job.cargo_types?.name ?? job.cargo_type_id ?? ''
                    const origin = job.origin_city?.city_name ?? ''
                    const dest = job.destination_city?.city_name ?? ''
                    const pickup = job.pickup_time ?? null
                    const deadline = job.delivery_deadline ?? null
                    const transportMode = job.transport_mode ?? null

                    const rowStatus = String(assignment?.status ?? '').toLowerCase()
                    const rowAssignedPayload = Number(assignment?.assigned_payload_kg ?? NaN)
                    const rowRemainingPayload = Number(assignment?.payload_remaining_kg ?? NaN)
                    const offerRemainingPayload = Number(job?.remaining_payload ?? NaN)
                    const offerWeight = Number(job?.weight_kg ?? NaN)

                    const weight =
                      Number.isFinite(rowRemainingPayload) && rowRemainingPayload > 0
                        ? rowRemainingPayload
                        : rowStatus === 'assigned'
                        ? (Number.isFinite(offerRemainingPayload)
                            ? offerRemainingPayload
                            : Number.isFinite(offerWeight)
                              ? offerWeight
                              : null)
                        : (Number.isFinite(rowAssignedPayload)
                            ? rowAssignedPayload
                            : Number.isFinite(offerWeight)
                              ? offerWeight
                              : null)

                    const reward = transportMode === 'trailer_cargo' ? job.reward_trailer_cargo : job.reward_load_cargo

                    // Determine if pickup time has arrived. If pickup_time is missing, consider it ready.
                    const pickupMs = pickup ? new Date(String(pickup)).getTime() : null
                    const pickupReady = pickupMs == null ? true : pickupMs <= Date.now()

                    const originFlag = resolveFlagForLocation(job.origin_city, origin)
                    const destFlag = resolveFlagForLocation(job.destination_city, dest)

                    return (
                      <li
                        key={assignment.id}
                        draggable={pickupReady} // only draggable when pickup is ready
                        onDragStart={(ev) => {
                          // Prevent drag when pickup not ready
                          if (!pickupReady) {
                            ev.preventDefault()
                            return
                          }
                          const payload = {
                            type: 'cargo',
                            id: assignment.id,
                            label: cargoItemName,
                            status: assignment.status ?? null,
                            assigned_payload_kg: assignment.assigned_payload_kg ?? null,
                            payload_remaining_kg: assignment.payload_remaining_kg ?? null,
                            job_offer: job,
                          }
                          ev.dataTransfer.setData('application/json', JSON.stringify(payload))
                          ev.dataTransfer.setData('text/plain', `cargo:${assignment.id}:${cargoItemName}`)
                        }}
                        title={!pickupReady ? 'Pickup not ready yet' : undefined}
                        className={`p-3 border-b border-slate-200 last:border-b-0 ${pickupReady ? 'hover:bg-slate-50 cursor-grab' : 'opacity-40 cursor-not-allowed bg-slate-50'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-slate-800">{cargoItemName}</div>

                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 font-semibold text-slate-800">
                                  {originFlag ? (
                                    // eslint-disable-next-line jsx-a11y/alt-text
                                    <img src={originFlag} className="w-3 h-3 rounded-sm object-cover" />
                                  ) : (
                                    <Flag className="w-3 h-3 text-slate-400" />
                                  )}
                                  {origin || '—'}
                                </span>
                                <span className="text-slate-400">→</span>
                                <span className="flex items-center gap-1 font-semibold text-slate-800">
                                  {destFlag ? (
                                    // eslint-disable-next-line jsx-a11y/alt-text
                                    <img src={destFlag} className="w-3 h-3 rounded-sm object-cover" />
                                  ) : (
                                    <Flag className="w-3 h-3 text-slate-400" />
                                  )}
                                  {dest || '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <CargoTypeBadge name={cargoTypeName} />
                        </div>

                        <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          <span>
                            Transport:{' '}
                            {transportMode === 'trailer_cargo' ? (
                              <span className="font-semibold text-purple-600">Trailer</span>
                            ) : transportMode === 'load_cargo' ? (
                              <span className="font-semibold text-blue-600">Load</span>
                            ) : (
                              <span className="font-semibold text-slate-700">Unknown</span>
                            )}
                          </span>

                          {pickup && (
                            <span>
                              Pickup:{' '}
                              <span className={`font-semibold ${pickupReady ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {new Date(pickup).toLocaleString()}
                              </span>
                            </span>
                          )}

                          {deadline && (() => {
                            /**
                             * Determine if the deadline has passed and render with
                             * a red emphasis when expired or green when upcoming.
                             */
                            const isExpired = new Date(String(deadline)) < new Date()
                            return (
                              <span>
                                Deadline:{' '}
                                <span className={isExpired ? 'text-rose-600 font-semibold' : 'font-semibold text-green-600'}>
                                  {new Date(deadline).toLocaleDateString()}{' '}
                                  {new Date(deadline).toLocaleTimeString()}
                                </span>
                              </span>
                            )
                          })()}

                          <span>
                            Distance:{' '}
                            <span className="font-semibold">
                              {job?.distance_km != null && !Number.isNaN(Number(job.distance_km))
                                ? `${Number(job.distance_km).toFixed(0)} km`
                                : '—'}
                            </span>
                          </span>

                          {weight != null && (
                            <span>
                              Weight:{' '}
                              <span className="font-semibold">{Number(weight).toFixed(0)} kg</span>
                            </span>
                          )}

                          <span>
                            Reward:{' '}
                            {reward != null ? (typeof reward === 'number' ? `$${reward}` : String(reward)) : '—'}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : (
            <div className="text-sm text-slate-500">No {activeTab} yet — will show rows here.</div>
          )}
        </div>

        <aside className="border border-slate-100 rounded p-3 flex flex-col justify-between mt-4">
          <div>
            <div className="text-xs text-slate-600">Summary</div>
            <div className="text-lg font-semibold mt-2">{summaryCount}</div>
            <div className="text-sm text-slate-500 mt-2">Drag rows from lists onto the assembler below to assign assets.</div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <div className="w-full px-3 py-2 rounded" style={{ visibility: 'hidden' }} />{/* placeholder to keep layout unchanged */}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await refresh()
                  void refreshTrailers()
                  if (activeTab === 'drivers') {
                    void fetchAvailableDrivers(initialCompanyId || undefined)
                  }
                  if (activeTab === 'trucks') {
                    void fetchCompanyTrucksForStaging(initialCompanyId || undefined)
                  }
                  if (activeTab === 'cargo') {
                    void fetchAssignedJobs(initialCompanyId || undefined)
                  }
                }}
                className="flex-1 px-3 py-2 border border-slate-200 rounded hover:bg-slate-50 transition text-sm"
                type="button"
              >
                Refresh
              </button>
              <button
                onClick={() => {
                  // eslint-disable-next-line no-console
                  console.debug(`Create ${activeTab}`)
                }}
                className="px-3 py-2 border border-slate-200 rounded hover:bg-slate-50 transition text-sm"
                type="button"
              >
                Create
              </button>
            </div>

            {activeTab === 'trucks' && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-sm text-slate-600">
                  Showing {(pagedTrucks.length === 0 ? 0 : (truckPage - 1) * PAGE_SIZE + 1)}–{Math.min(truckPage * PAGE_SIZE, trucksToShow.length)} of {trucksToShow.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTruckPage((p) => Math.max(1, p - 1))}
                    disabled={truckPage <= 1}
                    className={`px-2 py-1 text-sm rounded border ${truckPage <= 1 ? 'text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                  >
                    Prev
                  </button>
                  <div className="text-sm text-slate-700">Page {truckPage} / {totalTruckPages}</div>
                  <button
                    type="button"
                    onClick={() => setTruckPage((p) => Math.min(totalTruckPages, p + 1))}
                    disabled={truckPage >= totalTruckPages}
                    className={`px-2 py-1 text-sm rounded border ${truckPage >= totalTruckPages ? 'text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>

      <div className="mt-6">
        <AssignmentPanel
          onAssignmentChange={setAssignment}
          relocationInfo={relocationInfo}
          companyId={effectiveCompanyId || initialCompanyId || null}
        />
      </div>
    </>
  )
}

/**
 * TabButton
 *
 * Presentational tab header button.
 */
function TabButton({ id, active, children, onClick }: any) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-sm font-medium transition ${active ? 'bg-yellow-400 text-black' : 'text-slate-700 hover:bg-slate-50'}`}
      type="button"
    >
      {children}
    </button>
  )
}