/**
 * TruckCard.tsx
 *
 * Single-row truck card used in the trucks list. Shows truck info and an
 * expandable details panel. Allows editing name, registration and hub assignment
 * for owned trucks. When isMarket=true the card is read-only.
 *
 * Enhanced with maintenance UI:
 * - Shows Last maintenance (date-only) and Next maintenance (remaining km)
 * - Adds "Maintenance" button that opens MaintenanceModal
 * - Visual warning & suspension states based on remaining km:
 *    - Normal: remaining > 0
 *    - Warning: 0 >= remaining > -3000
 *    - Suspended: remaining <= -3000 -> card overlay + only maintenance actionable
 */

import React, { useEffect, useState } from 'react'
import { Gauge, Calendar, MapPin, Menu, Edit3, Check, X } from 'lucide-react'
import EditableField from './EditableField'
import StatChip from './StatChip'
import { supabaseFetch, getTable } from '../../lib/supabase'
import LogModal from './LogModal'
import TruckSpecModal from './TruckSpecModal'
import TruckComponentsModal from './TruckComponentsModal'
import SellTruckModal from './SellTruckModal'
import InsuranceModal from './InsuranceModal'
import RegistrationInput from '../common/RegistrationInput'
import TruckInsurance from './TruckInsurance'
import MaintenanceModal from './MaintenanceModal'
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
function statusClass(s: string) {
  switch (s) {
    case 'available':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    case 'in_use':
    case 'assigned':
      return 'bg-amber-50 text-amber-700 ring-amber-100'
    case 'maintenance':
      return 'bg-rose-50 text-rose-700 ring-rose-100'
    case 'suspended':
      return 'bg-rose-600 text-white ring-rose-700'
    default:
      return 'bg-gray-50 text-gray-700 ring-gray-100'
  }
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

  // Maintenance related state
  const [lastMaintenanceAt, setLastMaintenanceAt] = useState<string | null>((truck as any)?.last_maintenance_at ?? null)
  const [nextMaintenanceKm, setNextMaintenanceKm] = useState<number | null>((truck as any)?.next_maintenance_km ?? null)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [maintenanceEstimates, setMaintenanceEstimates] = useState<any>(null)

  // Cargo icons and other existing states...
  const [cargoIconUrl, setCargoIconUrl] = useState<string | null>(null)
  const [cargoIconUrlSecondary, setCargoIconUrlSecondary] = useState<string | null>(null)

  // Editable name
  const [name, setName] = useState<string>((truck as any)?.name ?? defaultName ?? '')
  const [savingName, setSavingName] = useState<boolean>(false)
  const [editingName, setEditingName] = useState<boolean>(false)
  const [editInput, setEditInput] = useState<string>(name)

  // Registration state
  const [registration, setRegistration] = useState<string | null>(((truck as any)?.registration as string) ?? defaultRegistration ?? null)
  const [savingRegistration, setSavingRegistration] = useState<boolean>(false)
  const [registrationDigits, setRegistrationDigits] = useState<string>('')

  useEffect(() => {
    const [, d] = parseRegistration(registration ?? defaultRegistration ?? null)
    setRegistrationDigits(d.slice(0, 4))
  }, [registration, defaultRegistration])

  // Hub selection
  const [hubCity, setHubCity] = useState<string | null>((truck as any)?.hub ?? (truck as any)?.hub_city ?? null)
  const [hubs, setHubs] = useState<HubOption[]>([])
  const [loadingHubs, setLoadingHubs] = useState<boolean>(false)
  const [savingHub, setSavingHub] = useState<boolean>(false)
  const [selectedHubId, setSelectedHubId] = useState<string>('')

  // Acquisition type (new)
  const [acquisitionType, setAcquisitionType] = useState<string | null>(((truck as any)?.acquisition_type as string) ?? null)

  // UI state
  const [expanded, setExpanded] = useState<boolean>(false)
  const [actionsOpen, setActionsOpen] = useState<boolean>(false)
  const [showLogs, setShowLogs] = useState<boolean>(false)
  const [showSpecs, setShowSpecs] = useState<boolean>(false)
  const [showComponents, setShowComponents] = useState<boolean>(false)
  const [showSell, setShowSell] = useState<boolean>(false)
  const [showInsurance, setShowInsurance] = useState<boolean>(false)

  const rawModelId = (truck as any)?.master_truck_id ?? null

  // Model display
  const derivedModelName =
    truck?.model_make ? `${truck.model_make} ${truck.model_model ?? ''}`.trim() : truck?.model_model ?? null

  const modelDisplay = formatModelDisplay(
    modelInfo ?? {
      make: truck?.model_make ?? null,
      model: truck?.model_model ?? null,
      country: truck?.model_country ?? null,
      class: truck?.model_class ?? null,
      max_payload: truck?.model_max_load_kg ?? null,
      tonnage: truck?.model_tonnage ?? null,
      year: truck?.model_year ?? null,
      cargo_type_id: truck?.cargo_type_id ?? null,
      cargo_type_name: truck?.cargo_type_name ?? null,
      cargo_type_id_secondary: truck?.cargo_type_id_secondary ?? null,
      cargo_type_secondary_name: truck?.cargo_type_secondary_name ?? null,
      fuel_tank_capacity_l: truck?.model_fuel_tank_capacity_l ?? null,
      fuel_type: truck?.model_fuel_type ?? null,
      image_url: truck?.model_image_url ?? null,
    },
    derivedModelName ?? rawModelId ?? 'Unknown model'
  )

  /**
   * loadCargoIconsFromModel
   *
   * Resolve cargo_type_id(s) using modelInfo or master_truck_id then fetch icon_urls.
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
      let primary: string | null | undefined = modelInfo?.cargo_type_id ?? null
      let secondary: string | null | undefined = modelInfo?.cargo_type_id_secondary ?? null
      const modelId = (truck as any)?.master_truck_id ?? null
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
        const cargoTypeName = (truck as any)?.cargo_type_name ?? modelInfo?.cargo_type_name ?? (truck as any)?.cargo_type ?? null
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
      console.debug('cargo icon lookup from model', { master_truck_id: (truck as any)?.master_truck_id, primary, secondary, iconPrimary, iconSecondary })
    }

    void load()
    return () => {
      mounted = false
    }
  }, [truck?.master_truck_id, modelInfo?.cargo_type_id, modelInfo?.cargo_type_id_secondary, modelInfo?.cargo_type_name, truck?.cargo_type_name])

  // Refresh editable fields from API for owned trucks
  useEffect(() => {
    if (isMarket) return
    let mounted = true
    async function fetchLatestRow() {
      if (!id) return
      try {
        // Use a safe join to fetch the city name (avoid requesting a non-existing column)
        const res = await supabaseFetch(
          `/rest/v1/user_trucks?id=eq.${encodeURIComponent(
            id
          )}&select=name,registration,hub,location_city_id,last_maintenance_at,next_maintenance_km,mileage_km,cities:location_city_id(city_name),acquisition_type&limit=1`,
          { method: 'GET' }
        )
        if (!mounted) return
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          const row = res.data[0] as any
          if (typeof row.name === 'string') setName(row.name)
          if (typeof row.registration === 'string') setRegistration(row.registration)
          if (typeof row.hub === 'string') setHubCity(row.hub)

          // If the join returned a city row, prefer it as the displayed location (safe fallback to hub)
          if (row.cities && Array.isArray(row.cities) && row.cities.length > 0 && row.cities[0]?.city_name) {
            setHubCity(row.cities[0].city_name)
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
    fetchLatestRow()
    return () => {
      mounted = false
    }
  }, [id, isMarket])

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
    load()
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
    if (isMarket) {
      setRegistration(newReg)
      return
    }
    const prev = registration
    setRegistration(newReg)
    if (!id) return
    setSavingRegistration(true)
    try {
      const res = await supabaseFetch(`/rest/v1/user_trucks?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ registration: newReg }),
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      })
      if (!res || res.status < 200 || res.status >= 300) {
        setRegistration(prev)
        // eslint-disable-next-line no-console
        console.error('Failed to persist registration', res)
      }
    } catch (err) {
      setRegistration(prev)
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
    const prevLocationId = null
    const prevRegistration = registration

    const selected = hubId ? hubs.find((h) => h.id === hubId) : undefined
    const selectedCity = selected?.city ?? null
    let selectedCityId = selected?.city_id ?? null

    const [, currentDigits] = parseRegistration(registration ?? defaultRegistration ?? null)
    const newPrefix = makePrefixFromCity(selectedCity)
    const newDigits = currentDigits && currentDigits.length > 0 ? currentDigits : '1'
    const newRegistration = `${newPrefix}${newDigits}`

    setHubCity(selectedCity)
    setNextMaintenanceKm(nextMaintenanceKm ?? nextMaintenanceKm)
    setRegistration(newRegistration)

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
        setRegistration(prevRegistration)
        // eslint-disable-next-line no-console
        console.error('Failed to persist hub/location/registration', res)
      } else {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const returned = res.data[0] as any
          if (returned.registration) setRegistration(returned.registration)
          if (returned.location_city_id) {
            // nothing
          }
          if (returned.hub) setHubCity(returned.hub)
        }
      }
    } catch (err) {
      setHubCity(prevHub)
      setRegistration(prevRegistration)
      // eslint-disable-next-line no-console
      console.error('Error saving hub/location/registration', err)
    } finally {
      setSavingHub(false)
    }
  }

  // Location display fallback
  const location = (truck as any)?.location_city_name ?? hubCity ?? '—'

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
          model: { class: truck?.model_class ?? modelInfo?.class },
        } as any,
        'city'
      )
      setMaintenanceEstimates(estimates)
    } catch {
      setMaintenanceEstimates(null)
    }
  }

  return (
    <div className={`modern-card relative w-full rounded-lg bg-white overflow-visible border border-gray-200 ${isSuspended ? 'opacity-70 grayscale' : ''}`} role="article" aria-label={`Truck ${id || 'unknown'}`}>
      {/* Suspended overlay when truck is blocked - visually dim card but keep maintenance button accessible */}
      {isSuspended && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-rose-700 bg-white/40 px-3 py-1 rounded-md font-semibold">Suspended — maintenance required</div>
        </div>
      )}

      <div className="flex items-center gap-4 p-3 w-full">
        <div className="h-12 w-1 rounded-full bg-gradient-to-b from-sky-400 to-emerald-400" />

        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="min-w-0 w-full">
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-xs text-slate-500">Truck Model:</div>
                <div className="text-sm font-medium truncate">{modelDisplay}</div>
              </div>

              <div className="inline-flex items-center gap-2 ml-4 min-w-0">
                <div className="text-xs text-slate-500">Truck Name:</div>
                <div className="min-w-0 flex items-center gap-2">
                  {!editingName ? (
                    <>
                      <div className="text-sm font-medium truncate min-w-0">{name ?? defaultName ?? '—'}</div>
                      {!isMarket && !isSuspended && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingName(true)
                            setEditInput(name ?? defaultName ?? '')
                          }}
                          className="p-1 rounded hover:bg-gray-100 text-slate-500"
                          aria-label="Edit truck name"
                        >
                          <Edit3 className="w-4 h-4" />
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
                      className="flex items-center gap-2"
                    >
                      <input
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        className="text-sm font-medium truncate min-w-0 px-2 py-1 border border-slate-200 rounded bg-white"
                        aria-label="Edit truck name input"
                      />
                      <button type="submit" className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white" aria-label="Save name">
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingName(false)
                          setEditInput(name ?? defaultName ?? '')
                        }}
                        className="p-1 rounded hover:bg-gray-100 text-slate-500"
                        aria-label="Cancel edit"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cargo type icons */}
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            {cargoIconUrl ? (
              <img
                src={cargoIconUrl}
                alt="Cargo type"
                className="w-10 h-10 rounded-sm border border-slate-100 bg-white object-cover"
                style={{ flexShrink: 0 }}
              />
            ) : null}

            {cargoIconUrlSecondary ? (
              <img
                src={cargoIconUrlSecondary}
                alt="Secondary cargo type"
                className="w-10 h-10 rounded-sm border border-slate-100 bg-white object-cover"
                style={{ flexShrink: 0 }}
              />
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-6 flex-shrink-0">
          <StatChip icon={<Gauge className="w-4 h-4 text-slate-400" />} label="Condition" value={`${conditionScore}`} className="min-w-[88px]" />

          <div className="w-20 flex items-center justify-center flex-shrink-0">
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(status)} ring-1 text-center`}>
              <span className="capitalize">{status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 justify-center">
              <MapPin className="w-4 h-4 text-slate-400" />
              <div className="text-xs text-slate-500">Location</div>
            </div>

            <div className="text-sm text-slate-700 font-medium truncate w-28" title={String(location)}>
              {location}
            </div>
          </div>

          <div className="relative">
            <button type="button" aria-haspopup="true" aria-expanded={expanded} aria-label={expanded ? 'Close truck details' : 'Open truck details'} onClick={handleToggleExpand} className="p-2 rounded-md hover:bg-gray-100 text-slate-600">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expandable details panel */}
      <div className={`px-4 overflow-hidden transition-all duration-200 ${expanded ? 'max-h-96 py-4' : 'max-h-0 py-0'}`} aria-hidden={!expanded}>
        <div className="bg-slate-50 border border-slate-100 rounded-md p-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-slate-500">Truck model</div>
              <div className="text-sm font-medium text-slate-800 truncate min-w-0">{modelDisplay}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Producer</div>
              <div className="text-sm font-medium text-slate-800">{modelInfo?.make ?? truck?.model_make ?? truck?.make ?? truck?.producer ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Country</div>
              <div className="text-sm font-medium text-slate-800">{modelInfo?.country ?? truck?.model_country ?? truck?.manufactured_country ?? truck?.origin_country ?? truck?.country ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Class</div>
              <div className="text-sm font-medium text-slate-800">{modelInfo?.class ?? truck?.model_class ?? truck?.truck_class ?? truck?.class ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Year</div>
              {/* Prefer the denormalized year from user_trucks.model_year for active trucks,
                  fall back to joined modelInfo.year or other year fields when absent. */}
              <div className="text-sm font-medium text-slate-800">{(truck?.model_year ?? modelInfo?.year) ?? truck?.year ?? truck?.production_year ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Max payload</div>
              <div className="text-sm font-medium text-slate-800">{(modelInfo as any)?.max_load_kg ?? truck?.model_max_load_kg ?? truck?.max_payload_kg ?? truck?.payload_kg ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Tonnage in (t)</div>
              <div className="text-sm font-medium text-slate-800">{modelInfo?.tonnage ?? truck?.model_tonnage ?? truck?.tonnage ?? truck?.gross_tonnage ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Cargo type</div>
              <div className="text-sm font-medium text-slate-800">
                <div className="flex items-center gap-2">
                  {(modelInfo?.cargo_type_id ?? truck?.cargo_type_id) ? (
                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200">
                      {modelInfo?.cargo_type_name ?? truck?.cargo_type_name ?? '—'}
                    </span>
                  ) : null}

                  {(modelInfo?.cargo_type_id_secondary ?? truck?.cargo_type_id_secondary) ? (
                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200">
                      {modelInfo?.cargo_type_secondary_name ?? truck?.cargo_type_secondary_name ?? '—'}
                    </span>
                  ) : null}

                  {!(modelInfo?.cargo_type_id ?? truck?.cargo_type_id) && !(modelInfo?.cargo_type_id_secondary ?? truck?.cargo_type_id_secondary) ? '—' : null}
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
                  <select aria-label="Select hub" value={selectedHubId} onChange={(e) => setSelectedHubId(e.target.value)} className="text-sm px-2 py-1 border border-slate-200 rounded bg-white" disabled={savingHub}>
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
                      setRegistrationDigits(d)
                      const prefix = parseRegistration(registration ?? defaultRegistration ?? null)[0]
                      setRegistration(`${prefix}${d}`)
                    }}
                    region={parseRegistration(registration ?? defaultRegistration ?? null)[0]}
                    onSave={() => {
                      const prefix = parseRegistration(registration ?? defaultRegistration ?? null)[0]
                      handleSaveRegistration(`${prefix}${registrationDigits}`)
                    }}
                    disabled={savingRegistration || isMarket}
                    className="ml-3"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedHubId === (hubs.find((h) => h.city === hubCity)?.id ?? '')) return
                      handleChangeHub(selectedHubId)
                    }}
                    disabled={savingHub || selectedHubId === (hubs.find((h) => h.city === hubCity)?.id ?? '')}
                    className={`text-sm px-3 py-1 rounded border ${savingHub ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white hover:bg-slate-100 border-slate-200'}`}
                  >
                    Apply
                  </button>
                </>
              )}
            </div>

            {/* Buttons - disable non-maintenance actions when suspended */}
            <button type="button" onClick={() => setShowComponents(true)} className={`px-3 py-1 text-sm ${isSuspended ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-100'} border border-slate-200 rounded flex items-center gap-2`} disabled={isSuspended}>
              Components
            </button>

            <button type="button" onClick={() => setShowSpecs(true)} className={`px-3 py-1 text-sm ${isSuspended ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-100'} border border-slate-200 rounded flex items-center gap-2`} disabled={isSuspended}>
              Specifications
            </button>

            <button type="button" onClick={() => setShowLogs(true)} className={`px-3 py-1 text-sm ${isSuspended ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-100'} border border-slate-200 rounded flex items-center gap-2`} disabled={isSuspended}>
              Logs
            </button>

            <button type="button" onClick={() => setShowInsurance(true)} className={`px-3 py-1 text-sm ${isSuspended ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-100'} border border-slate-200 rounded flex items-center gap-2`} disabled={isSuspended}>
              Insurance
            </button>

            {/* Maintenance button always active (even for suspended trucks) */}
            <button type="button" onClick={openMaintenance} className="px-3 py-1 text-sm bg-amber-600 hover:bg-amber-700 border border-amber-600 rounded text-white flex items-center gap-2">
              Maintenance
            </button>

            <button type="button" onClick={() => setShowSell(true)} className={`px-3 py-1 text-sm ${isSuspended ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} border ${isSuspended ? 'border-slate-200' : 'border-red-600'} rounded text-white flex items-center gap-2`} disabled={isSuspended}>
              Sell
            </button>
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
        (async () => {
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
