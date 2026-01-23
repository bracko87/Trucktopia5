/**
 * WeatherBadge.tsx
 *
 * Compact weather badge used as a pill (Origin / Destination).
 * Tightened spacing and constrained width so adjacent pills sit closer
 * and the badge does not leave empty space to the right.
 *
 * - Keeps behavior: opens CityModal via global event.
 * - Adds a max-width on the badge and a max-width on the text area so long
 *   names / whitespace do not expand the pill.
 */

import React, { useEffect, useState } from 'react'
import { getTable } from '../../lib/supabase'

/**
 * WeatherData
 *
 * Normalized weather data returned by the component.
 */
export interface WeatherData {
  temp_c?: number | null
  temp_f?: number | null
  condition?: string | null
  icon_url?: string | null
  source?: any
}

/**
 * WeatherBadgeProps
 *
 * Props accepted by WeatherBadge.
 */
export interface WeatherBadgeProps {
  /** City name to query (optional if cityId provided) */
  city?: string | null
  /** Optional UUID city id to query first (preferred) */
  cityId?: string | null
  /** Optional two-letter country code to narrow lookup when using name */
  countryCode?: string | null
  /** Optional label to show above the city (e.g. "Origin") */
  label?: string | null
  /** Optional extra className */
  className?: string
}

/**
 * Module-level cache for weather results to avoid repeated DB calls.
 * Key format: `id::${cityId}` or `name::${city}::${countryCode || ''}`.
 */
const WEATHER_CACHE = new Map<string, WeatherData | null>()

/**
 * fetchWeatherById
 *
 * Try to fetch a weather row by city_id (exact match).
 *
 * @param cityId - city UUID string
 */
async function fetchWeatherById(cityId: string): Promise<WeatherData | null> {
  try {
    const encoded = encodeURIComponent(String(cityId))
    const res = await getTable('city_weather_today', `?select=*&city_id=eq.${encoded}&limit=1`)
    if (!res || res.status >= 400 || !res.data) return null
    const row = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data
    if (!row) return null
    return {
      temp_c: row.temperature ?? row.temp_c ?? row.temperature_c ?? row.temp ?? null,
      temp_f: row.temp_f ?? row.temperature_f ?? null,
      condition: row.condition ?? row.description ?? row.weather ?? null,
      icon_url: row.icon_url ?? row.icon ?? null,
      source: row,
    }
  } catch {
    return null
  }
}

/**
 * fetchWeatherForCityName
 *
 * Fetch a weather row by city name and optional country code.
 *
 * @param city - city name
 * @param countryCode - optional country code
 */
async function fetchWeatherForCityName(city: string, countryCode?: string | null): Promise<WeatherData | null> {
  try {
    const qCity = encodeURIComponent(String(city))
    const countryFilter = countryCode ? `&country_code=eq.${encodeURIComponent(String(countryCode))}` : ''
    const res = await getTable('city_weather_today', `?select=*&city_name=eq.${qCity}${countryFilter}&limit=1`)
    if (!res || res.status >= 400 || !res.data) return null
    const row = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data
    if (!row) return null
    return {
      temp_c: row.temperature ?? row.temp_c ?? row.temperature_c ?? row.temp ?? null,
      temp_f: row.temp_f ?? row.temperature_f ?? null,
      condition: row.condition ?? row.description ?? row.weather ?? null,
      icon_url: row.icon_url ?? row.icon ?? null,
      source: row,
    }
  } catch {
    return null
  }
}

/**
 * WeatherBadge
 *
 * Render a small pill with weather summary. Constrains width so the pill
 * remains compact and doesn't create a large blank area.
 */
export default function WeatherBadge({ city, cityId, countryCode, label, className }: WeatherBadgeProps) {
  const [loading, setLoading] = useState<boolean>(false)
  const [data, setData] = useState<WeatherData | null>(null)

  useEffect(() => {
    let mounted = true
    const key = cityId ? `id::${cityId}` : `name::${(city ?? '').trim()}::${countryCode ?? ''}`

    if (!cityId && !city) {
      setData(null)
      return
    }

    const cached = WEATHER_CACHE.get(key)
    if (typeof cached !== 'undefined') {
      setData(cached)
      return
    }

    setLoading(true)

    const p = (async () => {
      if (cityId) {
        const byId = await fetchWeatherById(cityId)
        if (byId) return byId
        if (city) return await fetchWeatherForCityName(city, countryCode)
        return null
      } else {
        return await fetchWeatherForCityName(city as string, countryCode)
      }
    })()

    void p
      .then((d) => {
        if (!mounted) return
        WEATHER_CACHE.set(key, d)
        setData(d)
      })
      .catch(() => {
        if (!mounted) return
        WEATHER_CACHE.set(key, null)
        setData(null)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [city, cityId, countryCode])

  /**
   * emojiForCondition
   *
   * Simple emoji fallback for weather icons.
   *
   * @param cond - textual condition
   */
  function emojiForCondition(cond?: string | null) {
    if (!cond) return '🌤'
    const s = cond.toLowerCase()
    if (s.includes('rain')) return '🌧'
    if (s.includes('shower')) return '🌦'
    if (s.includes('storm') || s.includes('thunder')) return '⛈'
    if (s.includes('snow')) return '❄️'
    if (s.includes('cloud')) return '☁️'
    if (s.includes('clear') || s.includes('sun') || s.includes('sunny')) return '☀️'
    return '🌤'
  }

  /**
   * onOpenCity
   *
   * Dispatch global event used by CityModal to open the modal for this city.
   *
   * @param ev - optional UI event
   */
  function onOpenCity(ev?: React.SyntheticEvent) {
    try {
      ev?.preventDefault()
      window.dispatchEvent(
        new CustomEvent('open-city-modal', {
          detail: { cityId: cityId ?? undefined, cityName: city ?? undefined },
        }),
      )
    } catch {
      // ignore (non-browser)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenCity}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenCity()
        }
      }}
      title={city ?? 'City weather'}
      aria-label={city ? `Open weather for ${city}` : 'Open city weather'}
      /* Tight spacing + constrained width to avoid extra blank space */
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-100 text-xs shadow-sm ${className ?? ''} cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-200 max-w-[170px] overflow-hidden`}
    >
      <div className="flex flex-col">
        {label ? <div className="text-[10px] text-slate-400 leading-none">{label}</div> : null}
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            {loading ? (
              <span className="text-slate-400 text-sm">…</span>
            ) : data?.icon_url ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img src={data.icon_url} className="w-5 h-5 object-cover rounded" />
            ) : (
              <span className="text-base leading-none">{emojiForCondition(data?.condition)}</span>
            )}
          </div>

          {/* limit text width so the badge stays compact */}
          <div className="min-w-0 max-w-[110px] overflow-hidden">
            <div className="text-[11px] font-medium text-slate-800 leading-tight truncate">{city ?? '—'}</div>
            <div className="text-[11px] text-slate-500 leading-tight truncate">
              {loading
                ? 'Loading…'
                : data
                ? `${data.temp_c != null ? `${Math.round(data.temp_c)}°C` : data.temp_f != null ? `${Math.round(data.temp_f)}°F` : '—'} · ${data.condition ?? '—'}`
                : 'No data'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
