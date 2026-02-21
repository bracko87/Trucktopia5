/**
 * TopBreakdown.tsx
 *
 * Top income & expense categories — real data only.
 */

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export interface CategoryItem {
  name: string
  amount: number
}

interface Props {
  income: CategoryItem[]
  expenses: CategoryItem[]
}

/**
 * formatCurrency
 *
 * Formats a number as a dollar string for display in tooltips and lists.
 *
 * @param v number value to format
 * @returns formatted currency string
 */
function formatCurrency(v: number) {
  return `${Math.round(v).toLocaleString()}`
}

/**
 * humanize
 *
 * Converts an underscore-separated code into a human-readable title case string.
 *
 * @param code string code to humanize
 * @returns humanized string
 */
function humanize(code: string) {
  return code
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * TopBreakdown
 *
 * Renders two small bar charts (income and expenses) plus top lists.
 * Uses a fixed pixel height for ResponsiveContainer to ensure charts render
 * even when parent flex containers collapse or don't provide a height.
 *
 * @param props income and expenses arrays
 * @returns JSX.Element
 */
export default function TopBreakdown({ income, expenses }: Props) {
  const topIncome = [...income].sort((a, b) => b.amount - a.amount).slice(0, 5)
  const topExpenses = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5)

  return (
    <div className="space-y-10">
      {/* INCOME */}
      <div>
        <div className="text-xs text-slate-500 mb-2">Top income sources</div>

        {/* Use explicit numeric height on ResponsiveContainer so charts render even if parent has no computed height */}
        <div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topIncome} barCategoryGap="12%">
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                labelFormatter={(l) => humanize(String(l))}
              />
              <Bar dataKey="amount" fill="#10B981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <ul className="mt-3 space-y-1 text-sm">
          {topIncome.map((c) => (
            <li key={c.name} className="flex justify-between">
              <span>{humanize(c.name)}</span>
              <span className="font-medium">{formatCurrency(c.amount)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* EXPENSES */}
      <div className="pt-6 border-t border-slate-100">
        <div className="text-xs text-slate-500 mb-2">Top expenses</div>

        {/* Same explicit height for the expense chart */}
        <div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topExpenses} barCategoryGap="12%">
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                labelFormatter={(l) => humanize(String(l))}
              />
              <Bar dataKey="amount" fill="#EF4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <ul className="mt-3 space-y-1 text-sm">
          {topExpenses.map((c) => (
            <li key={c.name} className="flex justify-between">
              <span>{humanize(c.name)}</span>
              <span className="font-medium">{formatCurrency(c.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
