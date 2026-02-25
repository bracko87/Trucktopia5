/**
 * TaxesPanel.tsx
 *
 * Taxes panel for showing tax liabilities and filings.
 * Replaced placeholder content with a working tax workflow UI:
 * - Configure tax enabled/disabled
 * - Configure tax rate (%)
 * - Configure settlement frequency (daily/weekly/monthly/yearly)
 * - Compute pending tax liability from unsettled income
 * - Settle taxes immediately
 * - Request one monthly tax return (20%–40% of taxes paid this month)
 */

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

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

function addByFrequency(base: Date, frequency: Frequency): Date {
  const d = new Date(base.getTime())
  if (frequency === 'daily') d.setDate(d.getDate() + 1)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
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
  const [taxEnabled, setTaxEnabled] = useState(true)
  const [returnPercent, setReturnPercent] = useState(25)

  const [pendingTaxableIncome, setPendingTaxableIncome] = useState(0)
  const [monthlyTaxPaid, setMonthlyTaxPaid] = useState(0)

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

        const { data: companyRow, error: companyError } = await supabase
          .from('companies')
          .select(
            'id,created_at,tax_enabled,tax_rate,tax_settlement_frequency,tax_last_settled_at,tax_last_return_at',
          )
          .eq('owner_auth_user_id', user.id)
          .maybeSingle()

        if (companyError || !companyRow?.id) {
          throw new Error('Company not found for current user')
        }

        const normalizedCompany: CompanyTaxState = {
          id: String(companyRow.id),
          created_at: companyRow.created_at ?? null,
          tax_enabled: companyRow.tax_enabled ?? true,
          tax_rate: Number(companyRow.tax_rate ?? 0.15),
          tax_settlement_frequency: (companyRow.tax_settlement_frequency ?? 'monthly') as Frequency,
          tax_last_settled_at: companyRow.tax_last_settled_at ?? null,
          tax_last_return_at: companyRow.tax_last_return_at ?? null,
        }

        const { data: accounts, error: accountError } = await supabase
          .from('financial_accounts')
          .select('id,currency')
          .eq('owner_company_id', companyRow.id)

        if (accountError) throw accountError

        const ids = (accounts ?? []).map((a: any) => String(a.id))
        const accountCurrency = accounts?.[0]?.currency ?? 'EUR'

        let taxableIncome = 0
        let monthTaxPaid = 0

        if (ids.length > 0) {
          const { data: incomes, error: incomeError } = await supabase
            .from('financial_transactions')
            .select('amount,kind,type_code,created_at')
            .in('account_id', ids)
            .eq('kind', 'income')
            .neq('type_code', 'TAX_RETURN')
            .gt('created_at', normalizedCompany.tax_last_settled_at ?? '1970-01-01T00:00:00Z')

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
        }

        if (!mounted) return

        setCompany(normalizedCompany)
        setAccountIds(ids)
        setCurrency(accountCurrency)
        setTaxRatePercent(Math.round(normalizedCompany.tax_rate * 10000) / 100)
        setFrequency(normalizedCompany.tax_settlement_frequency)
        setTaxEnabled(normalizedCompany.tax_enabled)
        setPendingTaxableIncome(taxableIncome)
        setMonthlyTaxPaid(monthTaxPaid)
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
  }, [])

  const pendingTaxLiability = useMemo(() => {
    return pendingTaxableIncome * (taxRatePercent / 100)
  }, [pendingTaxableIncome, taxRatePercent])

  const canRequestReturnThisMonth = useMemo(() => {
    if (!company?.tax_last_return_at) return true
    const lastReturn = new Date(company.tax_last_return_at)
    const monthStart = startOfCurrentUtcMonth()
    return Number.isNaN(lastReturn.getTime()) || lastReturn < monthStart
  }, [company?.tax_last_return_at])

  async function saveSettings() {
    if (!company) return
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const rate = Math.max(0, Math.min(100, taxRatePercent)) / 100

      const { error: updateError } = await supabase
        .from('companies')
        .update({
          tax_enabled: taxEnabled,
          tax_rate: rate,
          tax_settlement_frequency: frequency,
        })
        .eq('id', company.id)

      if (updateError) throw updateError

      setCompany((prev) =>
        prev
          ? {
              ...prev,
              tax_enabled: taxEnabled,
              tax_rate: rate,
              tax_settlement_frequency: frequency,
            }
          : prev,
      )

      setNotice('Tax settings saved successfully.')
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save tax settings')
    } finally {
      setSaving(false)
    }
  }

  async function settleTaxNow() {
    if (!company || !taxEnabled) return
    if (accountIds.length === 0) {
      setError('No financial account found for this company')
      return
    }

    const amount = Number(pendingTaxLiability.toFixed(2))
    if (amount <= 0) {
      setNotice('No pending tax liability at the moment.')
      return
    }

    setSettling(true)
    setError(null)
    setNotice(null)

    try {
      const nowIso = new Date().toISOString()
      const accountId = accountIds[0]

      const { error: txError } = await supabase.from('financial_transactions').insert({
        account_id: accountId,
        type_code: 'TAX_PAYMENT',
        kind: 'fee',
        amount,
        currency,
        note: `Tax settlement (${taxRatePercent.toFixed(2)}% of taxable income)`,
        metadata: {
          tax_rate_percent: taxRatePercent,
          taxable_income: Number(pendingTaxableIncome.toFixed(2)),
          settlement_frequency: frequency,
        },
      })

      if (txError) throw txError

      const { error: companyUpdateError } = await supabase
        .from('companies')
        .update({ tax_last_settled_at: nowIso })
        .eq('id', company.id)

      if (companyUpdateError) throw companyUpdateError

      setCompany((prev) => (prev ? { ...prev, tax_last_settled_at: nowIso } : prev))
      setMonthlyTaxPaid((prev) => prev + amount)
      setPendingTaxableIncome(0)
      setNotice(`Tax settlement completed: ${formatMoney(amount, currency)} debited.`)
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
      setError('Tax return already requested this month.')
      return
    }

    const pct = Math.max(20, Math.min(40, returnPercent))
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
        note: `Monthly tax return (${pct}% of month tax paid)`,
        metadata: {
          return_percent: pct,
          based_on_month_tax_paid: Number(refundableBase.toFixed(2)),
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
            Recommended default for gameplay and EU-like cadence is monthly settlement with a flat tax
            rate on income.
          </p>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-slate-700 space-y-1">
            <span className="block">Tax enabled</span>
            <select
              value={taxEnabled ? 'enabled' : 'disabled'}
              onChange={(e) => setTaxEnabled(e.target.value === 'enabled')}
              className="w-full rounded-md border border-slate-300 p-2"
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>

          <label className="text-sm text-slate-700 space-y-1">
            <span className="block">Settlement frequency</span>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
              className="w-full rounded-md border border-slate-300 p-2"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>

          <label className="text-sm text-slate-700 space-y-1 md:col-span-2">
            <span className="block">Tax rate (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={taxRatePercent}
              onChange={(e) => setTaxRatePercent(Number(e.target.value || 0))}
              className="w-full rounded-md border border-slate-300 p-2"
            />
          </label>
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
          <div className="text-lg font-medium mt-1">{formatMoney(pendingTaxLiability, currency)}</div>
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl shadow space-y-3">
        <h3 className="text-base font-semibold">Settle taxes</h3>
        <p className="text-sm text-slate-600">
          Pending taxable income: <strong>{formatMoney(pendingTaxableIncome, currency)}</strong> → tax due:{' '}
          <strong>{formatMoney(pendingTaxLiability, currency)}</strong>
        </p>
        <button
          onClick={settleTaxNow}
          disabled={settling || !taxEnabled}
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {settling ? 'Settling…' : 'Settle tax now'}
        </button>
      </section>

      <section className="bg-white p-6 rounded-xl shadow space-y-3">
        <h3 className="text-base font-semibold">Monthly tax return</h3>
        <p className="text-sm text-slate-600">
          Taxes paid this month: <strong>{formatMoney(monthlyTaxPaid, currency)}</strong>. You can request
          one return per month for 20%–40% of paid taxes.
        </p>

        <label className="text-sm text-slate-700 space-y-1 block">
          <span className="block">Return percentage (20% - 40%)</span>
          <input
            type="number"
            min={20}
            max={40}
            step="1"
            value={returnPercent}
            onChange={(e) => setReturnPercent(Number(e.target.value || 20))}
            className="w-full md:w-64 rounded-md border border-slate-300 p-2"
          />
        </label>

        <button
          onClick={requestTaxReturn}
          disabled={requestingReturn || !canRequestReturnThisMonth}
          className="rounded-md bg-emerald-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {requestingReturn
            ? 'Requesting return…'
            : canRequestReturnThisMonth
              ? 'Request monthly tax return'
              : 'Tax return already requested this month'}
        </button>

        <div className="text-xs text-slate-500">
          Last tax return request: {toIsoDateTime(company?.tax_last_return_at)}
        </div>
      </section>
    </div>
  )
}