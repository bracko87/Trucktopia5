/**
 * cargoCompatibility.ts
 *
 * Helpers to determine cargo <-> truck/trailer compatibility.
 * Uses canonical GCW handling (normalizeGcwLetter / gcwRank) to ensure
 * consistent comparisons between numeric and letter GCW representations.
 */

import type { TruckCardRow } from '../../lib/trucksApi'
import { normalizeGcwLetter, gcwRank } from '../../lib/gcw'

/**
 * cargoTypeId
 *
 * Extract canonical cargo_type_id from a cargo/job object, or null.
 *
 * @param cargo - cargo/job object
 * @returns string | null
 */
export function cargoTypeId(cargo: any): string | null {
  return cargo?.job_offer?.cargo_type_id ?? cargo?.cargo_type_id ?? null
}

/**
 * cargoRequiresTrailer
 *
 * Determine whether the cargo requires a trailer based on transport_mode.
 *
 * @param cargo - cargo object
 * @returns boolean
 */
export function cargoRequiresTrailer(cargo: any): boolean {
  if (!cargo) return false
  const mode = (cargo?.job_offer?.transport_mode ?? cargo?.transport_mode ?? '') as string
  return String(mode).toLowerCase() === 'trailer_cargo'
}

/**
 * truckSupportsCargo
 *
 * Check if a truck advertises support for the cargo type required by `cargo`.
 * Permissive when cargo or cargo_type_id is not present.
 *
 * @param truck - TruckCardRow
 * @param cargo - cargo object
 * @returns boolean
 */
export function truckSupportsCargo(truck: TruckCardRow, cargo: any): boolean {
  if (!cargo) return true

  const requiredCargoType = cargoTypeId(cargo)
  if (!requiredCargoType) return true

  const raw: any = (truck as any)?._raw ?? {}

  const supported = [raw?.cargo_type_id, raw?.cargo_type_id_secondary].filter(Boolean)

  return supported.includes(requiredCargoType)
}

/**
 * trailerSupportsCargo
 *
 * Check trailer cargo-type support. Mirrors truckSupportsCargo semantics.
 *
 * @param trailer - trailer row
 * @param cargo - cargo object
 * @returns boolean
 */
export function trailerSupportsCargo(trailer: any, cargo: any): boolean {
  if (!cargo) return true

  const requiredCargoType = cargoTypeId(cargo)
  if (!requiredCargoType) return true

  const raw: any = trailer?._raw ?? {}

  const supported = [raw?.cargo_type_id, raw?.cargo_type_id_secondary].filter(Boolean)

  return supported.includes(requiredCargoType)
}

/**
 * gcwAllowsTrailer
 *
 * Determine whether a truck allows a trailer based on GCW ordering.
 *
 * Rules:
 * - Truck A (rank 1) allows trailer rank 1 only
 * - Truck B (rank 2) allows trailer ranks 1..2
 * - Truck C (rank 3) allows trailer ranks 1..3
 *
 * Accepts either:
 * - trailerPayloadKgOrTrailer as number (payload kg) -> derive trailerRank from thresholds:
 *    <=16000 -> rank 1 (A)
 *    <=26000 -> rank 2 (B)
 *    >26000  -> rank 3 (C)
 * - trailerPayloadKgOrTrailer as an object (trailer row) -> derive trailer GCW from trailer/model/raw and rank it
 *
 * Permissive if either side GCW is unknown.
 *
 * @param truck - TruckCardRow
 * @param trailerPayloadKgOrTrailer - number | trailer object
 * @returns boolean
 */
export function gcwAllowsTrailer(truck: TruckCardRow, trailerPayloadKgOrTrailer: number | any): boolean {
  const raw: any = (truck as any)?._raw ?? {}

  // derive truck GCW candidate from common fields
  let truckGcwCandidate: any =
    raw?.gcw_class ??
    raw?.gcw ??
    (truck as any)?.model?.gcw ??
    (truck as any)?.model?.reliability ??
    null

  // normalize to letter
  const truckLetter = normalizeGcwLetter(truckGcwCandidate)
  const truckRank = gcwRank(truckLetter)

  // If caller provided a trailer object, derive its rank from fields
  if (typeof trailerPayloadKgOrTrailer === 'object' && trailerPayloadKgOrTrailer !== null) {
    const trailer = trailerPayloadKgOrTrailer
    const trRaw: any = trailer?._raw ?? {}
    let trailerGcwCandidate: any =
      trRaw?.gcw_class ?? trRaw?.gcw ?? trailer?.model?.gcw ?? trailer?.model?.reliability ?? null

    const trailerLetter = normalizeGcwLetter(trailerGcwCandidate)
    const trailerRank = gcwRank(trailerLetter)

    // If either side unknown, be permissive
    if (truckRank === 0 || trailerRank === 0) return true

    return trailerRank <= truckRank
  }

  // Otherwise treat second arg as payload kg and derive trailer rank by thresholds
  const trailerPayloadKg = Number(trailerPayloadKgOrTrailer ?? 0)
  let trailerRank = 3
  if (trailerPayloadKg <= 16000) trailerRank = 1
  else if (trailerPayloadKg <= 26000) trailerRank = 2
  else trailerRank = 3

  // If truck rank unknown, be permissive
  if (truckRank === 0) return true

  return trailerRank <= truckRank
}

/**
 * truckCanHandleCargo
 *
 * Compatibility check implementing project rules:
 * - LOAD job: allow trucks that explicitly support cargo OR any truck with class 'big'.
 * - TRAILER job: truck must be class 'big' and respect GCW trailer payload limits.
 *
 * @param truck - TruckCardRow
 * @param cargo - cargo object
 * @returns boolean
 */
export function truckCanHandleCargo(truck: TruckCardRow, cargo: any): boolean {
  if (!cargo) return true

  const requiresTrailer = cargoRequiresTrailer(cargo)

  const truckClass = String((truck as any)?.model?.class ?? '').toLowerCase()
  const supportsCargo = truckSupportsCargo(truck, cargo)

  // LOAD job
  if (!requiresTrailer) {
    if (supportsCargo) return true
    if (truckClass === 'big') return true
    return false
  }

  // TRAILER job
  if (truckClass !== 'big') return false

  const trailerWeight =
    (cargo?.job_offer?.trailer_payload_kg as number) ??
    (cargo?.job_offer?.weight_kg as number) ??
    0

  return gcwAllowsTrailer(truck, trailerWeight)
}