/**
 * StaffFilters.tsx
 *
 * Collapsible filter panel used on the Staff Market page.
 *
 * Changes:
 * - Country dropdown values are the ISO code only (value={c.code}).
 * - Country display uses "Name (CODE)".
 * - Country items include a human readable name computed via Intl.DisplayNames.
 *
 * Layout and behavior preserved.
 */

import React from 'react'
import { ChevronDown, Filter } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * StaffFiltersProps
 *
 * Props accepted by the StaffFilters component.
 */
export interface StaffFiltersProps {
  roleFilter: string
  onRoleFilterChange: (v: string) => void
  skillsFilter: string
  onSkillsFilterChange: (v: string) => void
  salaryMode: 'any' | 'below' | 'above'
  onSalaryModeChange: (v: 'any' | 'below' | 'above') => void
  salaryValue: string
  onSalaryValueChange: (v: string) => void
  countryFilter: string
  onCountryFilterChange: (v: string) => void
  /**
   * onReload
   *
   * Optional callback that should perform a canonical reload of the staff list
   * (must re-fetch the hired_staff/hired list). This is called when a global
   * 'staff:reload' event is dispatched (e.g. after an assignment).
   */
  onReload?: () => void
}

/**
 * PanelHeader
 *
 * Small header used to toggle the collapsible panel.
 *
 * @param props.open whether panel is open
 * @param props.onToggle toggle handler
 * @param props.children header children
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
 * SkillItem
 *
 * Interface representing a skill row from skills_master.
 */
interface SkillItem {
  id: string
  name: string
}

/**
 * CountryItem
 *
 * Represents a discovered country_code value.
 */
interface CountryItem {
  code: string
  key: string
  /** Human readable country name (derived from code) */
  name: string
}

/**
 * getCountryName
 *
 * Map an ISO country code to a human readable name using Intl.DisplayNames when available.
 * Falls back to the code when mapping is not possible.
 *
 * @param code country ISO code (string)
 * @returns display name or code
 */
function getCountryName(code: string) {
  try {
    // Intl.DisplayNames expects region codes (ISO 3166-1 alpha-2/alpha-3)
    // @ts-ignore - DisplayNames may not exist in some environments
    if (typeof Intl !== 'undefined' && (Intl as any).DisplayNames) {
      const dn = new (Intl as any).DisplayNames(['en'], { type: 'region' })
      const name = dn.of(code)
      if (name) return name
    }
  } catch {
    // ignore and fall back
  }
  return code
}

/**
 * StaffFilters
 *
 * Renders the filter UI with role, skills, country_code and salary filters.
 * Country dropdown is server-backed and filters data server-side in the parent.
 *
 * @param props StaffFiltersProps
 */
export default function StaffFilters({
  roleFilter,
  onRoleFilterChange,
  skillsFilter,
  onSkillsFilterChange,
  salaryMode,
  onSalaryModeChange,
  salaryValue,
  onSalaryValueChange,
  countryFilter,
  onCountryFilterChange,
  onReload,
}: StaffFiltersProps): JSX.Element {
  const [open, setOpen] = React.useState<boolean>(false)

  const canonicalRoles = ['drivers', 'mechanics', 'dispatchers', 'managers', 'directors'] as const
  const [roles, setRoles] = React.useState<string[]>(['all', ...canonicalRoles])
  const [skills, setSkills] = React.useState<SkillItem[]>([])
  const [loadingSkills, setLoadingSkills] = React.useState<boolean>(false)

  const [countries, setCountries] = React.useState<CountryItem[]>([])
  const [loadingCountries, setLoadingCountries] = React.useState<boolean>(false)
  const [countriesError, setCountriesError] = React.useState<string | null>(null)

  /**
   * Fetch distinct job categories from unemployed_staff.job_category
   * Merge results with canonicalRoles so canonical roles appear first.
   */
  React.useEffect(() => {
    let mounted = true
    async function fetchRoles() {
      try {
        const res = await fetch('/rest/v1/unemployed_staff?select=job_category')
        if (!res.ok) {
          if (mounted) setRoles(['all', ...canonicalRoles])
          return
        }
        const data = await res.json()
        const found = new Set<string>()
        for (const row of data) {
          const v = (row?.job_category || '').trim()
          if (v) found.add(v)
        }

        const extras: string[] = []
        for (const v of Array.from(found)) {
          if (!canonicalRoles.includes(v as any)) extras.push(v)
        }
        extras.sort((a, b) => a.localeCompare(b))

        const final = ['all', ...canonicalRoles, ...extras]
        if (mounted) setRoles(final)
      } catch {
        if (mounted) setRoles(['all', ...canonicalRoles])
      }
    }
    fetchRoles()
    return () => {
      mounted = false
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * loadSkillsForCategory
   *
   * Loads skills (id + name) from skills_master for the currently selected category.
   * Skills UI is hidden until a specific category is chosen.
   */
  React.useEffect(() => {
    let mounted = true
    async function loadSkills() {
      setLoadingSkills(true)
      try {
        if (!roleFilter || roleFilter === 'all') {
          if (mounted) {
            setSkills([])
            onSkillsFilterChange('all')
            setLoadingSkills(false)
          }
          return
        }

        const encoded = encodeURIComponent(roleFilter)
        const url = `/rest/v1/skills_master?select=id,name&category=eq.${encoded}&order=name.asc`
        const res = await fetch(url)
        if (!res.ok) {
          if (mounted) {
            setSkills([])
            onSkillsFilterChange('all')
          }
          return
        }
        const data = await res.json()
        const normalized: SkillItem[] = Array.isArray(data)
          ? data
              .map((r: any) => {
                return { id: String(r.id), name: String(r.name ?? '').trim() }
              })
              .filter((s) => s.name)
          : []

        if (mounted) {
          setSkills(normalized)
          onSkillsFilterChange('all')
        }
      } catch {
        // ignore fetch errors
      } finally {
        if (mounted) setLoadingSkills(false)
      }
    }

    loadSkills()
    return () => {
      mounted = false
    }
    // only when roleFilter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter])

  /**
   * fetchCountries
   *
   * Pages the unemployed_staff table to gather distinct country_code rows.
   * - Uses supabase-js paging (.range) only
   * - Dedupes by country_code
   * - Does NOT query or depend on a country name column
   *
   * Runs once on mount.
   */
  React.useEffect(() => {
    let mounted = true

    async function fetchCountries() {
      setLoadingCountries(true)
      setCountriesError(null)

      try {
        const chunk = 1000
        let from = 0
        const seen = new Set<string>()

        while (mounted) {
          const to = from + chunk - 1

          const { data, error } = await supabase
            .from('unemployed_staff')
            .select('country_code')
            .not('country_code', 'is', null)
            .range(from, to)

          if (error) {
            // surface the error in console for debugging but stop paging
            // eslint-disable-next-line no-console
            console.error('Country fetch error:', error)
            break
          }

          if (!data || data.length === 0) break

          for (const r of data) {
            const code = (r?.country_code ?? '').toString().trim()
            if (code) seen.add(code)
          }

          if (data.length < chunk) break
          from += chunk
        }

        const arr = Array.from(seen)
          .sort()
          .map((code) => ({ key: code, code, name: getCountryName(code) }))

        if (mounted) {
          setCountries(arr)
          if (arr.length === 0) {
            setCountriesError('No country codes found in unemployed_staff.')
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
        if (mounted) {
          setCountries([])
          setCountriesError('Failed to load countries.')
        }
      } finally {
        if (mounted) setLoadingCountries(false)
      }
    }

    fetchCountries()
    return () => {
      mounted = false
    }
  }, [])

  /**
   * Listen for global staff reload events.
   *
   * When other components dispatch `window.dispatchEvent(new CustomEvent('staff:reload'))`
   * this listener will call onReload if provided. This ensures there is one canonical
   * reload path for the staff list (parent should implement onReload to re-fetch).
   */
  React.useEffect(() => {
    function handleReload() {
      onReload?.()
    }

    if (typeof window === 'undefined') return
    window.addEventListener('staff:reload', handleReload)
    return () => {
      window.removeEventListener('staff:reload', handleReload)
    }
  }, [onReload])

  const numericSalary = React.useMemo(() => {
    const n = Number(salaryValue)
    if (Number.isNaN(n)) return 0
    return Math.max(0, Math.min(10000, Math.round(n)))
  }, [salaryValue])

  /**
   * setMode
   *
   * Helper to change salary mode.
   */
  function setMode(m: 'any' | 'below' | 'above') {
    onSalaryModeChange(m)
  }

  const skillsDisabled = !roleFilter || roleFilter === 'all'

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
              {/* Show country label with a loaded count; keep styling unchanged */}
              <label className="text-xs text-slate-600">
                Country{loadingCountries ? ' (loading...)' : countries.length > 0 ? ` (${countries.length})` : ''}
              </label>
            </div>

            <div className="flex items-center md:justify-start">
              <label className="text-xs text-slate-600">Salary</label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start w-full">
            {/* Category + (skills hidden when no role selected) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <select
                  value={roleFilter}
                  onChange={(e) => onRoleFilterChange(e.target.value)}
                  className="border px-4 py-2 rounded w-full md:w-full"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r === 'all' ? 'All' : r[0].toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skills select is removed/hidden when no category is chosen */}
              {!skillsDisabled && (
                <div className="flex items-center gap-3">
                  <select
                    value={skillsFilter}
                    onChange={(e) => onSkillsFilterChange(e.target.value)}
                    className={`border px-3 py-2 rounded w-full text-sm ${loadingSkills ? 'opacity-80' : ''}`}
                    disabled={loadingSkills}
                  >
                    {loadingSkills ? (
                      <option>Loading skills…</option>
                    ) : (
                      <>
                        <option value="all">All skills</option>
                        {skills.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Middle column: country selector (server-backed, country_code only) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <select
                  value={countryFilter}
                  onChange={(e) => onCountryFilterChange(e.target.value)}
                  className={`border px-4 py-2 rounded w-full md:w-full ${loadingCountries ? 'opacity-80' : ''}`}
                  disabled={loadingCountries}
                >
                  <option value="all">All</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Minimal inline error message to surface failures without changing layout */}
              {countriesError && <div className="text-xs text-rose-600">{countriesError}</div>}
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
                <span>{numericSalary > 0 ? `${numericSalary}` : ''}</span>
                <span>10,000+</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}