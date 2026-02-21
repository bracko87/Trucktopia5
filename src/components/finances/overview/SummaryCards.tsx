/**
 * SummaryCards.tsx
 *
 * Presents three financial summary metric cards.
 *
 * The component accepts props so data can be provided by the parent OverviewPanel.
 */

import React from 'react'

/**
 * SummaryCardsProps
 *
 * Props required by the SummaryCards component.
 */
interface SummaryCardsProps {
  balance: number
  pendingPayouts: number
  monthlySpend: number
}

/**
 * formatCurrency
 *
 * Formats a numeric value as USD for display.
 *
 * @param v number
 * @returns string
 */
function formatCurrency(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * SummaryCards
 *
 * Renders three cards: Company balance, Pending payouts, Monthly spend.
 *
 * @param props SummaryCardsProps
 * @returns JSX.Element
 */
export default function SummaryCards({
  balance,
  pendingPayouts,
  monthlySpend,
}: SummaryCardsProps): JSX.Element {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="text-xs text-slate-500">Company balance</div>
        <div className="text-2xl font-semibold mt-2">{formatCurrency(balance)}</div>
        <div className="text-sm text-slate-500 mt-1">Available funds</div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        <div className="text-xs text-slate-500">Pending payouts</div>
        <div className="text-2xl font-semibold mt-2">{formatCurrency(pendingPayouts)}</div>
        <div className="text-sm text-slate-500 mt-1">Scheduled</div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        <div className="text-xs text-slate-500">Monthly spend</div>
        <div className="text-2xl font-semibold mt-2">{formatCurrency(monthlySpend)}</div>
        <div className="text-sm text-slate-500 mt-1">This period</div>
      </div>
    </section>
  )
}