import { supabaseFetch } from '../lib/supabase'

type GarageType = 'owner_hub' | 'city' | 'remote'

/**
 * computeMaintenanceCost
 *
 * Deterministic implementation per provided rules.
 * All monetary values returned in cents.
 */
export async function computeMaintenanceCost(
  truck: {
    model_year?: number | null
    mileage_km?: number | null
    model?: { class?: string } | null
    class?: string | null
  },
  garageType: GarageType
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
 * The UI should prefer the first row (latest snapshot) as source of truth.
 */
export async function fetchMaintenanceChecks(userTruckId: string) {
  if (!userTruckId) return { status: 0, data: null }
  const q = `/rest/v1/maintenance_checks?user_truck_id=eq.${encodeURIComponent(
    userTruckId
  )}&order=performed_at.desc,created_at.desc&limit=100`
  return supabaseFetch(q, { method: 'GET' })
}

/**
 * createMaintenanceCheck
 *
 * Insert a maintenance_check row. Returns supabaseFetch response.
 */
export async function createMaintenanceCheck(payload: Record<string, any>) {
  return supabaseFetch('/rest/v1/maintenance_checks', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
  })
}