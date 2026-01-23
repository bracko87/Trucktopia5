/**
 * StaffFilters.tsx
 *
 * Collapsible filter panel used on the Staff Market page.
 *
 * - Keeps the existing three-column layout (Category, Country, Salary).
 * - Adds a Skills selector extracted from the `description` column (heuristic).
 * - Keeps Availability selector (static options for now).
 *
 * The component is purely presentational and reports changes via callbacks.
 */

import React from 'react'
import { ChevronDown, Filter } from 'lucide-react'

/**
 * StaffFiltersProps
 *
 * Props accepted by the StaffFilters component.
 */
export interface StaffFiltersProps {
  roleFilter: string
  onRoleFilterChange: (v: string) => void
  countryFilter: string
  countries: string[]
  onCountryFilterChange: (v: string) => void
  availabilityFilter: string
  onAvailabilityFilterChange: (v: string) => void
  skillsFilter: string
  onSkillsFilterChange: (v: string) => void
  salaryMode: 'any' | 'below' | 'above'
  onSalaryModeChange: (v: 'any' | 'below' | 'above') => void
  salaryValue: string
  onSalaryValueChange: (v: string) => void
}

/**
 * Mapping of some common ISO codes -> display names.
 */
const countryNames: Record<string, string> = {
  PT: 'Portugal',
  VN: 'Vietnam',
  AU: 'Australia',
  NZ: 'New Zealand',
  CA: 'Canada',
  MX: 'Mexico',
  US: 'United States',
  USA: 'United States',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  BS: 'Bahamas',
  CU: 'Cuba',
  DO: 'Dominican Republic',
  HT: 'Haiti',
  JM: 'Jamaica',
  CR: 'Costa Rica',
  HN: 'Honduras',
  NI: 'Nicaragua',
  PA: 'Panama',
  AR: 'Argentina',
  BR: 'Brazil',
  CL: 'Chile',
  PL: 'Poland',
  ID: 'Indonesia',
  MY: 'Malaysia',
  PH: 'Philippines',
  TH: 'Thailand',
  LK: 'Sri Lanka',
}

/**
 * getCountryDisplay
 *
 * Return a user-friendly country label.
 *
 * @param country raw country value
 */
function getCountryDisplay(country: string): string {
  if (!country) return ''
  const raw = country.trim()
  if (raw.toLowerCase() === 'all') return 'All'
  const code = raw.toUpperCase()
  if ((code.length <= 3 || /^[A-Z]{2,3}$/.test(code)) && countryNames[code]) {
    return countryNames[code]
  }
  return raw
}

/**
 * countryCodeToEmoji
 *
 * Convert 2-letter ISO code to flag emoji (best-effort).
 *
 * @param code country code
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
 * Try to infer a 2-letter ISO code from a value (code or name).
 *
 * @param country input country
 */
function inferCountryCode(country?: string | null): string | undefined {
  if (!country) return undefined
  const raw = country.trim()
  const maybeCode = raw.toUpperCase()
  if (/^[A-Z]{2,3}$/.test(maybeCode)) return maybeCode.length === 3 && maybeCode === 'USA' ? 'US' : maybeCode.slice(0, 2)
  for (const [code, name] of Object.entries(countryNames)) {
    if (name.toLowerCase() === raw.toLowerCase()) return code.slice(0, 2)
  }
  return undefined
}

/**
 * PanelHeader
 *
 * Small header used to toggle the collapsible panel.
 */
function PanelHeader({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-t-md border border-b-0 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Filter size={16} />
        <span>{children}</span>
      </div>

      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="inline-flex items-center gap-2 text-sm text-slate-600 px-2 py-1 rounded hover:bg-slate-50"
      >
        <span className="sr-only">{open ? 'Collapse filters' : 'Expand filters'}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} />
      </button>
    </div>
  )
}

/**
 * StaffFilters
 *
 * Renders the three-column filter UI and:
 * - Fetches job categories
 * - Extracts skill tokens from the description column (heuristic) and exposes them
 *   in the Skills select so the parent can filter by a chosen skill.
 *
 * @param props StaffFiltersProps
 */
export default function StaffFilters({
  roleFilter,
  onRoleFilterChange,
  countryFilter,
  countries,
  onCountryFilterChange,
  availabilityFilter,
  onAvailabilityFilterChange,
  skillsFilter,
  onSkillsFilterChange,
  salaryMode,
  onSalaryModeChange,
  salaryValue,
  onSalaryValueChange,
}: StaffFiltersProps): JSX.Element {
  const [open, setOpen] = React.useState<boolean>(false)
  const [roles, setRoles] = React.useState<string[]>(['all'])
  const [skills, setSkills] = React.useState<string[]>(['all'])
  const [loadingSkills, setLoadingSkills] = React.useState<boolean>(false)

  /**
   * Fetch distinct job categories from unemployed_staff.job_category
   */
  React.useEffect(() => {
    let mounted = true
    async function fetchRoles() {
      try {
        const res = await fetch('/rest/v1/unemployed_staff?select=job_category&order=job_category')
        if (!res.ok) return
        const data = await res.json()
        const set = new Set<string>()
        data.forEach((row: any) => {
          const v = (row?.job_category || '').trim()
          if (v) set.add(v)
        })
        const arr = Array.from(set).sort((a, b) => a.localeCompare(b))
        if (mounted) setRoles(['all', ...arr])
      } catch {
        // keep default if fetch fails
      }
    }
    fetchRoles()
    return () => {
      mounted = false
    }
  }, [])

  /**
   * fetchSkillsFromDescriptions
   *
   * Heuristically extracts tokens from the description column.
   * - Looks for JSON-style arrays and key:[..] patterns (e.g. skills:[], allowed_cargo_types:[])
   * - Falls back to simple "skills: a, b, c" patterns.
   */
  React.useEffect(() => {
    let mounted = true
    let cancelled = false
    async function fetchSkillsFromDescriptions() {
      setLoadingSkills(true)
      try {
        const res = await fetch('/rest/v1/unemployed_staff?select=description')
        if (!res.ok) return
        const rows = await res.json()
        const set = new Set<string>()
        for (const r of rows) {
          const desc: string = String(r?.description || '')
          if (!desc) continue

          // JSON-like arrays: ["a","b"]
          const jsonArrayRegex = /(\[[^\]]*["'][^\]]*["'][^\]]*\])/g
          const matches = desc.match(jsonArrayRegex) || []
          for (const m of matches) {
            try {
              const parsed = JSON.parse(m)
              if (Array.isArray(parsed)) {
                parsed.forEach((p) => {
                  if (typeof p === 'string' && p.trim()) set.add(p.trim())
                })
                continue
              }
            } catch {
              // ignore JSON parse errors for this match and try simple split
            }
            const inner = m.replace(/^\[|\]$/g, '')
            inner
              .split(',')
              .map((s) => s.replace(/^['"\s]+|['"\s]+$/g, '').trim())
              .filter(Boolean)
              .forEach((s) => set.add(s))
          }

          // key: [a,b] patterns (skills, allowed_cargo_types, etc.)
          const keyArrayRegex = /(?:skills|skill|allowed_cargo_types)\s*:\s*\[([^\]]+)\]/gi
          let k: RegExpExecArray | null
          while ((k = keyArrayRegex.exec(desc))) {
            const inner = k[1] || ''
            inner
              .split(',')
              .map((s) => s.replace(/^['"\s]+|['"\s]+$/g, '').trim())
              .filter(Boolean)
              .forEach((s) => set.add(s))
          }

          // "skills: a, b, c" fallback
          const skillsLabelRegex = /skills?\s*[:\-]\s*([A-Za-z0-9,\s_\/\-]+)/i
          const lm = desc.match(skillsLabelRegex)
          if (lm && lm[1]) {
            lm[1]
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .forEach((s) => set.add(s))
          }
        }

        if (!cancelled && mounted) {
          const arr = Array.from(set)
            .map((s) => s.trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
          setSkills(['all', ...arr])
        }
      } catch {
        // ignore fetch errors
      } finally {
        if (mounted && !cancelled) setLoadingSkills(false)
      }
    }

    fetchSkillsFromDescriptions()
    return () => {
      cancelled = true
      mounted = false
    }
  }, [])

  // Salary numeric derived for the slider display
  const numericSalary = React.useMemo(() => {
    const n = Number(salaryValue)
    if (Number.isNaN(n)) return 0
    return Math.max(0, Math.min(10000, Math.round(n)))
  }, [salaryValue])

  /**
   * setMode
   *
   * Switch salary mode.
   */
  function setMode(m: 'any' | 'below' | 'above') {
    onSalaryModeChange(m)
  }

  // Static availability options (kept for layout parity)
  const availabilityOptions = [
    { value: 'all', label: 'All' },
    { value: 'now', label: 'Available now' },
    { value: '1_week', label: '1 week' },
    { value: '2_weeks', label: '2 weeks' },
    { value: '1_month', label: '1 month' },
    { value: '2_months', label: '2 months' },
  ]

  const selectedCountryEmoji = React.useMemo(() => {
    const code = inferCountryCode(countryFilter)
    return countryCodeToEmoji(code)
  }, [countryFilter])

  return (
    <div className="w-full">
      <PanelHeader open={open} onToggle={() => setOpen((s) => !s)}>
        Filters
      </PanelHeader>

      <div
        className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
        aria-hidden={!open}
      >
        <form className="bg-white p-4 rounded-b-md rounded-tr-md border border-t-0 flex flex-col gap-2 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center w-full">
            <div className="flex items-center md:justify-start">
              <label className="text-xs text-slate-600 w-16 md:w-auto">Category</label>
            </div>

            <div className="flex items-center md:justify-start">
              <label className="text-xs text-slate-600">Country</label>
            </div>

            <div className="flex items-center md:justify-start">
              <label className="text-xs text-slate-600">Salary</label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start w-full">
            {/* Category + Skills (left column) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <select
                  value={roleFilter}
                  onChange={(e) => onRoleFilterChange(e.target.value)}
                  className="border px-4 py-2 rounded w-full md:w-full"
                >
                  {roles.map((r) => (
                    <option key={r} value={r === 'all' ? 'all' : r}>
                      {r === 'all' ? 'All' : r[0].toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={skillsFilter}
                  onChange={(e) => onSkillsFilterChange(e.target.value)}
                  className="border px-3 py-2 rounded w-full text-sm"
                >
                  {loadingSkills ? <option>Loading skills…</option> : null}
                  {skills.map((s) => (
                    <option key={s} value={s}>
                      {s === 'all' ? 'All skills' : s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Country + Availability (middle column) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <select
                  value={countryFilter}
                  onChange={(e) => onCountryFilterChange(e.target.value)}
                  className="border px-4 py-2 rounded w-full md:w-full"
                >
                  <option value="all">All</option>
                  {countries.map((c) => {
                    const code = inferCountryCode(c)
                    const emoji = countryCodeToEmoji(code)
                    const display = getCountryDisplay(c)
                    return (
                      <option key={c} value={c}>
                        {emoji ? `${emoji} ${display}` : display}
                      </option>
                    )
                  })}
                </select>

                <div className="hidden md:flex items-center text-xs text-slate-500 whitespace-nowrap">
                  {countryFilter && countryFilter !== 'all' ? (
                    <>
                      <span className="mr-1">{selectedCountryEmoji}</span>
                      <span>· {getCountryDisplay(countryFilter)}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={availabilityFilter}
                  onChange={(e) => onAvailabilityFilterChange(e.target.value)}
                  className="border px-3 py-2 rounded w-full text-sm"
                >
                  {availabilityOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Salary (right column) */}
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md border overflow-hidden w-full">
                  <button
                    type="button"
                    onClick={() => setMode('any')}
                    className={`px-3 py-1 text-sm flex-1 text-center ${salaryMode === 'any' ? 'bg-black text-white' : 'bg-slate-50 text-slate-700'}`}
                  >
                    Any
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('below')}
                    className={`px-3 py-1 text-sm flex-1 text-center ${salaryMode === 'below' ? 'bg-black text-white' : 'bg-slate-50 text-slate-700'}`}
                  >
                    Below
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('above')}
                    className={`px-3 py-1 text-sm flex-1 text-center ${salaryMode === 'above' ? 'bg-black text-white' : 'bg-slate-50 text-slate-700'}`}
                  >
                    Above
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  aria-label="Salary range"
                  type="range"
                  min={0}
                  max={10000}
                  step={100}
                  value={numericSalary}
                  onChange={(e) => onSalaryValueChange(String(e.target.value))}
                  disabled={salaryMode === 'any'}
                  className={`flex-1 h-2 rounded-lg accent-black ${salaryMode === 'any' ? 'opacity-40' : ''}`}
                />

                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-600">$</div>
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    step={1}
                    value={salaryMode === 'any' ? '' : String(numericSalary)}
                    onChange={(e) => onSalaryValueChange(e.target.value)}
                    placeholder=""
                    className="border px-2 py-1 rounded w-28 text-sm"
                    disabled={salaryMode === 'any'}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 px-4">
                <span>0</span>
                <span>{numericSalary > 0 ? `$${numericSalary}` : ''}</span>
                <span>10,000+</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}