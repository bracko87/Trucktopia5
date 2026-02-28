/**
 * TruckCard.tsx
 *
 * Single-row truck card used in the trucks list. Shows truck info and an
 * expandable details panel. Allows editing name, registration and hub assignment
 * for owned trucks. When isMarket=true the card is read-only.
 *
 * Enhanced with maintenance UI and safe location handling:
 * - Tracks currentCity separately from hubCity so real truck location (location_city_id)
 *   is displayed when available.
 * - Hub remains separate and is not allowed to overwrite the real location.
 *
 * UI enhancements:
 * - Hover/focus "pop" effect (shadow + slight lift) similar to trailers/staff.
 * - More granular status pill colors so statuses are easier to distinguish.
 */

import React, { useEffect, useState } from 'react'
import { Menu, Edit3, Check, X } from 'lucide-react'
import { supabaseFetch, getTable } from '../../lib/supabase'
import LogModal from './LogModal'
import TruckSpecModal from './TruckSpecModal'
import TruckComponentsModal from './TruckComponentsModal'
import SellTruckModal from './SellTruckModal'
import InsuranceModal from './InsuranceModal'
import RegistrationInput from '../common/RegistrationInput'
import TruckInsurance from './TruckInsurance'
import MaintenanceModal from './MaintenanceModal'
import TruckImageField from './TruckImageField'
import { computeMaintenanceCost } from '../../services/maintenanceService'

/**
 * ModelInfo
 *
 * Optional pre-resolved model values passed from the list (batched).
 */
interface ModelInfo {
  make?: string | null
  model?: string | null
  country?: string | null
  class?: string | null
  max_payload?: number | null
  tonnage?: number | null
  year?: number | null
  cargo_type_id?: string | null
  cargo_type_name?: string | null
  cargo_type_id_secondary?: string | null
  cargo_type_secondary_name?: string | null
  max_load_kg?: number | null
  fuel_tank_capacity_l?: number | null
  fuel_type?: string | null
  image_url?: string | null
  gcw?: number | null
}

/**
 * Props for TruckCard
 */
interface TruckCardProps {
  truck: any
  modelInfo?: ModelInfo
  defaultName?: string
  defaultRegistration?: string
  isMarket?: boolean
}

/**
 * formatModelDisplay
 *
 * Combine make and model into a single display string with sensible fallbacks.
 *
 * @param info - ModelInfo
 * @param fallback - fallback string when info unavailable
 * @returns combined display string
 */
function formatModelDisplay(info?: ModelInfo | null, fallback?: string) {
  if (!info) return fallback ?? 'Unknown model'
  const parts = [info.make, info.model].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : fallback ?? 'Unknown model'
}

/**
 * statusClass
 *
 * Map truck status to pill color classes.
 *
 * @param s - status string
 * @returns Tailwind CSS classes
 */
function formatStatusLabel(s?: string | null) {
  const raw = String(s ?? 'unknown').trim()
  if (!raw) return 'unknown'
  return raw.replace(/_/g, ' ')
}

/**
 * extractCityNameFromEmbeddedRelation
 *
 * PostgREST/Supabase relationship payloads may come back as either:
 * - an object (many-to-one)
 * - an array (one-to-many / ambiguous cardinality)
 *
 * This helper safely extracts city_name from either shape.
 */
function extractCityNameFromEmbeddedRelation(value: any): string | null {
  if (!value) return null

  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first?.city_name === 'string' && first.city_name.trim()
      ? first.city_name.trim()
      : null
  }

  if (typeof value === 'object') {
    return typeof value.city_name === 'string' && value.city_name.trim()
      ? value.city_name.trim()
      : null
  }

  return null
}

/**
 * extractEmbeddedTruckModel
 *
 * Normalizes PostgREST embed payload for `truck_models` so callers can consume
 * a single object regardless of whether the relation is returned as object/array.
 */
function extractEmbeddedTruckModel(value: any): any | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  if (typeof value === 'object') return value
  return null
}

function statusClass(s: string) {
  switch ((s ?? '').toLowerCase()) {
    // Idle / available
    case 'available':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    case 'idle':
      return 'bg-sky-50 text-sky-700 ring-sky-100'
    case 'parked':
      return 'bg-slate-50 text-slate-700 ring-slate-200'

    // Operational / assigned (separated visually)
    case 'assigned':
      return 'bg-amber-50 text-amber-700 ring-amber-100'
    case 'in_use':
      return 'bg-orange-50 text-orange-700 ring-orange-100'
    case 'reserved':
      return 'bg-teal-50 text-teal-700 ring-teal-100'

    // Job progress / transit
    case 'picking_up':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-100'
    case 'loading':
      return 'bg-blue-50 text-blue-700 ring-blue-100'
    case 'in_transit':
      return 'bg-cyan-50 text-cyan-700 ring-cyan-100'
    case 'delivering':
      return 'bg-violet-50 text-violet-700 ring-violet-100'
    case 'unloading':
      return 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100'

    // Maintenance / problem states
    case 'maintenance':
      return 'bg-rose-50 text-rose-700 ring-rose-100'
    case 'in_repair':
      return 'bg-red-50 text-red-700 ring-red-100'
    case 'damaged':
      return 'bg-red-100 text-red-800 ring-red-200'
    case 'suspended':
      return 'bg-rose-600 text-white ring-rose-700'

    default:
      return 'bg-gray-50 text-gray-700 ring-gray-100'
  }
}

function isTruckInTransit(truck: any): boolean {
  const rawStatus = String(truck?.status ?? '').toUpperCase()
  if (rawStatus === 'IN_TRANSIT') return true

  const availableFrom = truck?.available_from_at
  if (!availableFrom) return false

  const t = new Date(availableFrom).getTime()
  if (Number.isNaN(t)) return false

  return Date.now() < t
}

function formatTimeLeftShort(availableFromAt?: string | null): string {
  if (!availableFromAt) return 'Pending delivery'

  const target = new Date(availableFromAt).getTime()
  if (Number.isNaN(target)) return 'Pending delivery'

  const ms = target - Date.now()
  if (ms <= 0) return 'Available now'

  const totalMinutes = Math.ceil(ms / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/**
 * parseRegistration
 *
 * Parse a registration string into prefix (2 letters) and digits suffix.
 *
 * @param reg - registration string (may be null)
 * @returns [prefix, digits]
 */
function parseRegistration(reg?: string | null): [string, string] {
  if (!reg || typeof reg !== 'string' || reg.length < 2) return ['XX', '']
  const prefix = reg.slice(0, 2).toUpperCase()
  const digits = reg.slice(2).replace(/\D/g, '')
  return [prefix, digits]
}

/**
 * normalizeRegistration
 *
 * Ensure registration is always saved in normalized form:
 * - 2-letter uppercase prefix
 * - up to 4 numeric digits
 */
function normalizeRegistration(prefix?: string | null, digits?: string | null): string {
  const rawPrefix = String(prefix ?? '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()

  const safePrefix =
    rawPrefix.length >= 2
      ? rawPrefix.slice(0, 2)
      : rawPrefix.length === 1
        ? `${rawPrefix}X`
        : 'XX'

  const safeDigits = String(digits ?? '')
    .replace(/\D/g, '')
    .slice(0, 4)

  return `${safePrefix}${safeDigits}`
}

/**
 * deriveRegistrationDigitsSeed
 *
 * Generate a fallback digits seed for a registration:
 * - Prefer digits parsed from fallbackReg
 * - Otherwise derive last 4 digits from the truckId (non-digits stripped)
 * - Finally fall back to '1'
 *
 * @param truckId - truck UUID
 * @param fallbackReg - optional fallback registration string
 * @returns up to 4 digit string
 */
function deriveRegistrationDigitsSeed(truckId?: string | null, fallbackReg?: string | null): string {
  const [, fallbackDigits] = parseRegistration(fallbackReg)
  if (fallbackDigits) return fallbackDigits.slice(0, 4)

  const digitsFromId = String(truckId ?? '')
    .replace(/\D/g, '')
    .slice(-4)

  if (digitsFromId) return digitsFromId
  return '1'
}

/**
 * HubOption
 *
 * Minimal hub representation used in the selector.
 */
interface HubOption {
  id: string
  city?: string | null
  country?: string | null
  is_main?: boolean | null
  city_id?: string | null
}

/**
 * TruckCard
 *
 * Shows truck info and allows editing name, registration and hub (city)
 * assignment for owned trucks. When isMarket=true the card is read-only.
 *
 * @param props - TruckCardProps
 */
export default function TruckCard({
  truck,
  modelInfo,
  defaultName,
  defaultRegistration,
  isMarket = false,
}: TruckCardProps) {
  // Basic derived values
  const id = truck?.id ?? ''
  const status = ((truck?.status as unknown as string) ?? 'unknown').toLowerCase()
  const mileage = (truck?.mileage_km as unknown as number) ?? (truck as any)?.mileage ?? 0
  const conditionScore = (truck?.condition_score as unknown as number) ?? 0

  // Embedded truck_model relation from page-level joined fetch (object or array)
  const embeddedTruckModel = React.useMemo(
    () => extractEmbeddedTruckModel((truck as any)?.truck_models),
    [truck]
  )

  // Prefer explicit modelInfo prop, then embedded relation, then denormalized truck fields
  const resolvedModelInfo: ModelInfo = React.useMemo(
    () => ({
      make: modelInfo?.make ?? embeddedTruckModel?.make ?? truck?.model_make ?? null,
      model: modelInfo?.model ?? embeddedTruckModel?.model ?? truck?.model_model ?? null,
      country: modelInfo?.country ?? embeddedTruckModel?.country ?? truck?.model_country ?? null,
      class: modelInfo?.class ?? embeddedTruckModel?.class ?? truck?.model_class ?? null,
      max_payload: modelInfo?.max_payload ?? embeddedTruckModel?.max_payload ?? null,
      tonnage: modelInfo?.tonnage ?? embeddedTruckModel?.tonnage ?? truck?.model_tonnage ?? null,
      year: modelInfo?.year ?? embeddedTruckModel?.year ?? truck?.model_year ?? null,
      cargo_type_id: modelInfo?.cargo_type_id ?? embeddedTruckModel?.cargo_type_id ?? truck?.cargo_type_id ?? null,
      cargo_type_name: modelInfo?.cargo_type_name ?? embeddedTruckModel?.cargo_type_name ?? truck?.cargo_type_name ?? null,
      cargo_type_id_secondary:
        modelInfo?.cargo_type_id_secondary ??
        embeddedTruckModel?.cargo_type_id_secondary ??
        truck?.cargo_type_id_secondary ??
        null,
      cargo_type_secondary_name:
        modelInfo?.cargo_type_secondary_name ??
        embeddedTruckModel?.cargo_type_secondary_name ??
        truck?.cargo_type_secondary_name ??
        null,
      max_load_kg:
        modelInfo?.max_load_kg ??
        embeddedTruckModel?.max_load_kg ??
        truck?.model_max_load_kg ??
        truck?.max_payload_kg ??
        null,
      fuel_tank_capacity_l:
        modelInfo?.fuel_tank_capacity_l ??
        embeddedTruckModel?.fuel_tank_capacity_l ??
        truck?.model_fuel_tank_capacity_l ??
        null,
      fuel_type: modelInfo?.fuel_type ?? embeddedTruckModel?.fuel_type ?? truck?.model_fuel_type ?? null,
      image_url: modelInfo?.image_url ?? embeddedTruckModel?.image_url ?? truck?.model_image_url ?? null,
      gcw:
        modelInfo?.gcw ??
        (embeddedTruckModel?.gcw !== undefined && embeddedTruckModel?.gcw !== null
          ? Number(embeddedTruckModel?.gcw)
          : null) ??
        ((truck as any)?.gcw !== undefined && (truck as any)?.gcw !== null ? Number((truck as any)?.gcw) : null),
    }),
    [modelInfo, embeddedTruckModel, truck]
  )

  // Maintenance related state
  const [lastMaintenanceAt, setLastMaintenanceAt] = useState<string | null>((truck as any)?.last_maintenance_at ?? null)
  const [nextMaintenanceKm, setNextMaintenanceKm] = useState<number | null>((truck as any)?.next_maintenance_km ?? null)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [maintenanceEstimates, setMaintenanceEstimates] = useState<any>(null)

  // Cargo icons and other existing states...
  const [cargoIconUrl, setCargoIconUrl] = useState<string | null>(null)
  const [cargoIconUrlSecondary, setCargoIconUrlSecondary] = useState<string | null>(null)

  // CGW fetched from truck_models when not present in props/truck
  const [fetchedCgwNum, setFetchedCgwNum] = useState<number | null>(null)
  const [fetchedCgwLabel, setFetchedCgwLabel] = useState<string | null>(null)

  // Editable name
  const [name, setName] = useState<string>((truck as any)?.name ?? defaultName ?? '')
  const [savingName, setSavingName] = useState<boolean>(false)
  const [editingName, setEditingName] = useState<boolean>(false)
  const [editInput, setEditInput] = useState<string>(name)

  // Registration state
  const [registration, setRegistration] = useState<string | null>(
    ((truck as any)?.registration as string) ?? defaultRegistration ?? null
  )
  const [savingRegistration, setSavingRegistration] = useState<boolean>(false)
  const [registrationDigits, setRegistrationDigits] = useState<string>('')
  const registrationDigitsRef = React.useRef<string>('')
  const [hydratingRegistration, setHydratingRegistration] = useState<boolean>(false)
  const registrationHydratedForTruckRef = React.useRef<string | null>(null)

  /**
   * syncRegistrationState
   *
   * Keep the local registration and digit inputs in sync.
   *
   * @param nextRegistration - next registration string or null
   */
  const syncRegistrationState = React.useCallback((nextRegistration: string | null) => {
    const normalized = typeof nextRegistration === 'string' ? nextRegistration : null
    const [, nextDigitsRaw] = parseRegistration(normalized)
    const nextDigits = nextDigitsRaw.slice(0, 4)

    registrationDigitsRef.current = nextDigits
    setRegistration(normalized)
    setRegistrationDigits(nextDigits)
  }, [])

  useEffect(() => {
    const [, d] = parseRegistration(registration ?? defaultRegistration ?? null)
    const nextDigits = d.slice(0, 4)

    registrationDigitsRef.current = nextDigits
    setRegistrationDigits((prev) => (prev === nextDigits ? prev : nextDigits))
  }, [registration, defaultRegistration])

  // Hub selection
  const [hubCity, setHubCity] = useState<string | null>((truck as any)?.hub ?? (truck as any)?.hub_city ?? null)
  const [hubs, setHubs] = useState<HubOption[]>([])
  const [loadingHubs, setLoadingHubs] = useState<boolean>(false)
  const [savingHub, setSavingHub] = useState<boolean>(false)
  const [selectedHubId, setSelectedHubId] = useState<string>('')

  // Track "real" current truck location separately from hub
  const [currentCity, setCurrentCity] = useState<string | null>((truck as any)?.location_city_name ?? null)

  // Acquisition type (new)
  const [acquisitionType, setAcquisitionType] = useState<string | null>(((truck as any)?.acquisition_type as string) ?? null)

  // Insurance button disabling (true until 60 days before current active insurance ends)
  const [insuranceDisabled, setInsuranceDisabled] = useState<boolean>(false)

  // UI state
  const [expanded, setExpanded] = useState<boolean>(false)
  const [actionsOpen, setActionsOpen] = useState<boolean>(false)
  const [showLogs, setShowLogs] = useState<boolean>(false)
  const [showSpecs, setShowSpecs] = useState<boolean>(false)
  const [showComponents, setShowComponents] = useState<boolean>(false)
  const [showSell, setShowSell] = useState<boolean>(false)
  const [showInsurance, setShowInsurance] = useState<boolean>(false)

  /**
   * checkInsurance
   *
   * Loads active insurance end_date for this truck and disables the Insurance
   * button when more than 60 days remain.
   */
  useEffect(() => {
    async function checkInsurance() {
      try {
        const res = await getTable(
          'truck_insurances',
          `?user_truck_id=eq.${encodeURIComponent(id)}&is_active=eq.true&select=end_date`
        )

        const rows = Array.isArray(res?.data) ? res.data : []

        if (!rows.length || !rows[0].end_date) {
          setInsuranceDisabled(false)
          return
        }

        const end = new Date(rows[0].end_date)
        const now = new Date()

        const daysLeft =
          (end.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)

        setInsuranceDisabled(daysLeft > 60)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Insurance check failed', e)
        setInsuranceDisabled(false)
      }
    }

    if (id) void checkInsurance()
  }, [id])

  const rawModelId = (truck as any)?.master_truck_id ?? null

  /**
   * Fetch CGW/GCW numeric code from truck_models when not present in the
   * passed modelInfo / embedded model / truck row. The truck_models table stores
   * numeric codes (1/2/3) which we map to labels A/B/C below.
   */
  React.useEffect(() => {
    let mounted = true

    async function loadCgwFromModel() {
      // Prefer already-embedded or passed model data first
      const preResolvedRaw = resolvedModelInfo?.gcw ?? (truck as any)?.gcw ?? null
      if (preResolvedRaw !== null && preResolvedRaw !== undefined && !Number.isNaN(Number(preResolvedRaw))) {
        if (mounted) {
          setFetchedCgwNum(Number(preResolvedRaw))
          setFetchedCgwLabel(null)
        }
        return
      }

      if (!rawModelId) return

      try {
        const q = `?select=gcw&id=eq.${encodeURIComponent(String(rawModelId))}&limit=1`
        const res: any = await getTable('truck_models', q)
        const rows = Array.isArray(res?.data) ? res.data : []
        if (!mounted) return
        if (rows.length > 0) {
          const r = rows[0] as any
          const maybeNum = r.gcw ?? null
          const n = maybeNum !== null && maybeNum !== undefined ? Number(maybeNum) : null
          setFetchedCgwNum(n)
          // keep fetchedCgwLabel unused - clear to avoid stale values
          setFetchedCgwLabel(null)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug('TruckCard: failed to fetch gcw from truck_models', err)
        setFetchedCgwNum(null)
        setFetchedCgwLabel(null)
      }
    }

    void loadCgwFromModel()
    return () => {
      mounted = false
    }
  }, [rawModelId, resolvedModelInfo?.gcw, truck])

  // Model display
  const derivedModelName =
    truck?.model_make
      ? `${truck.model_make} ${truck.model_model ?? ''}`.trim()
      : truck?.model_model ?? (embeddedTruckModel ? `${embeddedTruckModel?.make ?? ''} ${embeddedTruckModel?.model ?? ''}`.trim() : null)

  const modelDisplay = formatModelDisplay(
    resolvedModelInfo,
    derivedModelName ?? rawModelId ?? 'Unknown model'
  )

  /**
   * loadCargoIconsFromModel
   *
   * Resolve cargo_type_id(s) using resolvedModelInfo or master_truck_id then fetch icon_urls.
   * Caches results on window.__cargoIconCache.
   */
  useEffect(() => {
    let mounted = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalCache = (window as any).__cargoIconCache || ((window as any).__cargoIconCache = {} as Record<string, string | null>)

    async function fetchCargoIconByCargoTypeId(id?: string | null) {
      if (!id) return null
      const cacheKey = `cargoId:${id}`
      if (globalCache[cacheKey] !== undefined) return globalCache[cacheKey]
      try {
        const res: any = await getTable('cargo_types', `?select=icon_url&id=eq.${encodeURIComponent(id)}&limit=1`)
        const rows = Array.isArray(res?.data) ? res.data : []
        const icon = rows[0]?.icon_url ?? null
        globalCache[cacheKey] = icon
        return icon
      } catch {
        globalCache[cacheKey] = null
        return null
      }
    }

    async function resolveCargoTypeIdsFromModel() {
      let primary: string | null | undefined = resolvedModelInfo?.cargo_type_id ?? null
      let secondary: string | null | undefined = resolvedModelInfo?.cargo_type_id_secondary ?? null
      const modelId = (truck as any)?.master_truck_id ?? null

      // If page already embedded truck_models and resolvedModelInfo is populated, skip extra model fetch
      if ((!primary || !secondary) && modelId) {
        try {
          const res: any = await getTable(
            'truck_models',
            `?select=cargo_type_id,cargo_type_id_secondary&id=eq.${encodeURIComponent(String(modelId))}&limit=1`
          )
          const rows = Array.isArray(res?.data) ? res.data : []
          if (rows.length > 0) {
            primary = primary ?? (rows[0]?.cargo_type_id ?? null)
            secondary = secondary ?? (rows[0]?.cargo_type_id_secondary ?? null)
          }
        } catch {
          // ignore
        }
      }
      return { primary: primary ?? null, secondary: secondary ?? null }
    }

    async function load() {
      if (!mounted) return

      const { primary, secondary } = await resolveCargoTypeIdsFromModel()
      let iconPrimary = null
      let iconSecondary = null

      if (primary) iconPrimary = await fetchCargoIconByCargoTypeId(String(primary))
      if (secondary) iconSecondary = await fetchCargoIconByCargoTypeId(String(secondary))

      if (!iconPrimary) {
        const cargoTypeName =
          (truck as any)?.cargo_type_name ??
          resolvedModelInfo?.cargo_type_name ??
          (truck as any)?.cargo_type ??
          null

        if (cargoTypeName) {
          try {
            const res: any = await getTable('cargo_types', `?select=icon_url&name=eq.${encodeURIComponent(String(cargoTypeName))}&limit=1`)
            let rows = Array.isArray(res?.data) ? res.data : []
            if (rows.length === 0) {
              const res2: any = await getTable('cargo_types', `?select=icon_url&name=ilike.*${encodeURIComponent(String(cargoTypeName))}*&limit=1`)
              rows = Array.isArray(res2?.data) ? res2.data : []
            }
            iconPrimary = rows[0]?.icon_url ?? null
            if (iconPrimary) globalCache[`name:${cargoTypeName}`] = iconPrimary
          } catch {
            // ignore
          }
        }
      }

      if (!mounted) return
      setCargoIconUrl(iconPrimary ?? null)
      setCargoIconUrlSecondary(iconSecondary ?? null)
      // eslint-disable-next-line no-console
      console.debug('cargo icon lookup from model', {
        master_truck_id: (truck as any)?.master_truck_id,
        primary,
        secondary,
        iconPrimary,
        iconSecondary,
      })
    }

    void load()
    return () => {
      mounted = false
    }
  }, [
    truck?.master_truck_id,
    truck?.cargo_type_name,
    resolvedModelInfo?.cargo_type_id,
    resolvedModelInfo?.cargo_type_id_secondary,
    resolvedModelInfo?.cargo_type_name,
  ])

  // Initial seed for currentCity from prop (do not override if already set)
  useEffect(() => {
    const seed = (truck as any)?.location_city_name ?? null
    if (!currentCity && seed) setCurrentCity(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truck?.location_city_name])

  // Refresh editable fields from API for owned trucks
  useEffect(() => {
    if (isMarket) return
    let mounted = true

    async function fetchLatestRow() {
      if (!id) return
      try {
        // Fetch the real current location via location_city_id -> cities(city_name).
        // Alias as `location_city` for clarity, and also support older shapes in parsing.
        const res = await supabaseFetch(
          `/rest/v1/user_trucks?id=eq.${encodeURIComponent(
            id
          )}&select=name,registration,hub,location_city_id,last_maintenance_at,next_maintenance_km,mileage_km,location_city:cities(city_name),acquisition_type&limit=1`,
          { method: 'GET' }
        )

        if (!mounted) return

        if (res && Array.isArray(res.data) && res.data.length > 0) {
          const row = res.data[0] as any

          if (typeof row.name === 'string') setName(row.name)
          if (Object.prototype.hasOwnProperty.call(row, 'registration')) {
            syncRegistrationState(typeof row.registration === 'string' ? row.registration : null)
          }

          // Hub remains hub (separate from current location)
          if (typeof row.hub === 'string') setHubCity(row.hub)

          // Resolve real current location from embedded relation first.
          // Support both alias `location_city` and older `cities`, and both object/array shapes.
          const embeddedLocationCityName =
            extractCityNameFromEmbeddedRelation((row as any).location_city) ??
            extractCityNameFromEmbeddedRelation((row as any).cities)

          if (embeddedLocationCityName) {
            setCurrentCity(embeddedLocationCityName)
          } else if (typeof row.location_city_id === 'string' && row.location_city_id) {
            // Fallback: resolve directly from cities table using location_city_id
            try {
              const cityRes: any = await getTable(
                'cities',
                `?select=city_name&id=eq.${encodeURIComponent(row.location_city_id)}&limit=1`
              )
              const cityRows = Array.isArray(cityRes?.data) ? cityRes.data : []
              const cityName = cityRows[0]?.city_name
              if (typeof cityName === 'string' && cityName.trim()) {
                setCurrentCity(cityName.trim())
              } else {
                setCurrentCity(null)
              }
            } catch (cityErr) {
              // eslint-disable-next-line no-console
              console.debug('Failed to resolve location city from location_city_id', cityErr)
              setCurrentCity(null)
            }
          } else {
            setCurrentCity(null)
          }

          if (typeof row.last_maintenance_at === 'string') {
            setLastMaintenanceAt(row.last_maintenance_at)
          }
          if (row.next_maintenance_km !== undefined && row.next_maintenance_km !== null) {
            setNextMaintenanceKm(Number(row.next_maintenance_km))
          }
          if (typeof row.mileage_km === 'number') {
            // update displayed mileage if changed
          }
          // Acquisition type (new): update if available
          if (typeof row.acquisition_type === 'string') {
            setAcquisitionType(row.acquisition_type)
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch latest truck row', err)
      }
    }

    void fetchLatestRow()
    return () => {
      mounted = false
    }
  }, [id, isMarket, syncRegistrationState])

  // Auto-hydrate missing registration when possible.
  useEffect(() => {
    if (isMarket || !id) return
    if (savingRegistration || hydratingRegistration) return

    const currentReg = typeof registration === 'string' ? registration.trim() : ''
    if (currentReg) return

    if (registrationHydratedForTruckRef.current === id) return

    const fallbackPrefix = parseRegistration(defaultRegistration ?? null)[0]
    const sourceCity =
      hubCity ??
      currentCity ??
      (truck as any)?.hub ??
      (truck as any)?.location_city_name ??
      null

    const prefix = sourceCity ? makePrefixFromCity(sourceCity) : fallbackPrefix
    const digits = registrationDigitsRef.current || deriveRegistrationDigitsSeed(id, defaultRegistration ?? null)
    const generatedRegistration = normalizeRegistration(prefix, digits)

    if (!generatedRegistration) return

    registrationHydratedForTruckRef.current = id

    let cancelled = false

    ;(async () => {
      setHydratingRegistration(true)

      try {
        // Only set registration if it is still NULL in DB
        const res = await supabaseFetch(
          `/rest/v1/user_trucks?id=eq.${encodeURIComponent(id)}&registration=is.null`,
          {
            method: 'PATCH',
            body: JSON.stringify({ registration: generatedRegistration }),
            headers: {
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
          }
        )

        if (cancelled) return

        if (!res || res.status < 200 || res.status >= 300) {
          // keep UI honest if DB rejected it (for example unique constraint conflict)
          syncRegistrationState(null)
          // eslint-disable-next-line no-console
          console.error('Failed to auto-hydrate missing registration', res)
          return
        }

        if (Array.isArray(res.data) && res.data.length > 0) {
          const returned = res.data[0] as any
          syncRegistrationState(
            typeof returned?.registration === 'string'
              ? returned.registration
              : generatedRegistration
          )
        } else {
          // PATCH may return no rows if registration was already set by another process
          const verify = await supabaseFetch(
            `/rest/v1/user_trucks?id=eq.${encodeURIComponent(id)}&select=registration&limit=1`,
            { method: 'GET' }
          )

          if (cancelled) return

          const row = Array.isArray(verify?.data) ? verify.data[0] : null
          syncRegistrationState(typeof row?.registration === 'string' ? row.registration : null)
        }
      } catch (err) {
        if (!cancelled) {
          syncRegistrationState(null)
          // eslint-disable-next-line no-console
          console.error('Error auto-hydrating missing registration', err)
        }
      } finally {
        if (!cancelled) {
          setHydratingRegistration(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    id,
    isMarket,
    registration,
    savingRegistration,
    hydratingRegistration,
    defaultRegistration,
    hubCity,
    currentCity,
    truck,
    syncRegistrationState,
  ])

  // Load hubs for owner
  useEffect(() => {
    if (isMarket) return
    let mounted = true
    async function load() {
      setLoadingHubs(true)
      try {
        const ownerCompanyId = truck?.owner_company_id ?? truck?.owner_id ?? null
        const res = ownerCompanyId
          ? await getTable('hubs', `?select=id,city,country,is_main,city_id&owner_id=eq.${ownerCompanyId}&order=is_main.desc,city.asc`)
          : await getTable('hubs', `?select=id,city,country,is_main,city_id&order=is_main.desc,city.asc`)
        const rows = Array.isArray(res.data) ? res.data : []
        if (!mounted) return
        const mapped = rows.map((r: any) => ({ id: r.id, city: r.city, country: r.country, is_main: r.is_main, city_id: r.city_id }))
        setHubs(mapped)
        const initialSelected = mapped.find((h) => h.city === hubCity)?.id ?? ''
        setSelectedHubId(initialSelected)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug('Failed to load hubs for truck', err)
        setHubs([])
      } finally {
        if (mounted) setLoadingHubs(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truck, isMarket])

  useEffect(() => {
    const idForCity = hubs.find((h) => h.city === hubCity)?.id ?? ''
    setSelectedHubId(idForCity)
  }, [hubCity, hubs])

  /**
   * handleSaveName
   *
   * Persist truck name to public.user_trucks.name via Supabase REST.
   */
  async function handleSaveName(newName: string) {
    if (isMarket) {
      setName(newName)
      return
    }
    const prev = name
    setName(newName)
    if (!id) return
    setSavingName(true)
    try {
      const res = await supabaseFetch(`/rest/v1/user_trucks?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      })
      if (!res || res.status < 200 || res.status >= 300) {
        setName(prev)
        // eslint-disable-next-line no-console
        console.error('Failed to persist truck name', res)
      }
    } catch (err) {
      setName(prev)
      // eslint-disable-next-line no-console
      console.error('Error saving truck name', err)
    } finally {
      setSavingName(false)
    }
  }

  /**
   * handleSaveRegistration
   *
   * Persist registration to public.user_trucks.registration.
   */
  async function handleSaveRegistration(newReg: string) {
    const [rawPrefix, rawDigits] = parseRegistration(newReg)
    const normalizedRegistration = normalizeRegistration(rawPrefix, rawDigits)

    if (isMarket) {
      syncRegistrationState(normalizedRegistration)
      return
    }

    const prev = registration
    syncRegistrationState(normalizedRegistration)

    if (!id) return

    setSavingRegistration(true)
    try {
      const res = await supabaseFetch(`/rest/v1/user_trucks?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ registration: normalizedRegistration }),
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      })

      if (!res || res.status < 200 || res.status >= 300) {
        syncRegistrationState(prev ?? null)
        // eslint-disable-next-line no-console
        console.error('Failed to persist registration', res)
        return
      }

      if (Array.isArray(res.data) && res.data.length > 0) {
        const returned = res.data[0] as any
        if (Object.prototype.hasOwnProperty.call(returned, 'registration')) {
          syncRegistrationState(
            typeof returned.registration === 'string' ? returned.registration : null
          )
        }
      }
    } catch (err) {
      syncRegistrationState(prev ?? null)
      // eslint-disable-next-line no-console
      console.error('Error saving registration', err)
    } finally {
      setSavingRegistration(false)
    }
  }

  /**
   * handleChangeHub
   *
   * Persist selected hub (city name) to public.user_trucks.hub and update location_city_id.
   */
  async function handleChangeHub(hubId: string) {
    const prevHub = hubCity
    const prevRegistration = registration
    const prevCurrentCity = currentCity

    const selected = hubId ? hubs.find((h) => h.id === hubId) : undefined
    const selectedCity = selected?.city ?? null
    const selectedCityId = selected?.city_id ?? null

    const currentDigits = registrationDigitsRef.current
    const newPrefix = makePrefixFromCity(selectedCity)
    const newDigits = currentDigits && currentDigits.length > 0 ? currentDigits : '1'
    const newRegistration = normalizeRegistration(newPrefix, newDigits)

    setHubCity(selectedCity)
    // Since this action also updates location_city_id, keep current location in sync optimistically
    setCurrentCity(selectedCity)
    syncRegistrationState(newRegistration)

    if (isMarket) {
      return
    }

    if (!id) return
    setSavingHub(true)
    try {
      const payload: any = {
        hub: selectedCity,
        location_city_id: selectedCityId ?? null,
        registration: newRegistration,
      }

      const res = await supabaseFetch(`/rest/v1/user_trucks?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      })

      if (!res || res.status < 200 || res.status >= 300) {
        setHubCity(prevHub)
        setCurrentCity(prevCurrentCity)
        syncRegistrationState(prevRegistration ?? null)
        // eslint-disable-next-line no-console
        console.error('Failed to persist hub/location/registration', res)
      } else {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const returned = res.data[0] as any

          if (Object.prototype.hasOwnProperty.call(returned, 'registration')) {
            syncRegistrationState(
              typeof returned.registration === 'string' ? returned.registration : newRegistration
            )
          }

          if (Object.prototype.hasOwnProperty.call(returned, 'hub')) {
            setHubCity(typeof returned.hub === 'string' ? returned.hub : null)
          }
          // Keep currentCity as optimistic selected city unless a later refresh resolves precise value
        }
      }
    } catch (err) {
      setHubCity(prevHub)
      setCurrentCity(prevCurrentCity)
      syncRegistrationState(prevRegistration ?? null)
      // eslint-disable-next-line no-console
      console.error('Error saving hub/location/registration', err)
    } finally {
      setSavingHub(false)
    }
  }

  // Location display: ONLY real truck location (user_trucks.location_city_id -> cities.city_name)
  // Do not fall back to hub here, because hub is not the same thing as current location.
  const location =
    currentCity ??
    (truck as any)?.location_city_name ??
    '—'

  function handleToggleExpand() {
    if (actionsOpen) setActionsOpen(false)
    setExpanded((s) => !s)
  }

  /**
   * Visual maintenance state derived values
   */
  const remainingKm = nextMaintenanceKm !== null && nextMaintenanceKm !== undefined ? Math.round((nextMaintenanceKm as number) - (Number(truck?.mileage_km ?? mileage) || 0)) : null
  const isWarning = remainingKm !== null && remainingKm <= 0 && remainingKm > -3000
  const isSuspended = remainingKm !== null && remainingKm <= -3000
  const isInRepair = (truck?.status ?? '').toLowerCase() === 'in_repair' || (truck?.status ?? '').toLowerCase() === 'maintenance'

  const inTransit = !isMarket && isTruckInTransit(truck)
  const availableFromAt = (truck as any)?.available_from_at ?? null
  const isActionLocked = isSuspended || inTransit

  /**
   * openMaintenance
   *
   * Opens the maintenance modal and preloads estimates.
   */
  async function openMaintenance() {
    setMaintenanceModalOpen(true)
    try {
      const estimates = await computeMaintenanceCost(
        {
          id,
          mileage_km: Number(truck?.mileage_km ?? mileage),
          purchase_date: truck?.purchase_date ?? truck?.created_at,
          model: { class: truck?.model_class ?? resolvedModelInfo?.class },
        } as any,
        'city'
      )
      setMaintenanceEstimates(estimates)
    } catch {
      setMaintenanceEstimates(null)
    }
  }

  const cargoPrimaryName = resolvedModelInfo?.cargo_type_name ?? truck?.cargo_type_name ?? null
  const cargoSecondaryName = resolvedModelInfo?.cargo_type_secondary_name ?? truck?.cargo_type_secondary_name ?? null

  const payloadValue =
    resolvedModelInfo?.max_load_kg ??
    truck?.model_max_load_kg ??
    truck?.max_payload_kg ??
    truck?.payload_kg ??
    null

  const payloadDisplay =
    payloadValue !== null && payloadValue !== undefined
      ? `${Number(payloadValue).toLocaleString()} kg`
      : '—'

  const truckClassForGcw =
    (resolvedModelInfo?.class as string | undefined) ??
    (truck?.model_class as string | undefined) ??
    (truck?.truck_class as string | undefined) ??
    (truck?.class as string | undefined) ??
    null

  const collapsedGcwLabel = (() => {
    if (!truckClassForGcw || String(truckClassForGcw).toLowerCase() !== 'big') return '—'
    const raw = fetchedCgwNum ?? resolvedModelInfo?.gcw ?? (truck as any)?.gcw ?? null
    const num = raw !== null && raw !== undefined && !Number.isNaN(Number(raw)) ? Number(raw) : null
    const mapping: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' }
    return num != null ? mapping[num] ?? '—' : '—'
  })()

  return (
    <div
      className={[
        'modern-card group relative w-full rounded-xl bg-white overflow-hidden border border-gray-100',
        'shadow-sm transform-gpu transition-all duration-200 ease-out',
        'hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-200',
        'focus-within:-translate-y-0.5 focus-within:shadow-lg focus-within:border-slate-200',
        isSuspended ? 'opacity-70 grayscale' : '',
        inTransit ? 'opacity-70' : '',
      ].join(' ')}
      role="article"
      aria-label={`Truck ${id || 'unknown'}`}
    >
      {/* Suspended overlay when truck is blocked - visually dim card but keep maintenance button accessible */}
      {isSuspended && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-rose-700 bg-white/40 px-3 py-1 rounded-md font-semibold">Suspended — maintenance required</div>
        </div>
      )}

      {inTransit && (
        <div className="absolute inset-0 z-10 flex items-start justify-end p-3 pointer-events-none">
          <div className="rounded-md border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs font-medium text-amber-800 shadow-sm">
            <div>In transit</div>
            <div className="font-normal">
              {availableFromAt
                ? `Available in ${formatTimeLeftShort(availableFromAt)}`
                : 'Pending delivery'}
            </div>
          </div>
        </div>
      )}

      {/* Top row converted to trailer-style 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 w-full divide-y md:divide-y-0 md:divide-x divide-slate-100">
        {/* Column 1 - Identity */}
        <div className="p-4 flex items-center">
          <div className="flex items-center gap-3 w-full min-w-0">
            {/* Truck image slot (small preview + edit) */}
            <TruckImageField
              truckId={id}
              initialUrl={resolvedModelInfo?.image_url ?? (truck as any)?.image_url ?? (truck as any)?.photo_url ?? null}
              className="w-12 h-12 rounded-full border border-slate-100 bg-white object-cover"
            />

            <div className="min-w-0 w-full">
              <div className="font-semibold text-slate-900 truncate">{modelDisplay}</div>

              {/* Truck Name row (editable) */}
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 min-w-0">
                <span className="font-medium shrink-0">Truck Name:</span>

                <div className="min-w-0 flex items-center gap-1">
                  {!editingName ? (
                    <>
                      <div className="truncate text-slate-700">{name ?? defaultName ?? '—'}</div>

                      {!isMarket && !isActionLocked && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingName(true)
                            setEditInput(name ?? defaultName ?? '')
                          }}
                          className="p-1 rounded hover:bg-gray-100 text-slate-500 shrink-0"
                          aria-label="Edit truck name"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        setEditingName(false)
                        handleSaveName(editInput)
                      }}
                      className="flex items-center gap-1 min-w-0"
                    >
                      <input
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        className="h-8 text-xs min-w-0 px-2 border border-slate-200 rounded bg-white"
                        aria-label="Edit truck name input"
                      />
                      <button
                        type="submit"
                        className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                        aria-label="Save name"
                        disabled={savingName}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingName(false)
                          setEditInput(name ?? defaultName ?? '')
                        }}
                        className="p-1 rounded hover:bg-gray-100 text-slate-500 shrink-0"
                        aria-label="Cancel edit"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-500 mt-1 truncate">
                <span className="font-medium">Registration:</span> {registration ?? defaultRegistration ?? '—'}
              </div>

              <div className="text-xs text-slate-500 mt-1 truncate">
                <span className="font-medium">Cargo type:</span>{' '}
                {cargoPrimaryName && cargoSecondaryName
                  ? `${cargoPrimaryName} / ${cargoSecondaryName}`
                  : cargoPrimaryName ?? cargoSecondaryName ?? '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2 - Condition & key stats */}
        <div className="p-4 flex items-center">
          <div className="w-full">
            <div className="text-sm text-slate-700 font-medium mb-2">Condition</div>

            <div className="flex items-center gap-3">
              <div className="text-sm font-medium">{conditionScore}</div>

              <div className="w-36 h-2 bg-slate-200 rounded overflow-hidden">
                <div
                  style={{
                    width: `${Math.min(Math.max(Number(conditionScore) || 0, 0), 100)}%`,
                    background: '#22c55e',
                    height: '100%',
                  }}
                />
              </div>

              <div className="text-xs text-slate-500 w-20">Health</div>
            </div>

            <div className="mt-3 text-sm text-slate-700 grid grid-cols-2 gap-4">
              <div>
                <span className="font-semibold">Payload:</span> {payloadDisplay}
              </div>

              <div>
                <span className="font-semibold">GCW:</span> {collapsedGcwLabel}
              </div>
            </div>

            <div className="mt-2 text-xs">
              <span className="font-medium text-slate-500">Next maintenance:</span>{' '}
              <span
                className={
                  remainingKm === null
                    ? 'text-slate-700'
                    : remainingKm > 0
                      ? 'text-slate-700'
                      : remainingKm > -3000
                        ? 'text-amber-700'
                        : 'text-rose-700'
                }
              >
                {remainingKm === null
                  ? (nextMaintenanceKm !== null ? `${Number(nextMaintenanceKm).toLocaleString()} km` : '—')
                  : `${remainingKm.toLocaleString()} km`}
              </span>
            </div>
          </div>
        </div>

        {/* Column 3 - Status / mileage / location / actions */}
        <div className="p-4 flex items-start">
          <div className="flex items-start w-full">
            <div className="text-sm text-slate-700">
              <div className="mb-2">
                <span className="font-semibold">Status:</span>{' '}
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ring-1 ${statusClass(status)}`}>
                  <span className="capitalize">{formatStatusLabel(status)}</span>
                </span>
              </div>

              <div>
                <span className="font-semibold">Mileage:</span> {Number(mileage).toLocaleString()} km
              </div>

              <div className="mt-1">
                <span className="font-semibold">Current location:</span> {location}
              </div>

              {inTransit && (
                <div className="mt-2 text-xs text-amber-700">
                  <span className="font-medium">Transit:</span>{' '}
                  {availableFromAt ? `Available in ${formatTimeLeftShort(availableFromAt)}` : 'Pending delivery'}
                </div>
              )}

              {isSuspended && (
                <div className="mt-2 text-xs text-rose-700">
                  <span className="font-medium">Suspended:</span> maintenance required
                </div>
              )}
            </div>

            <div className="ml-auto">
              <button
                type="button"
                onClick={handleToggleExpand}
                className="inline-flex items-center justify-center w-9 h-9 rounded border border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse truck details' : 'Expand truck details'}
              >
                {expanded ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable details panel */}
      <div
        className={`transition-[max-height] duration-200 ease-in-out overflow-hidden ${
          expanded ? 'max-h-[1400px]' : 'max-h-0'
        }`}
        aria-hidden={!expanded}
      >
        <div className="pt-2 border-t border-slate-100 p-4 bg-white rounded-b-xl">
          <div className="bg-slate-50 border border-slate-100 rounded-md p-3 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-slate-500">Truck model</div>
                <div className="text-sm font-medium text-slate-800 truncate min-w-0">{modelDisplay}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Producer</div>
                <div className="text-sm font-medium text-slate-800">
                  {resolvedModelInfo?.make ?? truck?.model_make ?? truck?.make ?? truck?.producer ?? '—'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">GCW</div>
                <div className="text-sm font-medium text-slate-800">
                  {(() => {
                    /**
                     * New GCW rendering:
                     * - Only display GCW mapped label (A/B/C) for trucks of class "big"
                     * - Prefer fetchedCgwNum (numeric 1/2/3) from the backend, then resolvedModelInfo.gcw, then truck.gcw
                     * - If not applicable or missing, display '—'
                     */
                    const truckClass =
                      (resolvedModelInfo?.class as string | undefined) ??
                      (truck?.model_class as string | undefined) ??
                      (truck?.truck_class as string | undefined) ??
                      (truck?.class as string | undefined) ??
                      null

                    if (!truckClass || String(truckClass).toLowerCase() !== 'big') {
                      return '—'
                    }

                    const raw =
                      fetchedCgwNum ??
                      resolvedModelInfo?.gcw ??
                      (truck as any)?.gcw ??
                      null

                    const num = raw !== null && raw !== undefined && !Number.isNaN(Number(raw)) ? Number(raw) : null

                    const mapping: Record<number, string> = {
                      1: 'A',
                      2: 'B',
                      3: 'C',
                    }

                    return num != null ? mapping[num] ?? '—' : '—'
                  })()}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Class</div>
                <div className="text-sm font-medium text-slate-800">
                  {resolvedModelInfo?.class ?? truck?.model_class ?? truck?.truck_class ?? truck?.class ?? '—'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Year</div>
                {/* Prefer the denormalized year from user_trucks.model_year for active trucks,
                  fall back to joined modelInfo.year or other year fields when absent. */}
                <div className="text-sm font-medium text-slate-800">
                  {(truck?.model_year ?? resolvedModelInfo?.year) ?? truck?.year ?? truck?.production_year ?? '—'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Max payload</div>
                <div className="text-sm font-medium text-slate-800">
                  {resolvedModelInfo?.max_load_kg ?? truck?.model_max_load_kg ?? truck?.max_payload_kg ?? truck?.payload_kg ?? '—'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Tonnage in (t)</div>
                <div className="text-sm font-medium text-slate-800">
                  {resolvedModelInfo?.tonnage ?? truck?.model_tonnage ?? truck?.tonnage ?? truck?.gross_tonnage ?? '—'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Cargo type</div>
                <div className="text-sm font-medium text-slate-800">
                  <div className="flex items-center gap-2">
                    {(resolvedModelInfo?.cargo_type_id ?? truck?.cargo_type_id) ? (
                      <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200">
                        {resolvedModelInfo?.cargo_type_name ?? truck?.cargo_type_name ?? '—'}
                      </span>
                    ) : null}

                    {(resolvedModelInfo?.cargo_type_id_secondary ?? truck?.cargo_type_id_secondary) ? (
                      <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200">
                        {resolvedModelInfo?.cargo_type_secondary_name ?? truck?.cargo_type_secondary_name ?? '—'}
                      </span>
                    ) : null}

                    {!(resolvedModelInfo?.cargo_type_id ?? truck?.cargo_type_id) && !(resolvedModelInfo?.cargo_type_id_secondary ?? truck?.cargo_type_id_secondary) ? '—' : null}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Purchase date</div>
                <div className="text-sm font-medium text-slate-800">{truck?.purchase_date ? new Date(truck.purchase_date).toLocaleString() : truck?.created_at ? new Date(truck.created_at).toLocaleString() : '—'}</div>
              </div>

              {/* Acquisition type (new)
              Map raw acquisition_type values to either "Purchased" or "Leased". */}
              <div>
                <div className="text-xs text-slate-500">Acquisition type</div>
                <div className="text-sm font-medium text-slate-800">
                  {(() => {
                    // Normalize and map a variety of possible raw values to two display values.
                    const raw = acquisitionType ?? (truck?.acquisition_type ?? null)
                    if (!raw) return 'Purchased'
                    const v = String(raw).toLowerCase()
                    if (v.includes('lease') || v.includes('leased') || v.includes('rental') || v.includes('rent')) return 'Leased'
                    // Treat all other cases (starter, used, purchased, buy, etc.) as Purchased
                    return 'Purchased'
                  })()}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Mileage in (km)</div>
                <div className="text-sm font-medium text-slate-800">{mileage != null ? `${mileage}` : '—'}</div>
              </div>

              {/* Last maintenance (date-only) */}
              <div>
                <div className="text-xs text-slate-500">Last maintenance</div>
                <div className="text-sm font-medium text-slate-800">{lastMaintenanceAt ? new Date(lastMaintenanceAt).toLocaleDateString() : (truck?.created_at ? new Date(truck.created_at).toLocaleDateString() : '—')}</div>
              </div>

              {/* Next maintenance (remaining km) */}
              <div>
                <div className="text-xs text-slate-500">Next maintenance (km)</div>
                <div className={`text-sm font-medium ${remainingKm === null ? 'text-slate-800' : remainingKm > 0 ? 'text-slate-800' : remainingKm > -3000 ? 'text-amber-700' : 'text-rose-700'}`}>
                  {remainingKm === null ? (nextMaintenanceKm !== null ? `${Number(nextMaintenanceKm).toLocaleString()} km` : '—') : `${remainingKm.toLocaleString()} km`}
                </div>
              </div>

              <TruckInsurance userTruckId={id} className="col-span-1 sm:col-span-1" />

              <div>
                <div className="text-xs text-slate-500">Hub</div>
                <div className="text-sm text-slate-700">{hubCity ?? '—'}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 justify-end">
              {/* Hub selector + Registration input aligned on the same row */}
              <div className="mr-auto flex items-center gap-2">
                <div className="text-xs text-slate-500 hidden sm:block">Hub</div>

                {isMarket ? (
                  <div className="text-sm px-2 py-1 border border-slate-200 rounded bg-white text-slate-500">— Read-only —</div>
                ) : loadingHubs ? (
                  <div className="text-sm text-slate-500">Loading…</div>
                ) : hubs.length === 0 ? (
                  <div className="text-sm text-slate-500">No hubs</div>
                ) : (
                  <>
                    <select
                      aria-label="Select hub"
                      value={selectedHubId}
                      onChange={(e) => setSelectedHubId(e.target.value)}
                      className="text-sm px-2 py-1 border border-slate-200 rounded bg-white"
                      disabled={savingHub || isActionLocked}
                    >
                      <option value="">— Unassigned —</option>
                      {hubs.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.city ?? '(unknown)'}
                          {h.is_main ? ' — main' : ''}
                        </option>
                      ))}
                    </select>

                    <RegistrationInput
                      value={registrationDigits}
                      onChange={(d) => {
                        const prefix = parseRegistration(registration ?? defaultRegistration ?? null)[0]
                        syncRegistrationState(normalizeRegistration(prefix, d))
                      }}
                      region={parseRegistration(registration ?? defaultRegistration ?? null)[0]}
                      onSave={() => {
                        const prefix = parseRegistration(registration ?? defaultRegistration ?? null)[0]
                        const latestRegistration = normalizeRegistration(prefix, registrationDigitsRef.current)
                        void handleSaveRegistration(latestRegistration)
                      }}
                      disabled={savingRegistration || isMarket || isActionLocked}
                      className="ml-3"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        if (selectedHubId === (hubs.find((h) => h.city === hubCity)?.id ?? '')) return
                        handleChangeHub(selectedHubId)
                      }}
                      disabled={
                        savingHub ||
                        isActionLocked ||
                        selectedHubId === (hubs.find((h) => h.city === hubCity)?.id ?? '')
                      }
                      className={`text-sm px-3 py-1 rounded border ${savingHub || isActionLocked ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white hover:bg-slate-100 border-slate-200'}`}
                      title={inTransit ? `Truck in transit until ${availableFromAt ? new Date(availableFromAt).toLocaleString() : 'delivery completes'}` : undefined}
                    >
                      Apply
                    </button>
                  </>
                )}
              </div>

              {/* Buttons - disable non-maintenance actions when suspended/in transit */}
              <button
                type="button"
                onClick={() => setShowComponents(true)}
                className={`px-3 py-1 text-sm ${isActionLocked ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-100'} border border-slate-200 rounded flex items-center gap-2`}
                disabled={isActionLocked}
                title={inTransit ? `Truck in transit until ${availableFromAt ? new Date(availableFromAt).toLocaleString() : 'delivery completes'}` : undefined}
              >
                Components
              </button>

              <button
                type="button"
                onClick={() => setShowSpecs(true)}
                className={`px-3 py-1 text-sm ${isActionLocked ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-100'} border border-slate-200 rounded flex items-center gap-2`}
                disabled={isActionLocked}
                title={inTransit ? `Truck in transit until ${availableFromAt ? new Date(availableFromAt).toLocaleString() : 'delivery completes'}` : undefined}
              >
                Specifications
              </button>

              <button
                type="button"
                onClick={() => setShowLogs(true)}
                className={`px-3 py-1 text-sm ${isActionLocked ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-100'} border border-slate-200 rounded flex items-center gap-2`}
                disabled={isActionLocked}
                title={inTransit ? `Truck in transit until ${availableFromAt ? new Date(availableFromAt).toLocaleString() : 'delivery completes'}` : undefined}
              >
                Logs
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!insuranceDisabled && !isActionLocked)
                    setShowInsurance(true)
                }}
                disabled={isActionLocked || insuranceDisabled}
                className={`px-3 py-1 text-sm border border-slate-200 rounded flex items-center gap-2 ${isActionLocked || insuranceDisabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-100'}`}
                title={
                  inTransit
                    ? `Truck in transit until ${availableFromAt ? new Date(availableFromAt).toLocaleString() : 'delivery completes'}`
                    : insuranceDisabled
                      ? 'New insurance available 60 days before expiry'
                      : 'Insurance'
                }
              >
                Insurance
              </button>

              {/* Maintenance button active for suspended trucks, disabled for in-transit trucks */}
              <button
                type="button"
                onClick={openMaintenance}
                disabled={inTransit}
                title={inTransit ? 'Truck is in transit and not yet available' : 'Maintenance'}
                className={`px-3 py-1 text-sm border rounded text-white flex items-center gap-2 ${
                  inTransit
                    ? 'bg-slate-300 border-slate-300 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-700 border-amber-600'
                }`}
              >
                Maintenance
              </button>

              <button
                type="button"
                onClick={() => setShowSell(true)}
                className={`px-3 py-1 text-sm ${isActionLocked ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} border ${isActionLocked ? 'border-slate-200' : 'border-red-600'} rounded text-white flex items-center gap-2`}
                disabled={isActionLocked}
                title={inTransit ? `Truck in transit until ${availableFromAt ? new Date(availableFromAt).toLocaleString() : 'delivery completes'}` : undefined}
              >
                Sell
              </button>
            </div>
          </div>
        </div>
      </div>

      <LogModal truckId={id} open={showLogs} onClose={() => setShowLogs(false)} />
      <TruckSpecModal modelId={rawModelId} open={showSpecs} onClose={() => setShowSpecs(false)} />
      <TruckComponentsModal truckId={id} open={showComponents} onClose={() => setShowComponents(false)} />
      <InsuranceModal truckId={id} condition={conditionScore} open={showInsurance} onClose={() => setShowInsurance(false)} />
      <SellTruckModal truckId={id} condition={conditionScore} open={showSell} onClose={() => setShowSell(false)} />
      <MaintenanceModal truckId={id} open={maintenanceModalOpen} onClose={() => setMaintenanceModalOpen(false)} onDone={() => {
        // Refresh minimal fields after maintenance
        ;(async () => {
          try {
            const res = await supabaseFetch(`/rest/v1/user_trucks?id=eq.${encodeURIComponent(id)}&select=last_maintenance_at,next_maintenance_km,mileage_km`)
            if (res && Array.isArray(res.data) && res.data.length > 0) {
              const r = res.data[0] as any
              if (r.last_maintenance_at) setLastMaintenanceAt(r.last_maintenance_at)
              if (r.next_maintenance_km !== undefined && r.next_maintenance_km !== null) setNextMaintenanceKm(Number(r.next_maintenance_km))
            }
          } catch {
            // noop
          }
        })()
      }} />
    </div>
  )
}

/**
 * makePrefixFromCity
 *
 * Create a 2-letter prefix from a city name (letters only, uppercase). Pads with X if needed.
 *
 * @param city - string
 */
function makePrefixFromCity(city?: string | null) {
  if (!city) return 'XX'
  const letters = city.replace(/[^A-Za-z]/g, '').toUpperCase()
  if (letters.length >= 2) return letters.slice(0, 2)
  if (letters.length === 1) return `${letters}X`
  return 'XX'
}