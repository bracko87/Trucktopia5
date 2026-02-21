/**
 * CountryFlag.tsx
 *
 * Small reusable component that renders a country's flag when an ISO code is known.
 * If the country is unknown (no mapping) we DO NOT render an <img> to avoid showing
 * the generic fallback image — instead we render an invisible spacer to preserve
 * layout spacing (so page layout is not changed).
 */

import React from 'react'

/**
 * Props for CountryFlag component.
 */
interface CountryFlagProps {
  /** Human-readable country name (e.g. "Serbia", "Afghanistan") */
  country?: string | null
  /** Extra Tailwind / CSS classes for sizing/styling */
  className?: string
  /** Optional alt text (default: "<country> flag") */
  alt?: string
}

/**
 * Map of normalized country name -> ISO 3166-1 alpha-2 code.
 * Keys should be lowercased.
 */
const COUNTRY_CODE_MAP: { [key: string]: string } = {
  afghanistan: 'af',
  albania: 'al',
  algeria: 'dz',
  andorra: 'ad',
  angola: 'ao',
  argentina: 'ar',
  armenia: 'am',
  australia: 'au',
  austria: 'at',
  azerbaijan: 'az',
  bahamas: 'bs',
  bangladesh: 'bd',
  belarus: 'by',
  belgium: 'be',
  'bosnia and herzegovina': 'ba',
  bosnia: 'ba',
  botswana: 'bw',
  brazil: 'br',
  bulgaria: 'bg',
  canada: 'ca',
  chile: 'cl',
  china: 'cn',
  colombia: 'co',
  croatia: 'hr',
  cuba: 'cu',
  cyprus: 'cy',
  czechia: 'cz',
  'czech republic': 'cz',
  denmark: 'dk',
  dominica: 'dm',
  'dominican republic': 'do',
  ecuador: 'ec',
  egypt: 'eg',
  estonia: 'ee',
  finland: 'fi',
  france: 'fr',
  georgia: 'ge',
  germany: 'de',
  greece: 'gr',
  hungary: 'hu',
  iceland: 'is',
  india: 'in',
  indonesia: 'id',
  iran: 'ir',
  iraq: 'iq',
  ireland: 'ie',
  israel: 'il',
  italy: 'it',
  jamaica: 'jm',
  japan: 'jp',
  jordan: 'jo',
  kazakhstan: 'kz',
  kenya: 'ke',
  kosovo: 'xk',
  kuwait: 'kw',
  kyrgyzstan: 'kg',
  latvia: 'lv',
  lebanon: 'lb',
  libya: 'ly',
  liechtenstein: 'li',
  lithuania: 'lt',
  luxembourg: 'lu',
  madagascar: 'mg',
  malawi: 'mw',
  malaysia: 'my',
  maldives: 'mv',
  mali: 'ml',
  malta: 'mt',
  mauritania: 'mr',
  mauritius: 'mu',
  mexico: 'mx',
  moldova: 'md',
  monaco: 'mc',
  mongolia: 'mn',
  montenegro: 'me',
  morocco: 'ma',
  mozambique: 'mz',
  myanmar: 'mm',
  namibia: 'na',
  nepal: 'np',
  netherlands: 'nl',
  'new zealand': 'nz',
  nicaragua: 'ni',
  niger: 'ne',
  nigeria: 'ng',
  'north macedonia': 'mk',
  norway: 'no',
  oman: 'om',
  pakistan: 'pk',
  panama: 'pa',
  paraguay: 'py',
  peru: 'pe',
  philippines: 'ph',
  poland: 'pl',
  portugal: 'pt',
  qatar: 'qa',
  romania: 'ro',
  russia: 'ru',
  'russian federation': 'ru',
  rwanda: 'rw',
  'saudi arabia': 'sa',
  senegal: 'sn',
  serbia: 'rs',
  singapore: 'sg',
  slovakia: 'sk',
  slovenia: 'si',
  somalia: 'so',
  'south africa': 'za',
  'south korea': 'kr',
  spain: 'es',
  sri_lanka: 'lk',
  'sri lanka': 'lk',
  sudan: 'sd',
  sweden: 'se',
  switzerland: 'ch',
  syria: 'sy',
  tajikistan: 'tj',
  tanzania: 'tz',
  thailand: 'th',
  tunisia: 'tn',
  turkey: 'tr',
  turkiye: 'tr',
  turkmenistan: 'tm',
  uganda: 'ug',
  ukraine: 'ua',
  'united arab emirates': 'ae',
  uae: 'ae',
  'united kingdom': 'gb',
  'great britain': 'gb',
  'united states': 'us',
  usa: 'us',
  uruguay: 'uy',
  uzbekistan: 'uz',
  venezuela: 've',
  vietnam: 'vn',
  yemen: 'ye',
  zambia: 'zm',
  zimbabwe: 'zw',
}

/**
 * Normalize a country display string for lookup in COUNTRY_CODE_MAP.
 */
function normalizeCountryName(name?: string | null): string {
  if (!name) return ''
  return name.trim().toLowerCase()
}

/**
 * CountryFlag
 *
 * Renders a flag <img> only when an ISO code is known. If unknown, render an
 * inert spacer element (same sizing classes) so the page spacing/layout remains
 * unchanged but the generic fallback image is never injected into the DOM.
 *
 * @param props CountryFlagProps
 * @returns JSX.Element
 */
export default function CountryFlag({
  country,
  className = 'w-6 h-4',
  alt,
}: CountryFlagProps) {
  const normalized = normalizeCountryName(country)
  const code = COUNTRY_CODE_MAP[normalized]

  // If we don't have a code, render an inert spacer (no <img> fallback).
  if (!code) {
    return <span aria-hidden="true" className={`${className} inline-block`} />
  }

  const src = `https://flagcdn.com/w24/${code}.png`

  /**
   * Handle image load error by hiding the image node so no broken/fallback
   * image appears in the DOM.
   *
   * @param e React.SyntheticEvent<HTMLImageElement>
   */
  function handleError(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    img.style.display = 'none'
  }

  return (
    <img
      src={src}
      alt={alt ?? `${country || 'Country'} flag`}
      className={`${className} object-cover rounded-sm inline-block`}
      onError={handleError}
      style={{ pointerEvents: 'none' }}
    />
  )
}