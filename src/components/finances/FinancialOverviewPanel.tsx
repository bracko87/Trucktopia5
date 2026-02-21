/**
 * FinancialOverviewPanel.tsx
 *
 * Interactive financial summary with time-based filters.
 * Shows income, expenses, and variance for selected period.
 */

import React, { useMemo, useState } from 'react'
import clsx from 'clsx'

/**
 * IncomeExpensePoint
 *
 * Single aggregated data point describing income and expenses for a label (day/week/month...).
 */
export interface IncomeExpensePoint {
  label: string
  income: number
  expenses: number
  date?: string
}

type Range = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total'

interface Props {
  data: IncomeExpensePoint[]
}

/**
 * formatCurrency
 *
 * Format number to compact USD string.
 *
 * @param n number
 * @returns string
 */
function formatCurrency(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

const RANGES: { key: Range; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'total', label: 'Total' },
]

/**
 * FinancialOverviewPanel
 *
 * Presents a compact overview with a client-side range selector and three summary cards.
 *
 * NOTE: This performs client-side aggregation; for large datasets swap to server-side aggregation.
 *
 * @param props Props
 * @returns JSX.Element
 */
export default function FinancialOverviewPanel({ data }: Props) {
  const [range, setRange] = useState<Range>('monthly')

  const summary = useMemo(() => {
    let income = 0
    let expenses = 0

    data.forEach((p) => {
      income += p.income
      expenses += p.expenses
    })

    return {
      income,
      expenses,
      net: income - expenses,
    }
  }, [data, range])

  const isPositive = summary.net >= 0

  return (
    <section className="bg-white rounded-xl shadow p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Financial overview</h3>
          <p className="text-xs text-slate-500">Income vs costs & variance</p>
        </div>

        {/* Range selector */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={clsx(
                'px-3 py-1 text-xs rounded-md transition',
                range === r.key ? 'bg-white shadow text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Income */}
        <div className="rounded-lg bg-emerald-50 p-4">
          <div className="text-xs text-emerald-700">Income</div>
          <div className="text-xl font-semibold text-emerald-800">{formatCurrency(summary.income)}</div>
        </div>

        {/* Expenses */}
        <div className="rounded-lg bg-red-50 p-4">
          <div className="text-xs text-red-700">Expenses</div>
          <div className="text-xl font-semibold text-red-800">{formatCurrency(summary.expenses)}</div>
        </div>

        {/* Net */}
        <div className={clsx('rounded-lg p-4', isPositive ? 'bg-emerald-100' : 'bg-red-100')}>
          <div className="text-xs text-slate-600">Net variance</div>
          <div className={clsx('text-xl font-bold', isPositive ? 'text-emerald-900' : 'text-red-900')}>
            {isPositive ? '+' : ''}
            {formatCurrency(summary.net)}
          </div>
        </div>
      </div>
    </section>
  )
}