/**
 * TrucksFilter.tsx
 *
 * Small reusable search + filter form used on the Trucks page.
 *
 * Provides:
 * - Search input for name / registration / id
 * - Status select filter
 * - Refresh button
 */

import React from 'react'
import { Search, RefreshCw, Filter } from 'lucide-react'

/**
 * TrucksFilterProps
 *
 * Props for the TrucksFilter component.
 */
interface TrucksFilterProps {
  searchValue: string
  onSearchChange: (next: string) => void
  statusValue: string
  onStatusChange: (next: string) => void
  onRefresh?: () => void
}

/**
 * TrucksFilter
 *
 * Presentational search + filter form that keeps a compact inline layout.
 *
 * @param props - TrucksFilterProps
 * @returns JSX.Element
 */
export default function TrucksFilter({
  searchValue,
  onSearchChange,
  statusValue,
  onStatusChange,
  onRefresh,
}: TrucksFilterProps): JSX.Element {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            aria-label="Search trucks"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, registration or id"
            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded bg-white text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center text-sm text-slate-500">
            <Filter className="w-4 h-4 mr-2 text-slate-400" />
            <label className="sr-only">Status</label>
          </div>

          <select
            aria-label="Filter by status"
            value={statusValue}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-sm px-3 py-2 border border-slate-200 rounded bg-white"
          >
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="in_use">In use</option>
            <option value="assigned">Assigned</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4 text-slate-600" />
          Refresh
        </button>
      </div>
    </div>
  )
}