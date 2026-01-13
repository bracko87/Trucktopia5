/**
 * FilterBar.tsx
 *
 * Small reusable filter bar used on the Market page.
 *
 * Presents controls for min reward, max distance, transport mode, cargo type
 * and sort selection. Emits filter changes via onChange callback.
 */

import React from 'react'
import { ChevronDown, Filter } from 'lucide-react'

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
  sortBy:
    | 'reward_desc'
    | 'reward_asc'
    | 'distance_asc'
    | 'distance_desc'
    | 'deadline_soonest'
}

/**
 * Props for FilterBar component.
 */
export interface FilterBarProps {
  filters: MarketFilters
  cargoTypes: string[]
  onChange: (next: MarketFilters) => void
}

/**
 * FilterBar
 *
 * Small presentational filter bar. All changes are emitted up via onChange.
 *
 * @param props - FilterBarProps
 */
export default function FilterBar({ filters, cargoTypes, onChange }: FilterBarProps) {
  function update(partial: Partial<MarketFilters>) {
    onChange({ ...filters, ...partial })
  }

  return (
    <div className="bg-white p-4 rounded-md shadow-sm flex flex-col md:flex-row md:items-center md:gap-4 gap-3">
      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
        <Filter className="w-4 h-4 text-slate-500" />
        <span>Filters</span>
      </div>

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
          <span className="text-xs text-slate-500">Max distance (km)</span>
          <input
            type="number"
            className="w-28 px-2 py-1 border rounded text-sm"
            value={filters.maxDistance ?? ''}
            onChange={(e) => update({ maxDistance: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder="Any"
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

        <label className="flex items-center gap-2 text-sm ml-auto md:ml-0">
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
  )
}