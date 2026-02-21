/**
 * src/lib/recommendations.ts
 *
 * Pure JS/TS ranking helpers for recommending trailers and drivers for a job offer.
 *
 * These functions implement the scoring rules provided:
 * - Trailer scoring: +50 same city, +30 supports cargo type (or null), +20 payload >= required
 *   Results are filtered to AVAILABLE trailers with sufficient payload, then ordered by
 *   recommendation_score DESC, payload_excess ASC.
 * - Driver ranking: location match first, then fatigue ascending, then experience descending.
 *
 * Purpose: keep recommendation logic deterministic, side-effect free and reusable by UI.
 */

/**
 * TrailerRankRow
 *
 * Minimal shape for the trailer row extended with ranking fields.
 */
export interface TrailerRankRow extends Record<string, any> {
  recommendation_score: number
  payload_excess: number
}

/**
 * rankTrailersForJob
 *
 * Rank trailers for a job offer using the requested scoring rules.
 *
 * @param trailers - array of trailer objects (must include: status, payload_capacity_kg, cargo_type_id, location_city_id, id)
 * @param jobOffer - job offer object (must include: id, weight_kg, cargo_type_id, origin_city_id)
 * @returns array of trailers annotated with recommendation_score & payload_excess, sorted by rank
 */
export function rankTrailersForJob(trailers: any[] = [], jobOffer: any | null): TrailerRankRow[] {
  if (!jobOffer || !Array.isArray(trailers) || trailers.length === 0) return []

  const weight = Number(jobOffer.weight_kg ?? 0)

  const candidates: TrailerRankRow[] = trailers
    .map((tr) => {
      const status = (tr.status ?? '').toString().toUpperCase()
      const payloadCap = Number(tr.payload_capacity_kg ?? tr.payloadKg ?? tr.payload ?? 0)
      const cargoTypeId = tr.cargo_type_id ?? tr.cargoTypeId ?? null
      const locationCityId = tr.location_city_id ?? tr.locationCityId ?? tr._raw?.location_city_id ?? null

      // Score components
      let score = 0
      if (locationCityId && String(locationCityId) === String(jobOffer.origin_city_id)) score += 50
      // Accept when trailer cargo_type matches job OR trailer has no specific cargo_type (null)
      if (!cargoTypeId || (jobOffer.cargo_type_id && String(cargoTypeId) === String(jobOffer.cargo_type_id))) score += 30
      if (payloadCap >= weight && weight > 0) score += 20

      const payload_excess = payloadCap - weight

      return {
        ...tr,
        recommendation_score: score,
        payload_excess,
        __payload_capacity_numeric: payloadCap,
        __status_normalized: status,
      } as TrailerRankRow
    })
    // Only AVAILABLE trailers and those meeting capacity (matching SQL WHERE)
    .filter((t) => {
      const okStatus = (t.__status_normalized ?? '').toUpperCase() === 'AVAILABLE'
      const capOk = Number(t.__payload_capacity_numeric ?? 0) >= weight
      return okStatus && capOk
    })
    .sort((a, b) => {
      // Primary: score desc
      if (a.recommendation_score !== b.recommendation_score) return b.recommendation_score - a.recommendation_score
      // Secondary: payload_excess asc (prefer tighter fit)
      const ea = Number(a.payload_excess ?? 0)
      const eb = Number(b.payload_excess ?? 0)
      if (ea !== eb) return ea - eb
      // Tiebreak: prefer lower id string (stable)
      return String(a.id ?? a._raw?.id ?? '').localeCompare(String(b.id ?? b._raw?.id ?? ''))
    })

  return candidates
}

/**
 * rankDriversForJob
 *
 * Rank drivers for a job offer using the requested ordering:
 * 1) same city as the truck's current city when a truck is provided (highest)
 * 2) lowest fatigue (ASC)
 * 3) highest experience (DESC)
 *
 * Note:
 * - When a truck argument is provided, location matching is computed against
 *   truck.location_city_id (this enforces the rule: drivers are recommendable only
 *   if they are in the same city as the truck).
 * - When no truck is provided the function will fallback to using jobOffer.origin_city_id.
 *
 * @param drivers - array of driver objects (should include: activity_id, location_city_id, fatigue, experience, id)
 * @param jobOffer - job offer object (may include: origin_city_id)
 * @param truck - optional truck object (preferred source for location_city_id)
 * @returns array of drivers sorted by preference (best first). Each driver gets `location_match` field (1 or 0).
 */
export function rankDriversForJob(drivers: any[] = [], jobOffer: any | null, truck: any | null = null): any[] {
  if (!Array.isArray(drivers) || drivers.length === 0) return []
  // determine the city id to use for matching: prefer truck.location_city_id when truck provided
  const truckCityId =
    (truck && (truck.location_city_id ?? truck._raw?.location_city_id ?? truck.locationCityId ?? null)) ?? null
  const originCityId = jobOffer?.origin_city_id ?? jobOffer?.origin_city?.id ?? null
  const matchCityId = truckCityId ?? originCityId

  const candidates = drivers
    .filter((d) => (d.activity_id ?? '').toString().toLowerCase() === 'free')
    .map((d) => {
      const loc = d.location_city_id ?? d.locationCityId ?? d._raw?.current_location_id ?? d.location ?? null
      const location_match = loc && matchCityId && String(loc) === String(matchCityId) ? 1 : 0
      return {
        ...d,
        location_match,
        _fatigue_num: Number(d.fatigue ?? 0),
        _experience_num: Number(d.experience ?? 0),
      }
    })
    .sort((a, b) => {
      // location_match desc
      if (a.location_match !== b.location_match) return b.location_match - a.location_match
      // fatigue asc
      if (a._fatigue_num !== b._fatigue_num) return a._fatigue_num - b._fatigue_num
      // experience desc
      if (a._experience_num !== b._experience_num) return b._experience_num - a._experience_num
      // tiebreak stable by id
      return String(a.id ?? '').localeCompare(String(b.id ?? ''))
    })

  return candidates
}