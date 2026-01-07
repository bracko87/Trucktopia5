/**
 * TruckCard.tsx
 *
 * Single-row truck card used in the trucks list. Reads model-related fields
 * from denormalized columns on public.user_trucks and accepts optional modelInfo.
 *
 * Uses cargo_type_id / cargo_type_name instead of the previous textual model_load_type.
 */

import React, { useEffect, useState } from 'react'
import { Gauge, Calendar, MapPin, Menu } from 'lucide-react'
import EditableField from './EditableField'
import StatChip from './StatChip'
import { supabaseFetch, getTable } from '../../lib/supabase'
import LogModal from './LogModal'
import TruckSpecModal from './TruckSpecModal'
import TruckComponentsModal from './TruckComponentsModal'
import SellTruckModal from './SellTruckModal'
import InsuranceModal from './InsuranceModal'

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
  /**
   * Secondary cargo type id
   */
  cargo_type_id_secondary?: string | null
  /**
   * Secondary cargo type name
   */
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
  /**
   * isMarket
   *
   * When true the card represents a marketplace model and must be readonly.
   * Updates should be disabled and no REST persistence must run.
   */
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
 * EditableRegistration
 *
 * Inline component that renders a locked 2-letter prefix and editable numeric
 * digits (1-4). Calls onSave with full registration (prefix + digits).
 *
 * When isMarket=true the parent will not render this component and will show
 * a static registration instead.
 *
 * @param props - component props
 */
function EditableRegistration({
  value,
  defaultValue,
  onSave,
  maxDigits = 4,
}: {
  value?: string | null
  defaultValue?: string | null
  onSave: (reg: string) => void
  maxDigits?: number
}) {
  const initial = value ?? defaultValue ?? null
  const [prefix, setPrefix] = useState<string>('XX')
  const [digits, setDigits] = useState<string>('')

  useEffect(() => {
    const [p, d] = parseRegistration(initial)
    setPrefix(p)
    setDigits(d.slice(0, maxDigits))
  }, [initial, maxDigits])

  /**
   * handleDigitsChange
   *
   * Accept digits only and enforce max length.
   *
   * @param next - new input text
   */
  function handleDigitsChange(next: string) {
    const filtered = next.replace(/\D/g, '').slice(0, maxDigits)
    setDigits(filtered)
  }

  /**
   * handleSave
   *
   * Emit registration string to parent.
   */
  function handleSave() {
    onSave(`${prefix}${digits}`)
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="px-2 py-1 rounded-l-md bg-slate-100 text-xs font-mono text-slate-700 border border-r-0 border-slate-200">
        {prefix}
      </span>
      <input
        aria-label="Registration digits"
        value={digits}
        onChange={(e) => handleDigitsChange(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            const [, d] = parseRegistration(initial)
            setDigits(d.slice(0, maxDigits))
          }
        }}
        className="w-20 px-2 py-1 rounded-r-md border border-slate-200 text-sm font-mono"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={maxDigits}
      />
    </div>
  )
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
 * Main exported component. Shows truck info and allows editing name, registration
 * and hub (city) assignment for owned trucks. When isMarket=true the card is
 * read-only and no persistence calls are made.
 *
 * Uses cargo_type_name displayed instead of the old model_load_type text.
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
  // Safe fallbacks
  const id = truck.id ?? ''
  const status = ((truck.status as unknown as string) ?? 'unknown').toLowerCase()
  const mileage = (truck.mileage_km as unknown as number) ?? (truck as unknown as any)?.mileage ?? 0
  const conditionScore = (truck.condition_score as unknown as number) ?? 0

  // Editable name (local state)
  const [name, setName] = useState<string>((truck as any).name ?? defaultName ?? '')
  const [savingName, setSavingName] = useState<boolean>(false)

  // Editable registration (prefix locked)
  const [registration, setRegistration] = useState<string | null>(((truck as any).registration as string) ?? defaultRegistration ?? null)
  const [savingRegistration, setSavingRegistration] = useState<boolean>(false)

  // Hub (city) assignment
  const [hubCity, setHubCity] = useState<string | null>((truck as any).hub ?? (truck as any).hub_city ?? null)
  const [hubs, setHubs] = useState<HubOption[]>([])
  const [loadingHubs, setLoadingHubs] = useState<boolean>(false)
  const [savingHub, setSavingHub] = useState<boolean>(false)

  // Selected hub id (for the new "Apply" flow)
  const [selectedHubId, setSelectedHubId] = useState<string>('')

  // Location (city/hub) - id and name so we can persist location_city_id FK
  const [locationCityId, setLocationCityId] = useState<string | null>((truck as any).location_city_id ?? null)
  const [locationCityName, setLocationCityName] = useState<string | null>((truck as any).location_city_name ?? null)

  const rawModelId = (truck.master_truck_id as unknown as string) ?? null

  // Expanded state (controls the full-card expansion)
  const [expanded, setExpanded] = useState<boolean>(false)

  // Actions panel open state (kept for compatibility with small dropdown usage)
  const [actionsOpen, setActionsOpen] = useState<boolean>(false)

  // Modal open state for logs
  const [showLogs, setShowLogs] = useState<boolean>(false)

  // Modal open state for specifications (new)
  const [showSpecs, setShowSpecs] = useState<boolean>(false)

  // Modal open state for components
  const [showComponents, setShowComponents] = useState<boolean>(false)

  // Modal open state for selling the truck
  const [showSell, setShowSell] = useState<boolean>(false)

  // Modal open state for truck insurance
  const [showInsurance, setShowInsurance] = useState<boolean>(false)

  /**
   * openInsurance
   *
   * Open insurance modal (defined in component scope to avoid runtime reference errors).
   */
  function openInsurance() {
    setShowInsurance(true)
  }

  /**
   * closeInsurance
   *
   * Close insurance modal.
   */
  function closeInsurance() {
    setShowInsurance(false)
  }

  // Derive a fallback model display from denormalized columns on the truck row
  const derivedModelName =
    ((truck as any).model_make ? `${(truck as any).model_make} ${(truck as any).model_model ?? ''}`.trim() : (truck as any).model_model ?? null) ?? null

  const modelDisplay = formatModelDisplay(
    modelInfo ?? {
      make: (truck as any).model_make ?? null,
      model: (truck as any).model_model ?? null,
      country: (truck as any).model_country ?? null,
      class: (truck as any).model_class ?? null,
      max_payload: (truck as any).model_max_load_kg ?? null,
      tonnage: (truck as any).model_tonnage ?? null,
      year: (truck as any).model_year ?? null,
      cargo_type_id: (truck as any).cargo_type_id ?? null,
      cargo_type_name: (truck as any).cargo_type_name ?? null,
      cargo_type_id_secondary: (truck as any).cargo_type_id_secondary ?? null,
      cargo_type_secondary_name: (truck as any).cargo_type_secondary_name ?? null,
      fuel_tank_capacity_l: (truck as any).model_fuel_tank_capacity_l ?? null,
      fuel_type: (truck as any).model_fuel_type ?? null,
      image_url: (truck as any).model_image_url ?? null,
    },
    derivedModelName ?? rawModelId ?? 'Unknown model'
  )

  /**
   * fetchLatestRow
   *
   * Fetch the latest name, registration, hub and location_city_id for this truck row so edits persist across reloads.
   *
   * This is only relevant for owned user trucks. Skip for market items.
   *
   * @returns void
   */
  useEffect(() => {
    if (isMarket) return
    let mounted = true
    async function fetchLatestRow() {
      if (!id) return
      try {
        const res = await supabaseFetch(
          `/rest/v1/user_trucks?id=eq.${encodeURIComponent(id)}&select=name,registration,hub,location_city_id,location_city_name,cargo_type_id,cargo_type_name`,
          {
            method: 'GET',
          }
        )
        if (!mounted) return
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          const row = res.data[0] as {
            name?: string | null
            registration?: string | null
            hub?: string | null
            location_city_id?: string | null
            location_city_name?: string | null
            cargo_type_id?: string | null
            cargo_type_name?: string | null
          }
          if (typeof row.name === 'string') setName(row.name)
          if (typeof row.registration === 'string') setRegistration(row.registration)
          if (typeof row.hub === 'string') setHubCity(row.hub)
          if (typeof row.location_city_id === 'string') setLocationCityId(row.location_city_id)
          if (typeof row.location_city_name === 'string') setLocationCityName(row.location_city_name)
        }
      } catch (err) {
        // ignore fetch errors, keep local state
        // eslint-disable-next-line no-console
        console.error('Failed to fetch latest truck row', err)
      }
    }
    fetchLatestRow()
    return () => {
      mounted = false
    }
  }, [id, isMarket])

  /**
   * loadHubsForOwner
   *
   * Load hubs for the owning company so the user can relocate the truck.
   *
   * This is only relevant for owned trucks; skip for market listings.
   *
   * @returns void
   */
  useEffect(() => {
    if (isMarket) return
    let mounted = true
    async function load() {
      setLoadingHubs(true)
      try {
        const ownerCompanyId = (truck as any).owner_company_id ?? (truck as any).owner_id ?? null
        let res
        if (ownerCompanyId) {
          res = await getTable('hubs', `?select=id,city,country,is_main,city_id&owner_id=eq.${ownerCompanyId}&order=is_main.desc,city.asc`)
        } else {
          res = await getTable('hubs', `?select=id,city,country,is_main,city_id&order=is_main.desc,city.asc`)
        }
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

  /**
   * keep selectedHubId in sync when hubCity changes externally
   */
  useEffect(() => {
    const idForCity = hubs.find((h) => h.city === hubCity)?.id ?? ''
    setSelectedHubId(idForCity)
  }, [hubCity, hubs])

  /**
   * handleSaveName
   *
   * Persist truck name to public.user_trucks.name via Supabase REST.
   *
   * For market listings this is a no-op.
   *
   * @param newName - new truck name
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
   *
   * For market listings this is a no-op.
   *
   * @param newReg - new registration (prefix+digits)
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
   * resolveCityIdByName
   *
   * Try to find a cities.id by exact city name. Returns null when not found.
   *
   * @param cityName - city name to lookup
   * @returns city id string or null
   */
  async function resolveCityIdByName(cityName?: string | null): Promise<string | null> {
    if (!cityName) return null
    try {
      const cityRes = await getTable('cities', `?select=id&city_name=eq.${encodeURIComponent(cityName)}&limit=1`)
      const cityRows = Array.isArray(cityRes.data) ? cityRes.data : []
      if (cityRows.length > 0 && cityRows[0].id) {
        return cityRows[0].id
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug('City lookup failed for', cityName, err)
    }
    return null
  }

  /**
   * makePrefixFromCity
   *
   * Create a 2-letter prefix from a city name (letters only, uppercase). Pads with X if needed.
   *
   * @param city - city name
   * @returns 2-letter uppercase string
   */
  function makePrefixFromCity(city?: string | null) {
    if (!city) return 'XX'
    const letters = city.replace(/[^A-Za-z]/g, '').toUpperCase()
    if (letters.length >= 2) return letters.slice(0, 2)
    if (letters.length === 1) return `${letters}X`
    return 'XX'
  }

  /**
   * handleChangeHub
   *
   * Persist selected hub (city name) to public.user_trucks.hub column and also
   * update location_city_id to the selected hub's city_id so the FK is kept in sync.
   *
   * For market listings this is a no-op (local state only).
   *
   * @param hubId - selected hub id (or empty string for none)
   */
  async function handleChangeHub(hubId: string) {
    const prevHub = hubCity
    const prevLocationId = locationCityId
    const prevRegistration = registration

    const selected = hubId ? hubs.find((h) => h.id === hubId) : undefined
    const selectedCity = selected?.city ?? null
    let selectedCityId = selected?.city_id ?? null

    if (!selectedCityId && selectedCity) {
      selectedCityId = await resolveCityIdByName(selectedCity)
    }

    const [, currentDigits] = parseRegistration(registration ?? defaultRegistration ?? null)
    const newPrefix = makePrefixFromCity(selectedCity)
    const newDigits = currentDigits && currentDigits.length > 0 ? currentDigits : '1'
    const newRegistration = `${newPrefix}${newDigits}`

    setHubCity(selectedCity)
    setLocationCityId(selectedCityId ?? null)
    setLocationCityName(selectedCity ?? null)
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
        setLocationCityId(prevLocationId)
        setRegistration(prevRegistration)
        // eslint-disable-next-line no-console
        console.error('Failed to persist hub/location/registration', res)
      } else {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const returned = res.data[0] as any
          if (returned.registration) setRegistration(returned.registration)
          if (returned.location_city_id) setLocationCityId(returned.location_city_id)
          if (returned.hub) setHubCity(returned.hub)
        }
      }
    } catch (err) {
      setHubCity(prevHub)
      setLocationCityId(prevLocationId)
      setRegistration(prevRegistration)
      // eslint-disable-next-line no-console
      console.error('Error saving hub/location/registration', err)
    } finally {
      setSavingHub(false)
    }
  }

  /**
   * ensurePrefixFromHub
   *
   * When the truck already has a hub assigned but the registration prefix is 'XX'
   * (or different), compute the hub-based prefix and persist it.
   *
   * Skip for market items.
   */
  useEffect(() => {
    if (isMarket) return
    let mounted = true
    async function ensurePrefixFromHub() {
      if (!id) return
      if (!hubCity) return
      if (savingRegistration || savingHub) return

      const [currentPrefix, currentDigits] = parseRegistration(registration ?? defaultRegistration ?? null)
      const desiredPrefix = makePrefixFromCity(hubCity)
      if (!desiredPrefix || desiredPrefix === currentPrefix) return

      const newReg = `${desiredPrefix}${currentDigits && currentDigits.length > 0 ? currentDigits : '1'}`
      setRegistration(newReg)
      setSavingRegistration(true)
      try {
        const res = await supabaseFetch(`/rest/v1/user_trucks?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ registration: newReg }),
          headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        })
        if (!mounted) return
        if (!res || res.status < 200 || res.status >= 300) {
          const [, d] = parseRegistration(registration ?? defaultRegistration ?? null)
          setRegistration(`${currentPrefix}${d}`)
          // eslint-disable-next-line no-console
          console.error('Failed to persist registration on ensurePrefixFromHub', res)
        } else if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const returned = res.data[0] as any
          if (returned.registration) setRegistration(returned.registration)
        }
      } catch (err) {
        const [, d] = parseRegistration(registration ?? defaultRegistration ?? null)
        setRegistration(`${currentPrefix}${d}`)
        // eslint-disable-next-line no-console
        console.error('Error ensuring registration prefix from hub', err)
      } finally {
        if (mounted) setSavingRegistration(false)
      }
    }

    ensurePrefixFromHub()
    return () => {
      mounted = false
    }
  }, [hubCity, id, registration, defaultRegistration, savingRegistration, savingHub, isMarket])

  // Location display fallback
  const location = locationCityName ?? (truck as any).location_city_name ?? hubCity ?? '—'

  /**
   * handleToggleExpand
   *
   * Toggle the expanded card panel that reveals more information and options.
   */
  function handleToggleExpand() {
    if (actionsOpen) setActionsOpen(false)
    setExpanded((s) => !s)
  }

  return (
    <div className="modern-card relative w-full rounded-lg bg-white overflow-visible border border-gray-200" role="article" aria-label={`Truck ${id || 'unknown'}`}>
      <div className="flex items-center gap-4 p-3 w-full">
        <div className="h-12 w-1 rounded-full bg-gradient-to-b from-sky-400 to-emerald-400" />

        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-500">Truck Model:</div>
              <div className="text-sm font-medium truncate">{modelDisplay}</div>

              <div className="text-xs text-slate-500 ml-4">Reg:</div>
              <div className="ml-1">
                {isMarket ? (
                  <div className="inline-flex items-center gap-2">
                    <span className="px-2 py-1 rounded-l-md bg-slate-100 text-xs font-mono text-slate-700 border border-r-0 border-slate-200">
                      {parseRegistration(registration ?? defaultRegistration ?? null)[0]}
                    </span>
                    <span className="w-20 px-2 py-1 rounded-r-md border border-slate-200 text-sm font-mono">
                      {parseRegistration(registration ?? defaultRegistration ?? null)[1]}
                    </span>
                  </div>
                ) : (
                  <EditableRegistration value={registration} defaultValue={defaultRegistration ?? undefined} onSave={handleSaveRegistration} />
                )}
              </div>

              <div className="inline-flex items-center gap-2 ml-4 min-w-0">
                <div className="text-xs text-slate-500">Truck Name:</div>
                <div>{isMarket ? <div className="text-sm text-slate-800 truncate">{name || 'Unnamed truck'}</div> : <EditableField value={name} placeholder="Unnamed truck" onSave={handleSaveName} loading={savingName} />}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-6 flex-shrink-0">
          <StatChip icon={<Gauge className="w-4 h-4 text-slate-400" />} label="Condition" value={`${conditionScore}`} className="min-w-[88px]" />

          <StatChip icon={<Calendar className="w-4 h-4 text-slate-400" />} label="Mileage" value={`${mileage}`} className="min-w-[88px]" />

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
              <div className="text-sm font-medium text-slate-800">{modelInfo?.make ?? (truck as any).model_make ?? (truck as any).make ?? (truck as any).producer ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Country</div>
              <div className="text-sm font-medium text-slate-800">{modelInfo?.country ?? (truck as any).model_country ?? (truck as any).manufactured_country ?? (truck as any).origin_country ?? (truck as any).country ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Class</div>
              <div className="text-sm font-medium text-slate-800">{modelInfo?.class ?? (truck as any).model_class ?? (truck as any).truck_class ?? (truck as any).class ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Year</div>
              <div className="text-sm font-medium text-slate-800">{modelInfo?.year ?? (truck as any).model_year ?? (truck as any).year ?? (truck as any).production_year ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Max payload</div>
              <div className="text-sm font-medium text-slate-800">{(modelInfo as any)?.max_load_kg ?? (truck as any).model_max_load_kg ?? (truck as any).max_payload_kg ?? (truck as any).payload_kg ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Tonnage in (t)</div>
              <div className="text-sm font-medium text-slate-800">{modelInfo?.tonnage ?? (truck as any).model_tonnage ?? (truck as any).tonnage ?? (truck as any).gross_tonnage ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Cargo type</div>
              <div className="text-sm font-medium text-slate-800">
                <div className="flex items-center gap-2">
                  {/* Primary cargo type badge */}
                  {(modelInfo?.cargo_type_id ?? (truck as any).cargo_type_id) ? (
                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200">
                      {modelInfo?.cargo_type_name ?? (truck as any).cargo_type_name ?? '—'}
                    </span>
                  ) : null}

                  {/* Secondary cargo type badge */}
                  {(modelInfo?.cargo_type_id_secondary ?? (truck as any).cargo_type_id_secondary) ? (
                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200">
                      {modelInfo?.cargo_type_secondary_name ?? (truck as any).cargo_type_secondary_name ?? '—'}
                    </span>
                  ) : null}

                  {/* Fallback when neither present */}
                  {!(modelInfo?.cargo_type_id ?? (truck as any).cargo_type_id) && !(modelInfo?.cargo_type_id_secondary ?? (truck as any).cargo_type_id_secondary) ? '—' : null}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Purchase date</div>
              <div className="text-sm font-medium text-slate-800">{(truck as any).purchase_date ? new Date((truck as any).purchase_date).toLocaleString() : (truck as any).created_at ? new Date((truck as any).created_at).toLocaleString() : '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Mileage</div>
              <div className="text-sm font-medium text-slate-800">{mileage != null ? `${mileage}` : '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Fuel level</div>
              <div className="text-sm font-medium text-slate-800">{(truck as any).fuel_level_l ? `${(truck as any).fuel_level_l} L` : '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Last maintenance</div>
              <div className="text-sm font-medium text-slate-800">{(truck as any).last_maintenance_at ? new Date((truck as any).last_maintenance_at).toLocaleString() : '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Next maintenance (km)</div>
              <div className="text-sm font-medium text-slate-800">{(truck as any).next_maintenance_km ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Hub</div>
              <div className="text-sm text-slate-700">{hubCity ?? '—'}</div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 justify-end">
            {/* Hub selector + Apply moved here so it's in-line with action buttons */}
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

            <button
              type="button"
              onClick={() => {
                console.debug('Components for', id)
                // Keep the details panel expanded when opening components
                setShowComponents(true)
              }}
              className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-2"
            >
              Truck Components
            </button>

            <button
              type="button"
              onClick={() => {
                // Open the Truck specifications modal (fetches truck_models row including image)
                setShowSpecs(true)
                // Keep the details panel expanded (do not collapse)
              }}
              className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-2"
            >
              Truck specifications
            </button>

            <button
              type="button"
              onClick={() => {
                // Open logs modal for this truck and keep details expanded
                setShowLogs(true)
              }}
              className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-2"
            >
              View logs
            </button>

            <button
              type="button"
              onClick={openInsurance}
              className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-2"
            >
              Insurance
            </button>

            <button
              type="button"
              onClick={() => {
                // Open Sell Truck modal (moved to last position)
                setShowSell(true)
              }}
              className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 border border-red-600 rounded text-white flex items-center gap-2"
            >
              Sell Truck
            </button>
          </div>
        </div>
      </div>

      {/* Logs modal (keeps TruckCard layout unchanged) */}
      <LogModal truckId={id} open={showLogs} onClose={() => setShowLogs(false)} />

      {/* Truck specifications modal */}
      <TruckSpecModal modelId={rawModelId} open={showSpecs} onClose={() => setShowSpecs(false)} />

      {/* Truck components modal */}
      <TruckComponentsModal truckId={id} open={showComponents} onClose={() => setShowComponents(false)} />

      {/* Insurance modal */}
      <InsuranceModal truckId={id} condition={conditionScore} open={showInsurance} onClose={closeInsurance} />

      {/* Sell truck modal */}
      <SellTruckModal truckId={id} condition={conditionScore} open={showSell} onClose={() => setShowSell(false)} />
    </div>
  )
}