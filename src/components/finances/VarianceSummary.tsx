/**
 * VarianceSummary.tsx
 *
 * Small summary component showing totals and variance.
 */

import React from 'react'

/**
 * Props
 *
 * Income and expense totals (numbers).
 */
interface Props {
  income: number
  expenses: number
}

/**
 * formatCurrency
 *
 * Formats to USD-like string.
 *
 * @param n number
 * @returns string
 */
function formatCurrency(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

/**
 * VarianceSummary
 *
 * Displays income / expenses and variance compactly.
 *
 * @param props Props
 * @returns JSX.Element
 */
export default function VarianceSummary({ income, expenses }: Props) {
  const net = income - expenses
  const isPositive = net >= 0

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <div className="flex gap-4 items-center">
        <div>
          <div className="text-xs text-emerald-700">Income</div>
          <div className="text-lg font-semibold text-emerald-800">{formatCurrency(income)}</div>
        </div>

        <div>
          <div className="text-xs text-red-700">Expenses</div>
          <div className="text-lg font-semibold text-red-800">{formatCurrency(expenses)}</div>
        </div>

        <div>
          <div className="text-xs text-slate-600">Variance</div>
          <div className={isPositive ? 'text-lg font-bold text-emerald-900' : 'text-lg font-bold text-red-900'}>
            {isPositive ? '+' : ''}
            {formatCurrency(net)}
          </div>
        </div>
      </div>
    </div>
  )
}