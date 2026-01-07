/**
 * TruckTable.tsx
 *
 * Table component that renders a list of public trucks.
 */

import React from 'react'
import TruckRow, { UserPublicTruck } from './TruckRow'

/**
 * TruckTableProps
 *
 * Props for TruckTable.
 */
interface TruckTableProps {
  trucks: UserPublicTruck[]
}

/**
 * TruckTable
 *
 * Render a list of trucks as a responsive table.
 *
 * @param props TruckTableProps
 * @returns JSX.Element
 */
export default function TruckTable({ trucks }: TruckTableProps): JSX.Element {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full table-fixed">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-sm text-gray-600 w-1/6">ID</th>
            <th className="px-4 py-2 text-left text-sm text-gray-600 w-2/6">Model</th>
            <th className="px-4 py-2 text-left text-sm text-gray-600 w-1/6">Status</th>
            <th className="px-4 py-2 text-left text-sm text-gray-600 w-1/6">Location</th>
            <th className="px-4 py-2 text-left text-sm text-gray-600 w-1/6">Added</th>
          </tr>
        </thead>
        <tbody>
          {trucks.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={5}>
                No trucks found
              </td>
            </tr>
          ) : (
            trucks.map((t) => <TruckRow key={t.id ?? JSON.stringify(t)} truck={t} />)
          )}
        </tbody>
      </table>
    </div>
  )
}