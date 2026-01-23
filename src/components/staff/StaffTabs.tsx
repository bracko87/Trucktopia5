/**
 * StaffTabs.tsx
 *
 * Tabs component dividing staff by role and rendering lists for each.
 */

import React from 'react'
import StaffRow from './StaffRow'
import type { StaffMember } from '../../lib/staffApi'

/**
 * Props for StaffTabs.
 */
export interface StaffTabsProps {
  staff: StaffMember[]
}

/**
 * StaffTabs
 *
 * Renders five tabs (Drivers, Mechanics, Dispatchers, Managers, Directors)
 * and shows lists of staff for the active role.
 *
 * @param props StaffTabsProps
 * @returns JSX.Element
 */
export default function StaffTabs({ staff }: StaffTabsProps) {
  const roles = ['drivers', 'mechanics', 'dispatchers', 'managers', 'directors'] as const
  const [active, setActive] = React.useState<typeof roles[number]>('drivers')

  const roleMap = {
    drivers: 'driver',
    mechanics: 'mechanic',
    dispatchers: 'dispatcher',
    managers: 'manager',
    directors: 'director',
  } as const

  const filtered = staff.filter(s => {
    const r = (s.role || '').toLowerCase()
    return r === roleMap[active]
  })

  return (
    <div className="mt-4">
      <div className="flex gap-2 overflow-auto">
        {roles.map(r => (
          <button
            key={r}
            onClick={() => setActive(r)}
            className={`px-3 py-1 rounded-md text-sm font-medium ${
              active === r ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {capitalize(r)} ({staff.filter(s => (s.role || '').toLowerCase() === roleMap[r]).length})
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {filtered.length === 0 ? (
          <div className="p-6 bg-white rounded shadow-sm text-sm text-slate-500">No staff in this role yet.</div>
        ) : (
          filtered.map(s => (
            <StaffRow
              key={s.id}
              id={s.id}
              name={s.name}
              role={s.role}
              email={s.email}
              phone={s.phone}
              hired_at={s.hired_at}
            />
          ))
        )}
      </div>
    </div>
  )
}

/**
 * capitalize
 *
 * Capitalizes the provided string.
 */
function capitalize(s?: string) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}