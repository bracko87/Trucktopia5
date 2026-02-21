/**
 * HiredStaffPage.tsx
 *
 * Production screen that lists hired staff using the useHiredStaff hook.
 * - Shows loading / error states and renders HiredStaffCard for each member.
 */

import React from 'react'
import HiredStaffCard from '@/components/staff/HiredStaffCard'
import { useHiredStaff } from '@/hooks/useHiredStaff'

/**
 * HiredStaffPage
 *
 * Page component rendering the hired staff list.
 *
 * @returns JSX.Element
 */
export default function HiredStaffPage(): JSX.Element {
  const { data, loading, error } = useHiredStaff()

  if (loading) {
    return <div className="p-6 text-slate-500">Loading hired staff…</div>
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        Failed to load hired staff
        <br />
        <span className="text-sm text-slate-500">{error}</span>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return <div className="p-6 text-slate-500">No hired staff found.</div>
  }

  return (
    <div className="space-y-4 p-6">
      {data.map((member) => (
        <HiredStaffCard key={member.id} member={member} />
      ))}
    </div>
  )
}