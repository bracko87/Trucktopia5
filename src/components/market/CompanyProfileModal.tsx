/**
 * CompanyProfileModal.tsx
 *
 * Modal that shows a company profile and loads active job offers for the company when opened.
 * Also displays a compact company info block below the logo (city, country, Import/Export, Group).
 *
 * Key goals:
 * - Request only guaranteed columns to avoid PostgREST errors.
 * - Show up to 5 jobs per page (client-side pagination).
 * - Provide per-offer expand/collapse to reveal additional important job details.
 */

import React, { useEffect, useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import CountdownTimer from '../common/CountdownTimer'

let supabase: any
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const s = require('../../lib/supabase')
  supabase = s?.supabase ?? s?.default ?? s
} catch {
  supabase = undefined
}

/**
 * CompanyJobRow
 *
 * Minimal shape for job rows shown in the modal.
 */
export interface CompanyJobRow {
  id: string
  origin_city_name?: string | null
  destination_city_name?: string | null
  pickup_time?: string | null
  reward_trailer_cargo?: number | null
  reward_load_cargo?: number | null
  status?: string | null

  /** Extended fields for expanded view */
  weight_kg?: number | null
  pallets?: number | null
  temperature_control?: boolean | null
  hazardous?: boolean | null
  transport_mode?: string | null
  special_requirements?: any | null

  /** Cargo display fields (requested from server) */
  cargo_type_name?: string | null
  cargo_item_name?: string | null
}

/**
 * CompanyProfileRow
 *
 * Lightweight shape for company details we try to read.
 */
export interface CompanyProfileRow {
  id: string
  name?: string | null
  logo?: string | null
  city?: string | null
  country?: string | null
  country_code?: string | null
  group_name?: string | null
  corporation?: string | null
  is_importer?: boolean | null
  is_exporter?: boolean | null
  imports_count?: number | null
  exports_count?: number | null
  [key: string]: any
}

/**
 * CompanyProfileModalProps
 *
 * Props for the company profile modal.
 */
export interface CompanyProfileModalProps {
  open: boolean
  onClose: () => void
  companyId?: string | null
  companyName?: string | null
  companyLogo?: string | null
}

/**
 * formatCurrency
 *
 * Format a numeric reward into a compact string.
 *
 * @param n - numeric amount
 * @returns formatted currency string
 */
function formatCurrency(n?: number | null) {
  if (n === null || n === undefined) return '—'
  return `$${Math.round(n)}`
}

/**
 * smallDate
 *
 * Render a compact local date/time string or a placeholder.
 *
 * @param s - ISO date string
 * @returns formatted string
 */
function smallDate(s?: string | null) {
  if (!s) return '—'
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString(undefined, { hour12: false })
}

/**
 * transportModelLabel
 *
 * Convert a transport_mode string into a human-friendly label.
 *
 * Examples:
 * - 'load' or 'load_cargo' -> 'Load'
 * - 'trailer' or 'trailer_cargo' -> 'Trailer'
 * - otherwise -> 'Unknown'
 *
 * @param m - transport_mode value from the job row
 * @returns friendly transport model label
 */
function transportModelLabel(m?: string | null) {
  if (!m) return 'Unknown'
  const s = String(m).toLowerCase()
  if (s.includes('load')) return 'Load'
  if (s.includes('trailer')) return 'Trailer'
  return 'Unknown'
}

/**
 * countryCodeToEmoji
 *
 * Convert ISO alpha-2 code to emoji flag fallback.
 *
 * @param code - country code
 * @returns emoji string
 */
function countryCodeToEmoji(code?: string | null) {
  if (!code) return '🌍'
  const cc = String(code).trim().toUpperCase()
  if (cc.length !== 2) return '🌍'
  return cc
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('')
}

/**
 * renderFlagChip
 *
 * Render a rectangular flag chip using a 16:9 aspect ratio. The `size`
 * parameter controls the height in pixels; width is computed from 16:9.
 */
function renderFlagChip(code?: string | null, alt = '', size = 18) {
  const initial = (() => {
    if (!code) return null
    const cc = String(code).trim().toLowerCase()
    if (cc.length !== 2) return null
    return `https://flagcdn.com/48x36/${cc}.png`
  })()

  const [src, setSrc] = useState<string | null>(initial)
  const [triedAlternate, setTriedAlternate] = useState(false)

  const fontSize = Math.max(10, Math.floor(size * 0.6))

  function onError() {
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

  const height = Math.max(8, Math.floor(size))
  const width = Math.max(12, Math.round((height * 16) / 9))

  return (
    <div
      aria-hidden
      className="overflow-hidden bg-white border border-slate-100 shadow-sm flex items-center justify-center"
      style={{ width, height }}
      title={alt || code || 'Country'}
    >
      {src ? (
        // eslint-disable-next-line jsx-a11y/img-redundant-alt
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <img src={src} alt={alt || `${code} flag`} className="w-full h-full object-cover block" onError={onError} />
      ) : (
        <span style={{ fontSize, lineHeight: 1 }}>{countryCodeToEmoji(code)}</span>
      )}
    </div>
  )
}

/**
 * chooseCityName
 *
 * Return the best available city name from a nested city object.
 * Only checks city_name because PostgREST fails if any requested column is missing.
 *
 * @param c - nested city object
 * @returns best-effort city name or null
 */
function chooseCityName(c: any) {
  if (!c) return null
  return c.city_name ?? null
}

/**
 * FollowJobButton
 *
 * Small component that toggles follow state for a job and persists to localStorage.
 * Emits a 'job-follow-change' CustomEvent so other parts of the app can react.
 */
function FollowJobButton({ jobId }: { jobId: string }) {
  const key = 'followed_job_offers'
  const [followed, setFollowed] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem(key)
      if (!s) return false
      return JSON.parse(s as string).includes(jobId)
    } catch {
      return false
    }
  })

  function persist(ids: string[]) {
    try {
      localStorage.setItem(key, JSON.stringify(ids))
    } catch {
      // ignore
    }
  }

  function toggle() {
    try {
      const s = localStorage.getItem(key)
      const arr: string[] = s ? JSON.parse(s) : []
      let next: string[]
      if (followed) {
        next = arr.filter((i) => i !== jobId)
      } else {
        next = Array.from(new Set([jobId, ...arr]))
      }
      persist(next)
      setFollowed(!followed)
      try {
        window.dispatchEvent(new CustomEvent('job-follow-change', { detail: { jobId, followed: !followed } }))
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        toggle()
      }}
      className={`text-xs px-2 py-1 rounded-md border transition ${followed ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
      title={followed ? 'Unfollow this job' : 'Follow this job'}
    >
      {followed ? 'Following' : 'Follow'}
    </button>
  )
}

/**
 * AcceptJobButton
 *
 * Small component that triggers an accept action for a job.
 * Emits a 'company-job-accept' CustomEvent with { jobId } in detail.
 * The button becomes disabled after being clicked to prevent duplicate actions.
 */
function AcceptJobButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)

  async function onAccept(e: React.MouseEvent) {
    e.stopPropagation()
    if (loading || accepted) return
    setLoading(true)

    try {
      // Emit a local event so the rest of the app can handle accept logic (server call, UI updates).
      try {
        window.dispatchEvent(new CustomEvent('company-job-accept', { detail: { jobId } }))
      } catch {
        // ignore
      }

      // Best-effort: if supabase is available attempt a safe status update (non-blocking).
      if (supabase && typeof supabase.from === 'function') {
        try {
          // Do a conservative patch: set status = 'accepted' where id = jobId
          // This is optional and might fail with RLS; ignore errors.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const res = await supabase.from('job_offers').update({ status: 'accepted' }).eq('id', jobId).select('id')
          // eslint-disable-next-line no-console
          // console.log('accept res', res)
        } catch {
          // ignore
        }
      }

      setAccepted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onAccept}
      disabled={accepted || loading}
      className={`text-xs px-2 py-1 rounded-md text-white ${accepted ? 'bg-emerald-600 opacity-70' : 'bg-emerald-600 hover:bg-emerald-700'} transition`}
      title={accepted ? 'Accepted' : 'Accept this job'}
    >
      {accepted ? 'Accepted' : loading ? 'Accepting…' : 'Accept'}
    </button>
  )
}

/**
 * CompanyProfileModal
 *
 * Modal component that fetches and displays active job offers for a company and
 * shows basic profile details (city, country with flag, and optional group/corporation).
 *
 * Adds simple client-side pagination (5 jobs per page) and per-offer expand/collapse
 * which reveals extra job details fetched from the server.
 */
export default function CompanyProfileModal({
  open,
  onClose,
  companyId,
  companyName,
  companyLogo,
}: CompanyProfileModalProps) {
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<CompanyJobRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [company, setCompany] = useState<CompanyProfileRow | null>(null)

  // pagination
  const PAGE_SIZE = 5
  const [page, setPage] = useState(1)

  // expanded job ids
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let mounted = true

    /**
     * loadJobsAndCompany
     *
     * Fetch active job offers and company details when open.
     * Uses only guaranteed columns to prevent PostgREST errors.
     */
    async function loadJobsAndCompany() {
      setError(null)
      setJobs(null)
      setCompany(null)

      if (!companyId) {
        setJobs([])
        return
      }

      setLoading(true)

      try {
        if (supabase && typeof supabase.from === 'function') {
          // Request extra columns for expanded view plus cargo type/item display.
          // Keep city selection minimal to avoid PostgREST missing-column errors.
          const selectStr =
            'id,pickup_time,reward_trailer_cargo,reward_load_cargo,status,created_at,' +
            'weight_kg,pallets,temperature_control,hazardous,transport_mode,special_requirements,' +
            'cargo_type:cargo_type_id(id,name),' +
            'cargo_item:cargo_item_id(id,name),' +
            'origin_city:origin_city_id(id,city_name),' +
            'destination_city:destination_city_id(id,city_name),' +
            // Request minimal origin/destination client company info (safe fields)
            "origin_company:origin_client_company_id(id,name,logo)," +
            "destination_company:destination_client_company_id(id,name,logo)"

          /**
           * pickLogoJob
           *
           * Safely pick a probable logo field from a company row returned by PostgREST.
           * Checks common column names used across the codebase and falls back to null.
           *
           * @param obj - company-like object
           * @returns string|null - best-effort image url
           */
          /**
           * pickLogoJob
           *
           * Return the primary logo field for a client company object.
           *
           * @param obj - company-like object returned by PostgREST
           * @returns string|null - best-effort logo URL or null
           */
          function pickLogoJob(obj: any): string | null {
            if (!obj) return null
            return obj.logo ?? null
          }

          // Query jobs where origin OR destination matches the company.
          // Include both 'generated' and 'open' statuses.
          let jobsRes: any = await supabase
            .from('job_offers')
            .select(selectStr)
            .or(`origin_client_company_id.eq.${companyId},destination_client_company_id.eq.${companyId}`)
            .in('status', ['generated', 'open'])
            .order('created_at', { ascending: false })
            .limit(500)

          if (jobsRes.error) {
            if (mounted) setError(jobsRes.error.message || 'Failed to load jobs')
          } else {
            if (mounted) {
              const mapped = (jobsRes.data ?? []).map((r: any) => {
                const originCity = r.origin_city ?? null
                const destCity = r.destination_city ?? null

                const originCompany = r.origin_company ?? null
                const destinationCompany = r.destination_company ?? null

                return {
                  id: r.id,
                  origin_city_name: chooseCityName(originCity),
                  destination_city_name: chooseCityName(destCity),
                  pickup_time: r.pickup_time ?? null,
                  reward_trailer_cargo: r.reward_trailer_cargo ?? null,
                  reward_load_cargo: r.reward_load_cargo ?? null,
                  status: r.status ?? null,
                  weight_kg: r.weight_kg ?? null,
                  pallets: r.pallets ?? null,
                  temperature_control: r.temperature_control ?? null,
                  hazardous: r.hazardous ?? null,
                  transport_mode: r.transport_mode ?? null,
                  special_requirements: r.special_requirements ?? null,
                  cargo_type_name: (r.cargo_type && (r.cargo_type.name ?? r.cargo_type.id)) ?? null,
                  cargo_item_name: (r.cargo_item && (r.cargo_item.name ?? r.cargo_item.id)) ?? null,

                  // Map origin/destination client company name and logo (safe fallbacks)
                  origin_client_company_name: originCompany?.name ?? null,
                  origin_client_company_logo: pickLogoJob(originCompany),
                  destination_client_company_name: destinationCompany?.name ?? null,
                  destination_client_company_logo: pickLogoJob(destinationCompany),
                } as CompanyJobRow
              })
              setJobs(mapped)
            }
          }

          // Load company details (client_companies then companies fallback)
          const clientCompanyRes = await supabase.from('client_companies').select('*').eq('id', companyId).maybeSingle()
          if (clientCompanyRes && !clientCompanyRes.error && clientCompanyRes.data) {
            if (mounted) {
              const row = clientCompanyRes.data
              setCompany({
                id: row.id,
                name: row.name ?? companyName ?? undefined,
                logo: row.logo ?? companyLogo ?? undefined,
                city: row.city ?? row.hub_city ?? row.location_city ?? null,
                country: row.country ?? row.country_name ?? row.hub_country ?? null,
                country_code: row.country_code ?? row.country_iso2 ?? row.hub_country_code ?? null,
                group_name: row.group_name ?? row.parent_company ?? row.corporation ?? null,
                corporation: row.corporation ?? row.group_name ?? null,
                imports_count: row.imports_count ?? null,
                exports_count: row.exports_count ?? null,
                is_importer: row.is_importer ?? null,
                is_exporter: row.is_exporter ?? null,
                ...row,
              })
            }
          } else {
            const compRes = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle()
            if (compRes && !compRes.error && compRes.data) {
              if (mounted) {
                const row = compRes.data
                setCompany({
                  id: row.id,
                  name: row.name ?? companyName ?? undefined,
                  logo: row.logo ?? companyLogo ?? undefined,
                  city: row.hub_city ?? row.city ?? null,
                  country: row.hub_country ?? row.country ?? null,
                  country_code: row.hub_country_code ?? row.country_code ?? null,
                  group_name: row.group_name ?? row.parent_company ?? row.corporation ?? null,
                  corporation: row.corporation ?? null,
                  imports_count: row.imports_count ?? null,
                  exports_count: row.exports_count ?? null,
                  is_importer: row.is_importer ?? null,
                  is_exporter: row.is_exporter ?? null,
                  ...row,
                })
              }
            } else {
              if (mounted && !company && !error) {
                setCompany({
                  id: companyId,
                  name: companyName ?? 'Company',
                  logo: companyLogo ?? null,
                })
              }
            }
          }
        } else {
          if (mounted) setError('Active job fetch and company details are unavailable in this preview environment.')
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Unexpected error while loading jobs/company details')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (open) {
      loadJobsAndCompany()
    } else {
      setJobs(null)
      setError(null)
      setCompany(null)
    }

    return () => {
      mounted = false
    }
  }, [open, companyId])

  /**
   * Reset page to 1 when job list changes or modal opens/closes.
   */
  useEffect(() => {
    setPage(1)
    setExpanded({})
  }, [jobs, open])

  if (!open) return null

  const displayName = company?.name ?? companyName ?? 'Company'
  const displayLogo = company?.logo ?? companyLogo ?? undefined
  const city = company?.city ?? null
  const country = company?.country ?? null
  const countryCode = company?.country_code ?? null
  const group = company?.group_name ?? company?.corporation ?? null

  const totalJobs = Array.isArray(jobs) ? jobs.length : 0
  const totalPages = Math.max(1, Math.ceil(totalJobs / PAGE_SIZE))
  const pagedJobs = Array.isArray(jobs) ? jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : []

  /**
   * importsDisplay / exportsDisplay
   *
   * Compute import/export counts from the loaded jobs when possible.
   */
  const importsDisplay = (() => {
    if (Array.isArray(jobs) && city) {
      const count = jobs.filter((j) => j.destination_city_name && j.destination_city_name === city).length
      return String(count)
    }
    if (typeof company?.imports_count === 'number') return String(company.imports_count)
    if (company?.is_importer) return 'Yes'
    return '—'
  })()

  const exportsDisplay = (() => {
    if (Array.isArray(jobs) && city) {
      const count = jobs.filter((j) => j.origin_city_name && j.origin_city_name === city).length
      return String(count)
    }
    if (typeof company?.exports_count === 'number') return String(company.exports_count)
    if (company?.is_exporter) return 'Yes'
    return '—'
  })()

  /**
   * toggleExpand
   *
   * Toggle expanded state for a job entry.
   *
   * @param id - job id to toggle
   */
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = { ...prev }
      next[id] = !next[id]
      return next
    })
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl mx-6 bg-white rounded-lg shadow-lg border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="text-lg font-medium leading-tight">{displayName}</div>
              </div>

              {(city || country || countryCode || group) && (
                <div className="mt-1 text-sm text-slate-600 flex items-center gap-3">
                  {city && <span className="truncate">{city}</span>}

                  {countryCode ? (
                    <span className="inline-flex items-center gap-2">
                      {renderFlagChip(countryCode, country ?? undefined, 18)}
                      <span className="text-sm text-slate-500">{country ?? countryCode}</span>
                    </span>
                  ) : country ? (
                    <span className="text-sm text-slate-500">{country}</span>
                  ) : null}

                  {group && <span className="text-sm text-slate-500">• {group}</span>}
                </div>
              )}
            </div>
          </div>

          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-[30%]">
              {/* Headline above the logo block */}
              <div className="text-sm font-semibold mb-2">Company Prolife</div>

              <div
                className="w-full bg-slate-100 rounded-md overflow-hidden flex items-center justify-center border border-slate-100"
                style={{
                  aspectRatio: '16/9',
                  maxHeight: '320px',
                }}
              >
                {displayLogo ? (
                  // eslint-disable-next-line jsx-a11y/img-redundant-alt
                  <img src={displayLogo} alt={displayName ?? 'Company media'} className="w-full h-full object-cover block" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <span className="text-4xl font-bold text-slate-600">
                      {(displayName || 'C')
                        .split(/\s+/)
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Important info block below logo */}
              <div className="mt-3 text-sm text-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-slate-500">City</div>
                  <div className="font-medium">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openCityModal(undefined, city ?? undefined)
                      }}
                      className="text-left font-medium focus:outline-none focus:ring-2 focus:ring-slate-200"
                      title={city ?? 'City'}
                    >
                      {city ?? '—'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-slate-500">Country</div>
                  <div className="inline-flex items-center gap-2">
                    {countryCode ? renderFlagChip(countryCode, country ?? undefined, 16) : null}
                    <div className="font-medium">{country ?? countryCode ?? '—'}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-slate-500">Import (current offers)</div>
                  <div className="font-medium">{importsDisplay}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-slate-500">Export (current offers)</div>
                  <div className="font-medium">{exportsDisplay}</div>
                </div>

              </div>
            </div>

            <div className="w-full sm:w-[70%]">
              {loading && <div className="text-sm text-slate-500">Loading active jobs…</div>}
              {error && <div className="text-sm text-rose-600">{error}</div>}

              {!loading && !error && Array.isArray(jobs) && jobs.length === 0 && (
                <div className="text-sm text-slate-500">No active job offers found for this company.</div>
              )}

              {!loading && !error && Array.isArray(jobs) && jobs.length > 0 && (
                <>
                  {/* Headline above the job list */}
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-slate-700">All open job offers for this company</div>
                    <div className="text-xs text-slate-500">Showing latest offers (paginated)</div>
                  </div>

                  <div className="space-y-3">
                    {pagedJobs.map((j) => {
                      const bestReward = Math.max(j.reward_load_cargo ?? 0, j.reward_trailer_cargo ?? 0)
                      const isExpanded = Boolean(expanded[j.id])
                      return (
                        <div key={j.id} className="rounded-md border border-slate-100 bg-slate-50 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleExpand(j.id)}
                            aria-expanded={isExpanded}
                            className="w-full text-left p-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openCityModal(undefined, j.origin_city_name ?? undefined)
                                  }}
                                  className="font-medium mr-1 focus:outline-none focus:ring-1 focus:ring-slate-200"
                                  title={j.origin_city_name ?? 'Origin'}
                                >
                                  {j.origin_city_name ?? 'Unknown'}
                                </button>
                                <span className="mx-1 text-slate-400">→</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openCityModal(undefined, j.destination_city_name ?? undefined)
                                  }}
                                  className="font-medium ml-1 focus:outline-none focus:ring-1 focus:ring-slate-200"
                                  title={j.destination_city_name ?? 'Destination'}
                                >
                                  {j.destination_city_name ?? 'Unknown'}
                                </button>
                              </div>
                              <div className="text-xs text-slate-500">Pickup: {smallDate(j.pickup_time)}</div>
                              {/* Countdown below pickup time (live) */}
                              <div className="mt-1">
                                <CountdownTimer pickupTime={j.pickup_time} className="text-xs text-slate-500" showReadyText={true} />
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-sm font-extrabold text-emerald-600">{formatCurrency(bestReward)}</div>
                              <div className="text-slate-400">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                            </div>
                          </button>

                          {/* Expandable details */}
                          <div
                            className={`px-3 pb-3 transition-all duration-150 ease-in-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}
                          >
                            {isExpanded && (
                              <div className="pt-2 text-sm text-slate-700 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-slate-500">Weight</div>
                                  <div className="font-medium">{j.weight_kg !== null && j.weight_kg !== undefined ? `${j.weight_kg} kg` : '—'}</div>
                                </div>

                                {/* Cargo type */}
                                <div className="flex items-center justify-between">
                                  <div className="text-slate-500">Cargo type</div>
                                  <div className="font-medium">{j.cargo_type_name ?? '—'}</div>
                                </div>

                                {/* Cargo item */}
                                <div className="flex items-center justify-between">
                                  <div className="text-slate-500">Cargo item</div>
                                  <div className="font-medium">{j.cargo_item_name ?? '—'}</div>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="text-slate-500">Transport Model</div>
                                  <div className="font-medium">{transportModelLabel(j.transport_mode)}</div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {j.temperature_control ? (
                                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-700 border border-blue-100">
                                      Temperature control
                                    </span>
                                  ) : null}
                                  {j.hazardous ? (
                                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-rose-50 text-rose-700 border border-rose-100">
                                      Hazardous
                                    </span>
                                  ) : null}

                                  {/* Replace plain status text with small actionable buttons (Follow + Accept) */}
                                  <div className="ml-1 flex items-center gap-2">
                                    <FollowJobButton jobId={j.id} />
                                    <AcceptJobButton jobId={j.id} />
                                  </div>
                                </div>

                                {j.special_requirements ? (
                                  <div>
                                    <div className="text-slate-500 text-xs">Special requirements</div>
                                    <div className="mt-1 text-sm text-slate-600 bg-white border border-slate-100 rounded p-2">{typeof j.special_requirements === 'string' ? j.special_requirements : JSON.stringify(j.special_requirements)}</div>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                      Showing {totalJobs === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, totalJobs)}–{Math.min(page * PAGE_SIZE, totalJobs)} of {totalJobs}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="px-2 py-1 text-sm rounded border bg-white disabled:opacity-50"
                      >
                        Prev
                      </button>

                      <div className="text-sm text-slate-600">Page {page}/{totalPages}</div>

                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="px-2 py-1 text-sm rounded border bg-white disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}

              {!loading && !error && jobs === null && <div className="text-sm text-slate-500">No data loaded.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}