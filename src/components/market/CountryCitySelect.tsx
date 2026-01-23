/**
 * CountryCitySelect.tsx
 *
 * Controlled country and city selection components used by the Market filter bar.
 *
 * Ensures select shows full country names (not bare codes). Uses a project
 * fallback map for many country codes and Intl.DisplayNames where available.
 * This version ALWAYS resolves a friendly name for each option and sorts
 * country options alphabetically by their display name.
 */

import React from 'react'

/**
 * CountryOption
 *
 * Represents an available country and its city list passed from the Market page.
 */
export interface CountryOption {
  code: string
  name?: string
  cities: string[]
}

/**
 * Extensive fallback mapping from ISO alpha-2 (lowercase) to human-friendly
 * English country names. This mapping was expanded to cover many codes observed
 * in the dataset so option labels always show readable names.
 */
const COUNTRY_NAMES: Record<string, string> = {
  gb: 'United Kingdom',
  uk: 'United Kingdom',
  ro: 'Romania',
  pt: 'Portugal',
  pl: 'Poland',
  rs: 'Serbia',
  ge: 'Georgia',
  se: 'Sweden',
  bg: 'Bulgaria',
  lt: 'Lithuania',
  dk: 'Denmark',
  fi: 'Finland',
  hr: 'Croatia',
  il: 'Israel',
  tr: 'Turkey',
  uz: 'Uzbekistan',
  tj: 'Tajikistan',
  af: 'Afghanistan',
  ee: 'Estonia',
  md: 'Moldova',
  de: 'Germany',
  lb: 'Lebanon',
  gr: 'Greece',
  sa: 'Saudi Arabia',
  al: 'Albania',
  fr: 'France',
  si: 'Slovenia',
  it: 'Italy',
  at: 'Austria',
  cz: 'Czech Republic',
  ir: 'Iran',
  ae: 'United Arab Emirates',
  mk: 'North Macedonia',
  in: 'India',
  qa: 'Qatar',
  lv: 'Latvia',
  ba: 'Bosnia and Herzegovina',
  ye: 'Yemen',
  ch: 'Switzerland',
  kz: 'Kazakhstan',
  be: 'Belgium',
  sy: 'Syria',
  xk: 'Kosovo',
  jo: 'Jordan',
  hu: 'Hungary',
  ru: 'Russia',
  kh: 'Cambodia',
  no: 'Norway',
  am: 'Armenia',
  by: 'Belarus',
  sk: 'Slovakia',
  me: 'Montenegro',
  bh: 'Bahrain',
  om: 'Oman',
  kg: 'Kyrgyzstan',
  iq: 'Iraq',
  az: 'Azerbaijan',
  kw: 'Kuwait',
  es: 'Spain',
  lu: 'Luxembourg',
  nl: 'Netherlands',
  kr: 'South Korea',
  cn: 'China',
  tm: 'Turkmenistan',
  ua: 'Ukraine',
  pk: 'Pakistan',
  bd: 'Bangladesh',
  la: 'Laos',
  my: 'Malaysia',
  sg: 'Singapore',
  vn: 'Vietnam',
  mm: 'Myanmar',
  rsr: 'Serbia',
  // add more as needed...
}

/**
 * getCountryDisplayName
 *
 * Resolve a readable country name for an ISO-3166 alpha-2 code.
 *
 * Strategy:
 * 1. Try the project fallback mapping (COUNTRY_NAMES).
 * 2. If not present, try Intl.DisplayNames (if available).
 * 3. Fallback to the uppercased code.
 *
 * @param code - country code (case-insensitive)
 * @returns human friendly name
 */
function getCountryDisplayName(code?: string | null): string {
  if (!code) return ''
  const c = String(code).trim().toLowerCase()
  if (!c) return ''
  if (COUNTRY_NAMES[c]) return COUNTRY_NAMES[c]
  try {
    if (typeof Intl !== 'undefined' && (Intl as any).DisplayNames) {
      const dn = new (Intl as any).DisplayNames(['en'], { type: 'region' })
      const name = dn.of(c.toUpperCase())
      if (typeof name === 'string' && name.length > 0) return name
    }
  } catch {
    // ignore and fallback
  }
  return c.toUpperCase()
}

/**
 * CountrySelectProps
 *
 * Props for the CountrySelect component.
 */
interface CountrySelectProps {
  countries: CountryOption[]
  value: string
  onChange: (code: string) => void
  ariaLabel?: string
}

/**
 * CountrySelect
 *
 * Controlled select for countries. Ensures the passed `value` shows as an option
 * and that all option labels are full human-friendly country names, even if the
 * incoming CountryOption.name contains a raw code.
 *
 * @param props - CountrySelectProps
 */
export default function CountrySelect({
  countries,
  value,
  onChange,
  ariaLabel = 'Country',
}: CountrySelectProps) {
  /**
   * Normalize incoming list to unique lowercase codes and ALWAYS compute a
   * friendly name via getCountryDisplayName. This avoids displaying raw codes
   * that may be present in the incoming country.name.
   */
  const normalized = React.useMemo(() => {
    const map = new Map<string, { code: string; name: string }>()
    for (const c of countries || []) {
      if (!c || !c.code) continue
      const code = String(c.code).trim().toLowerCase()
      if (!code) continue
      const name = getCountryDisplayName(code)
      if (!map.has(code)) map.set(code, { code, name })
    }
    return Array.from(map.values())
  }, [countries])

  /**
   * Ensure the current value appears in the options with a friendly name.
   * If not present in the normalized list, prepend it so the select displays
   * correctly and shows the full name.
   */
  const finalOptions = React.useMemo(() => {
    const opts = [...normalized]
    const val = String(value ?? '').trim().toLowerCase()
    if (val) {
      if (!opts.some((o) => o.code === val)) {
        opts.unshift({ code: val, name: getCountryDisplayName(val) })
      } else {
        const idx = opts.findIndex((o) => o.code === val)
        if (idx >= 0) opts[idx].name = getCountryDisplayName(opts[idx].code)
      }
    }
    return opts
  }, [normalized, value])

  /**
   * Sort options alphabetically by display name (locale-aware) so the select
   * list is predictable and user-friendly.
   */
  const sortedOptions = React.useMemo(() => {
    return [...finalOptions].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  }, [finalOptions])

  return (
    <label className="flex items-center gap-2 text-sm w-full">
      <span className="text-xs text-slate-500">Country</span>
      <select
        aria-label={ariaLabel}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || '')}
        className="px-2 py-1 border rounded text-sm flex-1"
      >
        <option value="">Select country</option>
        {sortedOptions.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * CitySelectProps
 *
 * Props for the CitySelect component.
 */
export interface CitySelectProps {
  cities: string[]
  value: string
  disabled?: boolean
  onChange: (city: string) => void
  ariaLabel?: string
}

/**
 * CitySelect
 *
 * Controlled select for cities. Disabled when no country is selected (caller responsibility).
 *
 * @param props - CitySelectProps
 */
export function CitySelect({
  cities,
  value,
  disabled = false,
  onChange,
  ariaLabel = 'City',
}: CitySelectProps) {
  const list = cities ?? []
  return (
    <label className="flex items-center gap-2 text-sm w-full">
      <span className="text-xs text-slate-500">City</span>
      <select
        aria-label={ariaLabel}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || '')}
        disabled={disabled}
        className="px-2 py-1 border rounded text-sm flex-1"
      >
        <option value="">Select city</option>
        {list.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  )
}