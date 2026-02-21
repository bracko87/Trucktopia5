/**
 * TimeRangeSelector.tsx
 *
 * Small reusable time-range selector used by finance views.
 */

import React from 'react'
import clsx from 'clsx'

/**
 * TimeRange
 *
 * Supported time ranges.
 */
export type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total'

interface Props {
  value: TimeRange
  onChange: (v: TimeRange) => void
}

/**
 * TimeRangeSelector
 *
 * Render a compact segmented selector for time ranges.
 *
 * @param props Props
 * @returns JSX.Element
 */
export default function TimeRangeSelector({ value, onChange }: Props) {
  const RANGES: { key: TimeRange; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'total', label: 'Total' },
  ]

  return (
    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={clsx(
            'px-3 py-1 text-xs rounded-md transition',
            value === r.key ? 'bg-white shadow text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}