/**
 * JobCard.tsx
 *
 * Presentational Job card used on the Market list and My Jobs page.
 *
 * Behavior changes:
 * - Reads job.pickup_ready (if provided by the API) to determine whether the job
 *   may be assigned yet. When pickup_ready === false the card is shown as
 *   muted/gray and the primary assign/accept button is disabled. Countdown is
 *   still displayed.
 *
 * - Backwards compatible: if pickup_ready is not present, client-side time
 *   comparison is used as a fallback (now() >= pickup_time).
 *
 * Note: This file focuses only on UI behavior; actual data queries must expose
 * pickup_ready (see migrations/075_pickup_ready.sql).
 */

import React, { useState } from 'react'
import CountdownTimer from '../common/CountdownTimer'
import Currency from '../common/Currency'
import { Truck, Clock, Tag, ChevronDown, ChevronUp } from 'lucide-react'
import PricePill from './PricePill'
import CompanyProfileModal from './CompanyProfileModal'
import WeatherBadge from './WeatherBadge'

/**
 * JobRow
 *
 * Minimal job shape used by the Market page. pickup_ready is optional and when
 * present is authoritative.
 */
export interface JobRow {
  id: string

  /** Prefer this for multi-run offers (remaining payload left on offer). */
  remaining_payload?: number | null

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
  job_offer_type_code?: string | null
  assignment_status?: string | null
  driving_session_phase?: string | null
  computed_status?: string | null
  is_deadline_expired?: boolean | null

  /** pickup_ready - authoritative flag from server: now() >= pickup_time */
  pickup_ready?: boolean | null
}

/**
 * JobCardProps
 */
export interface JobCardProps {
  job: JobRow
  onView?: (job: JobRow) => void
  onAccept: (job: JobRow) => void
  onCancel?: (job: JobRow) => void
  actionsVariant?: 'default' | 'my-jobs'
  variant?: 'default' | 'waiting' | 'active'
  /** mode influences disabled behavior: 'market' keeps future pickups selectable */
  mode?: 'market' | 'staging' | 'my-jobs' | 'default'
}

function smallDate(s?: string | null) {
  if (!s) return '—'
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString(undefined, { hour12: false })
}

function formatPayload(kg?: number | null) {
  if (kg === null || kg === undefined) return '—'
  if (kg >= 1000) {
    const t = Math.round((kg / 1000) * 10) / 10
    return `${t} t`
  }
  return `${Math.round(kg)} kg`
}

/**
 * getDisplayPayloadKg
 *
 * Prefer authoritative remaining payload for multi-run offers.
 * Fallback to original job weight for legacy/single-run rows.
 */
function getDisplayPayloadKg(job: JobRow): number | null {
  const remaining = Number(job.remaining_payload)
  if (Number.isFinite(remaining) && remaining >= 0) return remaining

  const weight = Number(job.weight_kg)
  if (Number.isFinite(weight) && weight >= 0) return weight

  return null
}

function SquareFlag({
  code,
  alt = '',
  size = 20,
}: {
  code?: string | null
  alt?: string
  size?: number
}) {
  const initialSrc = (() => {
    if (!code) return null
    const cc = String(code).trim().toLowerCase()
    if (cc.length !== 2) return null
    return `https://flagcdn.com/w40/${cc}.png`
  })()

  const [src, setSrc] = useState<string | null>(initialSrc)
  const [triedAlternate, setTriedAlternate] = useState(false)

  function countryCodeToEmoji(code?: string | null) {
    if (!code) return '🌍'
    const cc = code.trim().toUpperCase()
    if (cc.length !== 2) return '🌍'
    return cc
      .split('')
      .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
      .join('')
  }

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
        <img
          src={src}
          className="w-full h-full object-cover block"
          onError={onImageError}
        />
      ) : (
        <span
          style={{
            fontSize: Math.max(10, Math.floor((size || 20) * 0.6)),
            lineHeight: 1,
          }}
        >
          {countryCodeToEmoji(code)}
        </span>
      )}
    </div>
  )
}

function CompanyAvatar({
  name,
  logoUrl,
  size = 36,
}: {
  name?: string | null
  logoUrl?: string | null
  size?: number
}) {
  const [imgError, setImgError] = useState(false)
  const placeholder = name
    ? `https://pub-cdn.sider.ai/u/U0KAH9N4VLX/web-coder/6956ef545599fc8caeb3a137/resource/dd5233b6-ba87-488e-92c2-3b9305a9295b.jpg`
    : 'https://pub-cdn.sider.ai/u/U0KAH9N4VLX/web-coder/6956ef545599fc8caeb3a137/resource/daad456b-384d-4c94-a27e-75a47ffb2120.jpg'
  const src = logoUrl ?? placeholder
  const initials = (name || 'C')
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const fontSize = Math.max(10, Math.floor(size * 0.4))

  return (
    <div
      className="rounded-full overflow-hidden bg-white border border-slate-100 shadow-sm flex items-center justify-center"
      style={{ width: size, height: size }}
      title={name || 'Company'}
    >
      {!imgError && src ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img
          src={src}
          className="w-full h-full object-cover block"
          onError={() => setImgError(true)}
        />
      ) : (
        <span style={{ fontSize, lineHeight: 1 }} className="text-slate-700 font-semibold">
          {initials}
        </span>
      )}
    </div>
  )
}

function normalizedTransportMode(m?: string | null): 'load' | 'trailer' | 'unknown' {
  if (!m) return 'unknown'
  const s = String(m).toLowerCase()
  if (s.includes('load')) return 'load'
  if (s.includes('trailer')) return 'trailer'
  if (s === 'load' || s === 'trailer') return s as 'load' | 'trailer'
  return 'unknown'
}

function formatDistance(km?: number | null) {
  if (km === null || km === undefined) return '—'
  if (Number.isNaN(Number(km))) return '—'
  return `${Math.round(km)} km`
}

const PHASE_LABELS_SHORT: Record<string, string> = {
  TO_PICKUP: 'Picking up',
  PICKING_LOAD: 'Picking up',
  LOADING: 'Loading',
  TO_DELIVERY: 'Delivering',
  TO_DELIVER: 'Delivering',
  UNLOADING: 'Unloading',
  COMPLETED: 'Completed',
  DELIVERED: 'Completed',
  ASSIGNED: 'Assigned',
  'TO PICKUP': 'Picking up',
  'TO DELIVERY': 'Delivering',
}

function StatusBadge({ status }: { status?: string | null }) {
  const raw = String(status ?? '').trim()
  const transformedKey = raw
    ? raw
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_')
        .replace(/__+/g, '_')
    : 'ASSIGNED'

  const label =
    PHASE_LABELS_SHORT[transformedKey] ??
    (() => {
      const human = transformedKey.replace(/_/g, ' ').toLowerCase()
      return human
        .split(' ')
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ')
    })()

  const styles: Record<string, string> = {
    ASSIGNED: 'bg-blue-100 text-blue-700',
    TO_PICKUP: 'bg-blue-100 text-blue-700',
    PICKING_LOAD: 'bg-blue-100 text-blue-700',
    LOADING: 'bg-amber-100 text-amber-700',
    TO_DELIVERY: 'bg-indigo-100 text-indigo-700',
    TO_DELIVER: 'bg-indigo-100 text-indigo-700',
    UNLOADING: 'bg-amber-100 text-amber-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    DELIVERED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-gray-200 text-gray-700',
    FAILED: 'bg-rose-100 text-rose-700',
  }

  const cls = styles[transformedKey] ?? styles.ASSIGNED

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${cls}`} title={raw || 'status'}>
      {label}
    </span>
  )
}

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
  assignmentStatus,
  variant = 'default',
  actionsVariant = 'default',
  pickupReady,
  disabled,
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
  assignmentStatus?: string | null
  variant?: 'default' | 'waiting' | 'active'
  actionsVariant?: 'default' | 'my-jobs'
  pickupReady?: boolean | null
  disabled?: boolean
}) {
  const pickupReadyComputed = (() => {
    if (typeof pickupReady === 'boolean') return pickupReady
    if (!pickup) return false
    const t = new Date(pickup).getTime()
    if (Number.isNaN(t)) return false
    return Date.now() >= t
  })()

  const pickupReadyFinal = pickupReadyComputed

  const isDeadlineExpired = (() => {
    if (!deadline) return false
    const d = new Date(String(deadline))
    if (Number.isNaN(d.getTime())) return false
    return d < new Date()
  })()

  function onKeyDownHandler(e: React.KeyboardEvent) {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Space' || e.key === 'Spacebar') {
      e.preventDefault()
      onToggleExpand()
    }
  }

  const topRowBase =
    variant === 'waiting'
      ? 'w-full rounded-lg px-4 py-3 bg-gradient-to-br from-sky-50 to-white/80 border border-sky-100 flex items-center gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-200'
      : variant === 'active'
        ? 'w-full rounded-lg px-4 py-3 bg-gradient-to-br from-emerald-50 to-white/80 border border-emerald-100 flex items-center gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-200'
        : 'w-full rounded-lg px-4 py-3 bg-gradient-to-br from-amber-50 to-white/80 border border-amber-100 flex items-center gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-200'

  const topRowClass = `${topRowBase} ${disabled ? 'opacity-70 filter grayscale cursor-not-allowed' : ''}`

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (disabled) return
        onToggleExpand()
      }}
      onKeyDown={onKeyDownHandler}
      className={topRowClass}
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
            <StatusBadge status={assignmentStatus} />

            {actionsVariant === 'my-jobs' ? (
              <div aria-hidden>
                <Currency
                  value={primaryReward ?? 0}
                  currency={currency ?? 'USD'}
                  className="text-slate-900 text-lg font-semibold"
                />
              </div>
            ) : (
              <PricePill amount={primaryReward} currency={currency ?? undefined} />
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (disabled) return
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
            <span className="font-semibold">
              {normalizedTransportMode(transportMode) === 'load' ? (
                <span className="text-blue-600">Load</span>
              ) : normalizedTransportMode(transportMode) === 'trailer' ? (
                <span className="text-purple-600">Trailer</span>
              ) : (
                <span className="text-slate-700">{transportMode ?? '—'}</span>
              )}
            </span>
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
            <span className={`${pickupReadyFinal ? 'font-bold text-emerald-700' : 'font-bold text-rose-600'}`}>
              Pickup: {smallDate(pickup)}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-white border border-slate-100 text-slate-600 shadow-sm">
            <Clock className="w-3 h-3 text-slate-500" />
            <span className={isDeadlineExpired ? 'text-rose-600 font-semibold' : ''}>
              Deadline: {smallDate(deadline)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  void item

  const isExpired = (() => {
    if (!deadline) return false
    const d = new Date(String(deadline))
    if (Number.isNaN(d.getTime())) return false
    return d < new Date()
  })()

  return (
    <div className="rounded-lg p-4 bg-white border border-slate-100 shadow-sm h-full flex flex-col justify-between">
      <div className="grid grid-cols-1 gap-3">
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
              <div className={isExpired ? 'text-rose-600 font-semibold text-sm' : 'text-sm text-slate-800'}>
                {smallDate(deadline)}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-md bg-white border border-slate-100 p-3 flex items-center justify-center">
            <CountdownTimer pickupTime={pickup ?? null} className="text-sm font-medium text-slate-700" />
          </div>
        </div>

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
          {hazardous && (
            <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100 text-rose-700 text-xs">
              Hazardous
            </span>
          )}
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

function RewardsBox({
  trailer,
  load,
  modeKey,
  onView,
  onAccept,
  onCancel,
  actionsVariant = 'default',
  job,
  disabled,
}: {
  trailer: number
  load: number
  modeKey: 'load' | 'trailer' | 'unknown'
  onView?: (job: JobRow) => void
  onAccept: () => void
  onCancel?: () => void
  actionsVariant?: 'default' | 'my-jobs'
  job: JobRow
  disabled?: boolean
}) {
  let primary = 0
  if (modeKey === 'load') primary = load
  else if (modeKey === 'trailer') primary = trailer
  else primary = Math.max(trailer, load)

  function inferHandicaps(): string[] {
    const out: string[] = []
    try {
      const req = job.special_requirements
      const s = req
        ? typeof req === 'string'
          ? req.toLowerCase()
          : JSON.stringify(req).toLowerCase()
        : ''
      if (s.includes('city') || s.includes('urban') || s.includes('downtown')) out.push('City drive')
      if (s.includes('narrow') || s.includes('low bridge') || s.includes('restricted')) out.push('Narrow access')
      if (s.includes('toll') || s.includes('tolls')) out.push('Tolls')
      if (job.temperature_control) out.push('Temperature control')
      if (job.hazardous) out.push('Hazardous')
      if (job.requires_customs) out.push('Customs (border crossing)')
    } catch {}
    return out
  }

  function inferOfferType(): string {
    try {
      const oCountry = job.origin_country_code?.toLowerCase()
      const dCountry = job.destination_country_code?.toLowerCase()
      if (oCountry && dCountry && oCountry === dCountry) return 'Interstate'
      if (oCountry && dCountry && oCountry !== dCountry) return 'International'
    } catch {}
    return 'Unknown'
  }

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
      <div className="grid grid-cols-2 gap-4 mb-4">
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

        <div className="space-y-3">
          {advantages.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Advantages</div>
              <div className="flex flex-wrap gap-2">
                {advantages.map((a) => (
                  <span
                    key={a}
                    className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs shadow-sm"
                  >
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
                  <span
                    key={h}
                    className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-100 text-rose-700 text-xs shadow-sm"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full mt-auto border-t border-slate-100 pt-3">
        <div className="w-full mt-2 flex items-baseline justify-between">
          <div className="text-sm text-slate-500">Total</div>

          {actionsVariant === 'my-jobs' ? (
            <Currency value={primary} currency={job.currency ?? 'USD'} className="text-slate-900 text-lg font-semibold" />
          ) : (
            <PricePill amount={primary} currency={job.currency ?? undefined} compact />
          )}
        </div>

        <div className="w-full mt-4 flex gap-2">
          <div className="flex-1" aria-hidden />
          {actionsVariant === 'my-jobs' ? (
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => onCancel?.()}
                disabled={disabled}
                className={`px-4 py-2 rounded-md text-white text-sm transition shadow ${
                  disabled ? 'bg-rose-300 cursor-not-allowed opacity-60' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Cancel Load
              </button>
              {!disabled ? null : <span className="text-xs text-slate-500">Assign disabled</span>}
            </div>
          ) : (
            <>
              <button
                type="button"
                className="px-3 py-2 rounded-md border bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={() => onView?.(job)}
              >
                Follow
              </button>
              <button
                type="button"
                onClick={() => {
                  if (disabled) return
                  onAccept()
                }}
                disabled={disabled}
                className={`px-4 py-2 rounded-md text-sm transition shadow ${
                  disabled ? 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-70' : 'bg-sky-600 text-white hover:bg-sky-700'
                }`}
              >
                Accept
              </button>
              {disabled ? <span className="ml-2 text-xs text-slate-500">Assign disabled</span> : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * JobCard
 */
export default function JobCard({
  job,
  onView,
  onAccept,
  onCancel,
  variant = 'default',
  actionsVariant = 'default',
  mode = undefined,
}: JobCardProps) {
  const [expanded, setExpanded] = useState(false)

  const rewardTrailer = job.reward_trailer_cargo ?? 0
  const rewardLoad = job.reward_load_cargo ?? 0
  const cargoLabel = job.cargo_type ?? job.cargo_item ?? 'Cargo'
  const transportMode = job.transport_mode ?? '—'
  const modeKey = normalizedTransportMode(transportMode)

  // Display remaining payload when present (fallback to weight)
  const displayPayloadKg = getDisplayPayloadKg(job)
  const payload = formatPayload(displayPayloadKg)

  const cargoType = job.cargo_type ?? job.cargo_item ?? null

  let primaryReward = 0
  if (modeKey === 'load') primaryReward = rewardLoad
  else if (modeKey === 'trailer') primaryReward = rewardTrailer
  else primaryReward = Math.max(rewardLoad, rewardTrailer)

  const [companyModalOpen, setCompanyModalOpen] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null)
  const [selectedCompanyLogo, setSelectedCompanyLogo] = useState<string | null>(null)

  function openCompanyModal(id?: string | null, name?: string | null, logo?: string | null) {
    setSelectedCompanyId(id ?? null)
    setSelectedCompanyName(name ?? null)
    setSelectedCompanyLogo(logo ?? null)
    setCompanyModalOpen(true)
  }

  function closeCompanyModal() {
    setCompanyModalOpen(false)
  }

  const authoritativePhase = (job.driving_session_phase ??
    job.status ??
    job.assignment_status ??
    job.computed_status ??
    'ASSIGNED') as string

  const pickupReady =
    typeof job.pickup_ready === 'boolean'
      ? job.pickup_ready
      : (() => {
          if (!job.pickup_time) return false
          const t = new Date(String(job.pickup_time)).getTime()
          if (Number.isNaN(t)) return false
          return Date.now() >= t
        })()

  const effectiveMode: 'market' | 'staging' | 'my-jobs' | 'default' =
    (mode as any) ?? (actionsVariant === 'my-jobs' ? 'my-jobs' : 'market')

  const disabled = pickupReady === false && (effectiveMode === 'staging' || effectiveMode === 'my-jobs')

  const hasCompanyInfo = Boolean(job.origin_client_company_name || job.destination_client_company_name)

  return (
    <article
      aria-labelledby={`job-${job.id}-title`}
      data-jobcard-version="v3-cargo-payload-company-v4"
      className={`group rounded-xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow duration-150 p-3 bg-white ${
        disabled ? 'opacity-75 filter grayscale' : ''
      }`}
      aria-disabled={disabled}
      role="article"
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
          assignmentStatus={authoritativePhase}
          variant={variant}
          actionsVariant={actionsVariant}
          pickupReady={job.pickup_ready ?? undefined}
          disabled={disabled}
        />
      </div>

      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
          expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!expanded}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
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

            {hasCompanyInfo && (
              <div className="mt-4 border-t pt-3 space-y-2">
                {job.origin_client_company_name && (
                  <button
                    type="button"
                    onClick={() =>
                      openCompanyModal(
                        job.origin_client_company_id,
                        job.origin_client_company_name,
                        job.origin_client_company_logo ?? undefined
                      )
                    }
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
                    onClick={() =>
                      openCompanyModal(
                        job.destination_client_company_id,
                        job.destination_client_company_name,
                        job.destination_client_company_logo ?? undefined
                      )
                    }
                    className="flex items-center gap-3 w-full text-left p-0"
                    aria-label={`Open profile for ${job.destination_client_company_name}`}
                  >
                    <CompanyAvatar
                      name={job.destination_client_company_name}
                      logoUrl={job.destination_client_company_logo}
                      size={56}
                    />
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500">Destination client</div>
                      <div className="text-sm font-medium truncate">{job.destination_client_company_name}</div>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="md:col-span-1">
            <MetaBox
              pickup={job.pickup_time}
              deadline={job.delivery_deadline}
              item={job.cargo_item}
              // ✅ use remaining payload for weight display when available
              weight_kg={displayPayloadKg}
              volume_m3={job.volume_m3}
              pallets={job.pallets}
              temperature_control={job.temperature_control}
              hazardous={job.hazardous}
              special_requirements={job.special_requirements}
            />
          </div>

          <RewardsBox
            trailer={rewardTrailer}
            load={rewardLoad}
            modeKey={modeKey}
            onView={onView}
            onAccept={() => onAccept(job)}
            onCancel={() => onCancel?.(job)}
            actionsVariant={actionsVariant}
            job={job}
            disabled={disabled}
          />
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