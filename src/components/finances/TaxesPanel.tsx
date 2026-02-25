/**
 * TaxesPanel.tsx
 *
 * Taxes panel for showing tax liabilities and filings.
 * Updated workflow UI:
 * - Taxes are always active (user chooses cadence only)
 * - Fixed tax rate derived from cadence:
 *   - Daily = 12%
 *   - Weekly = 13%
 *   - Monthly = 15%
 * - Compute pending tax liability from unsettled income
 * - Settle taxes immediately (via backend RPC processor)
 * - Request one monthly tax return (randomized internally; UI shows estimate only)
 *
 * UI updates:
 * - Player-facing helper text for settling taxes (no internal/system wording)
 * - Monthly return section hides randomization % details (still shows estimated amount)
 * - Monthly return cooldown is strict: last_return_at + 1 month
 * - Shows a red status box for availability / next available date
 * - Loads and displays last TAX_RETURN transaction date + amount received
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Frequency = 'daily' | 'weekly' | 'monthly'

type CompanyTaxState = {
  id: string
  created_at: string | null
  tax_enabled: boolean
  tax_rate: number
  tax_settlement_frequency: Frequency
  tax_last_settled_at: string | null
  tax_last_return_at: string | null
}

type FinancialTx = {
  amount: number | string | null
  kind?: string | null
  type_code?: string | null
  created_at?: string | null
}

function formatMoney(amount: number, currency: string): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount)
  } catch {
    return `${safeAmount.toFixed(2)} ${currency || 'EUR'}`
  }
}

function startOfCurrentUtcMonth(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

function toIsoDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

function toDisplayDateTime(value?: string | number | Date | null): string {
  if (value == null || value === '') return '—'
  try {
    const d = typeof value === 'number' ? new Date(value) : new Date(String(value))
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString()
  } catch {
    return '—'
  }
}

function getFixedTaxRateForFrequency(frequency: Frequency) {
  if (frequency === 'daily') return 0.12
  if (frequency === 'weekly') return 0.13
  return 0.15
}

function pickRandomReturnPercent() {
  return 20 + Math.floor(Math.random() * 21)
}

function normalizeFrequency(value?: string | null): Frequency {
  if (value === 'daily' || value === 'weekly' || value === 'monthly') return value
  return 'monthly'
}

function addByFrequency(base: Date, frequency: Frequency): Date {
  const d = new Date(base.getTime())
  if (frequency === 'daily') d.setDate(d.getDate() + 1)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  return d
}

function computeNextDue(
  lastSettledAt?: string | null,
  frequency: Frequency = 'monthly',
  companyCreatedAt?: string | null,
): string {
  const base =
    (lastSettledAt && !Number.isNaN(new Date(lastSettledAt).getTime()) && new Date(lastSettledAt)) ||
    (companyCreatedAt && !Number.isNaN(new Date(companyCreatedAt).getTime()) && new Date(companyCreatedAt)) ||
    new Date()

  const next = addByFrequency(base, frequency)
  if (Number.isNaN(next.getTime())) return '—'
  return next.toISOString().slice(0, 10)
}

function addOneMonth(dateLike: string | Date) {
  const d = new Date(dateLike)
  d.setMonth(d.getMonth() + 1)
  return d
}

type LastTaxReturn = { created_at: string | null; amount: number } | null

type LoadedMetrics = {
  accountIds: string[]
  currency: string
  pendingTaxableIncome: number
  monthlyTaxPaid: number
  lastTaxReturn: LastTaxReturn
}

/**
 * TaxesPanel
 *
 * Working tax workflow UI backed by Supabase.
 *
 * @returns JSX.Element
 */
export default function TaxesPanel(): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settling, setSettling] = useState(false)
  const [requestingReturn, setRequestingReturn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [company, setCompany] = useState<CompanyTaxState | null>(null)
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [currency, setCurrency] = useState('EUR')

  const [taxRatePercent, setTaxRatePercent] = useState(15)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [nextReturnPercent, setNextReturnPercent] = useState<number>(pickRandomReturnPercent)

  const [pendingTaxableIncome, setPendingTaxableIncome] = useState(0)
  const [monthlyTaxPaid, setMonthlyTaxPaid] = useState(0)

  const [lastTaxReturn, setLastTaxReturn] = useState<LastTaxReturn>(null)

  const loadMetrics = useCallback(
    async (companyId: string, taxLastSettledAt?: string | null) => {
      const { data: accounts, error: accountError } = await supabase
        .from('financial_accounts')
        .select('id,currency')
        .eq('owner_company_id', companyId)

      if (accountError) throw accountError

      const ids = (accounts ?? []).map((a: any) => String(a.id))
      const accountCurrency = accounts?.[0]?.currency ?? 'EUR'

      let taxableIncome = 0
      let monthTaxPaid = 0

      let lastReturn: LastTaxReturn = null

      if (ids.length > 0) {
        const { data: incomes, error: incomeError } = await supabase
          .from('financial_transactions')
          .select('amount,kind,type_code,created_at')
          .in('account_id', ids)
          .eq('kind', 'income')
          .neq('type_code', 'TAX_RETURN')
          .gt('created_at', taxLastSettledAt ?? '1970-01-01T00:00:00Z')

        if (incomeError) throw incomeError

        const monthStartIso = startOfCurrentUtcMonth().toISOString()
        const { data: monthlyTaxPayments, error: monthlyTaxError } = await supabase
          .from('financial_transactions')
          .select('amount,kind,type_code,created_at')
          .in('account_id', ids)
          .eq('type_code', 'TAX_PAYMENT')
          .gte('created_at', monthStartIso)

        if (monthlyTaxError) throw monthlyTaxError

        taxableIncome =
          (incomes as FinancialTx[] | null)?.reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0) ?? 0

        monthTaxPaid =
          (monthlyTaxPayments as FinancialTx[] | null)?.reduce(
            (sum, tx) => sum + Number(tx.amount ?? 0),
            0,
          ) ?? 0

        const { data: latestReturn, error: latestReturnError } = await supabase
          .from('financial_transactions')
          .select('created_at,amount')
          .in('account_id', ids)
          .eq('type_code', 'TAX_RETURN')
          .order('created_at', { ascending: false })
          .limit(1)

        if (latestReturnError) throw latestReturnError

        lastReturn =
          latestReturn?.[0]
            ? {
                created_at: latestReturn[0].created_at ?? null,
                amount: Number(latestReturn[0].amount ?? 0),
              }
            : null
      }

      const result: LoadedMetrics = {
        accountIds: ids,
        currency: accountCurrency,
        pendingTaxableIncome: taxableIncome,
        monthlyTaxPaid: monthTaxPaid,
        lastTaxReturn: lastReturn,
      }

      setAccountIds(result.accountIds)
      setCurrency(result.currency)
      setPendingTaxableIncome(result.pendingTaxableIncome)
      setMonthlyTaxPaid(result.monthlyTaxPaid)
      setLastTaxReturn(result.lastTaxReturn)

      return result
    },
    [],
  )

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)
      setNotice(null)

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
          throw new Error('Not authenticated')
        }

        const companySelect =
          'id,created_at,tax_enabled,tax_rate,tax_settlement_frequency,tax_last_settled_at,tax_last_return_at'

        const { data: initialCompanyRow, error: companyError } = await supabase
          .from('companies')
          .select(companySelect)
          .eq('owner_auth_user_id', user.id)
          .maybeSingle()

        if (companyError || !initialCompanyRow?.id) {
          throw new Error('Company not found for current user')
        }

        // Run due processing on load (ignore missing RPC during rollout)
        const processRes = await supabase.rpc('process_company_taxes_due', {
          p_company_id: initialCompanyRow.id,
          p_force: false,
        })

        if (processRes.error && !String(processRes.error.message ?? '').includes('does not exist')) {
          throw processRes.error
        }

        // Re-fetch company row in case due processing updated tax timestamps
        const { data: companyRowRefreshed, error: companyRefreshError } = await supabase
          .from('companies')
          .select(companySelect)
          .eq('id', initialCompanyRow.id)
          .maybeSingle()

        if (companyRefreshError) throw companyRefreshError

        const companyRow = companyRowRefreshed ?? initialCompanyRow
        const normalizedFrequency = normalizeFrequency(companyRow.tax_settlement_frequency)
        const fixedTaxRate = getFixedTaxRateForFrequency(normalizedFrequency)

        const normalizedCompany: CompanyTaxState = {
          id: String(companyRow.id),
          created_at: companyRow.created_at ?? null,
          tax_enabled: true,
          tax_rate: fixedTaxRate,
          tax_settlement_frequency: normalizedFrequency,
          tax_last_settled_at: companyRow.tax_last_settled_at ?? null,
          tax_last_return_at: companyRow.tax_last_return_at ?? null,
        }

        await loadMetrics(normalizedCompany.id, normalizedCompany.tax_last_settled_at)

        if (!mounted) return

        setCompany(normalizedCompany)
        setFrequency(normalizedCompany.tax_settlement_frequency)
        setTaxRatePercent(Math.round(fixedTaxRate * 100))
        setNextReturnPercent(pickRandomReturnPercent())
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message ?? 'Failed to load tax data')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [loadMetrics])

  const pendingTaxLiability = useMemo(() => {
    return pendingTaxableIncome * (taxRatePercent / 100)
  }, [pendingTaxableIncome, taxRatePercent])

  const potentialReturnAmount = useMemo(() => {
    const refundableBase = Math.max(0, monthlyTaxPaid)
    return Number(((refundableBase * nextReturnPercent) / 100).toFixed(2))
  }, [monthlyTaxPaid, nextReturnPercent])

  const nextReturnAt = useMemo(() => {
    if (!company?.tax_last_return_at) return null
    const next = addOneMonth(company.tax_last_return_at)
    return Number.isNaN(next.getTime()) ? null : next
  }, [company?.tax_last_return_at])

  const canRequestReturnThisMonth = useMemo(() => {
    if (!nextReturnAt) return true
    return new Date() >= nextReturnAt
  }, [nextReturnAt])

  async function saveSettings() {
    if (!company) return
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const normalizedFrequency = normalizeFrequency(frequency)
      const rate = getFixedTaxRateForFrequency(normalizedFrequency)

      const { error: updateError } = await supabase
        .from('companies')
        .update({
          tax_enabled: true,
          tax_rate: rate,
          tax_settlement_frequency: normalizedFrequency,
        })
        .eq('id', company.id)

      if (updateError) throw updateError

      setCompany((prev) =>
        prev
          ? {
              ...prev,
              tax_enabled: true,
              tax_rate: rate,
              tax_settlement_frequency: normalizedFrequency,
            }
          : prev,
      )

      setFrequency(normalizedFrequency)
      setTaxRatePercent(Math.round(rate * 100))
      setNotice('Tax cadence saved successfully.')
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save tax settings')
    } finally {
      setSaving(false)
    }
  }

  async function settleTaxNow() {
    if (!company) return

    setSettling(true)
    setError(null)
    setNotice(null)

    try {
      const res = await supabase.rpc('process_company_taxes_due', {
        p_company_id: company.id,
        p_force: true,
      })

      if (res.error) throw res.error

      const nowIso = new Date().toISOString()
      const amount = Number(pendingTaxLiability.toFixed(2))

      setCompany((prev) => (prev ? { ...prev, tax_last_settled_at: nowIso } : prev))
      await loadMetrics(company.id, nowIso)

      setNotice(
        amount > 0
          ? `Tax settlement completed: ${formatMoney(amount, currency)} debited.`
          : 'No pending tax liability at the moment.',
      )
    } catch (e: any) {
      setError(e?.message ?? 'Failed to settle taxes')
    } finally {
      setSettling(false)
    }
  }

  async function requestTaxReturn() {
    if (!company) return
    if (accountIds.length === 0) {
      setError('No financial account found for this company')
      return
    }
    if (!canRequestReturnThisMonth) {
      setError('Tax return is not available yet.')
      return
    }

    const pct = nextReturnPercent
    const refundableBase = Math.max(0, monthlyTaxPaid)
    const amount = Number(((refundableBase * pct) / 100).toFixed(2))

    if (amount <= 0) {
      setNotice('No eligible tax payments this month for a tax return.')
      return
    }

    setRequestingReturn(true)
    setError(null)
    setNotice(null)

    try {
      const nowIso = new Date().toISOString()
      const accountId = accountIds[0]

      const { error: insertError } = await supabase.from('financial_transactions').insert({
        account_id: accountId,
        type_code: 'TAX_RETURN',
        kind: 'refund',
        amount,
        currency,
        note: `Monthly tax return`,
        metadata: {
          return_percent: pct,
          based_on_month_tax_paid: Number(refundableBase.toFixed(2)),
          randomized: true,
        },
      })

      if (insertError) throw insertError

      const { error: companyUpdateError } = await supabase
        .from('companies')
        .update({ tax_last_return_at: nowIso })
        .eq('id', company.id)

      if (companyUpdateError) throw companyUpdateError

      setCompany((prev) => (prev ? { ...prev, tax_last_return_at: nowIso } : prev))
      setNotice(`Tax return applied: ${formatMoney(amount, currency)} credited.`)
      setNextReturnPercent(pickRandomReturnPercent())

      // Refresh metrics to update "last tax return" footer immediately.
      await loadMetrics(company.id, company.tax_last_settled_at ?? null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to request tax return')
    } finally {
      setRequestingReturn(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <section className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-2">Taxes</h2>
          <p className="text-sm text-black/70">Loading tax settings…</p>
        </section>
      </div>
    )
  }

  if (error && !company) {
    return (
      <div className="space-y-4">
        <section className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-2">Taxes</h2>
          <p className="text-sm text-red-600">Error: {error}</p>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="bg-white p-6 rounded-xl shadow space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Taxes</h2>
          <p className="text-sm text-black/70">
            Taxes are always active. Choose cadence only: Daily (12%), Weekly (13%), Monthly (15%).
          </p>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-slate-700 space-y-1">
            <span className="block">Settlement frequency</span>
            <select
              value={frequency}
              onChange={(e) => {
                const next = normalizeFrequency(e.target.value)
                setFrequency(next)
                setTaxRatePercent(Math.round(getFixedTaxRateForFrequency(next) * 100))
              }}
              className="w-full rounded-md border border-slate-300 p-2"
            >
              <option value="daily">Daily (12%)</option>
              <option value="weekly">Weekly (13%)</option>
              <option value="monthly">Monthly (15%)</option>
            </select>
          </label>

          <div className="text-sm text-slate-700 space-y-1">
            <span className="block">Tax rate (fixed by frequency)</span>
            <div className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 font-medium">
              {taxRatePercent}%
            </div>
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save tax settings'}
        </button>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-slate-500">Last settlement</div>
          <div className="text-lg font-medium mt-1">{toIsoDateTime(company?.tax_last_settled_at)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-slate-500">Next due</div>
          <div className="text-lg font-medium mt-1">
            {computeNextDue(company?.tax_last_settled_at, frequency, company?.created_at)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-slate-500">Estimated liability</div>
          <div className="text-lg font-semibold mt-1 text-red-600">
            -{formatMoney(pendingTaxLiability, currency)}
          </div>
        </div>
      </section>

      {/* Updated player-facing settle helper text */}
      <section className="bg-white p-6 rounded-xl shadow space-y-3">
        <h3 className="text-base font-semibold">Settle taxes</h3>
        <p className="text-sm text-slate-600">
          Pending taxable income: <strong>{formatMoney(pendingTaxableIncome, currency)}</strong> → tax due:{' '}
          <strong className="text-red-600">-{formatMoney(pendingTaxLiability, currency)}</strong>
        </p>
        <p className="text-xs text-slate-500">
          Settle tax now will immediately deduct currently due taxes from your company balance and mark taxes as paid up to now.
        </p>
        <button
          onClick={settleTaxNow}
          disabled={settling}
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {settling ? 'Settling…' : 'Settle tax now'}
        </button>
      </section>

      <section className="bg-white p-6 rounded-xl shadow space-y-3">
        <h3 className="text-base font-semibold">Monthly tax return</h3>

        <p className="text-sm text-slate-600">
          Taxes paid this month: <strong>{formatMoney(monthlyTaxPaid, currency)}</strong>. You can submit one tax return request each
          month.
        </p>

        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {canRequestReturnThisMonth
            ? 'Tax return is currently available.'
            : `Next tax return will be available on: ${nextReturnAt ? nextReturnAt.toLocaleString() : '—'}`}
        </div>

        <div className="text-sm text-slate-700">
          Estimated return amount if requested now: <strong>{formatMoney(potentialReturnAmount, currency)}</strong>
        </div>

        <button
          onClick={requestTaxReturn}
          disabled={requestingReturn || !canRequestReturnThisMonth}
          className="rounded-md bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {requestingReturn
            ? 'Requesting return…'
            : canRequestReturnThisMonth
              ? 'Request monthly tax return'
              : 'Tax return not available yet'}
        </button>

        <div className="text-xs text-slate-500">
          Last tax return request: {toDisplayDateTime(lastTaxReturn?.created_at)}
          {lastTaxReturn ? ` • Amount received: ${formatMoney(lastTaxReturn.amount, currency)}` : ''}
        </div>
      </section>
    </div>
  )
}