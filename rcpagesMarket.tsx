/**
 * Market.tsx
 *
 * Market page showing available job offers with filters, pagination and accept flow.
 *
 * Notes:
 * - Keeps original layout and behavior.
 * - Normalizes country codes to lowercase throughout to avoid mismatches between
 *   hub resolution (which may return lowercase codes) and job data (which can be uppercase).
 * - Ensures filters.country is set to the normalized hub country.
 *
 * Fix included:
 * - Accepted jobs are hidden immediately AND stay hidden after refresh by:
 *   1) Persisting accepted job ids in localStorage
 *   2) Keeping them in React state (instant UI update)
 *   3) Filtering them out inside filteredSortedJobs (render-time filtering)
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import FilterBar, { MarketFilters } from '../components/market/FilterBar'
import CountrySelect, { CitySelect } from '../components/market/CountryCitySelect'
import SavedHubControl from '../components/market/SavedHubControl'
import JobCard, { JobRow } from '../components/market/JobCard'
import AcceptModal from '../components/market/AcceptModal'
import { useAuth } from '../context/AuthContext'
import { Filter } from 'lucide-react'
import { getCountryName } from '../lib/countryNames'
import { supabase } from '../lib/supabase'

/**
 * Market API constants
 * NOTE: In production move anon key to a secure environment variable.
 */
const MARKET_API_BASE = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'
const MARKET_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

/**
 * MarketPagination
 *
 * Small, local pagination control used by the Market page.
 */
function MarketPagination({
  current,
  totalPages,
  onChange,
}: {
  current: number
  totalPages: number
  onChange: (p: number) => void
}) {
  if (!totalPages || totalPages <= 1) return null
  const goto = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages)
    if (next !== current) onChange(next)
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => goto(1)}
        disabled={current <= 1}
        className="px-2 py-1 border rounded bg-slate-50 text-sm disabled:opacity-50"
      >
        First
      </button>
      <button
        type="button"
        onClick={() => goto(current - 1)}
        disabled={current <= 1}
        className="px-2 py-1 border rounded bg-slate-50 text-sm disabled:opacity-50"
      >
        Prev
      </button>
      <select
        aria-label="Select page"
        value={String(current)}
        onChange={(e) => goto(Number(e.target.value))}
        className="px-2 py-1 border rounded bg-white text-sm"
      >
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => goto(current + 1)}
        disabled={current >= totalPages}
        className="px-2 py-1 border rounded bg-slate-50 text-sm disabled:opacity-50"
      >
        Next
      </button>
      <button
        type="button"
        onClick={() => goto(totalPages)}
        disabled={current >= totalPages}
        className="px-2 py-1 border rounded bg-slate-50 text-sm disabled:opacity-50"
      >
        Last
      </button>
    </div>
  )
}

/**
 * pickStringJob
 *
 * Pick a human-friendly string from a related object.
 */
function pickStringJob(obj: any): string | null {
  if (!obj) return null
  return obj.name ?? obj.title ?? obj.label ?? obj.display_name ?? obj.item_name ?? obj.type ?? obj.description ?? null
}

/**
 * pickLogoJob
 *
 * Pick a likely logo/image url field from a related object.
 */
function pickLogoJob(obj: any): string | null {
  if (!obj) return null
  return obj.logo ?? obj.logo_url ?? obj.image_url ?? obj.icon_url ?? null
}

/**
 * shouldRetryWithoutRemainingPayload
 *
 * Detect PostgREST 42703 errors caused by selecting a non-existent
 * remaining_payload column on active_job_offers_ui.
 */
function shouldRetryWithoutRemainingPayload(status: number, bodyText: string): boolean {
  if (status !== 400) return false
  const t = String(bodyText ?? '').toLowerCase()
  return t.includes('42703') && t.includes('remaining_payload')
}

/**
 * stripRemainingPayloadFromEncodedSelect
 *
 * Remove `remaining_payload` from an encoded PostgREST select expression.
 */
function stripRemainingPayloadFromEncodedSelect(encodedSelect: string): string {
  const decoded = decodeURIComponent(encodedSelect)
  const cleaned = decoded.replace(/,remaining_payload(?=,|$)/g, '').replace(/remaining_payload,(?=[^)]*$)/g, '')
  return encodeURIComponent(cleaned)
}

/**
 * fetchJobs
 *
 * Fetch job_offers rows (public select) in batches to avoid server-side response caps.
 */
async function fetchJobs(): Promise<JobRow[]> {
  const select =
    '*,origin_city:origin_city_id(city_name,country_code),' +
    'destination_city:destination_city_id(city_name,country_code),' +
    'origin_company:origin_client_company_id(id,name,logo),' +
    'destination_company:destination_client_company_id(id,name,logo),' +
    'cargo_type_obj:cargo_type_id(*),' +
    'cargo_item_obj:cargo_item_id(*)'

  const fields = [
    'weight_kg',
    'volume_m3',
    'pallets',
    'temperature_control',
    'hazardous',
    'special_requirements',
    'currency',
    'transport_mode',
    'pickup_time',
    'delivery_deadline',
    'destination',
    'job_offer_type_code',
    'origin_city_id',
    'destination_city_id',
    'reward_trailer_cargo',
    'reward_load_cargo',
    'created_at',
    'id',
  ]

  const encodedSelect = encodeURIComponent(select + ',' + fields.join(','))
  const BATCH_SIZE = 1000
  const MAX_PAGES = 50
  let offset = 0
  const allJobs: JobRow[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${MARKET_API_BASE}/rest/v1/active_job_offers_ui?select=${encodedSelect}&limit=${BATCH_SIZE}&offset=${offset}`

    const res = await fetch(url, {
      headers: {
        apikey: MARKET_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${MARKET_SUPABASE_ANON_KEY}`,
      },
    })

    let data: any[] = []
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      if (shouldRetryWithoutRemainingPayload(res.status, txt)) {
        const fallbackSelect = stripRemainingPayloadFromEncodedSelect(encodedSelect)
        const fallbackUrl = `${MARKET_API_BASE}/rest/v1/active_job_offers_ui?select=${fallbackSelect}&limit=${BATCH_SIZE}&offset=${offset}`
        const fallbackRes = await fetch(fallbackUrl, {
          headers: {
            apikey: MARKET_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${MARKET_SUPABASE_ANON_KEY}`,
          },
        })
        if (!fallbackRes.ok) {
          const fallbackTxt = await fallbackRes.text().catch(() => '')
          throw new Error(`Failed to fetch jobs (page ${page}, offset ${offset}): ${fallbackRes.status} ${fallbackTxt}`)
        }
        data = await fallbackRes.json().catch(() => [])
      } else {
        throw new Error(`Failed to fetch jobs (page ${page}, offset ${offset}): ${res.status} ${txt}`)
      }
    } else {
      data = await res.json()
    }

    if (!Array.isArray(data) || data.length === 0) break

    const mapped = (data as any[]).map((j) => {
      const cargoTypeName = pickStringJob(j.cargo_type_obj)
      const cargoItemName = pickStringJob(j.cargo_item_obj)

      const originCompany = j.origin_company ?? null
      const destinationCompany = j.destination_company ?? null

      return {
        ...j,
        origin_city_name: j.origin_city?.city_name ?? null,
        destination_city_name: j.destination_city?.city_name ?? null,
        origin_country_code: j.origin_city?.country_code ?? null,
        destination_country_code: j.destination_city?.country_code ?? null,
        cargo_type: cargoTypeName ?? null,
        cargo_item: cargoItemName ?? null,
        weight_kg: j.weight_kg ?? null,
        remaining_pay