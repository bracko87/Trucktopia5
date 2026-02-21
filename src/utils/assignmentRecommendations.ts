/**
 * src/utils/assignmentRecommendations.ts
 *
 * Recommendation helper functions used by the assembler UI.
 *
 * Provides pure helpers:
 * - scoreTruckForCargo(truck, cargo)
 * - recommendTruck(trucks, cargo)
 * - recommendDriver(drivers)
 * - recommendTrailer(trailers, cargo, truck)
 *
 * These functions are deterministic and side-effect free.
 */

import type { TruckCardRow } from '../../lib/trucksApi'
import { trailerSupportsCargo, gcwAllowsTrailer } from '../components/staging/cargoCompatibility'

/**
 * scoreTruckForCargo
 *
 * Compute recommendation score for a truck given cargo.
 *
 * @param truck - truck row (may contain ._raw or .model fields)
 * @param cargo - cargo object (expects job_offer with pickup_city, cargo_type_id, weight_kg)
 * @returns numeric score (higher is better)
 */
export function scoreTruckForCargo(truck: any, cargo: any): number {
  if (!truck || !cargo) return 0

  // Early rejection: trailer jobs must use BIG trucks only
  try {
    const transportMode = cargo?.job_offer?.transport_mode
    if (transportMode === 'trailer_cargo') {
      const cls = String(truck?.model?.class ?? truck?._raw?.class ?? '').toLowerCase()
      if (cls !== 'big') return -Infinity
    }
  } catch {
    // ignore and continue
  }

  let score = 0

  const pickupCity =
    cargo?.job_offer?.pickup_city ??
    cargo?.job_offer?.pickup_location_city ??
    cargo?.job_offer?.origin_city_name ??
    cargo?.job_offer?.origin_city?.city_name ??
    null

  const truckCity =
    truck?._raw?.location_city_name ??
    truck?._raw?.location_city ??
    truck?.location_city ??
    truck?.location?.city ??
    null

  // 1) Location match (highest priority)
  if (pickupCity && truckCity && String(pickupCity).trim() === String(truckCity).trim()) {
    score += 100
  }

  // 2) Cargo compatibility (reward exact cargo_type_id match)
  try {
    const truckCargo =
      truck?._raw?.cargo_type_id ?? truck?.cargo_type_id ?? truck?.model?.cargo_type_id ?? null
    const cargoType = cargo?.job_offer?.cargo_type_id ?? null
    if (truckCargo && cargoType && String(truckCargo) === String(cargoType)) {
      score += 50
    }
  } catch {}

  // 3) Payload fit (closer to capacity is better) - up to 50 points
  try {
    const weight = Number(cargo?.job_offer?.weight_kg ?? 0) || 0
    const payloadCap =
      Number(truck?.model?.max_payload ?? truck?._raw?.max_payload ?? truck?.model?.max_load_kg ?? truck?._raw?.model_max_load_kg ?? 0) ||
      0

    if (payloadCap > 0 && weight > 0) {
      const payloadScore = 1 - Math.abs(payloadCap - weight) / Math.max(payloadCap, weight)
      if (!Number.isNaN(payloadScore) && payloadScore > 0) {
        score += Math.round(payloadScore * 50)
      }
    } else if (payloadCap > 0) {
      score += 5
    }

    // Class preference nudges
    const truckClass = String(truck?.model?.class ?? truck?._raw?.class ?? '').toLowerCase()
    if (weight <= 4000 && (truckClass === 'small' || truckClass === 'medium')) {
      score += 20
    } else if (weight > 4000 && weight < 10000 && truckClass === 'medium') {
      score += 10
    } else if (weight >= 10000 && truckClass === 'big') {
      score += 30
    }
  } catch {}

  // 4) Availability bonus
  try {
    const status = truck?._raw?.status ?? truck?.status ?? null
    const onDuty = truck?._raw?.on_duty ?? truck?.on_duty ?? null
    if ((typeof onDuty === 'boolean' && onDuty === false) || (typeof status === 'string' && status.toLowerCase() === 'idle')) {
      score += 20
    }
  } catch {}

  // 5) Reliability scaled
  try {
    const reliability = Number(truck?.model?.reliability ?? truck?._raw?.model?.reliability ?? 0) || 0
    const relScore = Math.max(0, Math.min(1, reliability / 100))
    score += Math.round(relScore * 20)
  } catch {}

  return score
}

/**
 * recommendTruck
 *
 * Returns best truck candidate for given cargo using scoreTruckForCargo.
 *
 * Rules:
 * - If cargo has no pickup/origin city -> return null.
 * - Only consider trucks located in the pickup city.
 *
 * @param trucks - array of truck objects
 * @param cargo - cargo object
 * @returns best truck object or null
 */
export function recommendTruck(trucks: any[] = [], cargo: any | null): any | null {
  if (!trucks?.length || !cargo) return null

  const pickupCity =
    cargo?.job_offer?.pickup_city ??
    cargo?.job_offer?.pickup_location_city ??
    cargo?.job_offer?.origin_city_name ??
    cargo?.job_offer?.origin_city?.city_name ??
    null

  if (!pickupCity) return null

  const localTrucks = trucks.filter((truck) => {
    const city =
      truck?._raw?.location_city_name ??
      truck?._raw?.location_city ??
      truck?.location_city ??
      truck?.location?.city ??
      null

    return city && String(city).trim() === String(pickupCity).trim()
  })

  if (!localTrucks.length) return null

  let bestTruck: any | null = null
  let bestScore = -Infinity

  for (const truck of localTrucks) {
    const score = scoreTruckForCargo(truck, cargo)
    if (score > bestScore) {
      bestScore = score
      bestTruck = truck
    }
  }

  return bestTruck
}

/**
 * recommendDriver
 *
 * Lightweight heuristic to pick the best driver from an array.
 *
 * @param drivers - array of driver objects (fatigue, happiness, experience)
 * @returns best driver or null
 */
export function recommendDriver(drivers: any[] = []): any | null {
  if (!Array.isArray(drivers) || drivers.length === 0) return null

  let best: any | null = null
  let bestScore = -Infinity

  for (const d of drivers) {
    const fatigue = Number(d?.fatigue ?? 0) || 0
    const happiness = Number(d?.happiness ?? 100) || 100
    const experience = Number(d?.experience ?? 0) || 0
    const score = (100 - fatigue) * 2 + happiness + experience * 10
    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }

  return best
}

/**
 * recommendTrailer
 *
 * Deterministic trailer recommendation pipeline implementing these steps:
 * 1) Cargo type filter (mandatory) -> trailerSupportsCargo
 * 2) Location filter (mandatory) -> only trailers in pickup city considered
 *    - If none in pickup city -> return null (no recommendation)
 * 3) GCW compatibility (mandatory) -> gcwAllowsTrailer(truck, trailer)
 * 4) Payload ranking (bonus) -> prefer trailers with payload >= cargo weight,
 *    then prefer smaller excess payload
 *
 * @param trailers - array of trailer objects
 * @param cargo - cargo object (expects job_offer with weight_kg and origin_city)
 * @param truck - selected truck (used for GCW compatibility checks)
 * @returns best trailer object or null when none match
 */
export function recommendTrailer(trailers: any[] = [], cargo: any | null, truck: any | null): any | null {
  if (!Array.isArray(trailers) || !cargo || !truck) return null

  const pickupCity =
    cargo?.job_offer?.origin_city?.city_name ??
    cargo?.job_offer?.pickup_city ??
    null

  const cargoWeight = Number(cargo?.job_offer?.weight_kg ?? 0) || 0

  // --- STEP 1: cargo type filter (mandatory) ---
  const cargoMatching = trailers.filter((tr) => trailerSupportsCargo(tr, cargo))
  if (cargoMatching.length === 0) return null

  // --- STEP 2: location filter (mandatory) ---
  const sameCity = cargoMatching.filter((tr) => {
    const city =
      (tr as any).locationCityName ??
      tr?._raw?.location_city_name ??
      tr?._raw?.location_city ??
      tr?.location_city ??
      tr?.location?.city ??
      null

    return city && pickupCity && String(city).trim() === String(pickupCity).trim()
  })

  if (sameCity.length === 0) return null

  // --- STEP 3: GCW compatibility (mandatory) ---
  const gcwAllowed = sameCity.filter((tr) => gcwAllowsTrailer(truck, tr))
  if (gcwAllowed.length === 0) return null

  // --- STEP 4: payload bonus ranking ---
  gcwAllowed.sort((a, b) => {
    const pa = Number((a as any).payloadKg ?? (a as any).payload ?? 0)
    const pb = Number((b as any).payloadKg ?? (b as any).payload ?? 0)

    const aOk = pa >= cargoWeight
    const bOk = pb >= cargoWeight

    if (aOk !== bOk) return aOk ? -1 : 1

    // smaller excess payload preferred
    return Math.abs(pa - cargoWeight) - Math.abs(pb - cargoWeight)
  })

  return gcwAllowed[0] ?? null
}