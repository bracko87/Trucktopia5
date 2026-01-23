/**
 * CityModal.tsx
 *
 * Global modal component that shows a lightweight city "page" with:
 * - basic city info (from public.cities)
 * - today's weather (from public.city_weather_today)
 * - a compact horizontal forecast (from public.city_weather_forecast or similar)
 * - list of client companies located in the city (from public.client_companies)
 *
 * The modal listens for a global CustomEvent "open-city-modal" with
 * detail: { cityId?: string, cityName?: string }
 *
 * This file is split into small presentational subcomponents for clarity.
 */

import React, { useEffect, useState } from 'react'
import {
  X,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  Wind,
} from 'lucide-react'
import { getTable } from '../../lib/supabase'

/**
 * CityRow
 *
 * Minimal normalized city info used by the modal.
 */
export interface CityRow {
  id: string
  city_name?: string | null
  country?: string | null
  country_code?: string | null
  population?: number | null
  region?: string | null
  [key: string]: any
}

/**
 * WeatherRow
 *
 * Normalized weather shape used in this modal.
 */
export interface WeatherRow {
  temp_c?: number | null
  condition?: string | null
  icon_url?: string | null
  dateRaw?: any
  source?: any
}

/**
 * CompanyRow
 *
 * Minimal client company shape shown in the city modal.
 */
export interface CompanyRow {
  id: string
  name?: string | null
  logo?: string | null
  city?: string | null
  country?: string | null
}

/**
 * CityInfoRecord
 *
 * Minimal cached city_info fields we pull from the city_info table.
 */
interface CityInfoRecord {
  wiki_summary?: string | null
  thumbnail_url?: string | null
  region?: string | null
  population?: number | null
}

/**
 * FlagChip
 *
 * Small presentational flag chip with fallback emoji.
 *
 * @param code - ISO alpha-2 code
 * @param alt - accessible alt/title
 * @param size - px height
 */
function FlagChip({ code, alt = '', size = 18 }: { code?: string | null; alt?: string; size?: number }) {
  const initial = (() => {
    if (!code) return null
    const cc = String(code).trim().toLowerCase()
    if (cc.length !== 2) return null
    return `https://flagcdn.com/w40/${cc}.png`
  })()
  const [src, setSrc] = useState<string | null>(initial)
  const [triedAlt, setTriedAlt] = useState(false)

  /**
   * onError - try an alternate flag-host and then fallback to emoji
   */
  function onError() {
    if (!triedAlt && src) {
      const cc = String(code || '').trim().toLowerCase()
      if (cc.length === 2) {
        setSrc(`https://flagpedia.net/data/flags/icon/72x54/${cc}.png`)
        setTriedAlt(true)
        return
      }
    }
    setSrc(null)
  }

  /**
   * toEmoji - render regional indicator symbol fallback
   */
  function toEmoji(c?: string | null) {
    if (!c) return '🌍'
    const cc = String(c).trim().toUpperCase()
    if (cc.length !== 2) return '🌍'
    return cc.split('').map((ch) => String.fromCodePoint(127397 + ch.charCodeAt(0))).join('')
  }

  const height = Math.max(12, Math.floor(size))
  const width = Math.max(16, Math.round((height * 16) / 9))

  return (
    <div aria-hidden title={alt || code || 'Country'} className="overflow-hidden rounded-sm bg-white border border-slate-100 shadow-sm flex items-center justify-center" style={{ width, height }}>
      {src ? (
        // small decorative image
        // eslint-disable-next-line jsx-a11y/alt-text
        <img src={src} className="w-full h-full object-cover block" onError={onError} />
      ) : (
        <span style={{ fontSize: Math.max(10, Math.floor(height * 0.6)), lineHeight: 1 }}>{toEmoji(code)}</span>
      )}
    </div>
  )
}

/**
 * CompanyRowView
 *
 * Render a compact company entry.
 *
 * @param c - company row
 */
function CompanyRowView({ c }: { c: CompanyRow }) {
  const initials = (c.name || 'C').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 transition">
      <div className="w-10 h-10 rounded-full bg-white border border-slate-100 overflow-hidden flex items-center justify-center">
        {c.logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img src={c.logo} className="w-full h-full object-cover block" />
        ) : (
          <span className="font-semibold text-slate-700">{initials}</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{c.name ?? 'Company'}</div>
        <div className="text-xs text-slate-500 truncate">{c.city ?? ''}{c.country ? ` · ${c.country}` : ''}</div>
      </div>
    </div>
  )
}

/**
 * IconForCondition
 *
 * Map a normalized condition string to a lucide-react icon.
 *
 * @param cond - textual condition
 * @param iconUrl - optional external icon url
 */
function IconForCondition(cond?: string | null, iconUrl?: string | null) {
  if (iconUrl) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img src={iconUrl} className="w-8 h-8 object-cover rounded-md" />
  }
  const s = (cond || '').toLowerCase()
  if (s.includes('snow') || s.includes('blizzard')) return <CloudSnow className="w-6 h-6 text-sky-500" />
  if (s.includes('sleet')) return <CloudSnow className="w-6 h-6 text-sky-500" />
  if (s.includes('storm') || s.includes('thunder') || s.includes('thunderstorm')) return <CloudLightning className="w-6 h-6 text-violet-600" />
  if (s.includes('drizzle')) return <CloudDrizzle className="w-6 h-6 text-sky-400" />
  if (s.includes('rain') || s.includes('shower')) return <CloudRain className="w-6 h-6 text-sky-500" />
  if (s.includes('cloud') || s.includes('overcast')) return <Cloud className="w-6 h-6 text-slate-400" />
  if (s.includes('wind') || s.includes('breeze')) return <Wind className="w-6 h-6 text-slate-500" />
  if (s.includes('clear') || s.includes('sun') || s.includes('sunny')) return <Sun className="w-6 h-6 text-amber-400" />
  return <Sun className="w-6 h-6 text-amber-400" />
}

/**
 * ForecastCard
 *
 * Small presentational card used inside the horizontal forecast row.
 *
 * @param f - WeatherRow
 * @param idx - index for date fallback
 */
function ForecastCard({ f, idx }: { f: WeatherRow; idx: number }) {
  /**
   * pickDate
   *
   * Resolve a JS Date for this forecast entry. The forecast row may
   * contain various timestamp keys (date, dt, valid_at, timestamp).
   * If none are present we fallback to today + index days.
   *
   * @param raw - original raw value (string|number|null)
   * @param idx - index fallback offset
   * @returns Date
   */
  function pickDate(raw: any, idx: number) {
    try {
      if (!raw) return new Date(Date.now() + idx * 24 * 60 * 60 * 1000)
      const maybe = typeof raw === 'number' ? new Date(raw) : new Date(String(raw))
      if (!isNaN(maybe.getTime())) return maybe
    } catch {
      /* ignore */
    }
    return new Date(Date.now() + idx * 24 * 60 * 60 * 1000)
  }

  /**
   * formatForecastDate
   *
   * Format the date for display: short weekday and numeric day/month.
   *
   * @param d - Date
   */
  function formatForecastDate(d: Date) {
    const day = d.toLocaleDateString(undefined, { weekday: 'short' })
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return { day, date }
  }

  const d = pickDate((f as any).dateRaw ?? (f as any).dt ?? (f as any).timestamp ?? (f as any).valid_at ?? null, idx)
  const { day, date } = formatForecastDate(d)

  return (
    <div className="min-w-[88px] bg-white/80 backdrop-blur-sm rounded-md p-2 flex-shrink-0 flex flex-col items-center gap-1 text-center border border-slate-100 shadow-sm">
      <div className="text-[11px] text-slate-500">{day}</div>
      <div className="text-[11px] text-slate-400 -mt-1">{date}</div>
      <div className="my-1">{IconForCondition(f.condition, f.icon_url)}</div>
      <div className="font-medium text-sm">{f.temp_c != null ? `${Math.round(f.temp_c)}°C` : '—'}</div>
      <div className="text-xs text-slate-500 truncate max-w-[84px]">{f.condition ?? '—'}</div>
    </div>
  )
}

/**
 * CityModal
 *
 * Global component mounted once at app root. Listens for "open-city-modal"
 * CustomEvent and loads data for the requested city.
 */
export default function CityModal() {
  const [open, setOpen] = useState(false)
  const [cityId, setCityId] = useState<string | undefined>(undefined)
  const [cityName, setCityName] = useState<string | undefined>(undefined)

  const [city, setCity] = useState<CityRow | null>(null)
  const [weather, setWeather] = useState<WeatherRow | null>(null)
  const [forecast, setForecast] = useState<WeatherRow[] | null>(null)
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null)

  /**
   * cityInfo
   *
   * Cached richer info from the city_info table: wiki summary and thumbnail
   */
  const [cityInfo, setCityInfo] = useState<CityInfoRecord | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Thumbnail image runtime state and debug fields:
   * - thumbnailSrc: the actual <img> src we render (may use proxy fallback)
   * - thumbTriedAlt: whether we've attempted an alternate host/proxy
   * - thumbError: user-visible message when image fails to load
   */
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null)
  const [thumbTriedAlt, setThumbTriedAlt] = useState(false)
  const [thumbError, setThumbError] = useState<string | null>(null)

  useEffect(() => {
    /**
     * onOpen - handle the global event to open the modal for a city
     *
     * @param e - CustomEvent with detail {cityId?, cityName?}
     */
    function onOpen(e: any) {
      const d = e?.detail || {}
      setCityId(d.cityId ?? undefined)
      setCityName(d.cityName ?? undefined)
      setOpen(true)
    }
    window.addEventListener('open-city-modal', onOpen)
    return () => window.removeEventListener('open-city-modal', onOpen)
  }, [])

  useEffect(() => {
    let mounted = true

    /**
     * normalizeText
     *
     * Remove diacritics for a more robust ilike lookup.
     *
     * @param s - input string
     * @returns normalized string
     */
    function normalizeText(s: string) {
      try {
        return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      } catch {
        return s
      }
    }

    /**
     * fetchCityInfo
     *
     * Try to read wiki_summary and thumbnail_url for a city from city_info.
     * Uses city_id first, then falls back to city_name lookup when available.
     *
     * This version is more robust:
     * - tries exact match, then ilike partial match
     * - tries normalized (no diacritics) ilike as a last resort
     * - logs the fetched wiki_summary length for debug
     *
     * @param idToUse - city UUID or undefined
     * @param cityName - fallback city name
     */
    async function fetchCityInfo(idToUse?: string | null, cityName?: string | null) {
      try {
        let infoRes: any = null

        // 1) Try direct id match
        if (idToUse) {
          infoRes = await getTable('city_info', `?select=wiki_summary,thumbnail_url,region,population&city_id=eq.${encodeURIComponent(idToUse)}&limit=1`)
        }

        // 2) If no result by id, try exact city_name match
        if ((!infoRes || infoRes.status >= 400 || !infoRes.data || infoRes.data.length === 0) && (cityName || city?.city_name)) {
          const qName = encodeURIComponent(String(cityName ?? city?.city_name ?? ''))
          infoRes = await getTable('city_info', `?select=wiki_summary,thumbnail_url,region,population&city_name=eq.${qName}&limit=1`)
        }

        // 3) If still nothing, try case-insensitive partial match (ilike)
        if ((!infoRes || infoRes.status >= 400 || !infoRes.data || infoRes.data.length === 0) && (cityName || city?.city_name)) {
          const rawName = String(cityName ?? city?.city_name ?? '').trim()
          if (rawName.length > 0) {
            const qLike = encodeURIComponent(`%${rawName}%`)
            infoRes = await getTable('city_info', `?select=wiki_summary,thumbnail_url,region,population&city_name=ilike.${qLike}&limit=1`)
          }
        }

        // 4) Last resort: normalized (no diacritics) partial match
        if ((!infoRes || infoRes.status >= 400 || !infoRes.data || infoRes.data.length === 0) && (cityName || city?.city_name)) {
          const rawName = String(cityName ?? city?.city_name ?? '').trim()
          const norm = normalizeText(rawName)
          if (norm && norm !== rawName) {
            const qLikeNorm = encodeURIComponent(`%${norm}%`)
            infoRes = await getTable('city_info', `?select=wiki_summary,thumbnail_url,region,population&city_name=ilike.${qLikeNorm}&limit=1`)
          }
        }

        const infoRow = infoRes && infoRes.data && Array.isArray(infoRes.data) ? infoRes.data[0] ?? null : null
        if (mounted) {
          const normalized = infoRow
            ? {
                wiki_summary: infoRow.wiki_summary ?? null,
                thumbnail_url: infoRow.thumbnail_url ?? null,
                region: infoRow.region ?? null,
                population: infoRow.population ?? null,
              }
            : null

          // Debug: log the fetched city_info and wiki_summary length for inspection in the browser console.
          // Helps verify we're getting the full wiki_summary text from the DB.
          // eslint-disable-next-line no-console
          console.debug('CityModal: fetched city_info ->', normalized)
          // eslint-disable-next-line no-console
          console.debug('CityModal: wiki_summary length ->', normalized?.wiki_summary ? normalized.wiki_summary.length : 0)

          setCityInfo(normalized)

          // Initialize thumbnail runtime fields
          setThumbnailSrc(normalized?.thumbnail_url ?? null)
          setThumbTriedAlt(false)
          setThumbError(null)
        }
      } catch (err) {
        if (mounted) {
          setCityInfo(null)
          setThumbnailSrc(null)
          setThumbError(null)
        }
      }
    }

    async function loadAll() {
      setError(null)
      setCity(null)
      setWeather(null)
      setForecast(null)
      setCompanies(null)
      setCityInfo(null)
      setThumbnailSrc(null)
      setThumbTriedAlt(false)
      setThumbError(null)

      if (!open) return
      setLoading(true)

      try {
        // 1) Load city info by id or name
        let cityRes: any = null
        if (cityId) {
          cityRes = await getTable('cities', `?select=*&id=eq.${encodeURIComponent(cityId)}&limit=1`)
        } else if (cityName) {
          cityRes = await getTable('cities', `?select=*&city_name=eq.${encodeURIComponent(cityName)}&limit=1`)
        }

        const cityRow = cityRes && cityRes.data && Array.isArray(cityRes.data) ? cityRes.data[0] ?? null : null
        if (mounted) setCity(cityRow)

        const idToUse = (cityRow && cityRow.id) || cityId

        // 2) Load today's weather (prefer city_id lookup)
        let weatherRow: any = null
        if (idToUse) {
          weatherRow = await getTable('city_weather_today', `?select=*&city_id=eq.${encodeURIComponent(idToUse)}&limit=1`)
        }
        if ((!weatherRow || weatherRow.status >= 400 || !weatherRow.data || weatherRow.data.length === 0) && (cityRow?.city_name || cityName)) {
          const qName = encodeURIComponent(String(cityRow?.city_name ?? cityName ?? ''))
          const countryFilter = cityRow?.country_code ? `&country_code=eq.${encodeURIComponent(cityRow.country_code)}` : ''
          weatherRow = await getTable('city_weather_today', `?select=*&city_name=eq.${qName}${countryFilter}&limit=1`)
        }
        const w = weatherRow && weatherRow.data && Array.isArray(weatherRow.data) ? weatherRow.data[0] ?? null : null
        if (mounted) setWeather(w ? { temp_c: w.temperature ?? w.temp_c ?? null, condition: w.condition ?? w.description ?? null, icon_url: w.icon_url ?? null, source: w } : null)

        // 3) Attempt to fetch a small forecast (best-effort)
        try {
          let fRes: any = null
          if (idToUse) {
            fRes = await getTable('city_weather_forecast', `?select=*&city_id=eq.${encodeURIComponent(idToUse)}&limit=7`)
          }
          if ((!fRes || fRes.status >= 400 || !fRes.data || fRes.data.length === 0) && (cityRow?.city_name || cityName)) {
            const qName = encodeURIComponent(String(cityRow?.city_name ?? cityName ?? ''))
            fRes = await getTable('city_weather_forecast', `?select=*&city_name=eq.${qName}&limit=7`)
          }
          if (fRes && fRes.data && Array.isArray(fRes.data) && mounted) {
            const mapped = fRes.data.map((r: any) => ({
              temp_c: r.temperature ?? r.temp_c ?? null,
              condition: r.condition ?? r.description ?? null,
              icon_url: r.icon_url ?? r.icon ?? null,
              dateRaw: r.date ?? r.dt ?? r.timestamp ?? r.valid_at ?? null,
              source: r,
            }))
            setForecast(mapped)
          } else {
            // fallback: build a tiny forecast from today weather when forecast table missing
            if (w && mounted) {
              const fallback = Array.from({ length: 5 }).map((_, i) => ({
                temp_c: w.temp_c ?? (w.temp ?? null),
                condition: w.condition ?? null,
                icon_url: w.icon_url ?? null,
                dateRaw: Date.now() + i * 24 * 60 * 60 * 1000,
              }))
              setForecast(fallback)
            }
          }
        } catch {
          // ignore forecast failures
        }

        /**
         * Fetch client companies for the city.
         *
         * Strategy:
         *  - try exact city_id match
         *  - try exact city name match
         *  - try case-insensitive partial match (ilike) for robustness
         *  - if available, include country filter as a further fallback
         */
        try {
          let compRes: any = null
          const baseSelect = '?select=id,name,logo,city,country&limit=50'

          // 1) Prefer city_id when available
          if (idToUse) {
            compRes = await getTable('client_companies', `${baseSelect}&city_id=eq.${encodeURIComponent(idToUse)}`)
          }

          // 2) If no results by id, try by city name (exact), then ilike (partial, case-insensitive)
          if ((!compRes || compRes.status >= 400 || !compRes.data || compRes.data.length === 0) && (cityRow?.city_name || cityName)) {
            const nameRaw = String(cityRow?.city_name ?? cityName ?? '').trim()
            const qNameEq = encodeURIComponent(nameRaw)
            const qNameLike = encodeURIComponent(`%${nameRaw}%`)

            // try exact match first
            compRes = await getTable('client_companies', `${baseSelect}&city=eq.${qNameEq}`)

            // try partial case-insensitive match if exact returned nothing
            if ((!compRes || compRes.status >= 400 || !compRes.data || compRes.data.length === 0)) {
              compRes = await getTable('client_companies', `${baseSelect}&city=ilike.${qNameLike}`)
            }

            // lastly, if country is available try to narrow by country
            if ((!compRes || compRes.status >= 400 || !compRes.data || compRes.data.length === 0) && (cityRow?.country || cityRow?.country_code)) {
              const countryVal = encodeURIComponent(cityRow?.country ?? cityRow?.country_code ?? '')
              compRes = await getTable('client_companies', `${baseSelect}&city=ilike.${qNameLike}&country=eq.${countryVal}`)
            }
          }

          // 3) Normalise and set companies
          if (compRes && compRes.data && Array.isArray(compRes.data) && mounted) {
            const mapped = compRes.data.map((r: any) => ({ id: r.id, name: r.name, logo: r.logo, city: r.city, country: r.country })) as CompanyRow[]
            setCompanies(mapped)
          }
        } catch {
          // ignore companies errors
        }

        // 4) Fetch cached city_info (wiki summary + thumbnail) - best-effort
        try {
          await fetchCityInfo(idToUse, cityRow?.city_name ?? cityName ?? undefined)
        } catch {
          // ignore
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Failed to load city data')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadAll()
    return () => {
      mounted = false
    }
  }, [open, cityId, cityName])

  /**
   * onThumbnailError
   *
   * Handle <img> load error for the thumbnail.
   * - attempts one proxy fallback (images.weserv.nl) once,
   * - if fallback fails we mark thumbError and stop trying.
   */
  function onThumbnailError() {
    if (!thumbnailSrc) return
    if (!thumbTriedAlt) {
      // Try a simple proxy fallback: images.weserv.nl
      // This helps around some hotlinking / CORS / referrer-blocking cases.
      try {
        const cleaned = thumbnailSrc.replace(/^https?:\/\//, '')
        const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(cleaned)}`
        setThumbTriedAlt(true)
        setThumbnailSrc(proxied)
        // eslint-disable-next-line no-console
        console.debug('CityModal: thumbnail failed, trying proxy ->', proxied)
        return
      } catch {
        // fallthrough to final error
      }
    }
    // final fallback: mark error and clear thumbnailSrc so placeholder is shown
    setThumbError('Image failed to load. Click the link below to open the original URL.')
    setThumbnailSrc(null)
    // eslint-disable-next-line no-console
    console.warn('CityModal: thumbnail image failed to load for', cityInfo?.thumbnail_url)
  }

  if (!open) return null

  const displayName = city?.city_name ?? cityName ?? 'City'

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

      <div className="relative z-10 w-full max-w-3xl mx-4 bg-white rounded-lg shadow-lg border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-lg font-semibold truncate">{displayName}</div>
            {city?.country_code ? <div className="ml-2"><FlagChip code={city.country_code} alt={city.country ?? undefined} size={18} /></div> : null}
            {city?.country ? <div className="text-sm text-slate-500 ml-2">{city.country}</div> : null}
          </div>

          <button type="button" onClick={() => setOpen(false)} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Main content grid */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 space-y-3">
            <div>
              <div className="text-xs text-slate-500">Basic info</div>
              <div className="mt-2 text-sm text-slate-700 space-y-1">
                <div>
                  <span className="text-slate-500">Region</span>
                  <span className="ml-2 font-medium">{cityInfo?.region ?? city?.region ?? '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Population</span>
                  <span className="ml-2 font-medium">
                    {cityInfo?.population != null
                      ? Number(cityInfo.population).toLocaleString()
                      : city?.population != null
                      ? Number(city.population).toLocaleString()
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Today</div>
              <div className="mt-2">
                {loading ? <div className="text-sm text-slate-500">Loading…</div> : weather ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-white rounded-md border border-slate-100">
                      {weather.icon_url ? (<img src={weather.icon_url} className="w-8 h-8 object-cover rounded" alt="icon" />) : IconForCondition(weather.condition, undefined)}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{weather.temp_c != null ? `${Math.round(weather.temp_c)}°C` : '—'}</div>
                      <div className="text-xs text-slate-500">{weather.condition ?? '—'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No weather data</div>
                )}
              </div>
            </div>

            {/* Companies list (keeps in left column) */}
            <div>
              <div className="text-xs text-slate-500">Companies</div>
              <div className="mt-2 space-y-1 max-h-[220px] overflow-auto">
                {companies && companies.length > 0 ? companies.map((c) => <CompanyRowView key={c.id} c={c} />) : <div className="text-sm text-slate-500">No companies found</div>}
              </div>
            </div>
          </div>

          {/* Details column: show wiki summary + thumbnail (from city_info table) */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-xs text-slate-500">Details</div>
            <div className="mt-2 text-sm text-slate-700 space-y-3">
              {loading ? (
                <div className="text-sm text-slate-500">Loading…</div>
              ) : (
                <>
                  {thumbnailSrc ? (
                    <div className="w-full rounded-md overflow-hidden border border-slate-100 shadow-sm">
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <img src={thumbnailSrc} alt={`${displayName} thumbnail`} className="w-full h-48 object-cover block" onError={onThumbnailError} />
                    </div>
                  ) : cityInfo?.thumbnail_url ? (
                    <div className="text-sm text-slate-500">Thumbnail blocked or failed to load. See link below.</div>
                  ) : null}

                  {/* Show raw thumbnail URL and a clickable link for debugging/opening in new tab */}
                  {cityInfo?.thumbnail_url ? (
                    <div className="text-xs text-slate-400 break-all">
                      <a href={cityInfo.thumbnail_url} target="_blank" rel="noreferrer" className="underline">
                        Open original thumbnail
                      </a>
                      <div className="mt-1 text-[12px] text-slate-400 break-all">{cityInfo.thumbnail_url}</div>
                      {thumbError ? <div className="mt-1 text-xs text-rose-600">{thumbError}</div> : null}
                    </div>
                  ) : null}

                  <div className="text-sm text-slate-700">
                    {cityInfo?.wiki_summary ? (
                      <div className="whitespace-pre-wrap leading-relaxed text-sm text-slate-700 max-h-72 overflow-auto">
                        {cityInfo.wiki_summary}
                      </div>
                    ) : (
                      '—'
                    )}
                  </div>

                </>
              )}
            </div>
          </div>
        </div>

        {/* Forecast: render full width of the popup window below the grid */}
        <div className="px-4 pb-4">
          <div className="text-xs text-slate-500">Forecast</div>
          <div className="mt-2">
            {!forecast || forecast.length === 0 ? (
              <div className="text-sm text-slate-500">No forecast</div>
            ) : (
              <div className="mt-2">
                <div className="flex gap-3 overflow-x-auto py-2 -mx-4 px-4">
                  {forecast.map((f, i) => <ForecastCard key={i} f={f} idx={i} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
