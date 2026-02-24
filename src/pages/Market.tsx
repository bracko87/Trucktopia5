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
 * Changes made:
 * - confirmAccept now allows nullable truck from resolver path (no hard fail when no truck).
 * - Carrier company resolution now receives resolved truckId (nullable) for fallback resolution.
 * - Accept flow computes payload client-side:
 *   - truck -> assign payload up to capacity
 *   - no truck -> assign 0 payload (remaining stays the same)
 * - Force pre-dispatch status to "assigned" always (per catalog/state machine).
 *   // Keep accepted market jobs in the "assigned" lane so they appear in Waiting/Staging
 *   // even when truck is attached later in staging.
 * - Inserts job assignment with nullable user_truck_id and patches job offer accordingly.
 * - Adds backend policy error mapping for job_assignments_truck_required.
 * - AcceptModal binding updated to call confirmAccept with no arguments.
 *
 * Mandatory Sider.ai alignment (2026-02-23 20:50 UTC):
 * - resolveAcceptTruckId keeps ownership buckets:
 *   owner_user_auth_id, owner_user_id (auth/public), owner_company_id
 * - adds fallback ranking strategy:
 *   prefer active-ish trucks by capacity + newest, but if all are inactive/maintenance/disabled,
 *   still return the best truck to satisfy backend job_assignments_truck_required.
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
        remaining_payload: j.remaining_payload ?? j.weight_kg ?? null,
        volume_m3: j.volume_m3 ?? null,
        pallets: j.pallets ?? null,
        temperature_control: j.temperature_control ?? false,
        hazardous: j.hazardous ?? false,
        special_requirements: j.special_requirements ?? null,
        currency: j.currency ?? null,
        transport_mode: j.transport_mode ?? null,
        origin_client_company_id: originCompany?.id ?? null,
        origin_client_company_name: originCompany?.name ?? null,
        origin_client_company_logo: pickLogoJob(originCompany),
        destination_client_company_id: destinationCompany?.id ?? null,
        destination_client_company_name: destinationCompany?.name ?? null,
        destination_client_company_logo: pickLogoJob(destinationCompany),
        reward_trailer_cargo: j.reward_trailer_cargo ?? null,
        reward_load_cargo: j.reward_load_cargo ?? null,
        job_offer_type_code: j.job_offer_type_code ?? null,
        origin_city_id: j.origin_city_id ?? null,
        destination_city_id: j.destination_city_id ?? null,
        destination_text: j.destination ?? null,
      } as JobRow
    })

    allJobs.push(...mapped)

    if (data.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  return allJobs
}

/**
 * resolveTruckPayloadCapacity
 *
 * Query user_trucks for a single numeric capacity field (model_max_load_kg)
 * and return it when available. Falls back to null on any error.
 */
async function resolveTruckPayloadCapacity(truckId: string | null | undefined, authorization: string): Promise<number | null> {
  if (!truckId) return null
  try {
    const url = `${MARKET_API_BASE}/rest/v1/user_trucks?id=eq.${encodeURIComponent(truckId)}&select=model_max_load_kg&limit=1`
    const res = await fetch(url, {
      headers: {
        apikey: MARKET_SUPABASE_ANON_KEY,
        Authorization: authorization,
      },
    })
    if (!res.ok) return null
    const rows = await res.json().catch(() => null)
    const row = Array.isArray(rows) ? rows[0] : null
    const cap = Number(row?.model_max_load_kg ?? NaN)
    if (Number.isFinite(cap) && cap > 0) return cap
    return null
  } catch {
    return null
  }
}

/**
 * MarketPage
 *
 * Main page component.
 */
export default function MarketPage(): JSX.Element {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<MarketFilters>({
    minReward: null,
    maxDistance: null,
    transportMode: 'all',
    cargoType: 'all',
    sortBy: 'reward_desc',
    countries: ['de'], // 👈 force Germany for Test 1
  })

  const [preferredHubCity, setPreferredHubCity] = useState<string | null>(null)
  const [preferredHubCountry, setPreferredHubCountry] = useState<string | null>(null)

  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const PAGE_SIZE = 20
  const [page, setPage] = useState<number>(1)

  // Track whether a saved hub has been applied so auto hub resolution does not overwrite it.
  const [savedHubApplied, setSavedHubApplied] = useState(false)

  // ✅ Hidden accepted jobs: keep in React state (instant UI update) + localStorage (persist)
  const [hiddenMarketJobIds, setHiddenMarketJobIds] = useState<string[]>(() => readHiddenMarketJobIds())
  const hiddenMarketSet = useMemo(() => new Set(hiddenMarketJobIds.map(String)), [hiddenMarketJobIds])

  useEffect(() => {
    console.log('AUTO COUNTRY:', preferredHubCountry)
  }, [preferredHubCountry])

  useEffect(() => {
    let mounted = true

    async function loadJobs() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchJobs()
        if (!mounted) return

        // ✅ refresh hidden state from localStorage (in case another tab accepted jobs)
        const hiddenIds = readHiddenMarketJobIds()
        setHiddenMarketJobIds(hiddenIds)

        const hidden = new Set(hiddenIds.map(String))
        const filtered = (Array.isArray(data) ? data : []).filter((j) => j?.id && !hidden.has(String(j.id)))

        setJobs(filtered)
        console.log('Loaded jobs (filtered):', filtered.length)
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message ?? 'Failed to load jobs')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadJobs()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    if (!user) {
      setPreferredHubCity(null)
      setPreferredHubCountry(null)
      return () => {
        mounted = false
      }
    }

    // If the user already applied a saved hub during this session, do not auto-resolve.
    if (savedHubApplied) {
      return () => {
        mounted = false
      }
    }

    async function loadHub() {
      try {
        // If the user explicitly saved a hub locally, apply it and skip auto resolution.
        try {
          const raw = localStorage.getItem('market_saved_hub')
          if (raw) {
            const parsed = JSON.parse(raw)
            const savedCountry = parsed?.country ? String(parsed.country).trim().toLowerCase() : null
            const savedCity = parsed?.city ? String(parsed.city).trim() : null

            if (savedCountry || savedCity) {
              if (!mounted) return
              setPreferredHubCountry(savedCountry ?? null)
              setPreferredHubCity(savedCity ?? null)
              setFilters((prev) => ({
                ...prev,
                countries: savedCountry ? [savedCountry] : Array.isArray(prev.countries) ? prev.countries : [],
                city: savedCity ?? (prev as any).city ?? null,
              }))
              setSavedHubApplied(true)
              return
            }
          }
        } catch {
          // ignore parse errors and continue to auto-resolve
        }

        const hub = await fetchUserHub(user)
        if (!mounted) return

        if (!hub) {
          setPreferredHubCity(null)
          setPreferredHubCountry(null)
          return
        }

        const city = hub.city_name ?? hub.city ?? hub.hub_city ?? hub.cityName ?? null
        const country = hub.country ?? hub.hub_country ?? hub.countryCode ?? hub.country_code ?? null

        const cityStr = city ? String(city).trim() : null
        const countryStr = country ? String(country).trim() : null
        const resolvedCountry = countryStr ? countryStr.toLowerCase() : null

        setPreferredHubCity(cityStr ?? null)
        setPreferredHubCountry(resolvedCountry ?? null)

        setFilters((prev) => {
          const next = { ...prev } as MarketFilters & any
          if (resolvedCountry) {
            const prevList = Array.isArray(prev.countries) ? (prev.countries as string[]) : []
            const normPrev = prevList.map((c) => String(c ?? '').trim().toLowerCase())
            next.countries = normPrev.includes(resolvedCountry) ? prevList : [resolvedCountry, ...prevList]
          }
          if (cityStr) next.city = cityStr
          return next
        })
      } catch (err) {
        console.error('loadHub error', err)
        if (mounted) {
          setPreferredHubCity(null)
          setPreferredHubCountry(null)
        }
      }
    }

    loadHub()
    return () => {
      mounted = false
    }
  }, [user, savedHubApplied])

  const cargoTypes = useMemo(() => {
    const s = new Set<string>()
    for (const j of jobs) {
      if (j.cargo_type) s.add(j.cargo_type)
    }
    return Array.from(s)
  }, [jobs])

  const countries = useMemo(() => {
    const map = new Map<string, { code: string; name: string; cities: Set<string> }>()
    for (const j of jobs) {
      const oc = j.origin_country_code
      const dc = j.destination_country_code
      const on = j.origin_city_name
      const dn = j.destination_city_name

      if (oc) {
        const code = String(oc).trim().toLowerCase()
        const entry = map.get(code) ?? { code, name: code, cities: new Set<string>() }
        if (on) entry.cities.add(on)
        map.set(code, entry)
      }
      if (dc) {
        const code = String(dc).trim().toLowerCase()
        const entry = map.get(code) ?? { code, name: code, cities: new Set<string>() }
        if (dn) entry.cities.add(dn)
        map.set(code, entry)
      }
    }

    return Array.from(map.values()).map((v) => ({
      code: v.code,
      name: getCountryName(v.code),
      cities: Array.from(v.cities),
    }))
  }, [jobs])

  useEffect(() => {
    if (!preferredHubCity) return
    if (!countries || countries.length === 0) return

    const hasCity = countries.some((c) => Array.isArray(c.cities) && c.cities.some((city) => city.toLowerCase() === preferredHubCity.toLowerCase()))
    if (!hasCity) return

    setFilters((prev: any) => {
      if ((prev.city ?? '').toLowerCase() === preferredHubCity.toLowerCase()) return prev
      return { ...prev, city: preferredHubCity }
    })
  }, [preferredHubCity, countries])

  useEffect(() => {
    if (savedHubApplied) return
    try {
      const raw = localStorage.getItem('market_saved_hub')
      if (!raw) return
      const parsed = JSON.parse(raw)
      const savedCountry = parsed?.country ? String(parsed.country).trim().toLowerCase() : null
      const savedCity = parsed?.city ? String(parsed.city).trim() : null
      if (!savedCountry && !savedCity) return
      if (!countries || countries.length === 0) return

      setFilters((prev: any) => ({
        ...prev,
        countries: savedCountry ? [savedCountry] : Array.isArray(prev.countries) ? prev.countries : [],
        city: savedCity ?? prev.city ?? null,
      }))
      setPreferredHubCountry(savedCountry ?? null)
      setPreferredHubCity(savedCity ?? null)
      setSavedHubApplied(true)
    } catch {
      // ignore
    }
  }, [countries, savedHubApplied])

  function jobBestReward(j: JobRow) {
    return Math.max(j.reward_trailer_cargo ?? 0, j.reward_load_cargo ?? 0)
  }

  const filteredSortedJobs = useMemo(() => {
    const out = jobs.filter((j) => {
      // ✅ ALWAYS hide accepted ids at render-time
      if (hiddenMarketSet.has(String(j.id))) return false

      const cityFilterSource =
        ((filters as any).city && String((filters as any).city).trim()) ||
        (preferredHubCity && String(preferredHubCity).trim()) ||
        null

      if (cityFilterSource) {
        const cityLower = cityFilterSource.toLowerCase()
        const originLower = (j.origin_city_name ?? '').trim().toLowerCase()
        const destLower = (j.destination_city_name ?? '').trim().toLowerCase()
        if (originLower !== cityLower && destLower !== cityLower) return false
      }

      if (filters.minReward !== null) {
        if (jobBestReward(j) < filters.minReward) return false
      }

      if (filters.maxDistance !== null) {
        const d = j.distance_km ?? 0
        if (d > filters.maxDistance) return false
      }

      if (filters.transportMode !== 'all') {
        const want =
          filters.transportMode === 'load'
            ? 'load_cargo'
            : filters.transportMode === 'trailer'
              ? 'trailer_cargo'
              : filters.transportMode
        if (j.transport_mode !== want) return false
      }

      if (filters.countries && Array.isArray(filters.countries) && filters.countries.length > 0) {
        const codes = new Set(filters.countries.map((c) => String(c ?? '').toLowerCase()))
        const originCode = String(j.origin_country_code ?? '').toLowerCase()
        const destCode = String(j.destination_country_code ?? '').toLowerCase()
        if (!codes.has(originCode) && !codes.has(destCode)) return false
      }

      if (filters.cargoType !== 'all') {
        if (((j.cargo_type ?? j.cargo_item ?? '') as string).toLowerCase() !== filters.cargoType.toLowerCase()) return false
      }

      return true
    })

    out.sort((a, b) => {
      switch (filters.sortBy) {
        case 'reward_desc':
          return jobBestReward(b) - jobBestReward(a)
        case 'reward_asc':
          return jobBestReward(a) - jobBestReward(b)
        case 'distance_asc':
          return (a.distance_km ?? 0) - (b.distance_km ?? 0)
        case 'distance_desc':
          return (b.distance_km ?? 0) - (a.distance_km ?? 0)
        case 'deadline_soonest': {
          const da = a.delivery_deadline ? new Date(a.delivery_deadline).getTime() : Infinity
          const db = b.delivery_deadline ? new Date(b.delivery_deadline).getTime() : Infinity
          return da - db
        }
        default:
          return 0
      }
    })

    if ((filters as any).followedOnly) {
      const followed = new Set(readFollowedIds())
      const filtered = out.filter((j) => j.id && followed.has(j.id))
      return filtered.slice(0, 10)
    }

    return out
  }, [jobs, filters, preferredHubCity, hiddenMarketSet])

  useEffect(() => {
    setPage(1)
  }, [filters, preferredHubCity])

  const totalPages = Math.max(1, Math.ceil(filteredSortedJobs.length / PAGE_SIZE))
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    return filteredSortedJobs.slice(start, end)
  }, [filteredSortedJobs, page])

  function onAccept(job: JobRow) {
    setActionError(null)
    setAcceptingJobId(job.id)
  }

  /**
   * confirmAccept
   *
   * Accept the currently selected job. This version allows accept without a truck:
   * - If a truck is found => payload is assigned immediately up to capacity
   * - If no truck is found => payload assigned is 0 (remaining stays the same)
   *
   * IMPORTANT:
   * Force pre-dispatch status to "assigned" always (per catalog/state machine).
   * Keep accepted market jobs in the "assigned" lane so they appear in Waiting/Staging
   * even when truck is attached later in staging.
   */
  async function confirmAccept() {
    setActionError(null)
    setSuccessMessage(null)

    if (!user) {
      setActionError('Please log in')
      throw new Error('Please log in')
    }

    const jobId = acceptingJobId
    if (!jobId) {
      throw new Error('Missing job id')
    }

    try {
      // Read session and auth user id
      const session = await supabase.auth.getSession()
      const accessToken = session.data.session?.access_token ?? null
      const authUserId = session.data.session?.user?.id ?? null
      const authHeader = accessToken ? `Bearer ${accessToken}` : `Bearer ${MARKET_SUPABASE_ANON_KEY}`

      // Keep accept insert path using resolver output
      const truckId = await resolveAcceptTruckId(user, authHeader, authUserId)

      const carrierCompanyId = await resolveCarrierCompanyId(user, truckId, authHeader)
      if (!carrierCompanyId) {
        throw new Error('No carrier company linked to your account. Please create or join a company before accepting jobs.')
      }

      const selectedJob = jobs.find((j) => j.id === jobId) ?? null
      const remainingBeforeRaw = Number(selectedJob?.remaining_payload ?? selectedJob?.weight_kg ?? 0)
      const remainingBefore = Number.isFinite(remainingBeforeRaw) && remainingBeforeRaw > 0 ? remainingBeforeRaw : 0

      const truckCapacity = await resolveTruckPayloadCapacity(truckId, authHeader)
      const thisRunPayload = truckId ? Math.max(0, Math.min(remainingBefore, Number(truckCapacity ?? remainingBefore))) : 0
      const remainingAfter = truckId ? Math.max(0, remainingBefore - thisRunPayload) : remainingBefore

      // Keep accepted market jobs in the "assigned" lane so they appear in Waiting/Staging
      // even when truck is attached later in staging.
      const assignmentStatus = 'assigned'

      const commonHeaders: Record<string, string> = {
        apikey: MARKET_SUPABASE_ANON_KEY,
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      }

      // 1) Create assignment
      const assignRes = await fetch(`${MARKET_API_BASE}/rest/v1/job_assignments`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({
          job_offer_id: jobId,
          carrier_company_id: carrierCompanyId,
          user_id: (user as any).id ?? null,
          user_truck_id: truckId ?? null,
          status: assignmentStatus,
          accepted_at: new Date().toISOString(),
          assigned_payload_kg: thisRunPayload,
          payload_remaining_kg: remainingAfter,
        }),
      })

      if (!assignRes.ok) {
        const txt = await assignRes.text().catch(() => '')
        throw new Error(txt || `Assignment insert failed (${assignRes.status})`)
      }

      // 2) Patch job offer
      const patchJobRes = await fetch(`${MARKET_API_BASE}/rest/v1/job_offers?id=eq.${encodeURIComponent(jobId)}`, {
        method: 'PATCH',
        headers: {
          ...commonHeaders,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          remaining_payload: remainingAfter,
          status: assignmentStatus,
          assigned_user_truck_id: truckId ?? null,
        }),
      })

      if (!patchJobRes.ok) {
        const txt = await patchJobRes.text().catch(() => '')
        throw new Error(txt || `Job offer update failed (${patchJobRes.status})`)
      }

      // ✅ Hide immediately + persist after refresh
      addHiddenMarketJobId(jobId)
      setHiddenMarketJobIds((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]))

      // Remove from in-memory jobs list too
      setJobs((prev) => prev.filter((j) => j.id !== jobId))

      setSuccessMessage('Job accepted')
      setAcceptingJobId(null)
      return
    } catch (err: any) {
      console.error('accept error', err)
      const msg = String(err?.message ?? 'Accept failed')
      if (msg.includes('job_assignments_truck_required')) {
        setActionError('Backend policy still requires a truck on accept. Deploy Step-1/Step-2 SQL to allow accept without truck, then retry.')
      } else {
        setActionError(msg)
      }
      throw err
    } finally {
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }

  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Job Market - Available Jobs</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-prose">
              Browse open job offers and accept ones that fit your trucks. Single-column list shows one offer per row.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-600">
              <span>Results</span>
              <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded text-sm font-medium">{filteredSortedJobs.length}</div>
            </div>

            <button
              type="button"
              className="md:hidden p-2 rounded bg-sky-600 text-white"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label="Open filters"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </header>

        <section className="bg-white p-6 rounded-lg shadow-sm w-full space-y-4">
          <div>
            <h2 className="text-sm font-semibold mb-3">Filters</h2>
            <div className="bg-white p-4 rounded-md shadow-sm">
              <FilterBar
                key={`${preferredHubCountry ?? 'none'}-${preferredHubCity ?? 'none'}`}
                filters={filters}
                cargoTypes={cargoTypes}
                countries={countries}
                onChange={setFilters}
              />
              <div className="mt-3 text-xs text-slate-500">Sort by reward, distance or deadline.</div>
              {preferredHubCity && (
                <div className="mt-2 text-xs text-slate-600">
                  Showing jobs for your hub:{' '}
                  <strong>
                    {preferredHubCity}
                    {preferredHubCountry ? `, ${preferredHubCountry.toUpperCase()}` : ''}
                  </strong>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <CountrySelect
                countries={countries}
                value={Array.isArray(filters.countries) && filters.countries.length > 0 ? filters.countries[0] : preferredHubCountry ?? ''}
                onChange={(code) => {
                  const next = code ? [code] : []
                  setFilters((prev: any) => ({ ...prev, countries: next, city: null }))
                }}
              />
              <CitySelect
                cities={(() => {
                  const sel = (Array.isArray(filters.countries) && filters.countries.length > 0 ? filters.countries[0] : preferredHubCountry) ?? ''
                  const obj = countries.find((c) => c.code === String(sel).trim().toLowerCase())
                  return obj?.cities ?? []
                })()}
                value={(filters as any).city ?? ''}
                disabled={!((Array.isArray(filters.countries) && filters.countries.length > 0) || Boolean(preferredHubCountry))}
                onChange={(c) => setFilters((prev: any) => ({ ...prev, city: c || null }))}
              />
            </div>

            <SavedHubControl
              selectedCountry={Array.isArray(filters.countries) && filters.countries.length > 0 ? filters.countries[0] : preferredHubCountry ?? ''}
              selectedCity={(filters as any).city ?? ''}
              onApply={(country, city) => {
                const normCountry = country ? String(country).trim().toLowerCase() : ''
                setFilters((prev: any) => ({
                  ...prev,
                  countries: normCountry ? [normCountry] : [],
                  city: city ?? null,
                }))
                setPreferredHubCountry(normCountry || null)
                setPreferredHubCity(city ?? null)
                setSavedHubApplied(true)
              }}
            />
          </div>

          <div>
            {loading && <div className="text-sm text-slate-600">Loading jobs…</div>}
            {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-700">{error}</div>}
            {actionError && <div className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-700 mt-3">{actionError}</div>}
            {successMessage && <div className="p-3 bg-emerald-50 border border-emerald-100 rounded text-emerald-700 mt-3">{successMessage}</div>}
          </div>

          <div>
            {filteredSortedJobs.length === 0 && !loading && !error ? (
              <div className="text-sm text-slate-600">No jobs found matching the filters.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {paginatedJobs.map((job) => (
                  <JobCard key={job.id} job={job} onAccept={() => onAccept(job)} onView={() => {}} />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </div>
            <MarketPagination current={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </section>

        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
            <div className="ml-auto w-full max-w-md bg-white p-4 shadow-xl overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Refine</h3>
                <button className="px-3 py-1 rounded bg-slate-100" onClick={() => setMobileFiltersOpen(false)}>
                  Close
                </button>
              </div>
              <FilterBar
                key={`${preferredHubCountry ?? 'none'}-${preferredHubCity ?? 'none'}-mobile`}
                filters={filters}
                cargoTypes={cargoTypes}
                countries={countries}
                onChange={setFilters}
              />
            </div>
          </div>
        )}

        <AcceptModal
          open={Boolean(acceptingJobId)}
          jobId={acceptingJobId}
          job={jobs.find((j) => j.id === acceptingJobId) ?? null}
          onClose={() => {
            setActionError(null)
            setAcceptingJobId(null)
          }}
          onConfirm={() => confirmAccept()}
        />
      </div>
    </Layout>
  )
}

/**
 * Hidden market jobs helpers
 *
 * Persist a list of hidden/accepted job offer ids locally so accepted offers
 * are immediately hidden client-side and remain hidden after refresh.
 */
const HIDDEN_MARKET_JOBS_KEY = 'market_hidden_job_offer_ids_v1'

function readHiddenMarketJobIds(): string[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem(HIDDEN_MARKET_JOBS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function addHiddenMarketJobId(id: string) {
  try {
    if (typeof window === 'undefined') return
    const existing = new Set(readHiddenMarketJobIds())
    existing.add(String(id))
    localStorage.setItem(HIDDEN_MARKET_JOBS_KEY, JSON.stringify(Array.from(existing)))
  } catch {
    // ignore
  }
}

/**
 * readFollowedIds
 *
 * Read followed job ids from localStorage.
 */
function readFollowedIds(): string[] {
  try {
    const s = localStorage.getItem('followed_job_offers')
    if (!s) return []
    const parsed = JSON.parse(s)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

/**
 * resolveCarrierCompanyId
 *
 * Resolve the carrier company id used for job assignment inserts.
 */
async function resolveCarrierCompanyId(
  user: { id?: string | null; company_id?: string | null } | null,
  truckId?: string | null,
  authorization?: string
): Promise<string | null> {
  const inlineCompanyId = user?.company_id ?? null
  if (inlineCompanyId) return inlineCompanyId

  const authUserId = user?.id ?? null
  const headers = {
    apikey: MARKET_SUPABASE_ANON_KEY,
    Authorization: authorization ?? `Bearer ${MARKET_SUPABASE_ANON_KEY}`,
  }

  try {
    const queryUsersCompany = async (field: 'auth_user_id' | 'id', value: string): Promise<string | null> => {
      const usersUrl = `${MARKET_API_BASE}/rest/v1/users?select=company_id&${field}=eq.${encodeURIComponent(value)}&limit=1`
      const usersRes = await fetch(usersUrl, { headers })
      if (!usersRes.ok) return null
      const users = await usersRes.json().catch(() => null)
      return Array.isArray(users) ? users[0]?.company_id ?? null : null
    }

    if (authUserId) {
      const byAuthField = await queryUsersCompany('auth_user_id', authUserId)
      if (byAuthField) return byAuthField

      const byIdField = await queryUsersCompany('id', authUserId)
      if (byIdField) return byIdField
    }

    if (truckId) {
      const truckUrl = `${MARKET_API_BASE}/rest/v1/user_trucks?id=eq.${encodeURIComponent(truckId)}&select=owner_company_id&limit=1`
      const truckRes = await fetch(truckUrl, { headers })
      if (truckRes.ok) {
        const trucks = await truckRes.json().catch(() => null)
        const resolved = Array.isArray(trucks) ? trucks[0]?.owner_company_id : null
        if (resolved) return resolved
      }
    }

    if (authUserId) {
      const ownerTruckUrl = `${MARKET_API_BASE}/rest/v1/user_trucks?owner_user_id=eq.${encodeURIComponent(authUserId)}&select=owner_company_id&limit=1`
      const ownerTruckRes = await fetch(ownerTruckUrl, { headers })
      if (ownerTruckRes.ok) {
        const trucks = await ownerTruckRes.json().catch(() => null)
        const resolved = Array.isArray(trucks) ? trucks[0]?.owner_company_id : null
        if (resolved) return resolved
      }

      const companiesUrl = `${MARKET_API_BASE}/rest/v1/companies?owner_id=eq.${encodeURIComponent(authUserId)}&select=id&limit=1`
      const companiesRes = await fetch(companiesUrl, { headers })
      if (companiesRes.ok) {
        const companies = await companiesRes.json().catch(() => null)
        const resolved = Array.isArray(companies) ? companies[0]?.id : null
        if (resolved) return resolved
      }
    }
  } catch {
    // ignore and fall back to null
  }

  return null
}

/**
 * resolveAcceptTruckId
 *
 * Try to pick a sensible user_truck id to use when accepting a job.
 * Ownership buckets (kept for Sider alignment):
 *  - owner_user_auth_id = authUserId
 *  - owner_user_id = authUserId
 *  - owner_user_id = publicUserId (user.id)
 *  - owner_company_id = companyId
 *
 * Ranking:
 *  - Prefer non-inactive/maintenance/disabled trucks
 *  - Sort by capacity desc, then newest created_at desc
 *  - If all trucks are invalid-status, still return best fallback truck
 *    (backend currently enforces job_assignments_truck_required)
 */
async function resolveAcceptTruckId(
  user: { id?: string | null; company_id?: string | null } | null,
  authorization: string,
  authUserId: string | null
): Promise<string | null> {
  type Row = {
    id?: string | null
    status?: string | null
    created_at?: string | null
    model_max_load_kg?: number | string | null
  }

  try {
    const headers = {
      apikey: MARKET_SUPABASE_ANON_KEY,
      Authorization: authorization,
    }

    const publicUserId = user?.id ?? null
    const resolvedCompanyId = user?.company_id ?? null

    const fetchRows = async (query: string): Promise<Row[]> => {
      const url = `${MARKET_API_BASE}/rest/v1/user_trucks?${query}`
      const res = await fetch(url, { headers })
      if (!res.ok) return []
      const rows = await res.json().catch(() => [])
      return Array.isArray(rows) ? (rows as Row[]) : []
    }

    // Keep ownership fetch buckets
    const select = 'select=id,status,created_at,model_max_load_kg&order=created_at.desc'
    const buckets = await Promise.all([
      authUserId ? fetchRows(`owner_user_auth_id=eq.${encodeURIComponent(authUserId)}&${select}`) : Promise.resolve([]),
      // owner_user_id can store either auth user id or public users.id in historical rows
      authUserId ? fetchRows(`owner_user_id=eq.${encodeURIComponent(authUserId)}&${select}`) : Promise.resolve([]),
      publicUserId ? fetchRows(`owner_user_id=eq.${encodeURIComponent(publicUserId)}&${select}`) : Promise.resolve([]),
      resolvedCompanyId ? fetchRows(`owner_company_id=eq.${encodeURIComponent(resolvedCompanyId)}&${select}`) : Promise.resolve([]),
    ])

    // Deduplicate by truck id across ownership buckets
    const map = new Map<string, Row>()
    for (const rows of buckets) {
      for (const row of rows) {
        const id = row?.id ? String(row.id) : ''
        if (!id) continue
        if (!map.has(id)) map.set(id, row)
      }
    }

    // Add fallback ranking strategy
    const byCapacityThenNewest = (a: Row, b: Row) => {
      const capA = Number(a?.model_max_load_kg ?? 0)
      const capB = Number(b?.model_max_load_kg ?? 0)
      if (capA !== capB) return capB - capA

      const timeA = a?.created_at ? Date.parse(a.created_at) : 0
      const timeB = b?.created_at ? Date.parse(b.created_at) : 0
      return timeB - timeA
    }

    const allRows = Array.from(map.values())
    const invalidStatuses = new Set(['inactive', 'maintenance', 'disabled'])
    const candidates = allRows.filter((r) => !invalidStatuses.has(String(r?.status ?? '').toLowerCase()))
    candidates.sort(byCapacityThenNewest)

    if (candidates.length > 0) {
      return candidates[0]?.id ? String(candidates[0].id) : null
    }

    // Backend currently enforces job_assignments_truck_required.
    // If all trucks are flagged inactive/maintenance/disabled, still pick one best-effort
    // so accept can proceed and the assignment can be reworked in staging afterwards.
    if (candidates.length === 0) {
      allRows.sort(byCapacityThenNewest)
      return allRows[0]?.id ? String(allRows[0].id) : null
    }
  } catch {
    // ignore and fall through to null
  }
  return null
}

/**
 * fetchUserHub
 *
 * Try to obtain the user's main hub (city + country) from public.hubs or companies.
 */
async function fetchUserHub(user: { id: string; company_id?: string | null } | null) {
  if (!user) return null
  try {
    const tryHubQuery = async (ownerId?: string | null) => {
      if (!ownerId) return null
      const url = `${MARKET_API_BASE}/rest/v1/hubs?select=*&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`
      const r = await fetch(url, {
        headers: { apikey: MARKET_SUPABASE_ANON_KEY, Authorization: `Bearer ${MARKET_SUPABASE_ANON_KEY}` },
      })
      if (!r.ok) return null
      const d = await r.json().catch(() => null)
      if (Array.isArray(d) && d.length > 0) return d[0]
      return null
    }

    if (user.company_id) {
      const h = await tryHubQuery(user.company_id)
      if (h) return h
    }

    const h2 = await tryHubQuery(user.id)
    if (h2) return h2

    const tryCompany = async (companyId?: string | null, ownerId?: string | null) => {
      if (companyId) {
        const url = `${MARKET_API_BASE}/rest/v1/companies?id=eq.${encodeURIComponent(companyId)}&select=hub_city,hub_country&limit=1`
        const r = await fetch(url, {
          headers: { apikey: MARKET_SUPABASE_ANON_KEY, Authorization: `Bearer ${MARKET_SUPABASE_ANON_KEY}` },
        })
        if (r.ok) {
          const d = await r.json().catch(() => null)
          if (Array.isArray(d) && d.length > 0) return d[0]
        }
      }
      if (ownerId) {
        const url = `${MARKET_API_BASE}/rest/v1/companies?select=hub_city,hub_country&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`
        const r = await fetch(url, {
          headers: { apikey: MARKET_SUPABASE_ANON_KEY, Authorization: `Bearer ${MARKET_SUPABASE_ANON_KEY}` },
        })
        if (r.ok) {
          const d = await r.json().catch(() => null)
          if (Array.isArray(d) && d.length > 0) return d[0]
        }
      }
      return null
    }

    const comp = await tryCompany(user.company_id ?? null, user.id ?? null)
    if (comp) return comp

    const usersUrl = `${MARKET_API_BASE}/rest/v1/users?select=id,company_id&auth_user_id=eq.${encodeURIComponent(user.id)}&limit=1`
    const userRes = await fetch(usersUrl, {
      headers: { apikey: MARKET_SUPABASE_ANON_KEY, Authorization: `Bearer ${MARKET_SUPABASE_ANON_KEY}` },
    })
    if (userRes.ok) {
      const ud = await userRes.json().catch(() => null)
      if (Array.isArray(ud) && ud.length > 0) {
        const publicUser = ud[0] as any
        if (publicUser.company_id) {
          const h3 = await tryHubQuery(publicUser.company_id)
          if (h3) return h3
          const c2 = await tryCompany(publicUser.company_id, publicUser.id)
          if (c2) return c2
        }
        const h4 = await tryHubQuery(publicUser.id)
        if (h4) return h4
      }
    }

    return null
  } catch {
    return null
  }
}