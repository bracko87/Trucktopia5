/**
 * JobCard.tsx
 *
 * Presentational Job card used on the Market list.
 *
 * Renders a compact summary row and a collapsible details panel.
 * Adds small weather badges (origin & destination) using WeatherBadge which
 * fetches from public.city_weather_today without changing the existing layout.
 */

import React, { useEffect, useRef, useState } from 'react'
import CountdownTimer from '../common/CountdownTimer'
import { Truck, Clock, Tag, ChevronDown, ChevronUp, Star } from 'lucide-react'
import PricePill from './PricePill'
import CompanyProfileModal from './CompanyProfileModal'
import WeatherBadge from './WeatherBadge'

/**
 * JobRow
 *
 * Minimal job shape used by the Market page.
 */
export interface JobRow {
  id: string
  origin_city_id?: string | null
  origin_city_name?: string | null
  origin_country_code?: string | null
  destination_city_id?: string | null
  destination_city_name?: string | null
  destination_country_code?: string | null
  cargo_type?: string | null
  cargo_item?: string | null
  distance_km?: number | null
  pickup_time?: string | null
  delivery_deadline?: string | null
  transport_mode?: string | null
  reward_trailer_cargo?: number | null
  reward_load_cargo?: number | null
  weight_kg?: number | null
  volume_m3?: number | null
  pallets?: number | null
  temperature_control?: boolean | null
  hazardous?: boolean | null
  /** Indicates whether the job requires crossing customs / border formalities */
  requires_customs?: boolean | null
  special_requirements?: any | null
  currency?: string | null
  origin_client_company_id?: string | null
  origin_client_company_name?: string | null
  origin_client_company_logo?: string | null
  destination_client_company_id?: string | null
  destination_client_company_name?: string | null
  destination_client_company_logo?: string | null
  posted_by_user_name?: string | null
  status?: string | null
  /** Job offer type coming from job_offers.job_offer_type_code (preferred display) */
  job_offer_type_code?: string | null
}

/**
 * JobCardProps
 *
 * Props for the JobCard component.
 */
export interface JobCardProps {
  job: JobRow
  onView?: (job: JobRow) => void
  onAccept: (job: JobRow) => void
}

/**
 * smallDate
 *
 * Render a compact local date/time string or a placeholder.
 *
 * @param s - ISO date string
 */
function smallDate(s?: string | null) {
  if (!s) return '—'
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString(undefined, { hour12: false })
}

/**
 * formatPayload
 *
 * Convert weight in kilograms to a friendly string in tonnes or kg.
 *
 * @param kg - weight in kilograms
 */
function formatPayload(kg?: number | null) {
  if (kg === null || kg === undefined) return '—'
  if (kg >= 1000) {
    const t = Math.round((kg / 1000) * 10) / 10
    return `${t} t`
  }
  return `${Math.round(kg)} kg`
}

/**
 * SquareFlag
 *
 * Presentational square flag chip. Falls back to emoji if images fail.
 */
/**
   * SquareFlag
   *
   * Presentational flag chip. Renders a normal rectangular flag instead of a
   * tightly cropped square so flags keep their natural aspect ratio and
   * look correct visually.
   *
   * - Uses the `size` prop as the height in pixels.
   * - Computes a width with a 4:3 aspect ratio (approx 1.6x height) to avoid
   *   squashed images.
   * - Falls back to an emoji when remote images fail.
   *
   * @param code - two-letter country code
   * @param alt - accessible title / alt text
   * @param size - desired height in pixels (defaults to 20)
   */
  function SquareFlag({ code, alt = '', size = 20 }: { code?: string | null; alt?: string; size?: number }) {
    const initialSrc = (() => {
      if (!code) return null
      const cc = String(code).trim().toLowerCase()
      if (cc.length !== 2) return null
      return `https://flagcdn.com/w40/${cc}.png`
    })()

    const [src, setSrc] = useState<string | null>(initialSrc)
    const [triedAlternate, setTriedAlternate] = useState(false)

    /**
     * countryCodeToEmoji
     *
     * Fallback emoji rendering for country codes.
     */
    function countryCodeToEmoji(code?: string | null) {
      if (!code) return '🌍'
      const cc = code.trim().toUpperCase()
      if (cc.length !== 2) return '🌍'
      return cc.split('').map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join('')
    }

    /**
     * onImageError
     *
     * Try an alternate CDN on first failure, then fall back to emoji.
     */
    function onImageError() {
      if (!triedAlternate && src) {
        const cc = String(code || '').trim().toLowerCase()
        if (cc.length === 2) {
          setSrc(`https://flagpedia.net/data/flags/icon/72x54/${cc}.png`)
          setTriedAlternate(true)
          return
        }
      }
      setSrc(null)
    }

    // Use height=size and a wider width so flags keep their rectangular aspect.
    const width = Math.max(16, Math.round((size || 20) * 1.6))
    const chipStyle: React.CSSProperties = { width, height: size }

    return (
      <div
        aria-hidden
        className="overflow-hidden bg-white border border-slate-100 shadow-sm flex items-center justify-center"
        style={chipStyle}
        title={alt || code || 'Country'}
      >
        {src ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img src={src} className="w-full h-full object-cover block" onError={onImageError} />
        ) : (
          <span style={{ fontSize: Math.max(10, Math.floor((size || 20) * 0.6)), lineHeight: 1 }}>{countryCodeToEmoji(code)}</span>
        )}
      </div>
    )
  }

/**
 * CompanyAvatar
 *
 * Display a circular company avatar with fallback initials.
 */
function CompanyAvatar({ name, logoUrl, size = 36 }: { name?: string | null; logoUrl?: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const placeholder = name
    ? `https://pub-cdn.sider.ai/u/U0KAH9N4VLX/web-coder/6956ef545599fc8caeb3a137/resource/dd5233b6-ba87-488e-92c2-3b9305a9295b.jpg`
    : 'https://pub-cdn.sider.ai/u/U0KAH9N4VLX/web-coder/6956ef545599fc8caeb3a137/resource/daad456b-384d-4c94-a27e-75a47ffb2120.jpg'
  const src = logoUrl ?? placeholder
  const initials = (name || 'C').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
  const fontSize = Math.max(10, Math.floor(size * 0.4))

  return (
    <div className="rounded-full overflow-hidden bg-white border border-slate-100 shadow-sm flex items-center justify-center" style={{ width: size, height: size }} title={name || 'Company'}>
      {!imgError && src ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img src={src} className="w-full h-full object-cover block" onError={() => setImgError(true)} />
      ) : (
        <span style={{ fontSize, lineHeight: 1 }} className="text-slate-700 font-semibold">
          {initials}
        </span>
      )}
    </div>
  )
}

/**
 * normalizedTransportMode
 *
 * Normalize a transport_mode string into 'load' | 'trailer' | 'unknown'.
 */
function normalizedTransportMode(m?: string | null): 'load' | 'trailer' | 'unknown' {
  if (!m) return 'unknown'
  const s = String(m).toLowerCase()
  if (s.includes('load')) return 'load'
  if (s.includes('trailer')) return 'trailer'
  if (s === 'load' || s === 'trailer') return s as 'load' | 'trailer'
  return 'unknown'
}

/**
 * formatDistance
 *
 * Format distance in km into a user-friendly string.
 */
function formatDistance(km?: number | null) {
  if (km === null || km === undefined) return '—'
  if (Number.isNaN(Number(km))) return '—'
  return `${Math.round(km)} km`
}

/**
 * openCityModal
 *
 * Dispatch a global event to open the City modal. Accepts optional cityId and/or cityName.
 *
 * @param cityId - optional UUID of the city
 * @param cityName - optional human-friendly city name
 */
function openCityModal(cityId?: string | null, cityName?: string | null) {
  try {
    window.dispatchEvent(new CustomEvent('open-city-modal', { detail: { cityId, cityName } }))
  } catch {
    // ignore non-browser environments
  }
}

/**
 * TopRouteRow
 *
 * Compact summary row with origin -> destination, primary reward and chevron.
 */
function TopRouteRow({
  origin,
  originCode,
  destination,
  destinationCode,
  titleId,
  transportMode,
  cargoType,
  payload,
  cargoLabel,
  pickup,
  deadline,
  primaryReward,
  expanded,
  onToggleExpand,
  distanceKm,
  currency,
}: {
  origin?: string | null
  originCode?: string | null
  destination?: string | null
  destinationCode?: string | null
  titleId?: string
  transportMode?: string | null
  cargoType?: string | null
  payload?: string
  cargoLabel?: string | null
  pickup?: string | null
  deadline?: string | null
  primaryReward?: number | null
  expanded: boolean
  onToggleExpand: () => void
  distanceKm?: number | null
  currency?: string | null
}) {
  // Determine if a compact active countdown should be shown (pickup exists and is in the future).
  const pickupActive = (() => {
    if (!pickup) return false
    const t = new Date(pickup).getTime()
    if (Number.isNaN(t)) return false
    return t > Date.now()
  })()

  /**
   * onKeyDownHandler
   *
   * Handle Enter/Space to toggle expansion for keyboard users.
   */
  function onKeyDownHandler(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Space' || e.key === 'Spacebar') {
      e.preventDefault()
      onToggleExpand()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggleExpand()}
      onKeyDown={onKeyDownHandler}
      className="w-full rounded-lg px-4 py-3 bg-gradient-to-br from-amber-50 to-white/80 border border-amber-100 flex items-center gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-200"
      aria-pressed={expanded}
      aria-label={`Toggle job details for ${origin ?? 'Unknown'} to ${destination ?? 'Unknown'}`}
    >
      <div aria-hidden className="w-5 h-5 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <SquareFlag code={originCode} alt={origin || 'Origin'} size={18} />
              <div className="text-lg font-semibold leading-tight truncate">{origin ?? 'Unknown'}</div>
            </div>

            <div className="text-slate-300 text-2xl">→</div>

            <div className="flex items-center gap-2 min-w-0">
              <SquareFlag code={destinationCode} alt={destination || 'Destination'} size={18} />
              <div id={titleId} className="text-lg text-slate-700 font-medium leading-tight truncate">
                {destination ?? 'Unknown'}
              </div>
            </div>
          </div>

          <div className="ml-auto text-right flex items-center gap-3">
            <PricePill amount={primaryReward} currency={currency ?? undefined} />

            <button
              type="button"
              onClick={(e) => {
                // prevent the top-level onClick from doubling when someone clicks the chevron
                e.stopPropagation()
                onToggleExpand()
              }}
              aria-expanded={expanded}
              className="inline-flex items-center justify-center p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
              title={expanded ? 'Hide details' : 'Show details'}
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white border border-slate-100 text-slate-600 shadow-sm">
            <Truck className="w-3 h-3 text-slate-500" />
            <span className="font-medium">{transportMode ?? '—'}</span>
          </div>

          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white border border-slate-100 text-slate-600 shadow-sm">
            <Tag className="w-3 h-3 text-amber-600" />
            <span>{cargoType ?? cargoLabel ?? 'Cargo'}</span>
          </div>

          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white border border-slate-100 text-slate-600 shadow-sm">
            <span className="text-xs font-medium">{formatDistance(distanceKm)}</span>
            <span className="ml-1 text-[11px] text-slate-400">distance</span>
          </div>

          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white border border-slate-100 text-slate-600 shadow-sm">
            <span className="text-xs font-medium">{payload ?? '—'}</span>
            <span className="ml-1 text-[11px] text-slate-400">payload</span>
          </div>

          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white border border-slate-100 text-slate-600 shadow-sm">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>Pickup: {smallDate(pickup)}</span>
          </div>

          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white border border-slate-100 text-slate-600 shadow-sm">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>Deadline: {smallDate(deadline)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * MetaBox
 *
 * Center-bottom box showing pickup, deadline and tags inside expanded area.
 */
function MetaBox({
  pickup,
  deadline,
  item,
  weight_kg,
  volume_m3,
  pallets,
  temperature_control,
  hazardous,
  special_requirements,
}: {
  pickup?: string | null
  deadline?: string | null
  item?: string | null
  weight_kg?: number | null
  volume_m3?: number | null
  pallets?: number | null
  temperature_control?: boolean | null
  hazardous?: boolean | null
  special_requirements?: any | null
}) {
  return (
    <div className="rounded-lg p-4 bg-white border border-slate-100 shadow-sm h-full flex flex-col justify-between">
      <div className="grid grid-cols-1 gap-3">
        {/* Top row: Pickup and Deadline */}
        <div className="grid grid-cols-2 gap-3 items-start">
          <div className="flex items-start gap-3 pr-3 border-r border-slate-100">
            <div className="text-slate-400 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Pickup</div>
              <div className="text-sm text-slate-800">{smallDate(pickup)}</div>
            </div>
          </div>

          <div className="flex items-start gap-3 pl-3">
            <div className="text-slate-400 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Deadline</div>
              <div className="text-sm text-slate-800">{smallDate(deadline)}</div>
            </div>
          </div>
        </div>

        {/* Dedicated countdown box inside expanded details */}
        <div>
          <div className="rounded-md bg-white border border-slate-100 p-3 flex items-center justify-center">
            <CountdownTimer pickupTime={pickup ?? null} className="text-sm font-medium text-slate-700" />
          </div>
        </div>

        {/* Payload / Stats row */}
        <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-slate-50 p-2 text-sm">
            <div className="text-xs text-slate-500">Weight</div>
            <div className="font-medium text-slate-800">{formatPayload(weight_kg)}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-2 text-sm">
            <div className="text-xs text-slate-500">Volume</div>
            <div className="font-medium text-slate-800">{volume_m3 ?? '—'} m³</div>
          </div>
          <div className="rounded-md bg-slate-50 p-2 text-sm">
            <div className="text-xs text-slate-500">Pallets</div>
            <div className="font-medium text-slate-800">{pallets ?? '—'}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-2 text-sm">
            <div className="text-xs text-slate-500">Temp control</div>
            <div className="font-medium text-slate-800">{temperature_control ? 'Yes' : 'No'}</div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          {hazardous && <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100 text-rose-700 text-xs">Hazardous</span>}
        </div>

        {special_requirements && (
          <div className="mt-2 text-xs text-slate-500">
            <div className="font-medium text-slate-700">Special requirements</div>
            <div className="mt-1 truncate">{JSON.stringify(special_requirements)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * RewardsBox
 *
 * Two-column rewards / insights box used in JobCard expanded view.
 *
 * - Left: Distance, Type and Weather badges (Origin / Destination)
 * - Right: Advantages + Disadvantages (handicaps)
 *
 * Added detection for customs (requires_customs) which is treated as a disadvantage.
 *
 * @param trailer - reward for trailer cargo
 * @param load - reward for load cargo
 * @param modeKey - normalized transport mode key
 * @param onView - optional view callback
 * @param onAccept - accept callback
 * @param job - job row data
 */
function RewardsBox({
  trailer,
  load,
  modeKey,
  onView,
  onAccept,
  job,
}: {
  trailer: number
  load: number
  modeKey: 'load' | 'trailer' | 'unknown'
  onView?: (job: JobRow) => void
  onAccept: (job: JobRow) => void
  job: JobRow
}) {
  let primary = 0
  let primaryLabel = 'Total'

  if (modeKey === 'load') {
    primary = load
    primaryLabel = 'Load'
  } else if (modeKey === 'trailer') {
    primary = trailer
    primaryLabel = 'Trailer'
  } else {
    primary = Math.max(trailer, load)
    primaryLabel = load >= trailer ? 'Load' : 'Trailer'
  }

  /**
   * inferHandicaps
   *
   * Best-effort extraction of negative aspects from job data.
   * Includes customs (border crossing) when requires_customs is set.
   */
  function inferHandicaps(): string[] {
    const out: string[] = []
    try {
      const req = job.special_requirements
      const s = req ? (typeof req === 'string' ? req.toLowerCase() : JSON.stringify(req).toLowerCase()) : ''
      if (s.includes('city') || s.includes('urban') || s.includes('downtown')) out.push('City drive')
      if (s.includes('narrow') || s.includes('low bridge') || s.includes('restricted')) out.push('Narrow access')
      if (s.includes('toll') || s.includes('tolls')) out.push('Tolls')
      if (job.temperature_control) out.push('Temperature control')
      if (job.hazardous) out.push('Hazardous')
      // New: customs / border crossing increases time & paperwork -> disadvantage
      if (job.requires_customs) out.push('Customs (border crossing)')
    } catch {}
    return out
  }

  /**
   * inferOfferType
   *
   * Simplified inference of offer type from country codes.
   */
  function inferOfferType(): string {
    try {
      const oCountry = job.origin_country_code?.toLowerCase()
      const dCountry = job.destination_country_code?.toLowerCase()
      if (oCountry && dCountry && oCountry === dCountry) return 'Interstate'
      if (oCountry && dCountry && oCountry !== dCountry) return 'International'
    } catch {}
    return 'Unknown'
  }

  /**
   * inferAdvantages
   *
   * Best-effort positive aspects detection.
   */
  function inferAdvantages(): string[] {
    const out: string[] = []
    try {
      const dist = job.distance_km ?? 0
      const p = primary ?? 0
      if (p >= 1500) out.push('High pay')
      if (dist > 0 && p / dist >= 5) out.push('High pay/km')
      if ((job.weight_kg ?? 0) < 500) out.push('Light load')
      if ((job.pallets ?? 0) <= 2) out.push('Few pallets')
      if (!job.temperature_control && !job.hazardous) out.push('No special handling')
    } catch {}
    return out
  }

  const handicaps = inferHandicaps()
  const advantages = inferAdvantages()
  const offerType = job.job_offer_type_code ?? inferOfferType()

  return (
    <div className="rounded-lg p-4 bg-white border border-slate-100 shadow-sm h-full flex flex-col">
      {/* TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* LEFT SIDE */}
        <div className="space-y-3">
          <div>
            <div className="text-xs text-slate-500">Distance</div>
            <div className="text-sm font-medium text-slate-800">{formatDistance(job.distance_km)}</div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Type</div>
            <div className="text-xs font-medium text-slate-700">{offerType}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <WeatherBadge
              cityId={job.origin_city_id ?? undefined}
              city={job.origin_city_name ?? undefined}
              countryCode={job.origin_country_code ?? undefined}
              label="Origin"
            />
            <WeatherBadge
              cityId={job.destination_city_id ?? undefined}
              city={job.destination_city_name ?? undefined}
              countryCode={job.destination_country_code ?? undefined}
              label="Destination"
            />
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="space-y-3">
          {advantages.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Advantages</div>
              <div className="flex flex-wrap gap-2">
                {advantages.map((a) => (
                  <span key={a} className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs shadow-sm">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {handicaps.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Disadvantages</div>
              <div className="flex flex-wrap gap-2">
                {handicaps.map((h) => (
                  <span key={h} className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100 text-rose-700 text-xs shadow-sm">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TOTAL + BUTTONS */}
      <div className="w-full mt-auto border-t border-slate-100 pt-3">
        <div className="w-full mt-2 flex items-baseline justify-between">
          <div className="text-sm text-slate-500">Total</div>
          <PricePill amount={primary} currency={job.currency ?? undefined} compact />
        </div>

        <div className="w-full mt-4 flex gap-2">
          <div className="flex-1" aria-hidden />
          <button
            type="button"
            className="px-3 py-2 rounded-md border bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Follow
          </button>
          <button
            type="button"
            onClick={() => onAccept(job)}
            className="px-4 py-2 rounded-md bg-sky-600 text-white text-sm hover:bg-sky-700 transition shadow"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * JobCard
 *
 * Exported component that composes the small summary and the expanded details.
 */
export default function JobCard({ job, onView, onAccept }: JobCardProps) {
  const [expanded, setExpanded] = useState(false)

  const rewardTrailer = job.reward_trailer_cargo ?? 0
  const rewardLoad = job.reward_load_cargo ?? 0
  const cargoLabel = job.cargo_type ?? job.cargo_item ?? 'Cargo'
  const transportMode = job.transport_mode ?? '—'
  const modeKey = normalizedTransportMode(transportMode)
  const payload = formatPayload(job.weight_kg)
  const cargoType = job.cargo_type ?? job.cargo_item ?? null

  let primaryReward = 0
  if (modeKey === 'load') primaryReward = rewardLoad
  else if (modeKey === 'trailer') primaryReward = rewardTrailer
  else primaryReward = Math.max(rewardLoad, rewardTrailer)

  const [companyModalOpen, setCompanyModalOpen] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null)
  const [selectedCompanyLogo, setSelectedCompanyLogo] = useState<string | null>(null)

  /**
   * openCompanyModal
   *
   * Open the company profile modal with the provided company info.
   */
  function openCompanyModal(id?: string | null, name?: string | null, logo?: string | null) {
    setSelectedCompanyId(id ?? null)
    setSelectedCompanyName(name ?? null)
    setSelectedCompanyLogo(logo ?? null)
    setCompanyModalOpen(true)
  }

  /**
   * closeCompanyModal
   *
   * Close the modal and clear selected company.
   */
  function closeCompanyModal() {
    setCompanyModalOpen(false)
  }

  return (
    <article
      aria-labelledby={`job-${job.id}-title`}
      data-jobcard-version="v3-cargo-payload-company-v2"
      className="group rounded-xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow duration-150 p-3 bg-white"
    >
      <div className="mb-3">
        <TopRouteRow
          origin={job.origin_city_name}
          originCode={job.origin_country_code}
          destination={job.destination_city_name}
          destinationCode={job.destination_country_code}
          titleId={`job-${job.id}-title`}
          transportMode={String(transportMode)}
          cargoType={cargoType ?? undefined}
          payload={payload}
          cargoLabel={cargoLabel}
          pickup={job.pickup_time}
          deadline={job.delivery_deadline}
          primaryReward={primaryReward}
          expanded={expanded}
          onToggleExpand={() => setExpanded((s) => !s)}
          distanceKm={job.distance_km}
          currency={job.currency ?? undefined}
        />
      </div>

      <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ${expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`} aria-hidden={!expanded}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          {/* Left column */}
          <div className="rounded-lg p-4 bg-white border border-slate-100 shadow-sm h-full flex flex-col justify-between">
            <div className="min-w-0">
              <div className="text-xs text-slate-500">Cargo Type</div>
              <div className="text-sm font-medium text-slate-800">{cargoType ?? '—'}</div>

              <div className="mt-3">
                <div className="text-xs text-slate-500">Cargo Item</div>
                <div className="text-sm font-medium text-slate-800">{job.cargo_item ?? '—'}</div>
              </div>

              <div className="mt-3">
                <div className="text-xs text-slate-500">Transport Model</div>
                <div className="text-sm font-medium text-slate-800">
                  {modeKey === 'load' ? 'Load' : modeKey === 'trailer' ? 'Trailer' : 'Unknown'}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t pt-3 space-y-2">
              {job.origin_client_company_name && (
                <button
                  type="button"
                  onClick={() => openCompanyModal(job.origin_client_company_id, job.origin_client_company_name, job.origin_client_company_logo ?? undefined)}
                  className="flex items-center gap-3 w-full text-left p-0"
                  aria-label={`Open profile for ${job.origin_client_company_name}`}
                >
                  <CompanyAvatar name={job.origin_client_company_name} logoUrl={job.origin_client_company_logo} size={56} />
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">Origin client</div>
                    <div className="text-sm font-medium truncate">{job.origin_client_company_name}</div>
                  </div>
                </button>
              )}

              {job.destination_client_company_name && (
                <button
                  type="button"
                  onClick={() => openCompanyModal(job.destination_client_company_id, job.destination_client_company_name, job.destination_client_company_logo ?? undefined)}
                  className="flex items-center gap-3 w-full text-left p-0"
                  aria-label={`Open profile for ${job.destination_client_company_name}`}
                >
                  <CompanyAvatar name={job.destination_client_company_name} logoUrl={job.destination_client_company_logo} size={56} />
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">Destination client</div>
                    <div className="text-sm font-medium truncate">{job.destination_client_company_name}</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          <div className="md:col-span-1">
            <MetaBox
              pickup={job.pickup_time}
              deadline={job.delivery_deadline}
              item={job.cargo_item}
              weight_kg={job.weight_kg}
              volume_m3={job.volume_m3}
              pallets={job.pallets}
              temperature_control={job.temperature_control}
              hazardous={job.hazardous}
              special_requirements={job.special_requirements}
            />
          </div>

          <RewardsBox trailer={rewardTrailer} load={rewardLoad} modeKey={modeKey} onView={onView} onAccept={onAccept} job={job} />
        </div>
      </div>

      <CompanyProfileModal
        open={companyModalOpen}
        onClose={closeCompanyModal}
        companyId={selectedCompanyId ?? undefined}
        companyName={selectedCompanyName ?? undefined}
        companyLogo={selectedCompanyLogo ?? undefined}
      />
    </article>
  )
}