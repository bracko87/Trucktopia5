/**
 * StaffRow.tsx
 *
 * Single staff row (small card) used inside lists.
 */

import React from 'react'

/**
 * StaffRowProps
 *
 * Minimal props for a staff row.
 */
export interface StaffRowProps {
  id: string
  name?: string | null
  role?: string | null
  email?: string | null
  phone?: string | null
  hired_at?: string | null
}

/**
 * StaffRow
 *
 * Shows avatar initial, name, meta information and small actions placeholder.
 *
 * @param props StaffRowProps
 * @returns JSX.Element
 */
export default function StaffRow({ name, role, email, phone, hired_at }: StaffRowProps) {
  const initial = (name && name[0]) || '?'
  return (
    <div className="flex items-center justify-between bg-white rounded p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold">
          {initial}
        </div>
        <div>
          <div className="font-medium text-slate-900">{name || 'Unnamed'}</div>
          <div className="text-xs text-slate-500">
            {role ? capitalize(role) : 'Role unknown'} • {hired_at ? new Date(hired_at).toLocaleDateString() : '—'}
          </div>
          <div className="text-xs text-slate-400 mt-1">{email || phone || ''}</div>
        </div>
      </div>

      <div className="text-sm text-slate-500">ID: {String(Math.random()).slice(2, 8)}</div>
    </div>
  )
}

/**
 * capitalize
 *
 * Capitalize first letter of a string.
 */
function capitalize(s?: string | null) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}