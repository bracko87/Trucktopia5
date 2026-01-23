/**
 * FilterBar.tsx
 *
 * Presentational filter bar used on the Market page.
 * Renders only the primary filter controls (min reward, transport mode,
 * cargo type, sort and other small controls). The countries picker is
 * intentionally omitted here so it can be rendered in a separate box
 * below the main filters by the page.
 */

/**
 * File-level and function JSDoc comments follow project rules.
 */

import React from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * MarketFilters
 *
 * Represents filter & sort state for the Market page.
 */
export interface MarketFilters {
  minReward: number | null
  maxDistance: number | null
  transportMode: 'all' | 'load' | 'trailer'
  cargoType: string | 'all'
  /** Selected countries (multiple) - kept in the filter model but picker is rendered by page) */
  countries?: string[] | null
  sortBy:
    | 'reward_desc'
    | 'reward_asc'
    | 'distance_asc'
    | 'distance_desc'
    | 'deadline_soonest'
  /** Show only followed offers in main list (optional) */
  followedOnly?: boolean
  /** Job offer geographic scope filter */
  jobOfferScope?: 'all' | 'local' | 'state' | 'regional' | 'international'
}

/**
 * FilterBarProps
 *
 * Props for the FilterBar component.
 */
export interface FilterBarProps {
  filters: MarketFilters
  cargoTypes: string[]
  /** Optional countries list passed for debug / integration with CountrySelect */
  countries?: { code: string; name: string; cities: string[] }[] | null
  onChange: (next: MarketFilters) => void
}

/**
 * removeExternalFiltersHeading
 *
 * Remove an external stray heading element that reads "Filters" and matches
 * the classes used by the layout: text-sm font-semibold mb-3.
 *
 * This runs once on mount and is intentionally defensive: it only removes
 * headings whose trimmed text content equals "Filters".
 */
function removeExternalFiltersHeading() {
  try {
    const candidates = Array.from(document.querySelectorAll('h2.text-sm.font-semibold.mb-3'))
    for (const el of candidates) {
      if (el.textContent?.trim() === 'Filters') {
        el.remove()
      }
    }
  } catch {
    // ignore DOM access errors
  }
}

/**
 * removeSortHelper
 *
 * Remove a stray helper div that reads "Sort by reward, distance or deadline."
 * The selector targets divs with the common classes used in the layout and
 * only removes exact text matches to avoid accidental deletions.
 */
function removeSortHelper() {
  try {
    const candidates = Array.from(document.querySelectorAll('div.mt-3.text-xs.text-slate-500'))
    for (const el of candidates) {
      if (el.textContent?.trim() === 'Sort by reward, distance or deadline.') {
        el.remove()
      }
    }
  } catch {
    // ignore DOM access errors
  }
}

/**
 * FilterBar
 *
 * Stateless presentational component that renders the primary filter controls.
 * The countries picker is intentionally omitted here so it can be shown in a
 * separate box under the regular filters by the Market page.
 *
 * @param props - FilterBarProps
 */
export default function FilterBar({ filters, cargoTypes, onChange, countries }: FilterBarProps) {
  /**
   * update
   *
   * Merge partial changes into current filters and call onChange.
   *
   * @param partial - partial MarketFilters updates
   */
  function update(partial: Partial<MarketFilters>) {
    onChange({ ...filters, ...partial })
  }

  React.useEffect(() => {
    // Defensive DOM cleanup (keeps UI tidy)
    removeExternalFiltersHeading()
    removeSortHelper()
  }, [])

  // Temporary debug to verify country normalization and options passed from parent.
  React.useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.log('FILTER COUNTRY:', (filters as any).country ?? filters.countries ?? null)
      // eslint-disable-next-line no-console
      console.log('COUNTRY OPTIONS:', (countries ?? []).map((c) => c.code))
    } catch {
      // ignore
    }
  }, [filters, countries])

  const selectedOthersValue = filters.followedOnly ? 'followed' : filters.jobOfferScope ?? 'all'

  return (
    <>
      <div className="bg-white p-4 rounded-md shadow-sm flex flex-col md:flex-row md:items-center md:gap-4 gap-3">
        {/* Controls container */}
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-xs text-slate-500">Min reward</span>
            <input
              type="number"
              className="w-28 px-2 py-1 border rounded text-sm"
              value={filters.minReward ?? ''}
              onChange={(e) => update({ minReward: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="€0"
              min={0}
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-xs text-slate-500">Mode</span>
            <select
              className="px-2 py-1 border rounded text-sm"
              value={filters.transportMode}
              onChange={(e) => update({ transportMode: e.target.value as MarketFilters['transportMode'] })}
            >
              <option value="all">All</option>
              <option value="load">Load</option>
              <option value="trailer">Trailer</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm min-w-[160px]">
            <span className="text-xs text-slate-500">Cargo type</span>
            <select
              className="px-2 py-1 border rounded text-sm flex-1"
              value={filters.cargoType}
              onChange={(e) => update({ cargoType: e.target.value as MarketFilters['cargoType'] })}
            >
              <option value="all">All</option>
              {cargoTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          {/* Others dropdown: contains Followed and Job Offer types */}
          <label className="flex items-center gap-2 text-sm min-w-[180px]">
            <span className="text-xs text-slate-500">Others</span>
            <select
              className="px-2 py-1 border rounded text-sm"
              value={selectedOthersValue}
              onChange={(e) => {
                const val = e.target.value
                if (val === 'followed') {
                  update({ followedOnly: true })
                } else {
                  update({ jobOfferScope: val as MarketFilters['jobOfferScope'], followedOnly: false })
                }
              }}
            >
              <option value="all">All</option>
              <option value="followed">Followed</option>
              <option value="local">Local</option>
              <option value="state">State</option>
              <option value="regional">Regional</option>
              <option value="international">International</option>
            </select>
          </label>

          {/* Sort control aligned to the right */}
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs text-slate-500">Sort</span>
              <div className="relative">
                <select
                  className="appearance-none px-3 py-1 border rounded pr-6 text-sm"
                  value={filters.sortBy}
                  onChange={(e) => update({ sortBy: e.target.value as MarketFilters['sortBy'] })}
                >
                  <option value="reward_desc">Reward ↓</option>
                  <option value="reward_asc">Reward ↑</option>
                  <option value="distance_asc">Distance ↑</option>
                  <option value="distance_desc">Distance ↓</option>
                  <option value="deadline_soonest">Deadline soonest</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </label>
          </div>
        </div>
      </div>
    </>
  )
}