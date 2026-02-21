/**
 * src/lib/countryNames.ts
 *
 * Centralized mapping and helper for converting country codes (or fragile strings)
 * into a consistent display name. Use this as the single source of truth in UI renders.
 */

/**
 * COUNTRY_NAMES
 *
 * Map of lower-cased ISO country codes to a human-friendly display name.
 * Extend this map as your app needs more display names.
 */
export const COUNTRY_NAMES: Record<string, string> = {
  rs: 'Serbia',
  de: 'Germany',
  fr: 'France',
  es: 'Spain',
  gb: 'United Kingdom',
  uk: 'United Kingdom',
  us: 'United States',
  usa: 'United States',
  ca: 'Canada',
  au: 'Australia',
  nz: 'New Zealand',
  nl: 'Netherlands',
  be: 'Belgium',
  it: 'Italy',
  pt: 'Portugal',
  pl: 'Poland',
  se: 'Sweden',
  no: 'Norway',
  fi: 'Finland',
  dk: 'Denmark',
  hr: 'Croatia',
  hu: 'Hungary',
  ro: 'Romania',
  bg: 'Bulgaria',
  gr: 'Greece',
  cz: 'Czech Republic',
  sk: 'Slovakia',
  si: 'Slovenia',
  ie: 'Ireland',
  ch: 'Switzerland',
  at: 'Austria',
  br: 'Brazil',
  ar: 'Argentina',
  mx: 'Mexico',
  cl: 'Chile',
  co: 'Colombia',
  pe: 'Peru',
  ve: 'Venezuela',
  jp: 'Japan',
  kr: 'South Korea',
  cn: 'China',
  in: 'India',
  id: 'Indonesia',
  my: 'Malaysia',
  ph: 'Philippines',
  th: 'Thailand',
  vn: 'Vietnam',
  lk: 'Sri Lanka',
  za: 'South Africa',
  eg: 'Egypt',
  ae: 'United Arab Emirates',
  sa: 'Saudi Arabia',
  tr: 'Turkey',
  ru: 'Russia',
}

/**
 * getCountryName
 *
 * Resolve a canonical display name from a country code or fragile string.
 *
 * Behavior:
 * - Accepts undefined/null/empty -> returns empty string.
 * - Trims and lowercases the input and tries to lookup COUNTRY_NAMES.
 * - If not found, returns the original input uppercased as a safe fallback
 *   (so 'SERBIA'/'Serbia'/'serbia' -> 'Serbia' when mapping exists; otherwise 'XX' fallback).
 *
 * @param code optional country code or string
 * @returns display name (possibly uppercased fallback) or '' when not provided
 */
export function getCountryName(code?: string | null): string {
  if (!code) return ''
  const c = String(code).trim().toLowerCase()
  // If the value looks like a 2- or 3-letter ISO code, prefer lookup.
  if (c.length <= 3 && COUNTRY_NAMES[c]) return COUNTRY_NAMES[c]
  // If input already matches a mapping key in other forms, try lookup anyway.
  if (COUNTRY_NAMES[c]) return COUNTRY_NAMES[c]
  // Fallback: if this looks like a full name (e.g. 'Serbia' or 'SERBIA')
  // normalize capitalization: Title-case the word(s) to avoid raw uppercase.
  try {
    const words = String(code)
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ')
    return words || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

export default getCountryName