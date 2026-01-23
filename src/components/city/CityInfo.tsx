/**
 * CityInfo.tsx
 *
 * Small presentational component that loads cached city metadata from the
 * `city_info` Postgres table and renders a compact "Basic info" block used by
 * CityModal and other city-detail views.
 *
 * - Fetches by city_id (UUID) using the existing `getTable` helper to keep
 *   network logic consistent with other DB reads in the app.
 * - Uses a lightweight in-memory cache (per session) to avoid repeated reads.
 * - Renders Region and Population following the existing visual style.
 */

import React, { useEffect, useState } from 'react'
import { getTable } from '../../lib/supabase'

/**
 * CityInfoRow
 *
 * Shape of the minimal fields we read from city_info.
 */
export interface CityInfoRow {
  region?: string | null
  population?: number | null
  country_code?: string | null
  timezone?: string | null
  wiki_summary?: string | null
  thumbnail_url?: string | null
  data?: any | null
}

/**
 * CityInfoProps
 *
 * Props accepted by CityInfo component.
 */
export interface CityInfoProps {
  /** UUID of the city (maps to cities.id) */
  cityId?: string | null
  /** Optional className passed to the wrapper */
  className?: string
}

/**
 * Module-level cache to avoid repeated DB queries during a single session.
 * Keyed by cityId.
 */
const CITY_INFO_CACHE = new Map<string, CityInfoRow | null>()

/**
 * fetchCityInfo
 *
 * Try to read the minimal city_info row for a given cityId.
 *
 * @param cityId - UUID string of the city
 * @returns CityInfoRow or null
 */
async function fetchCityInfo(cityId: string): Promise<CityInfoRow | null> {
  try {
    const q = `?select=region,population,country_code,timezone,wiki_summary,thumbnail_url,data&city_id=eq.${encodeURIComponent(
      cityId,
    )}&limit=1`
    const res = await getTable('city_info', q)
    if (!res || res.status >= 400 || !res.data) return null
    const row = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data
    if (!row) return null
    return {
      region: row.region ?? null,
      population: row.population ?? null,
      country_code: row.country_code ?? null,
      timezone: row.timezone ?? null,
      wiki_summary: row.wiki_summary ?? null,
      thumbnail_url: row.thumbnail_url ?? null,
      data: row.data ?? null,
    }
  } catch {
    return null
  }
}

/**
 * CityInfo
 *
 * Fetches and renders a compact "Basic info" block (Region + Population).
 *
 * @param props - CityInfoProps
 * @returns JSX.Element
 */
export default function CityInfo({ cityId, className = '' }: CityInfoProps) {
  const [loading, setLoading] = useState<boolean>(false)
  const [info, setInfo] = useState<CityInfoRow | null>(null)

  useEffect(() => {
    let mounted = true
    if (!cityId) {
      setInfo(null)
      return
    }

    const cached = CITY_INFO_CACHE.get(cityId)
    if (typeof cached !== 'undefined') {
      setInfo(cached)
      return
    }

    setLoading(true)
    void fetchCityInfo(cityId)
      .then((d) => {
        if (!mounted) return
        CITY_INFO_CACHE.set(cityId, d)
        setInfo(d)
      })
      .catch(() => {
        if (!mounted) return
        CITY_INFO_CACHE.set(cityId, null)
        setInfo(null)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [cityId])

  const populationText =
    loading === true ? 'Loading…' : info?.population != null ? Number(info.population).toLocaleString() : '—'
  const regionText = loading === true ? 'Loading…' : info?.region ?? '—'

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-xs text-slate-500">Basic info</div>

      <div className="mt-2 text-sm text-slate-700 space-y-1">
        <div>
          <span className="text-slate-500">Region</span>
          <span className="ml-2 font-medium">{regionText}</span>
        </div>
        <div>
          <span className="text-slate-500">Population</span>
          <span className="ml-2 font-medium">{populationText}</span>
        </div>
      </div>
    </div>
  )
}