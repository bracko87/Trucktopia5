/**
 * StaffTabs.tsx
 *
 * Tabs component dividing staff by role and rendering lists for each.
 *
 * IMPORTANT:
 * - This component MUST NOT reshape staff rows.
 * - It must pass the full StaffMember object directly to HiredStaffCard.
 */

import React from 'react'
import HiredStaffCard from './HiredStaffCard'
import type { StaffMember } from '../../lib/staffApi'
import StaffCategoryEffects from './StaffCategoryEffects'
import type { StaffCategory } from '../../lib/staffCategoryEffects'

export interface StaffTabsProps {
  staff: StaffMember[]
  onSalaryUpdated: () => void
}

const CATEGORIES = ['drivers', 'mechanics', 'dispatchers', 'managers', 'directors'] as const
type Category = typeof CATEGORIES[number]

export default function StaffTabs({ staff, onSalaryUpdated }: StaffTabsProps) {
  const [active, setActive] = React.useState<Category>('drivers')

  /**
   * matchesCategory
   *
   * Canonical category matching.
   * - hired staff → job_category
   * - founder logic handled separately
   */
  function matchesCategory(row: StaffMember, category: Category): boolean {
    // --------------------------------------------------
    // Founder handling (CEO / DRIVER)
    // --------------------------------------------------
    if (row.roles && Array.isArray(row.roles)) {
      if (category === 'directors') {
        return row.roles.some((r) => r.key === 'CEO')
      }

      if (category === 'drivers') {
        return row.roles.some((r) => r.key === 'DRIVER')
      }
    }

    // --------------------------------------------------
    // Hired staff (THIS IS THE IMPORTANT FIX)
    // --------------------------------------------------
    if (!row.job_category) return false

    return row.job_category === category
  }

  const filtered = staff.filter((s) => matchesCategory(s, active))

  return (
    <div className="mt-4">
      {/* Tabs */}
      <div className="flex gap-2 overflow-auto">
        {CATEGORIES.map((cat) => {
          const count = staff.filter((s) => matchesCategory(s, cat)).length

          return (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                active === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {capitalize(cat)} ({count})
            </button>
          )
        })}
      </div>

      {/* Staff list */}
      <div className="mt-4 grid gap-3">
        {filtered.length === 0 ? (
          <div className="p-6 bg-white rounded shadow-sm text-sm text-slate-500">
            No staff in this role yet.
          </div>
        ) : (
          filtered.map((member) => (
            <HiredStaffCard
              key={member.id}
              member={member}
              onSalaryUpdated={onSalaryUpdated}
              currentCategory={active}
            />
          ))
        )}
      </div>

      {/* Category effects (skills / positions / bonuses) */}
      <StaffCategoryEffects category={active as StaffCategory} />
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
