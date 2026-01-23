/**
 * StaffStats.tsx
 *
 * Small header stats component: total staff and per-role counts.
 *
 * Renders compact role chips using a strict black-and-white palette.
 */

import React from 'react'

/**
 * StaffCounts
 *
 * Counts per role structure.
 */
export interface StaffCounts {
  total: number
  drivers: number
  mechanics: number
  dispatchers: number
  managers: number
  directors: number
}

/**
 * StaffStatsProps
 *
 * Props for StaffStats component.
 */
export interface StaffStatsProps {
  counts: StaffCounts
}

/**
 * StaffStats
 *
 * Displays the total staff and per-role chips using only black and white colors.
 *
 * @param props StaffStatsProps
 * @returns JSX.Element
 */
export default function StaffStats({ counts }: StaffStatsProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <div className="text-sm text-slate-500">Total staff</div>
        <div className="mt-1 text-2xl font-bold text-slate-900">{counts.total}</div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <RoleChip label="Drivers" count={counts.drivers} />
        <RoleChip label="Mechanics" count={counts.mechanics} />
        <RoleChip label="Dispatchers" count={counts.dispatchers} />
        <RoleChip label="Managers" count={counts.managers} />
        <RoleChip label="Directors" count={counts.directors} />
      </div>
    </div>
  )
}

/**
 * RoleChip
 *
 * Small pill used to show a role and count. Uses only black & white colors.
 *
 * @param props {label, count}
 */
function RoleChip({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 bg-white text-black border border-black/10">
      <span className="font-semibold">{count}</span>
      <span className="opacity-80">{label}</span>
    </div>
  )
}