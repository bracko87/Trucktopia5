/**
 * StaffCard.tsx
 *
 * Compact card showing a candidate's summary with optional expanded details.
 * Provides a hire handler that calls the server-side RPC `hire_unemployed_staff`
 * which atomically inserts into `hired_staff` and deletes the `unemployed_staff` row.
 *
 * Notes:
 * - Uses the safe server-side RPC approach: client only sends unemployed_id.
 * - All DB delete/insert logic runs inside the RPC (SECURITY DEFINER) on the server.
 * - Component notifies parent via onHire callback when hire succeeds.
 */

import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router'

/**
 * StaffMember
 *
 * Represents a row from unemployed_staff (partial).
 */
export interface StaffMember {
  id: string
  name?: string | null
  role?: string | null
  country?: string | null
  expected_salary_cents?: number | null
  expected_salary?: number | null
  experience_years?: number | null
  bio?: string | null
  skills?: string[] | null
  availability?: string | null
  available?: boolean | null
  hiring_fee_rate?: number | null
  age?: number | null
}

/**
 * ResolvedSkill
 *
 * Represents a resolved skill retrieved from skills_master.
 */
interface ResolvedSkill {
  raw: string
  display: string
  description?: string | null
}

/**
 * Props
 *
 * - candidate: StaffMember to render
 * - onHire: optional callback invoked after a successful hire with (candidateId, hiredRow)
 */
export default function StaffCard({
  candidate,
  onHire,
}: {
  candidate: StaffMember
  onHire?: (candidateId: string, hiredRow: any) => void
}): JSX.Element {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [flagLoaded, setFlagLoaded] = useState(false)
  const [showEmojiFallback, setShowEmojiFallback] = useState(false)
  const [resolvedSkills, setResolvedSkills] = useState<ResolvedSkill[] | null>(null)
  const [hired, setHired] = useState(false)
  const [hiring, setHiring] = useState(false)
  const [dbAge, setDbAge] = useState<number | null | undefined>(candidate.age ?? undefined)

  /**
   * Base salary (numeric). Compute once to avoid repeated conversions.
   * - prefer expected_salary_cents / 100
   * - fallback to expected_salary numeric
   * - final fallback = 0
   */
  const baseSalary =
    candidate.expected_salary_cents != null
      ? candidate.expected_salary_cents / 100
      : candidate.expected_salary != null
      ? Number(candidate.expected_salary)
      : 0

  // Hiring rate (decimal) and derived amounts
  const hiringRate = computeHiringRate(candidate)
  const hiringFee = baseSalary * hiringRate
  const totalHiringCost = baseSalary + hiringFee

  const countryInput = candidate.country ?? candidate.country
  const code = inferCountryCode(countryInput)
  const emoji = countryCodeToEmoji(code)
  const countryDisplay = getCountryDisplay(countryInput)
  const flagUrl = code ? `https://flagcdn.com/${code.toLowerCase()}.svg` : undefined

  useEffect(() => {
    if (!flagUrl || !candidate.name) return
    setShowEmojiFallback(false)
    setFlagLoaded(false)
    const img = new Image()
    img.onload = () => setFlagLoaded(true)
    img.onerror = () => setShowEmojiFallback(true)
    img.src = flagUrl
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [flagUrl, candidate.name])

  /**
   * Resolve skills to name + description using skills_master.
   * If skills look already human (not UUID) we keep them as-is with no description.
   */
  useEffect(() => {
    let mounted = true
    async function resolve() {
      const raw = candidate.skills || []
      if (raw.length === 0) {
        if (mounted) setResolvedSkills([])
        return
      }

      const appearsNamed = raw.some((s) => !uuidRegex.test(s))
      if (appearsNamed) {
        if (mounted) {
          const arr = raw.map((r) => ({ raw: r, display: r, description: undefined }))
          setResolvedSkills(arr)
        }
        return
      }

      const unique = Array.from(new Set(raw))
      const mapping = await fetchSkillNames(unique)
      const ordered: ResolvedSkill[] = raw.map((s) => {
        const m = mapping[s]
        return {
          raw: s,
          display: m?.name ?? s,
          description: m?.description,
        }
      })
      if (mounted) setResolvedSkills(ordered)
    }
    resolve()
    return () => {
      mounted = false
    }
  }, [candidate.skills])

  useEffect(() => {
    let mounted = true
    async function fetchAge() {
      if (!candidate.id) return
      if (candidate.age != null) {
        if (mounted) setDbAge(candidate.age)
        return
      }
      try {
        const res = await supabase.from('unemployed_staff').select('age').eq('id', candidate.id).limit(1).maybeSingle()
        // @ts-ignore
        if (mounted && res && res.data && typeof res.data.age === 'number') {
          setDbAge(res.data.age)
        }
      } catch {
        // ignore
      }
    }
    fetchAge()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id])

  const resolved = resolvedSkills ?? (candidate.skills ? candidate.skills.map((s) => ({ raw: s, display: s })) : [])
  const availabilityText = humanizeAvailability(candidate.availability)

  /**
   * handleHire
   *
   * Calls the server-side RPC `hire_unemployed_staff(unemployed_id uuid)` which:
   *  - inserts a row into hired_staff (mapping fields server-side)
   *  - deletes the unemployed_staff row
   *  - returns the inserted hired_staff row
   *
   * Client only provides the unemployed_id. This keeps the operation atomic and
   * avoids giving the client direct INSERT/DELETE privileges.
   */
  /**
   * handleHire
   *
   * Attempt to hire the candidate by calling the server RPC.
   * This version logs authentication/session info and full RPC errors
   * to help debugging why the RPC returns P0001/400.
   */
  async function handleHire() {
    if (hired || hiring) return
    setHiring(true)

    try {
      const { data, error } = await supabase.rpc('hire_unemployed_staff', {
        unemployed_id: candidate.id,
      })

      if (error) {
        console.error('hire_unemployed_staff RPC error:', error)
        toast.error(error.message)
        setHiring(false)
        return
      }

      if (!data) {
        toast.error('Hire failed: no data returned')
        setHiring(false)
        return
      }

      console.log('hire_unemployed_staff RPC success', data)

      // Only update UI after a real successful response with data
      setHired(true)
      toast.success('Candidate hired')

      // Optional: keep market UI clean if parent handles it
      onHire?.(candidate.id, data)

      setHiring(false)

      // 🔥 Trigger refetch by navigating to Staff page
      navigate('/staff')
    } catch (err: any) {
      console.error('Unexpected error calling hire_unemployed_staff:', err)
      toast.error(err?.message ?? 'Failed to hire candidate')
      setHiring(false)
    }
  }

  const ageDisplay = dbAge != null ? `${dbAge} yrs` : candidate.age != null ? `${candidate.age} yrs` : '—'

  return (
    <article className="bg-white rounded-xl shadow p-0 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <SectionBox align="center" className="md:col-span-1">
          <div className="flex items-center gap-3 w-full">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-700 flex-shrink-0">
              {candidate.name ? candidate.name.charAt(0).toUpperCase() : '?'}
            </div>

            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate flex items-center gap-2">
                <span className="truncate">{candidate.name}</span>

                {flagUrl && !showEmojiFallback ? (
                  flagLoaded ? (
                    <img
                      src={flagUrl}
                      alt={`${countryDisplay} flag`}
                      className="w-5 h-3 object-cover rounded-sm"
                      width={24}
                      height={16}
                      style={{ display: 'inline-block' }}
                    />
                  ) : (
                    <span className="w-5 h-3 inline-block" />
                  )
                ) : (
                  <span aria-hidden className="text-base">
                    {emoji}
                  </span>
                )}

                <span className="text-sm text-slate-700 truncate">{countryDisplay}</span>
              </div>

              <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                <span
                  className={`text-sm font-medium px-2 py-1 rounded-full inline-flex items-center gap-2 ${
                    candidate.role && candidate.role.toLowerCase().includes('driver') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-800 border border-slate-200'
                  }`}
                >
                  {candidate.role ?? 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </SectionBox>

        <SectionBox className="justify-start" align="start">
          <div className="w-full text-left">
            <div className="text-sm text-slate-700 font-medium mb-2">
              <span className="font-semibold">Experience:</span>{' '}
              <span className="font-normal">{candidate.experience_years != null ? `${candidate.experience_years} yrs` : 'Unknown'}</span>
            </div>

            <div className="text-sm text-slate-700">
              <span className="font-semibold">Skills:</span>{' '}
              <span className="font-normal">
                {resolved.length > 0 ? (
                  <>
                    {resolved.slice(0, 3).map((r) => r.display).join(', ')}
                    {Math.max(0, resolved.length - 3) > 0 ? <span className="text-xs text-slate-500"> {' '}+{resolved.length - 3} more</span> : null}
                  </>
                ) : (
                  <span className="text-slate-400">No skills listed</span>
                )}
              </span>
            </div>
          </div>
        </SectionBox>

        <SectionBox align="end">
          <div className="flex items-center gap-4 justify-end w-full">
            <div className="flex-1 min-w-[140px]">
              <div className="flex flex-col items-start gap-1">
                <span
                  className={`text-sm font-medium px-2 py-1 rounded-full inline-flex items-center gap-2 ${
                    candidate.available ?? !!candidate.availability ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {candidate.available ?? !!candidate.availability ? 'Available' : 'Unavailable'}
                </span>
                {availabilityText ? <span className="text-xs text-slate-500">{availabilityText}</span> : null}
              </div>
            </div>

            <div className="flex-1 min-w-[180px]">
              <div className="text-right">
                <div className="text-sm text-slate-700 font-medium">
                  <span className="font-semibold">Total Hiring Cost:</span>{' '}
                  <span className="font-semibold text-emerald-700">
                    {baseSalary > 0
                      ? new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0,
                        }).format(totalHiringCost)
                      : '—'}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  <div className="flex justify-end gap-4">
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Salary</div>
                      <div className="text-sm text-slate-700 font-medium">
                        {baseSalary > 0
                          ? new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              maximumFractionDigits: 0,
                            }).format(baseSalary)
                          : '—'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-500">Hiring fee</div>
                      <div className="text-sm text-emerald-700 font-medium">
                        {baseSalary > 0
                          ? new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              maximumFractionDigits: 0,
                            }).format(hiringFee)
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setOpen((s) => !s)}
                className="p-2 border rounded text-slate-700 bg-slate-50 hover:bg-slate-100"
                aria-expanded={open}
                aria-label={open ? 'Collapse details' : 'Open details'}
              >
                <Menu size={16} />
              </button>
            </div>
          </div>
        </SectionBox>
      </div>

      {open && (
        <div className="pt-2 border-t border-slate-100 p-4">
          {candidate.bio ? <p className="text-sm text-slate-700 mb-3">{candidate.bio}</p> : null}

          <div className="flex items-center justify-between mb-0 gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-[120px]">
              <div>
                <div className="text-xs text-slate-500">Age</div>
                <div className="text-sm text-slate-700 font-medium">{ageDisplay}</div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 mb-2">Skills (description)</div>
              <div className="flex flex-wrap gap-2">
                {resolved.length > 0 ? (
                  resolved.map((r, idx) => (
                    <div key={`${r.raw}-${idx}`} className="inline-flex items-center gap-2">
                      <SkillBadge name={r.display} description={r.description} />
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400">No skills listed</div>
                )}
              </div>
            </div>

            <div className="min-w-[110px] flex-shrink-0">
              <button
                type="button"
                onClick={handleHire}
                disabled={hired || hiring}
                className={`w-full px-4 py-2 rounded-md text-white font-medium ${hired ? 'bg-slate-300 text-slate-600 cursor-default' : hiring ? 'bg-emerald-500/90 hover:bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                aria-pressed={hired}
                aria-busy={hiring}
                aria-label={hired ? 'Hired' : hiring ? 'Hiring candidate' : 'Hire candidate'}
                style={{ pointerEvents: hired ? 'none' : 'auto' }}
              >
                {hiring ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    Hiring...
                  </span>
                ) : hired ? (
                  'Hired'
                ) : (
                  'Hire'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

/**
 * countryNameFallbacks
 *
 * Country name fallback map when Intl.DisplayNames is unavailable.
 */
const countryNameFallbacks: Record<string, string> = {
  PT: 'Portugal',
  US: 'United States',
  GB: 'United Kingdom',
  VN: 'Vietnam',
  AU: 'Australia',
  NZ: 'New Zealand',
  CA: 'Canada',
  MX: 'Mexico',
  PH: 'Philippines',
  ID: 'Indonesia',
  MY: 'Malaysia',
  TH: 'Thailand',
  LK: 'Sri Lanka',
  BR: 'Brazil',
  AR: 'Argentina',
  CL: 'Chile',
  PL: 'Poland',
  BS: 'Bahamas',
  CU: 'Cuba',
}

/**
 * countryCodeToEmoji
 *
 * Convert a 2-letter ISO code to a flag emoji.
 */
function countryCodeToEmoji(code?: string | null): string {
  if (!code) return ''
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  const first = 0x1f1e6 + (c.charCodeAt(0) - 65)
  const second = 0x1f1e6 + (c.charCodeAt(1) - 65)
  return String.fromCodePoint(first, second)
}

/**
 * inferCountryCode
 *
 * Try to infer a 2-letter country code from code or name.
 */
function inferCountryCode(country?: string | null): string | undefined {
  if (!country) return undefined
  const raw = country.trim()
  const maybeCode = raw.toUpperCase()
  if (/^[A-Z]{2,3}$/.test(maybeCode)) return maybeCode.length === 3 && maybeCode === 'USA' ? 'US' : maybeCode.slice(0, 2)
  for (const [code, name] of Object.entries(countryNameFallbacks)) {
    if (name.toLowerCase() === raw.toLowerCase()) return code.slice(0, 2)
  }
  return undefined
}

/**
 * getCountryDisplay
 *
 * Friendly country label, prefer Intl.DisplayNames.
 */
function getCountryDisplay(input?: string | null): string {
  if (!input) return 'Unknown'
  const code = inferCountryCode(input)
  if (code) {
    try {
      // @ts-ignore runtime check for environments that support Intl.DisplayNames
      if (typeof Intl !== 'undefined' && (Intl as any).DisplayNames) {
        // @ts-ignore
        const dn = new (Intl as any).DisplayNames(['en'], { type: 'region' })
        // @ts-ignore
        const name = dn.of(code)
        if (name) return name
      }
    } catch {
      // ignore and fallback
    }
    return countryNameFallbacks[code] ?? input
  }
  return input
}

/**
 * SectionBox
 *
 * Small presentational wrapper for each section inside the card.
 */
function SectionBox({
  children,
  align = 'start',
  className = '',
}: {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  const alignClass = align === 'center' ? 'items-center' : align === 'end' ? 'items-end' : 'items-start'
  return <div className={`p-4 flex ${alignClass} min-h-[64px] ${className}`}>{children}</div>
}

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * fetchSkillNames
 *
 * Fetch name + description from skills_master for a list of ids/codes.
 */
async function fetchSkillNames(values: string[]): Promise<Record<string, { name: string; description?: string | null }>> {
  if (!values || values.length === 0) return {}
  const unique = Array.from(new Set(values))
  const looksLikeUUIDs = unique.every((v) => uuidRegex.test(v))
  try {
    let rows: Array<{ id?: string; code?: string; name?: string; description?: string | null }> = []
    if (looksLikeUUIDs) {
      const { data, error } = await supabase.from('skills_master').select('id,code,name,description').in('id', unique)
      if (!error && data && data.length > 0) rows = data
      else {
        const res2 = await supabase.from('skills_master').select('id,code,name,description').in('code', unique)
        rows = res2.data ?? []
      }
    } else {
      const { data, error } = await supabase.from('skills_master').select('id,code,name,description').in('code', unique)
      if (!error && data && data.length > 0) rows = data
      else {
        const res2 = await supabase.from('skills_master').select('id,code,name,description').in('id', unique)
        rows = res2.data ?? []
      }
    }

    const map: Record<string, { name: string; description?: string | null }> = {}
    for (const r of rows) {
      const displayName = r.name ?? r.code ?? r.id ?? ''
      if (r.id) map[r.id] = { name: displayName, description: r.description }
      if (r.code) map[r.code] = { name: displayName, description: r.description }
    }
    return map
  } catch {
    return {}
  }
}

/**
 * sanitizeDescription
 *
 * Produce a plain text string from a possibly structured description value.
 *
 * Rules:
 * - If the description looks like JSON array or object, attempt JSON.parse and extract strings/numbers.
 * - Otherwise extract bracket contents like allowed_cargo_types:[...]
 * - Replace underscores/hyphens with spaces and remove most punctuation.
 * - Collapse multiple spaces into single space and trim.
 * - Convert standalone numeric tokens to percentages (e.g. 8 -> 8%).
 *
 * @param raw raw description string
 * @returns sanitized plain text or empty string
 */
function sanitizeDescription(raw?: string | null): string {
  if (!raw) return ''
  const s = raw.trim()

  let out = ''

  // Try JSON parse first and extract text tokens
  try {
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) {
        out = parsed
          .flatMap((v) => (v == null ? [] : typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v)))
          .map((t) => String(t))
          .join(' ')
      } else if (typeof parsed === 'object' && parsed !== null) {
        out = Object.values(parsed)
          .flatMap((v) => (v == null ? [] : typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v)))
          .map((t) => String(t))
          .join(' ')
      }
    }
  } catch {
    // fallthrough to regex extraction
  }

  // Extract bracketed lists like allowed_cargo_types:[ "a","b" ] or key:[a,b]
  if (!out) {
    const bracketListRegex = /\[[^\]]+\]/g
    const matches = s.match(bracketListRegex)
    if (matches && matches.length > 0) {
      const toks: string[] = []
      for (const m of matches) {
        const inner = m.replace(/^\[|\]$/g, '')
        inner
          .split(',')
          .map((x) => x.replace(/["'\s]+/g, '').replace(/[_\-]+/g, ' ').trim())
          .filter(Boolean)
          .forEach((t) => toks.push(t))
      }
      if (toks.length > 0) out = toks.join(' ')
    }
  }

  // Fallback: remove punctuation and special chars, replace underscores/hyphens with spaces
  if (!out) {
    out = s
      .replace(/[_\-]+/g, ' ')
      .replace(/["'`{}\[\]\(\)\.<>\:;,@#\$%\^&\*\+=\\\/|~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } else {
    out = out
      .replace(/[_\-]+/g, ' ')
      .replace(/["'`{}\[\]\(\)\.<>\:;,@#\$%\^&\*\+=\\\/|~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Convert standalone numeric tokens to percentages.
   * - Matches integers and decimals not already followed by a percent sign.
   * - Example: "8" -> "8%"; "8.5" -> "8.5%"; "8%" remains "8%".
   */
  out = out.replace(/\b(\d+(?:\.\d+)?)(?!%)(?=\b)/g, (_m, p1) => `${p1}%`)

  return out
}

/**
 * humanizeAvailability
 *
 * Convert stored availability tokens to readable strings.
 */
function humanizeAvailability(v?: string | null): string | null {
  if (!v) return null
  const raw = v.trim().toLowerCase()
  if (raw === 'now' || raw === 'available' || raw === 'available_now') return 'Available now'
  const weekMatch = raw.match(/^(\d+)[_-]?(week|weeks)$/)
  if (weekMatch) {
    const n = Number(weekMatch[1])
    return `Available in ${n} ${n === 1 ? 'week' : 'weeks'}`
  }
  const monthMatch = raw.match(/^(\d+)[_-]?(month|months)$/)
  if (monthMatch) {
    const n = Number(monthMatch[1])
    return `Available in ${n} ${n === 1 ? 'month' : 'months'}`
  }
  return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * SkillBadge
 *
 * Displays skill name and a small sanitized description text (plain words only).
 * Truncates description to 30 characters with ellipsis; full text is available on hover via title.
 */
function SkillBadge({ name, description }: { name: string; description?: string | null }) {
  const plain = sanitizeDescription(description)
  const MAX_LEN = 30

  // If the sanitized description is longer than MAX_LEN, truncate and append ellipsis.
  const display = plain && plain.length > MAX_LEN ? `${plain.slice(0, MAX_LEN).trim()}...` : plain

  return (
    <div title={plain || undefined} className="inline-flex items-center gap-3 bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs">
      <div className="flex items-center gap-2">
        <span className="font-medium">{name}</span>
        {display ? <span className="text-xs text-slate-500 ml-2">{display}</span> : null}
      </div>
    </div>
  )
}

/**
 * computeHiringRate
 *
 * Compute hiring fee rate for the game's rules.
 *
 * Mapping:
 * - explicit candidate.hiring_fee_rate -> use as-is
 * - 'now' / 'available' / 'available_now' -> 50%
 * - '1_week' / '1-week' / '1week' -> 30%
 * - '2_weeks' / '2-weeks' / '2weeks' -> 10%
 * - '3_weeks' / '3-weeks' / '3weeks' -> 0%
 * - default -> 20%
 *
 * @param candidate StaffMember
 * @returns fee rate as decimal (e.g. 0.3 for 30%)
 */
function computeHiringRate(candidate: StaffMember): number {
  if (candidate.hiring_fee_rate != null) return candidate.hiring_fee_rate

  const raw = (candidate.availability || '').toString().trim().toLowerCase()

  switch (raw) {
    case 'now':
    case 'available':
    case 'available_now':
      return 0.5

    case '1_week':
    case '1-week':
    case '1week':
      return 0.3

    case '2_weeks':
    case '2-weeks':
    case '2weeks':
      return 0.1

    case '3_weeks':
    case '3-weeks':
    case '3weeks':
      return 0.0

    default:
      return 0.2
  }
}