/**
 * TruckRow.tsx
 *
 * Small presentational row component that renders a single truck's data.
 */

import React from 'react'

/**
 * UserPublicTruck
 *
 * Minimal shape expected from user.public_trucks rows.
 */
export interface UserPublicTruck {
  /** Primary id */
  id?: string
  /** Human readable model/name */
  model?: string | null
  /** Status string (available, on job, etc) */
  status?: string | null
  /** Location text or city name */
  location?: string | null
  /** Owner user id */
  owner_user_id?: string | null
  /** Owner company id */
  owner_company_id?: string | null
  /** Created timestamp */
  created_at?: string | null
  [key: string]: any
}

/**
 * TruckRowProps
 *
 * Props for the TruckRow component.
 */
interface TruckRowProps {
  truck: UserPublicTruck
}

/**
 * TruckRow
 *
 * Render a single table row for a truck with accessible markup.
 *
 * @param props TruckRowProps
 * @returns JSX.Element
 */
export default function TruckRow({ truck }: TruckRowProps): JSX.Element {
  return (
    <tr className="odd:bg-white even:bg-gray-50">
      <td className="border-t px-4 py-3 text-sm">{truck.id ?? '—'}</td>
      <td className="border-t px-4 py-3 text-sm">{truck.model ?? 'Unknown model'}</td>
      <td className="border-t px-4 py-3 text-sm">{truck.status ?? '—'}</td>
      <td className="border-t px-4 py-3 text-sm">{truck.location ?? '—'}</td>
      <td className="border-t px-4 py-3 text-sm">{truck.created_at ? new Date(truck.created_at).toLocaleString() : '—'}</td>
    </tr>
  )
}