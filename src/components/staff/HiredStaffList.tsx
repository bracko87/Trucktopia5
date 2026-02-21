/**
 * HiredStaffList.tsx
 *
 * Presentational list component for hired_staff rows.
 *
 * Notes:
 * - This component no longer performs its own data fetching.
 * - It expects the parent to provide staff data and loading state.
 */

import React from 'react'
import HiredStaffCard from './HiredStaffCard'
import { StaffMember } from '../../lib/staffApi'

/**
 * Props for HiredStaffList
 */
interface HiredStaffListProps {
  /** Array of staff items provided by parent */
  staff: StaffMember[]
  /** Loading indicator from parent */
  loading?: boolean
  /** Optional error message to display */
  error?: string | null
}

/**
 * HiredStaffList
 *
 * Renders the provided hired staff list.
 *
 * @param props - HiredStaffListProps
 * @returns JSX.Element
 */
export default function HiredStaffList({
  staff,
  loading,
  error,
}: HiredStaffListProps): JSX.Element {
  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold mb-3">Hired Staff</h2>

      {loading ? (
        <div className="p-6 bg-white rounded shadow-sm text-sm text-slate-500">Loading hired staff…</div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-100 rounded text-rose-700">{error}</div>
      ) : !staff || staff.length === 0 ? (
        <div className="p-6 bg-white rounded shadow-sm text-sm text-slate-500">No hired staff found for this company.</div>
      ) : (
        <div className="grid gap-3">
          {staff.map((m) => (
            <HiredStaffCard key={m.id} member={m as any} />
          ))}
        </div>
      )}
    </div>
  )
}