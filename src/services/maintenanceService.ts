/** 
 * maintenanceService.ts
 *
 * Helpers for maintenance-related operations used by the UI.
 *
 * Responsibilities:
 * - Compute maintenance cost estimates deterministically.
 * - Fetch maintenance_checks history for a truck.
 * - Create a maintenance_check row and (best-effort) keep user_trucks.next_maintenance_km
 *   and last_maintenance_at in sync by patching user_trucks after a successful maintenance insert.
 */

import { supabaseFetch } from '../lib/supabase'

/**
 * MaintenanceCheck
 *
 * Minimal shape representing a maintenance_checks row returned to the UI.
 */
export interface MaintenanceCheck {
  id?: string
  user_truck_id?: string
  performed_at?: string
  odometer_km?: number | null
  mileage_km?: number | null
  model_year?: number | null
  next_maintenance_km?: number | null
  garage_type?: string
  parts_cost_cents?: number | null
  service_cost_cents?: number | null
  total_cost_cents?: number | null
  duration_hours?: number | null
  notes?: string | null
  created_at?: string
}

/**
 * computeMaintenanceCost
 *
 * Deterministic implementation per provided rules.
 * All monetary values returned in cents.
 *
 * @param truck - partial truck snapshot (mileage_km and model_year are important)
 * @param garageType - 'owner_hub' | 'city' | 'remote'
 */
export async function computeMaintenanceCost(
  truck: {
    model_year?: number | null
    mileage_km?: number | null
    model?: { class?: string } | null
    class?: string | null
  },
  garageType: 'owner_hub' | 'city' | 'remote'
) {
  const truckClass =
    (truck?.model && (truck.model.class === 'medium' || truck.model.class === 'big') && truck.model.class) ||
    (truck?.class === 'medium' || truck?.class === 'big' ? truck.class : 'small')

  const RULES: Record<string, any> = {
    small: { base: 8000, yearMin: 8000, yearMax: 12500, per50k: 4500 }, // cents
    medium: { base: 10000, yearMin: 10000, yearMax: 14500, per50k: 6500 },
    big: { base: 14000, yearMin: 14000, yearMax: 20500, per50k: 8500 },
  }

  const cfg = RULES[truckClass as string] ?? RULES.small

  const nowYear = new Date().getFullYear()
  const ageYears = truck.model_year ? Math.max(0, nowYear - truck.model_year) : 0
  const mileageKm = Math.max(0, Number(truck.mileage_km ?? 0))

  // ---- AGE COST ----
  let ageCost = cfg.base
  const yearlyBreakdown: number[] = [cfg.base]

  if (ageYears > 1) {
    // linear increment per year : use midpoint of min/max as requested
    const yearlyIncrement = Math.round((cfg.yearMin + cfg.yearMax) / 2)
    for (let y = 2; y <= ageYears; y++) {
      ageCost += yearlyIncrement
      yearlyBreakdown.push(yearlyIncrement)
    }
  }

  // ---- MILEAGE COST ----
  const mileageBlocks = Math.floor(mileageKm / 50000)
  const mileageCost = mileageBlocks * cfg.per50k

  const cityCost = ageCost + mileageCost

  let serviceCostCents = cityCost
  let durationHours = 24

  if (garageType === 'owner_hub') {
    serviceCostCents = Math.round(cityCost * 0.5)
    durationHours = 12
  } else if (garageType === 'remote') {
    serviceCostCents = Math.round(cityCost * 3)
    durationHours = 48
  }

  const partsCostCents = 0
  const totalCents = serviceCostCents + partsCostCents

  return {
    serviceCostCents,
    partsCostCents,
    totalCents,
    durationHours,
    breakdown: {
      truckClass,
      ageYears,
      baseCost: cfg.base,
      yearlyBreakdown,
      mileageBlocks,
      mileageCost,
      totalBeforeGarage: cityCost,
    },
  }
}

/**
 * fetchMaintenanceChecks
 *
 * Return maintenance_checks rows for a truck ordered newest first.
 * Returns an array of MaintenanceCheck (empty array on error).
 *
 * @param userTruckId - user_trucks.id
 */
export async function fetchMaintenanceChecks(userTruckId: string): Promise<MaintenanceCheck[]> {
  if (!userTruckId) return []
  const q = `/rest/v1/maintenance_checks?user_truck_id=eq.${encodeURIComponent(
    userTruckId
  )}&order=performed_at.desc,created_at.desc&limit=100`
  try {
    const res: any = await supabaseFetch(q, { method: 'GET' })
    if (res && Array.isArray(res.data)) return res.data as MaintenanceCheck[]
    return []
  } catch {
    return []
  }
}

/**
 * createMaintenanceCheck
 *
 * Insert a maintenance_checks row. After successful insert this function will
 * (best-effort) PATCH the corresponding user_trucks row to:
 * - set last_maintenance_at = performed_at
 * - set next_maintenance_km = (performed odometer or mileage) + 50000
 *
 * The PATCH is done here as a best-effort sync to keep user_trucks as the canonical
 * "next maintenance" source used by the UI. If DB triggers exist they will still
 * apply; this client-side patch is a safe redundancy.
 *
 * @param payload - maintenance_checks insert payload. Must include user_truck_id and odometer_km (or mileage_km) and performed_at.
 * @returns Object describing result and any errors. Contains `success` boolean.
 */
export async function createMaintenanceCheck(payload: Record<string, any>) {
  // Insert maintenance_check
  try {
    const insertRes: any = await supabaseFetch('/rest/v1/maintenance_checks', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    })

    const success = insertRes && (insertRes.status === 200 || insertRes.status === 201)
    const inserted = success ? (Array.isArray(insertRes.data) ? insertRes.data[0] : insertRes.data) : null

    // Best-effort: if we have a mileage/odometer and user_truck_id, patch user_trucks next_maintenance_km
    let patchResult: any = null
    if (success && payload.user_truck_id) {
      try {
        const performedOdometer =
          Number(payload.odometer_km ?? payload.mileage_km ?? inserted?.mileage_km ?? inserted?.odometer_km ?? 0)
        const nextKm = Math.round(performedOdometer + 50000)

        const patchRes: any = await supabaseFetch(
          `/rest/v1/user_trucks?id=eq.${encodeURIComponent(payload.user_truck_id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              next_maintenance_km: nextKm,
              last_maintenance_at: payload.performed_at ?? inserted?.performed_at ?? null,
            }),
            headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          }
        )

        patchResult = patchRes
      } catch (err) {
        // ignore patch errors; include info in returned object
        patchResult = { error: (err as any)?.message ?? String(err) }
      }
    }

    return {
      success,
      status: insertRes?.status ?? 0,
      data: inserted,
      user_truck_patch: patchResult,
      error: insertRes?.error ?? null,
    }
  } catch (err: any) {
    return { success: false, status: 0, error: err?.message ?? String(err) }
  }
}