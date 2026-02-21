/**
 * InsuranceSection.tsx
 *
 * Small reusable card representing a single insurance category (Cargo/Truck/Trailer).
 */

import React from 'react'

/**
 * InsuranceSectionProps
 *
 * Props for InsuranceSection component.
 */
export interface InsuranceSectionProps {
  /** Section title (e.g. "Cargo Insurance") */
  title: string
  /** Short description text */
  description?: string
  /** Number of active policies */
  policiesCount?: number
  /** Callback when user clicks Refresh */
  onRefresh?: () => void
  /** Callback when user clicks Add Policy */
  onAdd?: () => void
}

/**
 * InsuranceSection
 *
 * Renders a compact card used to display a single insurance category summary
 * with actions. Designed to be visually identical to other finance cards.
 *
 * @param props InsuranceSectionProps
 * @returns JSX.Element
 */
export default function InsuranceSection({
  title,
  description,
  policiesCount = 0,
  onRefresh,
  onAdd,
}: InsuranceSectionProps): JSX.Element {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm h-full flex flex-col justify-between">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
        <div className="mt-3 text-xs text-slate-600">Active policies: <span className="font-medium text-slate-800">{policiesCount}</span></div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-2 border border-slate-200 rounded hover:bg-slate-50 transition text-sm"
        >
          Refresh
        </button>

        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition text-sm"
        >
          Add Policy
        </button>
      </div>
    </div>
  )
}