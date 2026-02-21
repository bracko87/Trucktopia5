/**
 * DroppableSlot.tsx
 *
 * Slot preview renderer used in staging assignment.
 *
 * - Shows cargo, truck, trailer and drivers previews.
 * - Resolves driver locations using hired_staff.current_location_id with a
 *   fallback to staff_profile_stats.current_location_id, then resolves hub id -> city.
 * - Trailer info is fetched separately and does not interfere with driver state.
 */

import React, { useEffect, useState } from 'react'
import { normalizeGcwLetter } from '../../lib/gcw'
import { supabase } from '../../lib/supabase'

/**
 * DroppableSlotProps
 *
 * Props for the DroppableSlot component.
 */
interface DroppableSlotProps {
  id: string
  title: string
  count?: number
  value?: any
  capacityKg?: number | null
  disabled?: boolean
  onDrop?: (payload: any) => void
  ignoreDisabledForTypes?: string[]
  /**
   * allowedTypes
   *
   * Optional list of allowed payload.type strings for this slot. When provided,
   * drops that include a payload.type not in this list will be rejected.
   */
  allowedTypes?: string[]
}

/**
 * parseDropPayload
 *
 * Attempt to parse a JSON payload from the DataTransfer. Returns null when parsing fails.
 *
 * @param ev - DragEvent
 * @returns any | null
 */
function parseDropPayload(ev: React.DragEvent<HTMLDivElement>): any | null {
  try {
    const raw =
      ev.dataTransfer.getData('application/json') ||
      ev.dataTransfer.getData('text/plain')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * DroppableSlot
 *
 * Render a slot used by the assembler. When value is an array it's treated as
 * drivers and this component will resolve their current hub city by querying
 * hired_staff.current_location_id -> hubs.city using a two-step fetch with a
 * fallback to staff_profile_stats for CEO/profile ids.
 *
 * @param props DroppableSlotProps
 * @returns JSX.Element
 */
export default function DroppableSlot({
  id,
  title,
  count,
  value,
  capacityKg,
  disabled,
  onDrop,
  ignoreDisabledForTypes = [],
  allowedTypes,
}: DroppableSlotProps): JSX.Element {
  /**
   * Local state for fetched trailer details
   */
  const [trailerInfo, setTrailerInfo] = useState<any | null>(null)
  /**
   * Driver locations keyed by hired_staff / staff_profile id
   */
  const [driverLocations, setDriverLocations] = useState<Record<string, string | null>>({})

  /**
   * fetchTrailerInfo
   *
   * Query user_trailers for authoritative trailer fields and join trailer_models -> cargo_types
   * Also resolve location via location_city_id -> cities.city_name so PostgREST/Supabase returns the city_name.
   *
   * @param trailerId user_trailers.id
   */
  async function fetchTrailerInfo(trailerId: string) {
    if (!trailerId) {
      setTrailerInfo(null)
      return
    }

    try {
      const { data, error } = await supabase
        .from('user_trailers')
        .select(`
          id,
          cities:location_city_id(city_name),
          trailer_models (
            gcw,
            cargo_types ( name )
          )
        `)
        .eq('id', trailerId)
        .limit(1)

      if (error) {
        // eslint-disable-next-line no-console
        console.error('fetchTrailerInfo error', error)
        setTrailerInfo(null)
        return
      }

      if (!data || !data[0]) {
        setTrailerInfo(null)
        return
      }

      const row: any = data[0]
      const model = Array.isArray(row.trailer_models) ? row.trailer_models[0] : row.trailer_models
      const cargoName =
        model?.cargo_types?.name ??
        (Array.isArray(model?.cargo_types) ? model.cargo_types[0]?.name : null)

      const city =
        Array.isArray(row.cities)
          ? row.cities[0]?.city_name
          : row.cities?.city_name ?? null

      setTrailerInfo({
        location: city,
        cargo: cargoName ?? null,
        gcw: normalizeGcwLetter(model?.gcw),
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('fetchTrailerInfo error', e)
      setTrailerInfo(null)
    }
  }

  /**
   * fetchDriverLocations
   *
   * Resolve driver ids -> hub city using a simple straight wiring:
   * 1) Try hired_staff.current_location_id
   * 2) Fallback to staff_profile_stats.current_location_id
   * 3) Resolve hub ids -> hubs.city
   *
   * @param driverIds array of hired_staff / staff_profile id strings
   */
  async function fetchDriverLocations(driverIds: string[]) {
    if (!driverIds?.length) {
      setDriverLocations({})
      return
    }

    /* STEP 1 — hired_staff locations */
    const { data: staffRows } = await supabase
      .from('hired_staff')
      .select('id, current_location_id')
      .in('id', driverIds)

    const map: Record<string, string | undefined> = {}
    const hubIds: string[] = []

    for (const row of staffRows ?? []) {
      if (row.current_location_id) {
        map[row.id] = row.current_location_id
        hubIds.push(row.current_location_id)
      }
    }

    /* STEP 2 — fallback to staff_profile_stats */
    const missingIds = driverIds.filter((id) => !map[id])

    if (missingIds.length) {
      const { data: statsRows } = await supabase
        .from('staff_profile_stats')
        .select('staff_profile_id, current_location_id')
        .in('staff_profile_id', missingIds)

      for (const row of statsRows ?? []) {
        if (row.current_location_id) {
          map[row.staff_profile_id] = row.current_location_id
          hubIds.push(row.current_location_id)
        }
      }
    }

    if (!hubIds.length) {
      setDriverLocations({})
      return
    }

    /* STEP 3 — resolve cities */
    const { data: cities } = await supabase
      .from('cities')
      .select('id, city_name')
      .in('id', hubIds)

    const cityMap: Record<string, string> = {}
    for (const c of cities ?? []) {
      if (c?.id) cityMap[String(c.id)] = c.city_name ?? ''
    }

    /* STEP 4 — final driver -> city map */
    const result: Record<string, string | null> = {}
    for (const id of driverIds) {
      const cityId = map[id]
      result[id] = cityId ? cityMap[cityId] ?? null : null
    }

    // eslint-disable-next-line no-console
    console.log('Driver location map:', result)

    setDriverLocations(result)
  }

  /**
   * Driver-only effect
   *
   * Triggers location resolution for driver arrays only. It intentionally does not
   * clear driverLocations when there are no ids — the provided fetchDriverLocations
   * will handle empty input if called directly.
   */
  useEffect(() => {
    if (!Array.isArray(value)) return

    const ids = value.map((d: any) => d.id).filter(Boolean)

    if (ids.length) {
      void fetchDriverLocations(ids)
    }
  }, [JSON.stringify(value)])

  /**
   * Trailer effect
   *
   * Dedicated effect to handle trailer detection/fetching so driver state isn't
   * touched by trailer fetches.
   */
  useEffect(() => {
    // Trailer detection and fetch
    if (
      value &&
      (value.type === 'trailer' ||
        value.payloadKg ||
        value.payload ||
        value._raw?.payload_kg ||
        value.model?.max_payload)
    ) {
      const id = value?.id ?? value?._raw?.id
      if (id) {
        void fetchTrailerInfo(id)
      } else {
        setTrailerInfo(null)
      }
      return
    }

    // clear trailer info when not trailer
    setTrailerInfo(null)
  }, [JSON.stringify(value)])

  /**
   * renderValue
   *
   * Render preview depending on the value type. Drivers (array) path returns early
   * and will not render GCW lines (that belonged to truck/trailer branches).
   */
  function renderValue() {
    if (!value) return null

    // Drivers (array)
    if (Array.isArray(value)) {
      return (
        <>
          {value.map((drv: any) => (
            <div key={drv.id} className="mb-2">
              <div className="font-medium text-slate-800">
                {drv.label ?? drv.name ?? `${drv.first_name ?? ''} ${drv.last_name ?? ''}`.trim()}
              </div>
              <div className="text-xs text-slate-500">
                Location: {drv.id ? (driverLocations[String(drv.id)] ?? '—') : '—'}
              </div>
            </div>
          ))}
        </>
      )
    }

    const label = value?.label ?? value?.name ?? ''
    const job = value?.job_offer ?? value

    // Cargo detection
    const isCargo = Boolean(job?.weight_kg)

    if (isCargo) {
      const cargoWeight = Number(job.weight_kg ?? 0)
      const pickup =
        job.origin_city?.city_name ??
        job.pickup_city ??
        null

      const transportMode =
        job.transport_mode === 'trailer_cargo'
          ? 'Trailer job'
          : 'Load job'

      return (
        <>
          <div className="font-medium text-slate-800">{label}</div>

          <div className="text-xs text-slate-500 mt-1">
            {transportMode}
          </div>

          {pickup && (
            <div className="text-xs text-slate-500">
              Pickup: {pickup}
            </div>
          )}

          <div className="text-xs text-slate-500">
            {cargoWeight} / {capacityKg ?? '—'} kg
          </div>
        </>
      )
    }

    // Trailer preview
    const isTrailer = Boolean(
      value?.type === 'trailer' ||
      value?.payloadKg ||
      value?._raw?.payload_kg ||
      value?.model?.max_payload
    )

    if (isTrailer) {
      const raw = value?._raw ?? {}

      const fetchedCargo = trailerInfo?.cargo ?? (Array.isArray(raw?.cargo_type_names) ? raw.cargo_type_names.join(', ') : raw?.cargo_type_names)
      const cargoNames = fetchedCargo ?? '—'

      const gcwLetter = trailerInfo?.gcw ?? normalizeGcwLetter(value?.model?.gcw ?? raw?.gcw_class ?? raw?.gcw)

      return (
        <>
          <div className="font-medium text-slate-800">{label}</div>

          <div className="text-xs text-slate-500 mt-1">
            Location: {trailerInfo?.location ?? raw?.location_city_name ?? value?.location ?? '—'}
          </div>

          <div className="text-xs text-slate-500">
            Cargo: {cargoNames}
          </div>

          <div className="text-xs text-slate-500">
            GCW: {gcwLetter ?? '—'}
          </div>
        </>
      )
    }

    // Truck preview (non-big trucks do not show GCW)
    const model = value?.model ?? {}
    const raw = value?._raw ?? {}

    const modelLabel =
      model?.make || model?.model
        ? `${model?.make ?? ''} ${model?.model ?? ''}`.trim()
        : null

    const gcwLetter = normalizeGcwLetter(model?.gcw ?? raw?.gcw_class ?? raw?.gcw)

    return (
      <>
        <div className="font-medium text-slate-800">{label}</div>

        {modelLabel && (
          <div className="text-xs text-slate-500">
            {modelLabel}
          </div>
        )}

        <div className="text-xs text-slate-500 mt-1">
          Location: {raw?.location_city_name ?? '—'}
        </div>

        {/* Keep GCW for trucks only when meaningful (big trucks) */}
        {String(model?.class ?? '').toLowerCase?.() === 'big' && (
          <div className="text-xs text-slate-500">
            GCW: {gcwLetter ?? '—'}
          </div>
        )}
      </>
    )
  }

  return (
    <div
      id={id}
      className={`p-3 border border-slate-100 rounded bg-white ${disabled ? 'opacity-50' : ''}`}
      onDragOver={(ev) => ev.preventDefault()}
      onDrop={(ev) => {
        ev.preventDefault()
        const payload = parseDropPayload(ev)

        if (!payload && onDrop) {
          onDrop(null)
          return
        }

        // Block drop if payload.type is present but not allowed for this slot.
        if (payload?.type && allowedTypes && !allowedTypes.includes(payload.type)) {
          return
        }

        if (
          disabled &&
          payload?.type &&
          !ignoreDisabledForTypes.includes(payload.type)
        ) {
          return
        }

        onDrop?.(payload)
      }}
    >
      <div className="flex justify-between">
        <div className="text-sm font-medium text-slate-700">
          {title}
        </div>
        {typeof count === 'number' && (
          <div className="text-xs text-slate-500">{count}</div>
        )}
      </div>

      <div className="mt-2 border-t border-slate-200" />

      <div className="mt-2 text-xs text-slate-500">
        {value ? renderValue() : (
          <div className="text-slate-400">Empty</div>
        )}
      </div>
    </div>
  )
}