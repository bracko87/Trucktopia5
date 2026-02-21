/**
 * OverviewPanel.tsx
 *
 * Loads overview data (company -> accounts -> transactions) and renders the composed UI.
 * This variant computes chart series by first filtering transactions according to the
 * selected time range and THEN aggregating into chart buckets so the charts reflect
 * the selected range (daily/weekly/monthly/yearly/total).
 *
 * Notes:
 * - The component is defensive about parsing dates and handles empty states.
 * - For "daily" the window is computed as today 00:01 -> next day 00:01 (client timezone).
 * - Aggregation bucketing:
 *   - daily  -> hourly buckets (24)
 *   - weekly -> daily buckets (7)
 *   - monthly/yearly/total -> month buckets
 */

import React, { useEffect, useState } from 'react'
import SummaryCards from './overview/SummaryCards'
import IncomeExpenseChart, { IncomeExpensePoint } from './overview/IncomeExpenseChart'
import TopBreakdown, { CategoryItem } from './overview/TopBreakdown'
import { supabase } from '../../lib/supabase'
import IncomeVsCostSummary from './IncomeVsCostSummary'

/**
 * OverviewSummary
 *
 * Shape of the summary metrics used by SummaryCards.
 */
interface OverviewSummary {
  balance: number
  pendingPayouts: number
  monthlySpend: number
}

/**
 * TransactionRow
 *
 * Minimal transaction shape returned from the DB.
 */
interface TransactionRow {
  kind: string | null
  type_code: string | null
  amount: number | string | null
  created_at: string | null
  account_id?: string | null
}

/**
 * isIncome
 *
 * Determines whether a transaction is an income based on normalized kind column.
 *
 * @param tx TransactionRow
 * @returns boolean
 */
function isIncome(tx: TransactionRow) {
  return tx.kind === 'income' || tx.kind === 'adjustment'
}

/**
 * isExpense
 *
 * Determines whether a transaction is an expense based on normalized kind column.
 *
 * @param tx TransactionRow
 * @returns boolean
 */
function isExpense(tx: TransactionRow) {
  return ['expense', 'wage', 'fee'].includes(String(tx.kind ?? ''))
}

/**
 * Range
 *
 * Supported client-side ranges used for chart slicing.
 */
type Range = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total'

/**
 * getRangeWindow
 *
 * Compute a start (inclusive) and end (exclusive) Date for the requested client-side range.
 * For daily the range starts at 00:01 today (inclusive) and ends at 00:01 next day (exclusive).
 * For weekly/monthly/yearly we use a simple "now - period" approach anchored at 00:01 start.
 *
 * NOTE: This is client-side and uses the browser timezone. For absolute correctness
 * across DST and "game timezone" use a server-side RPC using AT TIME ZONE.
 *
 * @param range Range
 * @returns { start: Date, end: Date }
 */
function getRangeWindow(range: Range) {
  const now = new Date()
  switch (range) {
    case 'daily': {
      const start = new Date(now)
      start.setHours(0, 1, 0, 0)
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
      return { start, end }
    }
    case 'weekly': {
      const start = new Date(now)
      start.setDate(now.getDate() - 7)
      start.setHours(0, 1, 0, 0)
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
      return { start, end }
    }
    case 'monthly': {
      const start = new Date(now)
      start.setMonth(now.getMonth() - 1)
      start.setHours(0, 1, 0, 0)
      const end = new Date(start)
      end.setMonth(start.getMonth() + 1)
      return { start, end }
    }
    case 'yearly': {
      const start = new Date(now)
      start.setFullYear(now.getFullYear() - 1)
      start.setHours(0, 1, 0, 0)
      const end = new Date(start)
      end.setFullYear(start.getFullYear() + 1)
      return { start, end }
    }
    case 'total':
    default: {
      // wide window - includes all transactions
      return { start: new Date(0), end: new Date('9999-12-31') }
    }
  }
}

/**
 * aggregateByRange
 *
 * Aggregate an array of transactions into IncomeExpensePoint[] according to the selected range.
 * - daily  => 24 hourly buckets (labels: '00:00', '01:00' ...)
 * - weekly => 7 daily buckets (short weekday labels)
 * - monthly/yearly/total => month buckets (short month label, repeats across years if needed)
 *
 * @param transactions TransactionRow[]
 * @param range Range
 * @returns IncomeExpensePoint[]
 */
function aggregateByRange(transactions: TransactionRow[], range: Range): IncomeExpensePoint[] {
  const { start, end } = getRangeWindow(range)

  // Create buckets depending on range
  if (range === 'daily') {
    const buckets: IncomeExpensePoint[] = Array.from({ length: 24 }, (_, i) => ({
      label: `${String(i).padStart(2, '0')}:00`,
      income: 0,
      expenses: 0,
    }))

    const bucketMs = 60 * 60 * 1000 // hourly
    transactions.forEach((tx) => {
      if (!tx.created_at) return
      const d = new Date(tx.created_at)
      if (isNaN(d.getTime())) return
      if (d < start || d >= end) return
      const idx = Math.floor((d.getTime() - start.getTime()) / bucketMs)
      const index = Math.min(Math.max(idx, 0), 23)
      const amt = Number(tx.amount || 0)
      if (isIncome(tx)) buckets[index].income += amt
      if (isExpense(tx)) buckets[index].expenses += amt
    })

    return buckets
  }

  if (range === 'weekly') {
    // 7 day buckets starting at start
    const dayMs = 24 * 60 * 60 * 1000
    const buckets: IncomeExpensePoint[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getTime() + i * dayMs)
      return { label: d.toLocaleDateString(undefined, { weekday: 'short' }), income: 0, expenses: 0 }
    })

    transactions.forEach((tx) => {
      if (!tx.created_at) return
      const d = new Date(tx.created_at)
      if (isNaN(d.getTime())) return
      if (d < start || d >= end) return
      const idx = Math.floor((d.getTime() - start.getTime()) / dayMs)
      const index = Math.min(Math.max(idx, 0), 6)
      const amt = Number(tx.amount || 0)
      if (isIncome(tx)) buckets[index].income += amt
      if (isExpense(tx)) buckets[index].expenses += amt
    })

    return buckets
  }

  // monthly/yearly/total -> group by month between start and end
  const buckets: IncomeExpensePoint[] = []
  const cursor = new Date(start.getTime())
  // Normalize cursor to the first day of its month at 00:01 to be consistent
  cursor.setDate(1)
  cursor.setHours(start.getHours(), start.getMinutes(), 0, 0)

  while (cursor < end) {
    buckets.push({
      label: cursor.toLocaleString(undefined, { month: 'short', year: 'numeric' }),
      income: 0,
      expenses: 0,
    })
    // move to next month
    cursor.setMonth(cursor.getMonth() + 1)
  }

  if (buckets.length === 0) {
    // Fallback single bucket
    buckets.push({ label: 'All', income: 0, expenses: 0 })
  }

  // helper to compute month index difference
  function monthDiff(a: Date, b: Date) {
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  }

  transactions.forEach((tx) => {
    if (!tx.created_at) return
    const d = new Date(tx.created_at)
    if (isNaN(d.getTime())) return
    if (d < start || d >= end) return
    const idx = monthDiff(start, d)
    const index = Math.min(Math.max(idx, 0), buckets.length - 1)
    const amt = Number(tx.amount || 0)
    if (isIncome(tx)) buckets[index].income += amt
    if (isExpense(tx)) buckets[index].expenses += amt
  })

  return buckets
}

/**
 * filterByRange
 *
 * Filters raw transactions by the requested client-side range.
 *
 * @param transactions array of TransactionRow
 * @param range Range
 * @returns filtered TransactionRow[]
 */
function filterByRange(transactions: TransactionRow[], range: Range) {
  if (!transactions || transactions.length === 0) return []

  const { start, end } = getRangeWindow(range)
  try {
    return transactions.filter((tx) => {
      if (!tx.created_at) return false
      const d = new Date(tx.created_at)
      if (isNaN(d.getTime())) return false
      return d >= start && d < end
    })
  } catch (err) {
    // Defensive: return empty on parse error
    // eslint-disable-next-line no-console
    console.error('filterByRange error', err)
    return []
  }
}

/**
 * OverviewPanel
 *
 * Loads overview data (company -> accounts -> transactions) and renders the composed UI.
 * The visible range selector is exposed only inside the Total Balance Overview card;
 * parent manages the selected range state and uses it to slice chart data and compute totals.
 *
 * Additionally this component dispatches a CustomEvent 'finances:summary' with the
 * computed balance whenever the summary is set so small widgets can consume it.
 *
 * @returns JSX.Element | null
 */
export default function OverviewPanel(): JSX.Element | null {
  const [summary, setSummary] = useState<OverviewSummary | null>(null)
  const [chartData, setChartData] = useState<IncomeExpensePoint[]>([])
  const [topIncome, setTopIncome] = useState<CategoryItem[]>([])
  const [topExpenses, setTopExpenses] = useState<CategoryItem[]>([])
  const [transactionsAll, setTransactionsAll] = useState<TransactionRow[]>([])

  // Selected range controlled by the Overview panel (default monthly).
  const [selectedRange, setSelectedRange] = useState<Range>('monthly')

  useEffect(() => {
    let mounted = true
    async function loadOverviewData() {
      try {
        // Resolve current user
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser()
        if (authErr || !user) {
          if (mounted) {
            const fallback = { balance: 0, pendingPayouts: 0, monthlySpend: 0 }
            setSummary(fallback)
            try {
              window.dispatchEvent(new CustomEvent('finances:summary', { detail: { balance: fallback.balance } }))
            } catch {}
          }
          return
        }

        // Find company by owner_auth_user_id (safe read)
        const { data: company, error: compErr } = await supabase
          .from('companies')
          .select('id')
          .eq('owner_auth_user_id', user.id)
          .maybeSingle()

        if (compErr || !company) {
          if (mounted) {
            const fallback = { balance: 0, pendingPayouts: 0, monthlySpend: 0 }
            setSummary(fallback)
            try {
              window.dispatchEvent(new CustomEvent('finances:summary', { detail: { balance: fallback.balance } }))
            } catch {}
          }
          return
        }

        // Fetch accounts
        const { data: accounts, error: accErr } = await supabase
          .from('financial_accounts')
          .select('id')
          .eq('owner_company_id', company.id)

        if (accErr || !accounts || accounts.length === 0) {
          if (mounted) {
            const fallback = { balance: 0, pendingPayouts: 0, monthlySpend: 0 }
            setSummary(fallback)
            try {
              window.dispatchEvent(new CustomEvent('finances:summary', { detail: { balance: fallback.balance } }))
            } catch {}
          }
          return
        }

        const accountIds = accounts.map((a: any) => a.id)

        // Load transactions for these accounts
        const { data: txs, error: txErr } = await supabase
          .from('financial_transactions')
          .select('kind, type_code, amount, created_at, account_id')
          .in('account_id', accountIds)

        if (txErr || !txs) {
          if (mounted) {
            const fallback = { balance: 0, pendingPayouts: 0, monthlySpend: 0 }
            setSummary(fallback)
            try {
              window.dispatchEvent(new CustomEvent('finances:summary', { detail: { balance: fallback.balance } }))
            } catch {}
          }
          return
        }

        const transactions: TransactionRow[] = txs as TransactionRow[]

        // Compute balance (direction aware)
        const balance = transactions.reduce((sum, tx) => {
          const amt = Number(tx.amount || 0)
          if (isIncome(tx)) return sum + amt
          if (isExpense(tx)) return sum - amt
          return sum
        }, 0)

        // Monthly spend (current month)
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        const monthlySpend = transactions
          .filter((tx) => isExpense(tx) && tx.created_at && new Date(tx.created_at) >= startOfMonth)
          .reduce((s, tx) => s + Number(tx.amount || 0), 0)

        // Aggregate by YYYY-MM (kept for fallback/full chart)
        const byMonth: Record<string, { income: number; expenses: number }> = {}
        transactions.forEach((tx) => {
          if (!tx.created_at) return
          const d = new Date(tx.created_at)
          if (isNaN(d.getTime())) return
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expenses: 0 }
          if (isIncome(tx)) {
            byMonth[monthKey].income += Number(tx.amount || 0)
          } else if (isExpense(tx)) {
            byMonth[monthKey].expenses += Number(tx.amount || 0)
          }
        })

        const chart: IncomeExpensePoint[] = Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, v]) => ({
            label: new Date(`${key}-01`).toLocaleString('en-US', { month: 'short' }),
            income: v.income,
            expenses: v.expenses,
          }))

        // Top categories by type_code
        function topByType(filterFn: (tx: TransactionRow) => boolean) {
          const map: Record<string, number> = {}
          transactions.filter(filterFn).forEach((tx) => {
            const key = tx.type_code || 'Unknown'
            map[key] = (map[key] || 0) + Number(tx.amount || 0)
          })
          return Object.entries(map)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5)
        }

        const topIncomeRes = topByType(isIncome)
        const topExpensesRes = topByType(isExpense)

        if (mounted) {
          setSummary({
            balance,
            pendingPayouts: 0,
            monthlySpend,
          })
          setChartData(chart)
          setTopIncome(topIncomeRes)
          setTopExpenses(topExpensesRes)

          // store raw transactions so totals and charts can be computed from the filtered set
          setTransactionsAll(transactions)

          // Dispatch a lightweight event with the computed balance so small widgets can consume it.
          try {
            window.dispatchEvent(new CustomEvent('finances:summary', { detail: { balance } }))
          } catch {}
        }
      } catch (err) {
        if (mounted) {
          setSummary({ balance: 0, pendingPayouts: 0, monthlySpend: 0 })
          setChartData([])
          setTopIncome([])
          setTopExpenses([])
          setTransactionsAll([])
          try {
            window.dispatchEvent(new CustomEvent('finances:summary', { detail: { balance: 0 } }))
          } catch {}
        }
        // eslint-disable-next-line no-console
        console.error('Overview load error', err)
      }
    }

    loadOverviewData()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep previous behavior: don't render until loaded.
  if (!summary) return null

  // Provide a default sample when chart has no data.
  const defaultSample: IncomeExpensePoint[] = [
    { label: 'May', income: 18000, expenses: 11200 },
    { label: 'Jun', income: 22000, expenses: 14500 },
    { label: 'Jul', income: 20000, expenses: 15800 },
    { label: 'Aug', income: 25000, expenses: 17000 },
  ]

  // Derive chart series by aggregating raw transactions according to selectedRange.
  let chartToUse: IncomeExpensePoint[] = []
  try {
    chartToUse = aggregateByRange(transactionsAll, selectedRange)
    // Fallback to monthly aggregated chart (server-wide) if aggregation produced no buckets
    if (!chartToUse || chartToUse.length === 0) {
      chartToUse = chartData && chartData.length ? chartData : defaultSample
    }
  } catch (err) {
    // Defensive fallback
    // eslint-disable-next-line no-console
    console.error('chart aggregation error', err)
    chartToUse = chartData && chartData.length ? chartData : defaultSample
  }

  // Compute filtered transactions and totals from them (exact totals used by the IncomeVsCostSummary)
  let filteredTransactions: TransactionRow[] = []
  try {
    filteredTransactions = filterByRange(transactionsAll, selectedRange)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('filteredTransactions compute error', err)
    filteredTransactions = []
  }

  const totals = (() => {
    try {
      return filteredTransactions.reduce(
        (acc, tx) => {
          const amt = Number(tx.amount || 0)
          if (isIncome(tx)) acc.income += amt
          if (isExpense(tx)) acc.expenses += amt
          return acc
        },
        { income: 0, expenses: 0 }
      )
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('totals compute error', err)
      return { income: 0, expenses: 0 }
    }
  })()

  return (
    <div className="space-y-6">
      {/* Financial Overview - located at the top */}
      <section className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">Financial Overview</h2>
        <p className="text-sm text-black/70">
          Company balance, income, expenses and liabilities will be displayed here. Use the charts above to inspect
          trends and category drivers.
        </p>
      </section>

      {/* Summary cards */}
      <SummaryCards balance={summary.balance} pendingPayouts={summary.pendingPayouts} monthlySpend={summary.monthlySpend} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Costs card (range selector now controlled by parent state and exposed to the summary card) */}
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Income vs Costs</h3>
              <p className="text-sm text-slate-500">Aggregated totals and variance</p>
            </div>

            {/* Empty placeholder kept for layout parity */}
            <div />
          </div>

          <IncomeExpenseChart data={chartToUse} range={selectedRange} />
        </div>

        {/* Top categories */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="text-lg font-semibold mb-4">Top categories</h3>
          <TopBreakdown income={topIncome} expenses={topExpenses} />
        </div>
      </div>

      {/* Income vs costs summary rendered as an independent card with tabs for range selection */}
      <IncomeVsCostSummary
        income={totals.income}
        expenses={totals.expenses}
        selectedRange={selectedRange}
        onRangeChange={(r: Range) => setSelectedRange(r)}
      />
    </div>
  )
}
