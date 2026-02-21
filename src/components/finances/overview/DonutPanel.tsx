/**
 * DonutPanel.tsx
 *
 * Standalone donut chart panel used in the finances overview.
 * Renders a styled card with a donut chart and a centered summary.
 * The container height is fixed to 350px to match the requested sizing.
 */

import React from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

/**
 * IncomeExpensePoint
 *
 * Represents a monthly point with label, income and expenses.
 */
export interface IncomeExpensePoint {
  label: string
  income: number
  expenses: number
}

interface Props {
  data?: IncomeExpensePoint[]
}

/**
 * formatCurrency
 *
 * Formats a number into a simple currency string (rounded).
 *
 * @param n number
 * @returns string
 */
function formatCurrency(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

/**
 * DonutPanel
 *
 * Renders a self-contained card with a donut chart and centered totals.
 * The container height is fixed to 350px.
 *
 * @param props optional data array
 * @returns JSX.Element
 */
export default function DonutPanel({ data }: Props) {
  const chartData =
    data && data.length
      ? data
      : [
          { label: 'May', income: 18000, expenses: 11200 },
          { label: 'Jun', income: 22000, expenses: 14500 },
          { label: 'Jul', income: 20000, expenses: 15800 },
          { label: 'Aug', income: 25000, expenses: 17000 },
        ]

  const totals = chartData.reduce(
    (a, p) => {
      a.income += p.income
      a.expenses += p.expenses
      return a
    },
    { income: 0, expenses: 0 }
  )

  const total = totals.income + totals.expenses
  const net = totals.income - totals.expenses

  const pieData = [
    { name: 'Income', value: totals.income },
    { name: 'Expenses', value: totals.expenses },
  ]

  const COLORS = ['#10B981', '#EF4444']

  return (
    <div className="bg-white p-4 rounded-xl shadow mt-4 h-[350px] min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <radialGradient id="donut-inner-grad" cx="50%" cy="40%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.0)" />
                <stop offset="60%" stopColor="rgba(0,0,0,0.03)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.06)" />
              </radialGradient>

              <filter id="donut-drop" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.06" />
              </filter>
            </defs>

            <Pie
              data={pieData}
              dataKey="value"
              innerRadius="48%"
              outerRadius="88%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              isAnimationActive={true}
              animationDuration={900}
              animationEasing="ease-out"
              filter="url(#donut-drop)"
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="#ffffff"
                  strokeWidth={2}
                  style={{ transition: 'opacity 320ms ease, transform 600ms ease' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div
          className="absolute text-center pointer-events-none flex flex-col items-center justify-center"
          aria-hidden
        >
          <div className="text-xs text-slate-500">Net balance</div>
          <div className="text-2xl md:text-3xl font-extrabold leading-tight -mt-1">{formatCurrency(net)}</div>
          <div className="text-xs text-slate-400 mt-1">{total ? Math.round((totals.income / total) * 100) : 0}% income</div>

          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.0) 38%, rgba(0,0,0,0.03) 65%, rgba(0,0,0,0.06) 100%)',
              mixBlendMode: 'multiply',
            }}
          />
        </div>
      </div>
    </div>
  )
}