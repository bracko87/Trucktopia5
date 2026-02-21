/**
 * TransactionsPanel.tsx
 *
 * Transactions history panel with pagination.
 *
 * Loads company transactions for the current user and renders them in a compact table
 * with loading / empty / error states. Adds server-side pagination (20 rows per page)
 * while preserving the existing layout and visual style.
 */

import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * TransactionRow
 *
 * Minimal shape for financial_transactions rows used by the UI.
 */
interface TransactionRow {
  id: string
  account_id: string
  counterparty_account_id?: string | null
  type_code?: string | null
  kind: string
  amount: number
  currency?: string | null
  created_at?: string | null
  note?: string | null
}

/**
 * AccountRow
 *
 * Minimal shape for financial_accounts used to display account label.
 */
interface AccountRow {
  id: string
  name?: string | null
}

/**
 * formatLabel
 *
 * Humanizes and title-cases database codes (e.g. "FUEL" -> "Fuel", "reward_trailer" -> "Reward Trailer").
 *
 * @param s optional string from DB
 * @returns human friendly string or em-dash when empty
 */
function formatLabel(s?: string | null) {
  if (!s) return '—'
  const cleaned = String(s).replace(/_/g, ' ').toLowerCase().trim()
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * formatMoneyValue
 *
 * Format a numeric amount with grouping and 2 decimals.
 * - For USD we render "$" + number (no "US" prefix).
 * - For other currencies attempt Intl currency format, fallback to plain number.
 *
 * @param amount number (absolute value)
 * @param currency optional currency code
 * @returns formatted string (no sign included)
 */
function formatMoneyValue(amount: number, currency?: string | null) {
  const opts: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  try {
    if (currency === 'USD') {
      return `$${new Intl.NumberFormat(undefined, opts).format(amount)}`
    }
    if (currency) {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, ...opts }).format(amount)
    }
    return new Intl.NumberFormat(undefined, opts).format(amount)
  } catch {
    return `${amount.toFixed(2)}`
  }
}

/**
 * isNegativeKind
 *
 * Determines whether a transaction kind reduces company balance.
 *
 * @param kind transaction kind string
 * @returns boolean true when it should display as negative (red, prefixed with -)
 */
function isNegativeKind(kind?: string | null) {
  if (!kind) return false
  const k = kind.toLowerCase()
  return ['expense', 'fee', 'wage', 'maintenance', 'purchase'].includes(k)
}

/**
 * TransactionRowView
 *
 * Small presentational component for a single transaction row.
 *
 * @param props transaction and account map
 */
function TransactionRowView({
  t,
  accountsMap,
}: {
  t: TransactionRow
  accountsMap: Record<string, AccountRow>
}) {
  const negative = isNegativeKind(t.kind)
  const sign = negative ? '-' : '+'
  const abs = Math.abs(Number(t.amount || 0))
  const formatted = formatMoneyValue(abs, t.currency ?? undefined)
  const colorClass = negative ? 'text-red-600' : 'text-green-600'

  return (
    <tr key={t.id} className="border-t border-slate-100 last:border-b-0">
      <td className="px-4 py-3 text-slate-600">{t.created_at ? new Date(t.created_at).toLocaleString() : '-'}</td>
      <td className="px-4 py-3">{formatLabel(t.type_code)}</td>
      <td className="px-4 py-3">{formatLabel(t.kind)}</td>
      <td className={`px-4 py-3 text-right font-medium ${colorClass}`}>
        {sign}
        {formatted}
      </td>
      <td className="px-4 py-3">{accountsMap[t.account_id]?.name ?? t.account_id}</td>
      <td className="px-4 py-3 text-slate-500 truncate max-w-[220px]">{t.note ?? ''}</td>
    </tr>
  )
}

/**
 * TransactionsPanel
 *
 * Loads transactions for the current user's company and renders a table with server-side
 * pagination (20 rows per page).
 *
 * @returns JSX.Element
 */
export default function TransactionsPanel(): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [accountsMap, setAccountsMap] = useState<Record<string, AccountRow>>({})
  const [totalCount, setTotalCount] = useState<number>(0)

  const pageSize = 20
  const [page, setPage] = useState<number>(0) // zero-based page index

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        // Resolve current auth user
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser()

        if (authErr || !user) {
          if (mounted) {
            setError('Not authenticated')
            setTransactions([])
            setLoading(false)
          }
          return
        }

        // Find company by owner_auth_user_id (safe read in this app)
        const { data: company, error: compErr } = await supabase
          .from('companies')
          .select('id')
          .eq('owner_auth_user_id', user.id)
          .maybeSingle()

        if (compErr || !company || !company.id) {
          if (mounted) {
            setTransactions([])
            setError('No company found for current user')
            setLoading(false)
          }
          return
        }

        // Fetch accounts for company
        const { data: accounts, error: accErr } = await supabase
          .from('financial_accounts')
          .select('id,name')
          .eq('owner_company_id', company.id)

        if (accErr) {
          throw accErr
        }

        const accountIds = Array.isArray(accounts) ? accounts.map((a: any) => a.id) : []

        if (accountIds.length === 0) {
          if (mounted) {
            setTransactions([])
            setAccountsMap({})
            setTotalCount(0)
            setLoading(false)
          }
          return
        }

        const accountsRecord: Record<string, AccountRow> = {}
        accounts.forEach((a: any) => {
          accountsRecord[a.id] = { id: a.id, name: a.name ?? null }
        })

        // Get total count of matching transactions (exact count)
        const countRes = await supabase
          .from('financial_transactions')
          .select('id', { count: 'exact', head: false })
          .in('account_id', accountIds)

        if (countRes.error) {
          throw countRes.error
        }
        const total = countRes.count ?? 0

        // Load transactions for current page (limit to pageSize)
        const offset = page * pageSize
        const txRes = await supabase
          .from('financial_transactions')
          .select('id,account_id,counterparty_account_id,type_code,kind,amount,currency,created_at,note')
          .in('account_id', accountIds)
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1)

        if (txRes.error) {
          throw txRes.error
        }

        if (mounted) {
          setAccountsMap(accountsRecord)
          setTransactions((txRes.data as TransactionRow[]) || [])
          setTotalCount(total)
          setLoading(false)
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.message ?? 'Failed to load transactions')
          setLoading(false)
          setTransactions([])
          setTotalCount(0)
        }
      }
    }

    load()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]) // reload when page changes

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  if (loading) {
    return (
      <div className="space-y-4">
        <section className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-2">Transactions</h2>
          <p className="text-sm text-slate-500">Loading transactions…</p>
        </section>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <section className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-2">Transactions</h2>
          <p className="text-sm text-red-600">Error: {error}</p>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4">Transactions</h2>
        <p className="text-sm text-slate-500">
          Recent company transactions. Showing up to {pageSize} entries per page.
        </p>
      </section>

      <section className="bg-white p-4 rounded-xl shadow overflow-x-auto">
        {transactions.length === 0 ? (
          <div className="text-sm text-slate-500 p-6">No transactions available for this company.</div>
        ) : (
          <>
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-4 py-2 w-48">Date</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Kind</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">Note</th>
                </tr>
              </thead>

              <tbody>
                {transactions.map((t) => (
                  <TransactionRowView key={t.id} t={t} accountsMap={accountsMap} />
                ))}
              </tbody>
            </table>

            {/* Pagination controls */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-slate-600">
                Page {page + 1} of {totalPages} — {totalCount} transactions
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page <= 0}
                  className={`px-3 py-1 rounded-md border text-sm ${page <= 0 ? 'text-slate-300 border-slate-100' : 'text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                >
                  Previous
                </button>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className={`px-3 py-1 rounded-md border text-sm ${page >= totalPages - 1 ? 'text-slate-300 border-slate-100' : 'text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
