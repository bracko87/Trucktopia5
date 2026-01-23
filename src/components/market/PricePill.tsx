/**
 * PricePill.tsx
 *
 * Presentational component showing a job's price/reward with full numeric formatting.
 *
 * - Shows a locale-aware full number (no "k"/"M" abbreviations).
 * - For USD the dollar sign ($) is shown instead of 'USD'.
 * - Keeps original visual styling and accepts an optional `compact` prop
 *   (keeps compatibility with existing callers that pass compact).
 */

import React from 'react'

/**
 * PricePillProps
 *
 * Props for the PricePill component.
 */
export interface PricePillProps {
  /** Numeric amount (optional) */
  amount?: number | null
  /** Currency code (e.g. 'EUR', 'USD') */
  currency?: string | null
  /** Additional classname for styling */
  className?: string
  /** Compatibility flag (no visual change, kept to avoid breaking existing calls) */
  compact?: boolean
}

/**
 * formatAmount
 *
 * Format numeric amount into a full locale-aware string.
 *
 * - Uses the user's locale for thousands separators.
 * - Preserves two decimals when the amount has fractional part.
 *
 * @param amount - numeric amount
 * @returns formatted string
 */
function formatAmount(amount?: number | null) {
  if (amount == null || Number.isNaN(amount)) return '-'
  const num = Number(amount)
  const isInteger = Math.abs(num - Math.round(num)) < 0.000001
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: isInteger ? 0 : 2,
  })
  return formatter.format(num)
}

/**
 * PricePill
 *
 * Stateless presentational component that shows amount + currency.
 *
 * For USD the dollar sign is shown (e.g. "$2,000") instead of the letters "USD".
 *
 * @param props - PricePillProps
 * @returns JSX.Element
 */
export default function PricePill({ amount, currency, className = '' }: PricePillProps) {
  const amountText = formatAmount(amount)
  const cur = currency ? String(currency).trim().toUpperCase() : ''

  // If USD, show $ prefix next to amount and omit the currency letters.
  if (cur === 'USD') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-2 py-1 rounded-md bg-slate-50 border border-slate-100 text-sm font-medium ${className}`}
        aria-hidden="false"
      >
        <span className="text-slate-900 text-lg font-semibold">${amountText}</span>
      </div>
    )
  }

  // Default: show amount and currency code (e.g. "2,000 EUR")
  const curText = cur || ''

  return (
    <div
      className={`inline-flex items-center gap-2 px-2 py-1 rounded-md bg-slate-50 border border-slate-100 text-sm font-medium ${className}`}
      aria-hidden="false"
    >
      <span className="text-slate-900 text-lg font-semibold">{amountText}</span>
      {curText && <span className="text-xs text-slate-500">{curText}</span>}
    </div>
  )
}
