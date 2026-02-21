/**
 * Currency.tsx
 *
 * Reusable currency formatter component.
 *
 * - Formats numeric values using Intl.NumberFormat.
 * - Defaults to en-US / USD if no locale/currency provided.
 */

import React from 'react'

/**
 * CurrencyProps
 *
 * Props for the Currency formatter component.
 */
export interface CurrencyProps {
  /** Numeric value to format. If missing or NaN renders a dash. */
  value?: number | null
  /** ISO currency code, e.g. 'USD' */
  currency?: string
  /** BCP 47 locale string, e.g. 'en-US' */
  locale?: string
  /** Additional classes forwarded to the wrapper element */
  className?: string
  /** Whether to show two fraction digits (default true) */
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

/**
 * Currency
 *
 * Formats a numeric value as a currency string using Intl.NumberFormat.
 * Safe for server-side rendering: returns plain fallback when Intl is unavailable.
 *
 * Example: <Currency value={217} currency="USD" /> -> "$217.00"
 */
export default function Currency({
  value,
  currency = 'USD',
  locale = 'en-US',
  className,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
}: CurrencyProps) {
  // Defensive: handle missing or invalid numbers.
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return <span className={className}>—</span>
  }

  // Format using Intl.NumberFormat. If Intl not available, fall back to simple formatting.
  try {
    const nf = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    })
    return <span className={className}>{nf.format(Number(value))}</span>
  } catch {
    // Fallback: basic USD-style formatting
    const f = Number(value).toFixed(Math.max(0, minimumFractionDigits))
    const symbol = currency === 'USD' ? '$' : ''
    return (
      <span className={className}>
        {symbol}
        {f}
      </span>
    )
  }
}