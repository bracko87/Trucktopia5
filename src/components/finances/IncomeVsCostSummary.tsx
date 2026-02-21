/**
 * IncomeVsCostSummary.tsx
 *
 * Full-width final card showing Income / Expenses / Net.
 * This component also exposes a compact range selector (daily, weekly, monthly, yearly, total)
 * which is intended to control the calculation level used by the parent OverviewPanel.
 */

import React from 'react'
import clsx from 'clsx'

/**
 * Props
 *
 * Props accepted by the IncomeVsCostSummary component.
 */
interface Props {
  income: number
  expenses: number
  /**
   * selectedRange
   *
   * Current selected range from the parent (used to render active state).
   */
  selectedRange?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total'
  /**
   * onRangeChange
   *
   * Callback invoked when user selects a different range tab.
   */
  onRangeChange?: (r: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total') => void
}

/**
 * formatCurrency
 *
 * Formats a number to a USD-like rounded string.
 *
 * @param n number
 * @returns string
 */
function formatCurrency(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

/**
 * IncomeVsCostSummary
 *
 * Renders the big final summary card and the compact range tabs used for client-side slicing.
 *
 * @param props Props
 * @returns JSX.Element
 */
export default function IncomeVsCostSummary({ income, expenses, selectedRange = 'monthly', onRangeChange }: Props) {
  const net = income - expenses
  const isPositive = net >= 0

  const ranges: Array<{ key: Props['selectedRange']; label: string }> = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly', label: 'Yearly' },
    { key: 'total', label: 'Total' },
  ]

  /**
   * handleSelectRange
   *
   * Notify parent that the selected range changed.
   *
   * @param r range key
   */
  function handleSelectRange(r: Props['selectedRange']) {
    if (onRangeChange) onRangeChange(r)
  }

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Total Balance Overview</h3>
          <p className="text-sm text-slate-500">Aggregated totals and variance</p>
        </div>

        {/* Compact range tabs specific to this card */}
        <div className="mt-1">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {ranges.map((r) => {
              const active = r.key === selectedRange
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => handleSelectRange(r.key)}
                  className={clsx(
                    'px-3 py-1 text-xs rounded-md transition',
                    active ? 'bg-white shadow text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 rounded-lg p-4">
          <div className="text-xs text-emerald-700">Income</div>
          <div className="text-xl font-semibold text-emerald-900">{formatCurrency(income)}</div>
        </div>

        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-xs text-red-700">Expenses</div>
          <div className="text-xl font-semibold text-red-900">{formatCurrency(expenses)}</div>
        </div>

        <div className={clsx('rounded-lg p-4', isPositive ? 'bg-emerald-100' : 'bg-red-100')}>
          <div className="text-xs text-slate-600">Net result</div>
          <div className={clsx('text-xl font-bold', isPositive ? 'text-emerald-900' : 'text-red-900')}>
            {isPositive ? '+' : ''}
            {formatCurrency(net)}
          </div>
        </div>
      </div>
    </div>
  )
}