/**
 * IncomeExpenseChart.tsx
 *
 * Area chart + donut panel.
 */

import React from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import DonutPanel, { IncomeExpensePoint } from './DonutPanel'
import { TimeRange } from '../TimeRangeSelector'

export type { IncomeExpensePoint }

function formatCurrency(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

/**
 * AreaSection
 * FIX: Give chart a real height so ResponsiveContainer can render.
 */
function AreaSection({ data }: { data: IncomeExpensePoint[] }) {
  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fill: '#64748b' }} />
          <YAxis tick={{ fill: '#64748b' }} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />

          <Area
            type="monotone"
            dataKey="income"
            stroke="#10B981"
            fill="rgba(16,185,129,0.18)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="expenses"
            stroke="#EF4444"
            fill="rgba(239,68,68,0.14)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface Props {
  data?: IncomeExpensePoint[]
  range?: TimeRange
}

export default function IncomeExpenseChart({ data, range = 'monthly' }: Props) {
  const chartData: IncomeExpensePoint[] =
    data && data.length
      ? data
      : [
          { label: 'May', income: 18000, expenses: 11200 },
          { label: 'Jun', income: 22000, expenses: 14500 },
          { label: 'Jul', income: 20000, expenses: 15800 },
          { label: 'Aug', income: 25000, expenses: 17000 },
        ]

  const rangeLabelMap: Record<TimeRange, string> = {
    daily: 'Today',
    weekly: 'Last 4 weeks',
    monthly: 'Last 4 months',
    yearly: 'Last 12 months',
    total: 'All time',
  }

  return (
    <div className="flex flex-col space-y-4">
      {/* Area chart */}
      <div className="bg-white p-4 rounded-xl shadow h-[350px] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Income & expenses</h3>
          <div className="text-xs text-slate-400">{rangeLabelMap[range]}</div>
        </div>

        <div className="flex-1 min-h-0">
          <AreaSection data={chartData} />
        </div>
      </div>

      {/* Donut */}
      <DonutPanel data={chartData} />
    </div>
  )
}
