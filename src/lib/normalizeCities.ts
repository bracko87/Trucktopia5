/**
 * normalizeCities.ts
 *
 * Utility to normalize heterogeneous city rows returned by various PostgREST schemas.
 *
 * Many projects name city/country columns differently (city, city_name, name, country, country_name, country_code).
 * This module detects common schemas and returns a consistent small shape usable by UI code.
 */

/**
 * CityRow
 *
 * Normalized city row shape consumed by frontend components. Contains optional coordinates.
 */
export interface CityRow {
  id: string | number
  country: string
  city: string
  lat?: number
  lon?: number
}

/**
 * findKey
 *
 * Find the first object key matching any of the provided regex patterns.
 *
 * @param obj - source object
 * @param patterns - array of regex patterns to try
 * @returns key string or undefined
 */
function findKey(obj: Record<string, any>, patterns: RegExp[]): string | undefined {
  const keys = Object.keys(obj || {})
  for (const p of patterns) {
    const k = keys.find((kk) => p.test(kk))
    if (k) return k
  }
  return undefined
}

/**
 * normalizeCityRows
 *
 * Convert an array of raw DB rows into an array of normalized CityRow objects.
 * Preferred mapping: if rows include city_name and country_name these are used directly.
 * Falls back to heuristics if preferred columns are not present.
 *
 * @param raw - array of raw rows returned by PostgREST
 * @returns array of CityRow
 */
export function normalizeCityRows(raw: any[]): CityRow[] {
  if (!Array.isArray(raw)) return []

  // Fast path: explicit city_name / country_name columns (common in public.cities)
  const hasCityName = raw.some((r) => r && Object.prototype.hasOwnProperty.call(r, 'city_name'))
  const hasCountryName = raw.some((r) => r && Object.prototype.hasOwnProperty.call(r, 'country_name'))

  if (hasCityName && hasCountryName) {
    return raw
      .filter((r) => r && r.city_name && r.country_name)
      .map((r) => ({
        id: r.id ?? `${r.city_name}-${r.country_name}`,
        city: String(r.city_name),
        country: String(r.country_name),
        lat: r.lat !== undefined && r.lat !== null ? Number(r.lat) : undefined,
        lon: r.lon !== undefined && r.lon !== null ? Number(r.lon) : undefined,
      }))
  }

  // Heuristic fallback: try multiple common keys
  const countryPatterns = [
    /\bcountry_name\b/i,
    /\bcountry_code\b/i,
    /\bcountry\b/i,
    /\bnation\b/i,
    /\bregion\b/i,
  ]
  const cityPatterns = [
    /\bcity_name\b/i,
    /\bcity\b/i,
    /\btown\b/i,
    /\blocation_name\b/i,
    /\bname\b/i,
  ]

  const normalized: CityRow[] = []

  for (const r of raw) {
    if (!r || typeof r !== 'object') continue

    const cityKey = findKey(r, cityPatterns)
    const countryKey = findKey(r, countryPatterns)

    const cityVal = cityKey ? String(r[cityKey] ?? '').trim() : ''
    const countryVal = countryKey ? String(r[countryKey] ?? '').trim() : ''

    let finalCity = cityVal
    let finalCountry = countryVal

    if (!finalCity) {
      const possibleName = Object.keys(r)
        .map((k) => ({ k, v: String(r[k] ?? '').trim() }))
        .find((kv) => kv.k.toLowerCase() === 'name' && kv.v)
      if (possibleName && possibleName.v) finalCity = possibleName.v
    }

    if (!finalCountry) {
      const codeKey = findKey(r, [/\bcode\b/i, /\biso\b/i, /\bcountry_code\b/i])
      if (codeKey) finalCountry = String(r[codeKey] ?? '').trim()
    }

    const id = r.id ?? `${finalCity}-${finalCountry}`

    if (finalCity && finalCountry) {
      normalized.push({
        id,
        city: finalCity,
        country: finalCountry,
        lat: r.lat !== undefined && r.lat !== null ? Number(r.lat) : undefined,
        lon: r.lon !== undefined && r.lon !== null ? Number(r.lon) : undefined,
      })
    }
  }

  return normalized
}