/**
 * ExpandableBreakdown.tsx
 *
 * Reusable UI component that renders an estimate breakdown compactly and can be
 * expanded to reveal the full yearly lines, mileage addition and cumulative base.
 *
 * Visual behavior:
 * - Default: collapsed (shows a concise summary).
 * - Click the header to toggle full details. Chevron rotates and content expands with a simple transition.
 */

import React, { useMemo, useState } from 'react'
import type { FC } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * ExpandableBreakdownProps
 *
 * Props for the ExpandableBreakdown component.
 */
export interface ExpandableBreakdownProps {
  breakdown?: any
  currentMileage?: number
}

/**
 * moneyFormatter
 *
 * Format cents into USD string (same style used elsewhere).
 */
const moneyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/**
 * ExpandableBreakdown
 *
 * Displays a short summary of the estimate breakdown and allows expanding to
 * view the full yearly breakdown and supporting totals.
 *
 * @param props - component props
 */
const ExpandableBreakdown: FC<ExpandableBreakdownProps> = ({ breakdown, currentMileage }) => {
  const [open, setOpen] = useState(false)

  const {
    lines,
    mileageInfo,
    cumulativeBase,
  } = useMemo(() => {
    if (!breakdown) {
      return { lines: [], mileageInfo: null, cumulativeBase: null }
    }

    const arr: number[] = Array.isArray(breakdown.yearlyBreakdown) ? breakdown.yearlyBreakdown : []
    const blocks = breakdown.mileageBlocks ?? Math.floor((Number(currentMileage ?? 0) / 50000))
    const mileageCostCents = breakdown.mileageCost ?? blocks * (breakdown.truckClass === 'small' ? 4500 : breakdown.truckClass === 'medium' ? 6500 : 8500)

    const computedLines = arr.map((v: number, i: number) => {
      if (i === 0) {
        return { label: `Year ${i + 1}`, cents: v }
      }
      const increments = arr.slice(1, i + 1).reduce((s, n) => s + n, 0)
      return { label: `Year ${i + 1}`, cents: arr[0] + increments }
    })

    const cumulative = (breakdown.totalBeforeGarage ?? 0)

    return {
      lines: computedLines,
      mileageInfo: { blocks, mileageCostCents },
      cumulativeBase: cumulative,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown, currentMileage])

  const firstLineText = lines.length > 0 ? `${lines[0].label}: ${moneyFormatter.format(lines[0].cents / 100)}` : '—'
  const cumulativeText = cumulativeBase !== null ? moneyFormatter.format(cumulativeBase / 100) : '—'

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">Estimate breakdown</div>
          <div className="text-sm text-slate-700 mt-1">{firstLineText}</div>
        </div>

        <button
          aria-expanded={open}
          onClick={() => setOpen((s) => !s)}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700"
        >
          <span className="hidden sm:inline">View details</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} />
        </button>
      </div>

      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-250 ease-in-out ${open ? 'mt-3 max-h-[1200px] opacity-100' : 'mt-2 max-h-0 opacity-0'}`}
      >
        <ul className="list-disc list-inside ml-4 mt-1 text-sm text-slate-600">
          {lines.length === 0 ? <li>—</li> : lines.map((line, i) => <li key={i}>{`${line.label}: ${moneyFormatter.format(line.cents / 100)}`}</li>)}
        </ul>

        <div className="text-xs text-slate-500 mt-2">
          Mileage addition: {mileageInfo ? `${moneyFormatter.format(mileageInfo.mileageCostCents / 100)} (${mileageInfo.blocks} x 50,000 km)` : '—'}
        </div>
        <div className="text-xs text-slate-500 mt-1">Cumulative base: {cumulativeText}</div>
      </div>
    </div>
  )
}

export default ExpandableBreakdown
