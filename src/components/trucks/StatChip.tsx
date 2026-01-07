/**
 * StatChip.tsx
 *
 * Tiny reusable stat chip showing an icon, label and value.
 *
 * Used inside TruckCard for compact metrics (condition, mileage, etc).
 */

import React from 'react'

/**
 * StatChipProps
 *
 * Props for the StatChip component.
 */
interface StatChipProps {
  icon?: React.ReactNode
  label: string
  value: React.ReactNode
  className?: string
}

/**
 * StatChip
 *
 * Render a small stat cell with optional icon, compact label and value.
 *
 * @param props - StatChipProps
 */
export default function StatChip({ icon, label, value, className = '' }: StatChipProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {icon ? <div className="p-1 rounded bg-gray-50 flex items-center justify-center">{icon}</div> : null}
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-medium text-slate-800 truncate">{value}</div>
      </div>
    </div>
  )
}