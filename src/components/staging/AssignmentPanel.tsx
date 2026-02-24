/**
 * src/components/staging/AssignmentPanel.tsx
 *
 * Assignment panel used in the Staging Area.
 *
 * - Preserves visual layout and behaviour.
 * - Fetches preview and weather rows for pickup and delivery cities.
 * - Shows current weather cards and an aggregated relocation summary.
 *
 * Notes:
 * - This file was updated to:
 *   1) accept relocationInfo from parent and aggregate driver relocations,
 *   2) display relocation time as minutes/hours (human-friendly),
 *   3) include relocation cost into total cost when preview is available,
 *   4) align weather cards' height with the cost box (visual fix),
 *   5) reliably persist driver_id and driver_city_id into assignment_previews
 *      when a driver is selected (robust lookup + DB fallback).
 */

import React, { useEffect, useState } from 'react'
import DroppableSlot from './DroppableSlot'
import ModalShell from '../common/ModalShell'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { finalizeAssignmentDirect } from '../../services/assignmentService'
import StagingAssignmentsPanel from './StagingAssignmentsPanel'

/**
 * Temporary safety switch: keep preview flow enabled but disable final acceptance writes.
 */
// Flow switch: set to true to allow final assignment acceptance writes.
const ASSIGNMENT_FINALIZE_ENABLED = true

/**
 * DroppedItem
 *
 * Lightweight shape for an item dropped onto a slot.
 */
interface DroppedItem {
  id?: string
  type?: string
  label?: string
  model?: any
  job_offer?: any
  _raw?: any
  [key: string]: any
}

/**
 * HiredDriverRow
 *
 * Minimal shape representing a driver entry stored in the assignment drivers list.
 */
interface HiredDriverRow {
  id: string
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  _raw?: any
}

/**
 * AssignmentState
 *
 * Public shape representing the assembled assignment.
 */
export interface AssignmentState {
  truck: DroppedItem | null
  trailer: DroppedItem | null
  drivers: HiredDriverRow[]
  cargo: any | null
}

/**
 * AssignmentPanelProps
 *
 * Parent can optionally receive assignment updates via onAssignmentChange.
 */
interface AssignmentPanelProps {
  onAssignmentChange?: (state: AssignmentState) => void
  trucks?: any[]
  drivers?: any[]
  trailers?: any[]
  /**
   * relocationInfo
   *
   * Map of driver id -> { km, hours, cost } computed by the parent so the
   * RouteCalculatorBox can show a relocation summary without an extra RPC.
   */
  relocationInfo?: Record<string, any>
}

/**
 * CityWeatherRow
 *
 * Minimal shape for rows stored in city_weather_today / forecast table.
 */
interface CityWeatherRow {
  city_id: string
  condition?: string | null
  temperature?: number | null
  is_rain?: boolean | null
  is_snow?: boolean | null
  forecast_date?: string | null
  [key: string]: any
}

/**
 * weatherIcon
 *
 * Return a small emoji icon representing the provided weather condition.
 *
 * @param condition textual condition (e.g. "light rain")
 * @param row optional raw row with boolean flags (is_rain/is_snow)
 * @returns emoji string
 */
function weatherIcon(condition?: string | null, row?: any) {
  const c = (condition ?? '').toLowerCase()

  if (row?.is_snow || c.includes('snow')) return '❄️'
  if (row?.is_rain || c.includes('rain')) return '🌧'
  if (c.includes('cloud')) return '☁️'
  if (c.includes('sun') || c.includes('clear')) return '☀️'

  return '🌤'
}

/**
 * formatHoursToHM
 *
 * Convert decimal hours to a compact human friendly string:
 * - under 60 minutes -> "30 min"
 * - exact hours -> "1h"
 * - hours + minutes -> "1h 25m"
 *
 * @param hours number of hours
 * @returns formatted string or '—' when invalid
 */
function formatHoursToHM(hours?: number | null) {
  if (hours == null || Number.isNaN(Number(hours))) return '—'

  const totalMinutes = Math.round(Number(hours) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60

  if (h === 0) return `${totalMinutes} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * RouteCalculatorBoxProps
 *
 * Props for the route calculator box used to display calculated details before confirm.
 */
interface RouteCalculatorBoxProps {
  assignment: AssignmentState
  driversCount: number
  previewData?: any | null
  pickupWeather?: CityWeatherRow | null
  deliveryWeather?: CityWeatherRow | null
  pickupForecast?: CityWeatherRow | null
  deliveryForecast?: CityWeatherRow | null
  /** relocationInfo provided by parent (driver id -> {km,hours,cost}) */
  relocationInfo?: Record<string, any>
}

/**
 * RouteCalculatorBox
 *
 * Presentational calculation box that shows route/job estimates computed
 * from the assembled assignment OR from a server-provided preview row.
 *
 * Uses direct mapping from assignment_previews table columns when previewData
 * is provided. Otherwise falls back to local heuristics.
 */
function RouteCalculatorBox({
  assignment,
  driversCount,
  previewData,
  pickupWeather,
  deliveryWeather,
  pickupForecast,
  deliveryForecast,
  relocationInfo = {},
}: RouteCalculatorBoxProps) {
  /**
   * Aggregate relocation values from relocationInfo (provided by parent).
   * This keeps the preview modal in sync with the driver relocation engine
   * computed in StagingTabs.tsx.
   */
  const driverRelocations = (assignment?.drivers ?? [])
    .map((d: any) => (d && d.id ? relocationInfo?.[String(d.id)] : null))
    .filter(Boolean) as any[]

  const relocationKm: number = driverRelocations.reduce(
    (s, r) => s + (Number(r?.km ?? 0) || 0),
    0
  )
  const relocationHours: number = driverRelocations.reduce(
    (s, r) => s + (Number(r?.hours ?? 0) || 0),
    0
  )
  const relocationCost: number = driverRelocations.reduce(
    (s, r) => s + (Number(r?.cost ?? 0) || 0),
    0
  )

  const estimatedRouteStartFromDrivers =
    relocationHours > 0 ? new Date(Date.now() + relocationHours * 3600 * 1000) : null

  if (previewData) {
    const rel1 = previewData.dist_truck_to_trailer
    const rel2 = previewData.dist_trailer_to_pickup

    // Prefer aggregated driver relocation computed in parent (relocationKm / relocationHours / relocationCost).
    // If none present, keep preview numeric fields as a fallback.
    const previewRelocationCost = Number(previewData.driver_relocation_cost ?? previewData.relocation_cost ?? 0) || 0
    const previewRelocationHours = Number(previewData.relocation_hours ?? 0) || 0

    const jobDistance = previewData.dist_pickup_to_delivery
    const total = previewData.total_distance
    const duration = previewData.drive_hours
    const fuelL = previewData.fuel_liters
    const fuelCost = Number(previewData.fuel_cost ?? 0)
    const tollCost = Number(previewData.toll_cost ?? 0)
    // Include relocation cost into total cost
    const totalCost =
      Number(previewData.total_cost ?? 0) +
      (relocationCost > 0 ? relocationCost : previewRelocationCost)
    // Prefer a server-provided reward when present
    const reward = Number(previewData.reward ?? 0)
    const profit = Number(reward) - Number(totalCost)

    // Route start time: prefer aggregated driver relocation hours, fallback to preview hours
    const routeStartTime =
      (relocationHours > 0 ? relocationHours : previewRelocationHours ?? 0) > 0
        ? new Date(
            Date.now() +
              (relocationHours > 0 ? relocationHours : previewRelocationHours ?? 0) *
                3600 *
                1000
          )
        : null

    return (
      <section className="mt-4 bg-white rounded-lg border border-slate-200 p-4 shadow-sm h-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Route calculator</h3>
          <div className="text-xs text-slate-500">Values shown are taken from server preview</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-700 h-full items-start">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-slate-500">Truck → Trailer relocation</div>
              <div className="font-medium text-slate-800">
                {rel1 != null && Number.isFinite(Number(rel1)) && Number(rel1) > 0
                  ? `${Number(rel1).toFixed(0)} km`
                  : '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Trailer → Pickup relocation</div>
              <div className="font-medium text-slate-800">
                {rel2 != null && Number.isFinite(Number(rel2)) && Number(rel2) > 0
                  ? `${Number(rel2).toFixed(0)} km`
                  : '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Job delivery route</div>
              <div className="font-medium text-slate-800">
                {jobDistance != null && Number.isFinite(Number(jobDistance)) && Number(jobDistance) > 0
                  ? `${Number(jobDistance).toFixed(0)} km`
                  : '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Relocation / transfer before route</div>

              <div className="font-medium text-slate-800">
                {relocationKm > 0 || relocationHours > 0 || relocationCost > 0 ? (
                  <>{`${relocationKm.toFixed(0)} km • ${formatHoursToHM(relocationHours)} • $${relocationCost.toFixed(2)}`}</>
                ) : // fallback to preview numbers when driver relocation not available
                previewRelocationCost > 0 && previewRelocationHours > 0 ? (
                  `${Number(previewRelocationCost).toFixed(2)} • ${formatHoursToHM(previewRelocationHours)}`
                ) : (
                  '—'
                )}
              </div>

              <div className="text-xs text-slate-500 mt-1">Estimated route start</div>

              <div className="font-medium text-slate-800">
                {estimatedRouteStartFromDrivers
                  ? estimatedRouteStartFromDrivers.toLocaleString()
                  : routeStartTime
                    ? routeStartTime.toLocaleString()
                    : 'Immediate'}
              </div>
            </div>

            {/* Current weather cards only - arrival forecast blocks removed */}
            <div className="flex gap-3 mb-0 items-start">
              <div className="flex-1 border border-slate-200 rounded p-2 bg-slate-50 self-start">
                <div>
                  <div className="text-xs text-slate-500">Origin • Current weather</div>

                  <div className="font-medium flex items-center gap-1">
                    {weatherIcon(pickupWeather?.condition, pickupWeather)}
                    {pickupWeather?.condition ?? '—'}
                  </div>

                  <div className="text-sm">
                    {pickupWeather?.temperature != null
                      ? `${pickupWeather.temperature.toFixed(1)} °C`
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="flex-1 border border-slate-200 rounded p-2 bg-slate-50 self-start">
                <div>
                  <div className="text-xs text-slate-500">Destination • Current weather</div>

                  <div className="font-medium flex items-center gap-1">
                    {weatherIcon(deliveryWeather?.condition, deliveryWeather)}
                    {deliveryWeather?.condition ?? '—'}
                  </div>

                  <div className="text-sm">
                    {deliveryWeather?.temperature != null
                      ? `${deliveryWeather.temperature.toFixed(1)} °C`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 h-full flex flex-col">
            <div>
              <div className="text-xs text-slate-500">Total distance</div>
              <div className="font-medium text-slate-800">
                {total != null && Number.isFinite(Number(total)) && Number(total) > 0
                  ? `${Number(total).toFixed(0)} km`
                  : '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Duration (est.)</div>
              <div className="font-medium text-slate-800">
                {duration != null && !Number.isNaN(Number(duration)) ? formatHoursToHM(duration) : '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Fuel estimate</div>
              <div className="font-medium text-slate-800">
                {fuelL != null && !Number.isNaN(Number(fuelL)) ? `${Number(fuelL).toFixed(1)} L` : '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Drivers</div>
              <div className="font-medium text-slate-800">
                {driversCount} {driversCount === 1 ? 'driver' : 'drivers'}
              </div>
            </div>

            <div className="col-span-1 sm:col-span-2 mt-3 p-3 border border-slate-100 rounded bg-slate-50 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">Reward</div>
                  <div className="font-semibold text-slate-800">
                    {reward != null ? `$${Number(reward).toFixed(2)}` : '—'}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-slate-500">Fuel cost</div>
                  <div className="font-medium text-slate-800">
                    {fuelCost != null && !Number.isNaN(Number(fuelCost))
                      ? `$${Number(fuelCost).toFixed(2)}`
                      : '—'}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-slate-500">Tolls</div>
                  <div className="font-medium text-slate-800">
                    {tollCost != null && !Number.isNaN(Number(tollCost))
                      ? `$${Number(tollCost).toFixed(2)}`
                      : '—'}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-slate-500">Relocation</div>
                  <div className="font-medium text-slate-800">
                    {relocationCost > 0 || previewRelocationCost > 0
                      ? `$${(relocationCost > 0 ? relocationCost : previewRelocationCost).toFixed(2)}`
                      : '—'}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 border-t pt-3">
                  <div className="text-xs text-slate-500">Total cost</div>
                  <div className="font-semibold text-slate-800">
                    {totalCost != null && !Number.isNaN(Number(totalCost))
                      ? `$${Number(totalCost).toFixed(2)}`
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-slate-500">Estimated profit</div>
                <div
                  className={`font-semibold ${
                    profit != null && Number(profit) < 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {profit != null && !Number.isNaN(Number(profit))
                    ? `$${Number(profit).toFixed(2)}`
                    : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // Fallback heuristics when no preview available (unchanged behaviour, but
  // include aggregated driver relocation cost in totals)
  const job = assignment.cargo?.job_offer ?? assignment.cargo ?? null
  const jobDistanceKm = Number(job?.distance_km ?? job?.distance ?? 0) || 0

  const totalDistanceKm = jobDistanceKm // without relocation when coords missing
  const durationHours = totalDistanceKm > 0 ? totalDistanceKm / 68 : 0 // heuristic
  const fuelEstimateL = Math.round(((totalDistanceKm * 28) / 100) * 100) / 100
  const fuelCost = Math.round(fuelEstimateL * 1.7 * 100) / 100
  const tollCost = Math.round(totalDistanceKm * 0.1 * 100) / 100
  // Include relocation cost from aggregated driver relocation (client computed)
  const totalCost = Math.round((fuelCost + tollCost + relocationCost) * 100) / 100
  const reward = job?.reward_load_cargo ?? job?.reward_trailer_cargo ?? job?.reward ?? null
  const profit =
    reward != null ? Math.round((Number(reward) - totalCost) * 100) / 100 : null

  return (
    <section className="mt-4 bg-white rounded-lg border border-slate-200 p-4 shadow-sm h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Route calculator</h3>
        <div className="text-xs text-slate-500">
          Estimates are heuristics — review before confirm
        </div>
      </div>

      <div className="text-sm text-slate-700 h-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-full items-start">
          <div>
            <div className="text-xs text-slate-500">Job delivery route</div>
            <div className="font-medium text-slate-800">
              {jobDistanceKm > 0 ? `${jobDistanceKm.toFixed(0)} km` : '—'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Total distance</div>
            <div className="font-medium text-slate-800">
              {totalDistanceKm > 0 ? `${totalDistanceKm.toFixed(0)} km` : '—'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Duration (est.)</div>
            <div className="font-medium text-slate-800">
              {durationHours > 0 ? formatHoursToHM(durationHours) : '—'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Fuel estimate</div>
            <div className="font-medium text-slate-800">{fuelEstimateL.toFixed(1)} L</div>
          </div>

          <div className="col-span-1 sm:col-span-2 mt-3 p-3 border border-slate-100 rounded bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Reward</div>
              <div className="font-semibold text-slate-800">
                {reward != null ? `$${Number(reward).toFixed(2)}` : '—'}
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-slate-500">Fuel cost</div>
              <div className="font-medium text-slate-800">${fuelCost.toFixed(2)}</div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-slate-500">Tolls</div>
              <div className="font-medium text-slate-800">${tollCost.toFixed(2)}</div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-slate-500">Relocation</div>
              <div className="font-medium text-slate-800">
                {relocationCost > 0 ? `$${relocationCost.toFixed(2)}` : '—'}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 border-t pt-3">
              <div className="text-xs text-slate-500">Total cost</div>
              <div className="font-semibold text-slate-800">${totalCost.toFixed(2)}</div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-slate-500">Estimated profit</div>
              <div
                className={`font-semibold ${
                  profit != null && profit < 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {profit != null ? `$${profit.toFixed(2)}` : '—'}
              </div>
            </div>
          </div>

          {/* Current weather cards (aligned with cost box) */}
          {(pickupWeather || deliveryWeather) && (
            <div className="flex gap-3 mb-0 items-start col-span-1 sm:col-span-2">
              <div className="flex-1 border border-slate-200 rounded p-2 bg-slate-50 self-start">
                <div>
                  <div className="text-xs text-slate-500">Origin • Current weather</div>

                  <div className="font-medium flex items-center gap-1">
                    {weatherIcon(pickupWeather?.condition, pickupWeather)}
                    {pickupWeather?.condition ?? '—'}
                  </div>

                  <div className="text-sm">
                    {pickupWeather?.temperature != null
                      ? `${pickupWeather.temperature.toFixed(1)} °C`
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="flex-1 border border-slate-200 rounded p-2 bg-slate-50 self-start">
                <div>
                  <div className="text-xs text-slate-500">Destination • Current weather</div>

                  <div className="font-medium flex items-center gap-1">
                    {weatherIcon(deliveryWeather?.condition, deliveryWeather)}
                    {deliveryWeather?.condition ?? '—'}
                  </div>

                  <div className="text-sm">
                    {deliveryWeather?.temperature != null
                      ? `${deliveryWeather.temperature.toFixed(1)} °C`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * AssignmentPanel
 *
 * Panel exposing four droppable slots in a responsive grid. This component
 * owns the assignment state and notifies a parent when the state changes.
 *
 * On confirm it creates a server-side assignment preview via RPC and opens
 * confirmation modal. When finalizing it uses finalizeAssignmentDirect
 * with an explicit company id fallback to the logged-in user's company.
 */
export default function AssignmentPanel({
  onAssignmentChange,
  trucks = [],
  drivers = [],
  trailers = [],
  relocationInfo = {},
}: AssignmentPanelProps): JSX.Element {
  const { user } = useAuth()
  const [assignment, setAssignment] = useState<AssignmentState>({
    truck: null,
    trailer: null,
    drivers: [],
    cargo: null,
  })

  /**
   * Idle configs state
   *
   * Stores recent completed assignments (truck+trailer+driver) for reuse.
   */
  const [idleConfigs, setIdleConfigs] = useState<any[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')

  /**
   * updateAssignment
   *
   * Central updater that notifies parent when assignment changes.
   *
   * @param next AssignmentState or updater function
   */
  function updateAssignment(next: AssignmentState | ((prev: AssignmentState) => AssignmentState)) {
    setAssignment((prev) => {
      const nextVal = typeof next === 'function' ? (next as any)(prev) : next
      try {
        onAssignmentChange?.(nextVal)
      } catch {
        // ignore parent callback errors
      }
      return nextVal
    })
  }

  /**
   * handleReturnToHub
   *
   * Create a virtual "Return to hub" cargo job inside the assembler so the user
   * can assign a truck and driver and confirm a relocation back to hub.
   */
  function handleReturnToHub() {
    updateAssignment((a) => ({
      ...a,
      cargo: {
        id: 'return-job',
        label: 'Return to hub',
        job_offer: {
          transport_mode: 'relocation',
          weight_kg: 0,
          reward_load_cargo: 0,
        },
      },
    }))
  }

  useEffect(() => {
    onAssignmentChange?.(assignment)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment])

  const truckCount = assignment.truck ? 1 : 0
  const trailerCount = assignment.trailer ? 1 : 0
  const driverCount = assignment.drivers.length
  const cargoWeight =
    Number(assignment.cargo?.job_offer?.weight_kg ?? assignment.cargo?.weight_kg ?? 0) || 0
  const cargoCount = cargoWeight > 0 ? 1 : 0

  const truckPayload =
    Number(assignment.truck?.model?.max_payload ?? assignment.truck?.model?.max_load_kg ?? 0) || 0
  const trailerPayload =
    Number(
      assignment.trailer?.payloadKg ??
        assignment.trailer?.payload ??
        assignment.trailer?.model?.max_payload ??
        0
    ) || 0

  const capacity = trailerPayload || truckPayload || 0
  const capacityDisplay = capacity > 0 ? String(capacity) : '—'

  const hasCargo = !!assignment.cargo
  const hasTruck = !!assignment.truck
  const jobProvidesTrailer =
    assignment.cargo &&
    (assignment.cargo.job_offer?.transport_mode === 'trailer_cargo' ||
      assignment.cargo.transport_mode === 'trailer_cargo')
  const hasTrailer = !!assignment.trailer

  const truckClass = String(assignment.truck?.model?.class ?? '').toLowerCase()

  const trailerEnabled = hasCargo && hasTruck && truckClass === 'big' && !jobProvidesTrailer
  const truckEnabled = hasCargo
  const driversEnabled = true // drivers slot is always enabled (prevents ReferenceError)

  useEffect(() => {
    if (!assignment.truck) return
    try {
      const truckClassLocal = String(assignment.truck?.model?.class ?? '').toLowerCase()
      if (truckClassLocal !== 'big' && assignment.trailer) {
        setAssignment((a) => ({ ...a, trailer: null }))
      }
    } catch {
      // ignore
    }
  }, [assignment.truck])

  /**
   * Load idle configurations (recent completed assignments) for reuse.
   *
   * Runs once when user's company_id becomes available.
   */
  useEffect(() => {
    async function loadIdleConfigs() {
      if (!(user as any)?.company_id) return

      try {
        const { data } = await supabase
          .from('job_assignments')
          .select(`
            id,
            user_truck:user_truck_id (
              id,
              master_truck_id(name)
            ),
            user_trailer:user_trailer_id (
              id,
              name
            ),
            hired_staff:user_id (
              id,
              name
            )
          `)
          .eq('carrier_company_id', (user as any).company_id)
          .eq('status', 'COMPLETED')
          .order('delivered_at', { ascending: false })
          .limit(10)

        setIdleConfigs(data ?? [])
      } catch (err) {
        console.debug('[AssignmentPanel] loadIdleConfigs error', err)
        setIdleConfigs([])
      }
    }

    loadIdleConfigs()
  }, [user?.company_id])

  /**
   * handleConfigSelect
   *
   * Handler to reuse an idle configuration and pre-fill assembler slots.
   *
   * @param id idle config id
   */
  function handleConfigSelect(id: string) {
    setSelectedConfigId(id)

    const cfg = idleConfigs.find((c) => c.id === id)
    if (!cfg) return

    updateAssignment((a) => ({
      ...a,
      truck: cfg.user_truck
        ? {
            id: cfg.user_truck.id,
            label:
              cfg.user_truck.master_truck_id?.name ??
              `Truck ${String(cfg.user_truck.id).substring(0, 8)}`,
            model: { name: cfg.user_truck.master_truck_id?.name ?? null },
            _raw: cfg.user_truck,
          }
        : null,
      trailer: cfg.user_trailer
        ? {
            id: cfg.user_trailer.id,
            label:
              cfg.user_trailer.name ?? `Trailer ${String(cfg.user_trailer.id).substring(0, 8)}`,
            _raw: cfg.user_trailer,
          }
        : null,
      drivers: cfg.hired_staff ? [{ id: cfg.hired_staff.id, name: cfg.hired_staff.name }] : [],
    }))
  }

  /**
   * getConfirmBlocker
   *
   * Return a human-readable blocker string or null when confirmation is allowed.
   */
  function getConfirmBlocker(): string | null {
    if (!assignment.cargo) return 'Cargo must be assigned'
    if (!assignment.truck) return 'Truck must be assigned'
    const truckClassLocal = String(assignment.truck?.model?.class ?? '').toLowerCase()
    const truckNeedsTrailer = truckClassLocal === 'big'
    if (truckNeedsTrailer && !jobProvidesTrailer && !assignment.trailer) return 'Trailer must be assigned'
    if (assignment.drivers.length === 0) return 'At least one driver is required'
    return null
  }

  const confirmBlocker = getConfirmBlocker()
  const canConfirm = !confirmBlocker

  // Modal control & preview state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [creatingPreview, setCreatingPreview] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Weather rows for pickup/delivery (fetched from city_weather_today)
  const [pickupWeather, setPickupWeather] = useState<CityWeatherRow | null>(null)
  const [deliveryWeather, setDeliveryWeather] = useState<CityWeatherRow | null>(null)

  // Forecast rows for arrival day (kept for compatibility but not rendered as arrival blocks)
  const [pickupForecast, setPickupForecast] = useState<CityWeatherRow | null>(null)
  const [deliveryForecast, setDeliveryForecast] = useState<CityWeatherRow | null>(null)

  /**
   * handleConfirmAssignmentClick
   *
   * Create a server-side assignment preview via RPC and open confirmation modal.
   */
  async function handleConfirmAssignmentClick() {
    if (!canConfirm) {
      return
    }

    const jobOfferId = assignment.cargo?.job_offer?.id ?? assignment.cargo?.id ?? null
    const userTruckId = assignment.truck?.id ?? null
    const trailerId = assignment.trailer?.id ?? null
    const driverCount = assignment.drivers.length ?? 0

    if (!jobOfferId || !userTruckId) {
      setPreviewError('Missing required identifiers for preview creation')
      setConfirmOpen(true)
      return
    }

    setCreatingPreview(true)
    setPreviewError(null)

    try {
      const rpcRes = await supabase.rpc('create_assignment_preview_v3', {
        p_job_offer_id: jobOfferId,
        p_truck_id: userTruckId,
        p_trailer_id: trailerId,
        p_driver_count: driverCount,
        p_driver_id: assignment.drivers?.[0]?.id ?? null,
      })

      if ((rpcRes as any)?.error) {
        throw (rpcRes as any).error
      }

      const data = (rpcRes as any)?.data
      let maybeId: any = null

      if (!data) {
        maybeId = null
      } else if (typeof data === 'string') {
        maybeId = data
      } else if (Array.isArray(data) && data.length && data[0]?.id) {
        maybeId = data[0].id
      } else if (data?.id) {
        maybeId = data.id
      } else {
        const vals = Object.values(data)
        if (vals.length === 1 && typeof vals[0] === 'string') maybeId = vals[0]
      }

      const idStr = typeof maybeId === 'string' && maybeId !== 'false' ? maybeId : null

      if (!idStr) {
        setPreviewError('Preview RPC did not return a valid preview id')
        setConfirmOpen(true)
        return
      }

      setPreviewId(idStr)
      setConfirmOpen(true)

      // Persist selected driver into the preview row using the robust helper.
      // The helper will try props, local assignment._raw and fallback to DB lookups
      // so driver_city_id is reliably populated even when drivers prop lacks location.
      const selectedDriverId = assignment.drivers?.[0]?.id ?? null
      await updatePreviewDriverInDB(idStr, selectedDriverId)
    } catch (err: any) {
      setPreviewError(err?.message ?? String(err) ?? 'Failed to create preview')
      setConfirmOpen(true)
    } finally {
      setCreatingPreview(false)
    }
  }

  /**
   * loadPreview
   *
   * Simple preview loader that selects the preview row by id and then loads
   * city weather rows for pickup and delivery cities from city_weather_today.
   *
   * This implementation follows the requested simple data-flow:
   *  - select preview row by id
   *  - select from city_weather_today where city_id in (pickup, delivery)
   *  - split rows into pickupWeather and deliveryWeather
   *
   * Additionally, loads the nearest arrival-day forecast from
   * city_weather_forecast when preview.drive_hours is provided.
   *
   * @param id preview uuid
   */
  async function loadPreview(id: string) {
    if (!id) return

    setLoadingPreview(true)
    setPreviewData(null)
    setPreviewError(null)
    setPickupWeather(null)
    setDeliveryWeather(null)
    setPickupForecast(null)
    setDeliveryForecast(null)

    try {
      const { data: preview, error: previewErr } = await supabase
        .from('assignment_previews')
        .select('*')
        .eq('id', id)
        .single()

      if (previewErr) {
        setPreviewError(previewErr.message)
        setPreviewData(null)
        return
      }

      setPreviewData(preview)

      // If preview contains pickup/delivery city ids, fetch weather rows from DB
      const pickupId = preview?.pickup_city_id ?? null
      const deliveryId = preview?.delivery_city_id ?? null
      const cityIds: string[] = []

      if (pickupId) cityIds.push(pickupId)
      if (deliveryId && deliveryId !== pickupId) cityIds.push(deliveryId)

      if (cityIds.length > 0) {
        const { data: weatherRows, error: weatherErr } = await supabase
          .from('city_weather_today')
          .select('*')
          .in('city_id', cityIds)

        if (weatherErr) {
          // non-fatal: show preview but surface weather error
          console.debug('[AssignmentPanel] loadPreview weather error', { id, weatherErr })
        } else if (Array.isArray(weatherRows)) {
          const pickup = weatherRows.find((w: any) => String(w.city_id) === String(pickupId))
          const delivery = weatherRows.find((w: any) => String(w.city_id) === String(deliveryId))
          setPickupWeather(pickup ?? null)
          setDeliveryWeather(delivery ?? null)
          console.debug('[AssignmentPanel] loaded weather', { id, pickup, delivery })

          // Forecast load (arrival day) - non-blocking and best-effort
          try {
            if (preview?.drive_hours) {
              // Compute arrival using local time to match DB forecast_date (stored as local date)
              const arrival = new Date(Date.now() + Number(preview.drive_hours) * 3600 * 1000)

              const arrivalDate =
                arrival.getFullYear() +
                '-' +
                String(arrival.getMonth() + 1).padStart(2, '0') +
                '-' +
                String(arrival.getDate()).padStart(2, '0')

              // Fetch nearest forecast on or after arrivalDate for the requested cities.
              const { data: forecastRows, error: forecastErr } = await supabase
                .from('city_weather_forecast')
                .select('*')
                .in('city_id', cityIds)
                .gte('forecast_date', arrivalDate)
                .order('forecast_date', { ascending: true })

              // Debug to verify returned forecast rows
              console.debug('[AssignmentPanel] Forecast rows:', forecastRows)

              if (forecastErr) {
                console.debug('[AssignmentPanel] forecast load error', { id, forecastErr })
              } else if (Array.isArray(forecastRows)) {
                // Pick the nearest future forecast per city (first row after ordering ascending)
                const pickupRows = forecastRows.filter((r: any) => String(r.city_id) === String(pickupId))
                const deliveryRows = forecastRows.filter((r: any) => String(r.city_id) === String(deliveryId))

                setPickupForecast(pickupRows[0] ?? null)
                setDeliveryForecast(deliveryRows[0] ?? null)

                console.debug('[AssignmentPanel] loaded forecast', { id, forecastRows })
              }
            } else {
              setPickupForecast(null)
              setDeliveryForecast(null)
            }
          } catch (fErr) {
            console.debug('[AssignmentPanel] forecast load exception', { id, fErr })
            setPickupForecast(null)
            setDeliveryForecast(null)
          }
        }
      }
      console.debug('[AssignmentPanel] loaded preview', { id, preview })
    } catch (err: any) {
      setPreviewError(err?.message ?? 'Failed to load preview')
      setPreviewData(null)
      setPickupWeather(null)
      setDeliveryWeather(null)
      setPickupForecast(null)
      setDeliveryForecast(null)
      console.debug('[AssignmentPanel] loadPreview exception', { id, err })
    } finally {
      setLoadingPreview(false)
    }
  }

  useEffect(() => {
    if (!previewId) return
    loadPreview(previewId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewId])

  /**
   * updatePreviewDriverInDB
   *
   * Persist the selected driver id and driver city into the assignment_previews
   * row so the server-side finalize flow can read who was assigned and where they are.
   *
   * Robust lookup strategy:
   * 1) search provided drivers prop
   * 2) search assignment.drivers for _raw or direct fields
   * 3) if city not present, attempt a best-effort DB lookup on hired_staff
   *
   * @param previewUuid preview id to update
   * @param driverId driver id to set (string) or null to clear
   */
  async function updatePreviewDriverInDB(previewUuid: string | null, driverId: string | null) {
    if (!previewUuid) return

    try {
      // If clearing driver, clear both fields
      if (!driverId) {
        const { error } = await supabase
          .from('assignment_previews')
          .update({
            driver_id: null,
            driver_city_id: null,
          })
          .eq('id', previewUuid)

        if (error) {
          console.debug('[AssignmentPanel] updatePreviewDriverInDB clear error', error)
          setPreviewError((prev) => (prev ? prev + ' | Driver update failed' : 'Driver update failed'))
        }
        return
      }

      // Try to find driver in props list first (most detailed)
      let driverObj: any =
        (drivers ?? []).find((d: any) => String(d?.id ?? '') === String(driverId ?? '')) ?? null

      // If not present, try assignment.drivers list (may contain _raw)
      if (!driverObj) {
        const localDrv = (assignment.drivers ?? []).find(
          (d: any) => String(d?.id ?? '') === String(driverId ?? '')
        )
        if (localDrv) {
          driverObj = localDrv._raw ?? localDrv
        }
      }

      // At this point driverObj may still lack a city id. Best-effort DB fetch:
      let driverCityId: string | null =
        driverObj?.current_location_id ?? driverObj?.location_city_id ?? null

      if (!driverCityId) {
        try {
          // Schema differs across environments; try a wide select first, then fallback.
          let staffRow: any = null
          let staffErr: any = null

          const wide = await supabase
            .from('hired_staff')
            .select('id, current_location_id, location_city_id')
            .eq('id', driverId)
            .maybeSingle()

          staffRow = wide.data
          staffErr = wide.error

          const staffErrMsg = String(staffErr?.message ?? '').toLowerCase()
          const staffErrCode = String((staffErr as any)?.code ?? '')

          if (
            staffErr &&
            (staffErrCode === '42703' || staffErrMsg.includes('current_location_id'))
          ) {
            const fallback = await supabase
              .from('hired_staff')
              .select('id, location_city_id')
              .eq('id', driverId)
              .maybeSingle()

            staffRow = fallback.data
            staffErr = fallback.error
          }

          if (!staffErr && staffRow) {
            driverCityId = staffRow.current_location_id ?? staffRow.location_city_id ?? null
          }
        } catch (e) {
          console.debug('[AssignmentPanel] updatePreviewDriverInDB hired_staff lookup failed', e)
        }
      }

      const { error } = await supabase
        .from('assignment_previews')
        .update({
          driver_id: driverId,
          driver_city_id: driverCityId ?? null,
        })
        .eq('id', previewUuid)

      if (error) {
        console.debug('[AssignmentPanel] updatePreviewDriverInDB error', error)
        setPreviewError((prev) => (prev ? prev + ' | Driver update failed' : 'Driver update failed'))
      } else {
        // keep local previewData in sync when possible
        setPreviewData((pd) =>
          pd ? { ...pd, driver_id: driverId, driver_city_id: driverCityId ?? null } : pd
        )
      }
    } catch (err) {
      console.debug('[AssignmentPanel] updatePreviewDriverInDB exception', err)
    }
  }

  /**
   * When the selected drivers change and we already have a preview id,
   * persist the first selected driver into the preview row.
   *
   * Note: this useEffect is the mechanism that updates assignment_previews
   * immediately after a driver is dropped into the drivers slot — provided a
   * preview row exists (previewId). It is kept intentionally simple because
   * creating the preview is a separate RPC initiated by the user.
   */
  useEffect(() => {
    if (!previewId) return
    const selectedDriverId = assignment.drivers?.[0]?.id ?? null
    void updatePreviewDriverInDB(previewId, selectedDriverId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment.drivers, previewId])

  /**
   * handleConfirmFinalize
   *
   * Finalize the assignment after modal confirmation by using the client-side
   * finalizeAssignmentDirect flow (no RPC). This writes to job_assignments,
   * driving_sessions, updates user_trucks / user_trailers and hired_staff.
   *
   * Uses previewData + assignment slots + current user to construct the opts.
   */
  async function handleConfirmFinalize() {
    if (!ASSIGNMENT_FINALIZE_ENABLED) {
      setPreviewError(
        'Job acceptance is temporarily disabled while the assignment flow is under review.'
      )
      return
    }

    if (!previewId || !previewData) return

    // Resolve identifiers using best-effort from preview, assignment and current user.
    const jobOfferId =
      previewData?.job_offer_id ??
      previewData?.job_offer?.id ??
      assignment.cargo?.job_offer?.id ??
      assignment.cargo?.id ??
      null

    // Prefer logged-in user's company as canonical carrier company id (Step 3/4)
    const userCompanyId = (user as any)?.company_id ?? null

    const carrierCompanyId =
      userCompanyId ?? previewData?.carrier_company_id ?? assignment.truck?._raw?.owner_company_id ?? null

    const userTruckId = assignment.truck?.id ?? null
    const trailerId = assignment.trailer?.id ?? null

    const truckCityId =
      assignment.truck?._raw?.location_city_id ??
      assignment.truck?._raw?.location_city ??
      assignment.truck?.location ??
      null

    const pickupCityId =
      previewData?.pickup_city_id ??
      previewData?.origin_city_id ??
      assignment.cargo?.job_offer?.origin_city_id ??
      null

    const distance =
      previewData?.total_distance ??
      previewData?.total_distance_km ??
      previewData?.dist_pickup_to_delivery ??
      null

    const companyId =
      userCompanyId ??
      previewData?.carrier_company_id ??
      assignment.truck?._raw?.owner_company_id ??
      null

    // Debug log before finalization (Step 2)
    // eslint-disable-next-line no-console
    console.log('FINALIZE INPUT', {
      jobOfferId,
      userTruckId,
      companyId,
      carrierCompanyId,
      previewData,
      assignment,
    })

    if (!jobOfferId || !userTruckId || !companyId || !carrierCompanyId) {
      setPreviewError('Missing identifiers required to finalise assignment')
      return
    }

    try {
      // Call client-side function that performs the multi-step write flow.
      await finalizeAssignmentDirect({
        jobOfferId: jobOfferId,
        carrierCompanyId: carrierCompanyId,
        companyId: companyId,
        userId: (user as any)?.id ?? null,
        userTruckId: userTruckId,
        trailerId: trailerId ?? null,
        truckCityId: truckCityId ?? null,
        pickupCityId: pickupCityId ?? null,
        distance: distance ?? null,
        previewData: previewData,
        assignment: assignment,
      })

      // clear UI and close modal on success
      updateAssignment({
        truck: null,
        trailer: null,
        drivers: [],
        cargo: null,
      })

      setConfirmOpen(false)
      setPreviewId(null)
      setPreviewData(null)
      setPickupWeather(null)
      setDeliveryWeather(null)
      setPickupForecast(null)
      setDeliveryForecast(null)

      // reload staging lists
      window.dispatchEvent(new Event('staging:reload'))
    } catch (err: any) {
      // Surface the error but keep the modal open for user to retry or inspect
      const msg = err?.message ?? String(err) ?? 'Failed to finalise assignment'
      setPreviewError(msg)
      console.debug('[AssignmentPanel] finalizeAssignmentDirect error', err)
    }
  }

  function buildSummaryParts(): string[] {
    const truck = assignment.truck
    const driver = assignment.drivers[0] ?? null
    const trailer = assignment.trailer
    const cargo = assignment.cargo

    return [
      truck ? `Truck: ${truck.label ?? truck.name ?? truck.id}` : null,
      driver ? `Driver: ${driver.name ?? driver.id ?? driver.first_name}` : null,
      trailer ? `Trailer: ${trailer.label ?? trailer.name ?? trailer.id}` : null,
      cargo ? `Cargo: ${cargo.label ?? cargo.id}` : null,
      `Phase: pickup`,
    ].filter(Boolean) as string[]
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-3">Quick assembler</h2>

      <p className="text-sm text-slate-500 mb-4">
        Drag items (rows) from lists/tables onto the slots below to compose an assignment.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DroppableSlot
          id="cargo-slot"
          title="Cargo"
          count={cargoCount}
          value={assignment.cargo}
          capacityKg={capacity || undefined}
          disabled={false}
          allowedTypes={['cargo']}
          onDrop={(it) => {
            if (!it) {
              updateAssignment((a) => ({ ...a, cargo: null }))
              return
            }
            if (it.type && it.type !== 'cargo') return
            const normalizedCargo = {
              id: it.id,
              label:
                it.label ??
                it.job_offer?.cargo_items?.name ??
                `Cargo ${String(it.id).substring(0, 8)}`,
              job_offer: it.job_offer ?? it._raw?.job_offer ?? null,
              _raw: it._raw ?? null,
            }
            updateAssignment((a) => ({ ...a, cargo: normalizedCargo }))
          }}
        />

        <DroppableSlot
          id="truck-slot"
          title="Truck"
          count={truckCount}
          value={assignment.truck}
          capacityKg={0}
          disabled={!truckEnabled}
          allowedTypes={['truck']}
          onDrop={(it) => {
            if (!it) {
              updateAssignment((a) => ({ ...a, truck: null }))
              return
            }
            if (it.type && it.type !== 'truck') return
            const normalized = {
              id: it.id,
              label: it.label ?? it.name ?? `Truck ${String(it.id).substring(0, 8)}`,
              model: it.model ?? it._raw?.truck_models ?? null,
              location: it._raw?.location_city_name ?? it.location_city ?? null,
              _raw: it._raw ?? null,
            }
            updateAssignment((a) => ({ ...a, truck: normalized }))
          }}
        />

        <DroppableSlot
          id="trailer-slot"
          title="Trailer"
          count={trailerCount}
          value={jobProvidesTrailer ? { label: 'Trailer provided by job' } : assignment.trailer}
          capacityKg={0}
          disabled={!trailerEnabled}
          allowedTypes={['trailer']}
          onDrop={(it) => {
            // Prevent any drops when job provides a trailer or trailer slot is disabled
            if (!it) {
              if (jobProvidesTrailer) return
              updateAssignment((a) => ({ ...a, trailer: null }))
              return
            }
            if (jobProvidesTrailer) return

            // Protect against manual drops on non-big trucks
            const truckClassGuard = String(assignment.truck?.model?.class ?? '').toLowerCase()
            if (truckClassGuard !== 'big') {
              return
            }

            const raw = it._raw ?? {}
            const normalized = {
              id: it.id ?? raw.id ?? null,
              label:
                it.label ??
                it.name ??
                raw.label ??
                `Trailer ${String(it.id ?? raw.id ?? '').substring(0, 8)}`,
              model: it.model ?? raw.trailer_models ?? null,
              _raw: {
                ...raw,
                location_city_name:
                  raw.location_city_name ??
                  it.location_city ??
                  it.locationCityName ??
                  it.location ??
                  null,
                cargo_type_names:
                  raw.cargo_type_names ?? it.cargo_type_names ?? it.cargoTypeName ?? null,
              },
              payloadKg: Number(
                it.payloadKg ?? it.payload ?? raw.payload_kg ?? raw.max_payload ?? 0
              ) || 0,
              location:
                raw.location_city_name ??
                it.location_city ??
                it.locationCityName ??
                it.location ??
                null,
              cargo_type_names: Array.isArray(raw.cargo_type_names)
                ? raw.cargo_type_names
                : raw.cargo_type_names ?? it.cargo_type_names ?? it.cargoTypeName ?? null,
              status: it.status ?? raw.status ?? 'available',
            }
            updateAssignment((a) => ({ ...a, trailer: normalized }))
          }}
        />

        <DroppableSlot
          id="drivers-slot"
          title="Drivers"
          count={driverCount}
          value={assignment.drivers.length ? assignment.drivers : null}
          capacityKg={0}
          disabled={!driversEnabled}
          allowedTypes={['driver']}
          onDrop={(it) => {
            if (!it) {
              updateAssignment((a) => ({ ...a, drivers: [] }))
              return
            }

            updateAssignment((a) => {
              if (a.drivers.length >= 2) return a
              const drv: HiredDriverRow = {
                id: it.id ?? String(Date.now()),
                name:
                  it.label ??
                  it.name ??
                  `${it.first_name ?? ''} ${it.last_name ?? ''}`.trim(),
                first_name: it.first_name ?? null,
                last_name: it.last_name ?? null,
                _raw: it._raw ?? it,
              }
              if (a.drivers.find((d) => d.id === drv.id)) return a
              return { ...a, drivers: [...a.drivers, drv] }
            })
          }}
        />
      </div>

      <div className="mt-4 border border-slate-100 rounded p-4 bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
          {!canConfirm && confirmBlocker && (
            <div className="mt-0 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
              {confirmBlocker}
            </div>
          )}

          {assignment.cargo && (
            <div className="mt-3 sm:mt-0 sm:ml-4 flex items-center gap-3">
              <div className="bg-white border border-slate-100 px-3 py-2 rounded text-sm text-slate-800">
                <span className="font-normal">Current job payload:</span>{' '}
                <span className="text-orange-600 font-semibold">{`${cargoWeight.toFixed(
                  2
                )} / ${capacityDisplay} kg`}</span>
              </div>

              <div
                className={`bg-white border ${
                  0 > 0 ? 'border-orange-100' : 'border-emerald-100'
                } px-3 py-2 rounded text-sm text-slate-700`}
              >
                <span className="text-slate-600">Remaining after assignment:</span>{' '}
                <span
                  className={`font-semibold ${
                    0 > 0 ? 'text-orange-600' : 'text-emerald-600'
                  }`}
                >
                  {jobProvidesTrailer
                    ? '0.00'
                    : Math.max(0, Math.round((cargoWeight - capacity) * 100) / 100).toFixed(2)}{' '}
                  kg
                </span>
              </div>
            </div>
          )}

          <div className="mt-3 sm:mt-0 sm:ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={handleReturnToHub}
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Return to hub
            </button>

            <button
              type="button"
              onClick={() => {
                handleConfirmAssignmentClick()
              }}
              disabled={!canConfirm || creatingPreview}
              className={`px-4 py-2 rounded font-medium transition ${
                canConfirm
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
              aria-disabled={!canConfirm}
            >
              {creatingPreview ? 'Creating preview…' : 'Confirm Assignment'}
            </button>

            <button
              type="button"
              onClick={() => {
                updateAssignment({ truck: null, trailer: null, drivers: [], cargo: null })
              }}
              className="px-3 py-2 text-sm border border-slate-200 rounded hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal: contains the RouteCalculatorBox for final review only */}
      <ModalShell
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setPreviewId(null)
          setPreviewData(null)
          setPickupWeather(null)
          setDeliveryWeather(null)
          setPickupForecast(null)
          setDeliveryForecast(null)
        }}
        title="Confirm Assignment"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false)
              }}
              className="px-3 py-2 text-sm border border-slate-200 rounded hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmFinalize}
              disabled={!ASSIGNMENT_FINALIZE_ENABLED}
              className={`px-4 py-2 rounded font-medium transition ${
                ASSIGNMENT_FINALIZE_ENABLED
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
            >
              {ASSIGNMENT_FINALIZE_ENABLED
                ? 'Confirm Assignment'
                : 'Assignment confirm disabled'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-700 space-y-1">
            <div>Please review the assignment before confirming.</div>
            {!ASSIGNMENT_FINALIZE_ENABLED && (
              <div className="text-xs text-amber-700">
                Final assignment acceptance is temporarily disabled while this flow is under
                review.
              </div>
            )}
            <div className="text-xs text-amber-600">
              Server preview is used when available. Client-side heuristics are used as fallback.
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded p-3">
            {buildSummaryParts().map((p, i) => (
              <div key={i} className="text-sm text-slate-800">
                {p}
              </div>
            ))}
          </div>

          {previewError && <div className="text-sm text-rose-600">Preview error: {previewError}</div>}
          {loadingPreview && <div className="text-sm text-slate-500">Loading preview…</div>}

          {/* Route calculator now shows job route, metrics and the weather cards (arrival blocks removed) */}
          <RouteCalculatorBox
            assignment={assignment}
            driversCount={assignment.drivers.length}
            previewData={previewData}
            pickupWeather={pickupWeather}
            deliveryWeather={deliveryWeather}
            pickupForecast={pickupForecast}
            deliveryForecast={deliveryForecast}
            relocationInfo={relocationInfo}
          />
        </div>
      </ModalShell>

      {/* Staging bottom panel (keeps layout unchanged) */}
      <div className="mt-4">
        <StagingAssignmentsPanel companyId={(user as any)?.company_id ?? null} />
      </div>
    </div>
  )
}