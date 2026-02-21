/**
 * InsuranceChart.tsx
 *
 * Simple area chart showing aggregated insurance transactions (premiums vs claims)
 * over time. Uses recharts and provides a sensible default dataset.
 */

import React from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

/**
 * InsurancePoint
 *
 * Single point for the insurance transactions series.
 */
export interface InsurancePoint {
  label: string
  premiums: number
  claims: number
}

/**
 * InsuranceChartProps
 *
 * Props for the InsuranceChart component.
 */
interface InsuranceChartProps {
  /** Time series data. If not provided, sample data will be used. */
  data?: InsurancePoint[]
}

/**
 * formatCurrency
 *
 * Formats a number into a compact USD string.
 *
 * @param n number
 * @returns string
 */
function formatCurrency(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

/**
 * InsuranceChart
 *
 * Renders an area chart with two series: premiums (green) and claims (red).
 * The container provides an explicit height so ResponsiveContainer can render.
 *
 * @param props InsuranceChartProps
 * @returns JSX.Element
 */
export default function InsuranceChart({ data }: InsuranceChartProps): JSX.Element {
  const chartData: InsurancePoint[] =
    data && data.length
      ? data
      : [
          { label: 'May', premiums: 8200, claims: 1200 },
          { label: 'Jun', premiums: 9500, claims: 2000 },
          { label: 'Jul', premiums: 7800, claims: 1600 },
          { label: 'Aug', premiums: 10200, claims: 2300 },
          { label: 'Sep', premiums: 8800, claims: 900 },
          { label: 'Oct', premiums: 9100, claims: 1400 },
          { label: 'Nov', premiums: 9700, claims: 1200 },
          { label: 'Dec', premiums: 11000, claims: 2700 },
        ]

  return (
    <div className="bg-white p-4 rounded-xl shadow h-[320px] min-h-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Insurance transactions</h3>
        <div className="text-xs text-slate-400">All insurance transactions</div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fill: '#64748b' }} />
              <YAxis tick={{ fill: '#64748b' }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area
                type="monotone"
                dataKey="premiums"
                stroke="#10B981"
                fill="rgba(16,185,129,0.14)"
                strokeWidth={2}
                name="Premiums"
              />
              <Area
                type="monotone"
                dataKey="claims"
                stroke="#EF4444"
                fill="rgba(239,68,68,0.10)"
                strokeWidth={2}
                name="Claims"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}