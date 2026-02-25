/**
 * src/components/finances/LeasesPanel.tsx
 *
 * Panel component that lists company leases and shows a brief payment summary.
 * Preserves existing visual layout and design. Implements server-side pagination
 * using PostgREST range queries and shows a maximum of 10 entries per page.
 *
 * FIXES:
 * - Robust companyId resolution (user fields + DB fallback + browser fallback)
 * - Per-user localStorage scoping to avoid stale cross-account company ids
 * - useEffect dependency fixed (runs when user id/company changes)
 * - Includes created_at in select (since we order by it)
 * - Uses explicit FK join hint for truck_models to avoid ambiguous joins
 *
 * UPDATES:
 * - Replaced window.confirm(...) with an in-app modal confirmation for:
 *   - Cancel Leasing (lease termination)
 *   - Purchase Truck (lease buyout)
 *   Includes structured financial details in the popup.
 * - Implemented lease cancellation business flow:
 *   - penalty = 30% of remaining lease value
 *   - insert financial_transactions debit (LEASE_TERMINATION)
 *   - remove corresponding leased truck from user_trucks
 *   - delete lease row from user_leases (so it disappears immediately)
 * - Implemented lease purchase business flow:
 *   - charge full remaining lease value
 *   - insert financial_transactions debit (LEASE_PURCHASE)
 *   - update matched user_trucks acquisition_type -> used + purchase_date + purchase_price
 *   - delete lease row from user_leases
 *
 * REGRESSION FIXES:
 * - financial_accounts lookup is schema-safe (tries owner_company_id then company_id) to avoid 42703/400
 * - cancel/purchase actions clear stale error state before running and always reset loading in finally
 * - leased truck matching expanded to include historical acquisition_type variants
 * - modal shows visible error feedback and confirm click wraps async calls with void (...)
 *
 * BALANCE GATE FIX:
 * - Robust company balance parsing (balance / balance_cents, number or string)
 * - Company balance lookup mirrors header behavior: companies by id, then by owner_auth_user_id
 * - If balance cannot be resolved (RLS/schema drift), do not hard-block actions; transaction insert remains authoritative.
 */

import React from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

/**
 * LeaseRow
 *
 * Raw row shape we expect from the user_leases table query.
 */
interface LeaseRow {
  id: string
  asset_model_id?: string | null
  owner_company_id?: string | null
  lease_start?: string | null
  lease_end?: string | null
  lease_rate?: number | string | null
  status?: string | null
  is_active?: boolean | null
  truck_models?: {
    make?: string | null
    model?: string | null
  } | null
  created_at?: string | null
  [key: string]: any
}

/**
 * LeaseWithName
 *
 * LeaseRow augmented with an asset_name string used for display.
 */
interface LeaseWithName extends LeaseRow {
  asset_name?: string | null
}

type LeaseActionDialogState = {
  type: 'cancel' | 'purchase'
  lease: LeaseWithName
}

/**
 * PaymentInfo
 *
 * Computed payment information for a lease.
 */
interface PaymentInfo {
  totalPayments: number
  installmentsPaid: number
  remainingPayments: number
  installmentAmount: number | null
  nextPaymentDate: Date | null
}

/**
 * weeksDiffInclusive
 *
 * Compute inclusive week difference between two dates (minimum 0).
 */
function weeksDiffInclusive(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime()
  const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  return Math.max(0, weeks + 1)
}

/**
 * computePaymentInfo
 *
 * Compute a simple payment breakdown for a lease row. The installment amount
 * is derived from the total lease value (lease_rate) divided by number of weekly
 * payments between start and end.
 */
function computePaymentInfo(lease: LeaseRow): PaymentInfo | null {
  if (!lease.lease_start || !lease.lease_end) return null

  const start = new Date(lease.lease_start)
  const end = new Date(lease.lease_end)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return null

  const totalPayments = weeksDiffInclusive(start, end)
  const today = new Date()

  const serverPaid = (lease as any).payments_paid ?? (lease as any).payments_count ?? null
  const estimatedPaid = Math.max(0, weeksDiffInclusive(start, today))

  const installmentsPaid = Math.min(
    totalPayments,
    Math.max(0, typeof serverPaid === 'number' ? serverPaid : estimatedPaid)
  )

  const remainingPayments = Math.max(0, totalPayments - installmentsPaid)

  let installmentAmount: number | null = null
  if (lease.lease_rate !== null && lease.lease_rate !== undefined) {
    const total =
      typeof lease.lease_rate === 'string' ? parseFloat(lease.lease_rate) : Number(lease.lease_rate)
    if (!isNaN(total) && totalPayments > 0) {
      installmentAmount = total / totalPayments
    }
  }

  let nextPaymentDate: Date | null = null
  if (today < start) {
    nextPaymentDate = start
  } else if (remainingPayments > 0) {
    nextPaymentDate = new Date(start.getTime() + installmentsPaid * 7 * 24 * 60 * 60 * 1000)
  } else {
    nextPaymentDate = null
  }

  return {
    totalPayments,
    installmentsPaid,
    remainingPayments,
    installmentAmount,
    nextPaymentDate,
  }
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

/**
 * IntroCard
 */
function IntroCard(): JSX.Element {
  return (
    <section className="bg-white p-6 rounded-xl shadow" style={{ pointerEvents: 'auto' }}>
      <h2 className="text-lg font-semibold mb-4">Leases</h2>
      <p className="text-sm text-slate-500 mt-1">Company leases. Showing up to 10 entries per page.</p>
    </section>
  )
}

export default function LeasesPanel(): JSX.Element {
  const { user } = useAuth()

  const [leases, setLeases] = React.useState<LeaseWithName[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null)

  // modal dialog state (cancel/purchase)
  const [actionDialog, setActionDialog] = React.useState<LeaseActionDialogState | null>(null)

  // Pagination state
  const PAGE_SIZE = 10
  const [page, setPage] = React.useState(1)
  const [totalCount, setTotalCount] = React.useState<number | null>(null)

  // Cache the resolved company id so actions (purchase/cancel) don’t depend on fragile user shape
  const companyIdRef = React.useRef<string | null>(null)

  // Flip this to true temporarily if you want console logs
  const DEBUG = false

  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
      }),
    []
  )

  function formatMoney(v?: number | null): string {
    return currencyFormatter.format(Number(v || 0))
  }

  /**
   * resolveCompanyIdFromUser
   *
   * Best-effort extraction from common auth/user shapes.
   */
  function resolveCompanyIdFromUser(u: any): string | null {
    if (!u) return null
    const candidate =
      u.company_id ?? u.companyId ?? u.user_metadata?.company_id ?? u.user_metadata?.companyId ?? null
    return candidate ? String(candidate) : null
  }

  /**
   * resolveCompanyIdFromBrowser
   *
   * Browser fallback with per-user localStorage scoping to avoid stale company ids
   * from previously signed-in accounts.
   */
  function resolveCompanyIdFromBrowser(uid?: string | null): string | null {
    try {
      const w = (window as any).__CURRENT_COMPANY_ID
      if (w) return String(w)

      // Prefer per-user storage key to avoid stale cross-account company ids.
      if (uid) {
        const scoped = localStorage.getItem(`current_company_id:${uid}`)
        if (scoped) return scoped
      }

      const legacy = localStorage.getItem('current_company_id')
      if (legacy) return legacy
    } catch {}
    return null
  }

  /**
   * resolveCompanyIdFromDb
   *
   * Best-effort fallback: try common column names in `public.users`.
   * Primary expected linkage is users.auth_user_id -> auth user id.
   */
  async function resolveCompanyIdFromDb(u: any): Promise<string | null> {
    const uid = u?.id ? String(u.id) : null
    if (!uid) return null

    // public.users commonly stores auth linkage as auth_user_id.
    const attempts: Array<{ column: string; value: string }> = [
      { column: 'auth_user_id', value: uid },
      { column: 'id', value: uid },
    ]

    for (const a of attempts) {
      const { data, error } = await supabase
        .from('users')
        .select('company_id')
        .eq(a.column as any, a.value)
        .maybeSingle()

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('resolveCompanyIdFromDb attempt', a, { data, error })
      }

      if (!error && data?.company_id) return String(data.company_id)
    }

    return null
  }

  /**
   * resolveCompanyId
   *
   * Async resolution chain (cached):
   * 1) cached ref
   * 2) user object
   * 3) DB fallback (public.users.auth_user_id)
   * 4) browser fallback (__CURRENT_COMPANY_ID + localStorage)
   */
  async function resolveCompanyId(): Promise<string | null> {
    if (companyIdRef.current) return companyIdRef.current

    const fromUser = resolveCompanyIdFromUser(user as any)
    if (fromUser) {
      companyIdRef.current = fromUser
      try {
        if (user?.id) localStorage.setItem(`current_company_id:${user.id}`, fromUser)
        localStorage.setItem('current_company_id', fromUser)
      } catch {}
      return fromUser
    }

    const fromDb = await resolveCompanyIdFromDb(user as any)
    if (fromDb) {
      companyIdRef.current = fromDb
      try {
        if (user?.id) localStorage.setItem(`current_company_id:${user.id}`, fromDb)
        localStorage.setItem('current_company_id', fromDb)
      } catch {}
      return fromDb
    }

    const fromBrowser = resolveCompanyIdFromBrowser(user?.id ?? null)
    if (fromBrowser) {
      companyIdRef.current = fromBrowser
      return fromBrowser
    }

    return null
  }

  /**
   * getPrimaryFinancialAccountId
   *
   * Schema-safe lookup:
   * Some deployments use owner_company_id, others company_id.
   * Try both safely to avoid 400/42703 undefined column errors.
   */
  async function getPrimaryFinancialAccountId(companyId: string): Promise<string | null> {
    const attempts: Array<{ column: 'owner_company_id' | 'company_id' }> = [
      { column: 'owner_company_id' },
      { column: 'company_id' },
    ]

    let lastError: any = null

    for (const a of attempts) {
      const { data, error } = await supabase
        .from('financial_accounts')
        .select('id')
        .eq(a.column, companyId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!error) {
        return data?.id ? String(data.id) : null
      }

      lastError = error
      const code = String((error as any)?.code ?? '')
      // 42703 = undefined_column. Keep trying fallback column.
      if (code && code !== '42703') {
        break
      }
    }

    if (lastError) throw lastError
    return null
  }

  // ---------------- NEW BALANCE HELPERS ----------------

  function extractBalanceFromCompanyRow(row: any): number | null {
    if (!row) return null

    if (typeof row.balance === 'number' && Number.isFinite(row.balance)) {
      return Number(row.balance)
    }

    if (typeof row.balance_cents === 'number' && Number.isFinite(row.balance_cents)) {
      return Number(row.balance_cents) / 100
    }

    if (typeof row.balance === 'string') {
      const parsed = Number(row.balance)
      if (Number.isFinite(parsed)) return parsed
    }

    if (typeof row.balance_cents === 'string') {
      const parsed = Number(row.balance_cents)
      if (Number.isFinite(parsed)) return parsed / 100
    }

    return null
  }

  async function readCompanyBalance(companyId: string): Promise<number | null> {
    // Primary: explicit company id.
    const byId = await supabase
      .from('companies')
      .select('balance,balance_cents')
      .eq('id', companyId)
      .maybeSingle()

    if (byId.error) throw byId.error

    const idBalance = extractBalanceFromCompanyRow(byId.data)
    if (idBalance !== null) return idBalance

    // Fallback: owner_auth_user_id (same strategy as header widget).
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr) throw authErr
    const authUserId = authData?.user?.id
    if (!authUserId) return null

    const byOwner = await supabase
      .from('companies')
      .select('balance,balance_cents')
      .eq('owner_auth_user_id', authUserId)
      .maybeSingle()

    if (byOwner.error) throw byOwner.error

    return extractBalanceFromCompanyRow(byOwner.data)
  }

  /**
   * hasSufficientCompanyBalance
   *
   * Updated gate:
   * - Uses companies balance/balance_cents parsing (number or string).
   * - If balance cannot be resolved (schema/RLS drift), do NOT hard-block; proceed and let tx insert be authoritative.
   */
  async function hasSufficientCompanyBalance(companyId: string, amount: number): Promise<boolean> {
    if (!(amount > 0)) return true

    let balance: number | null = null
    try {
      balance = await readCompanyBalance(companyId)
    } catch {
      // If balance cannot be resolved (RLS/schema drift), do not hard-block.
      return true
    }

    if (balance === null) return true
    return balance >= amount
  }

  // ---------------- END NEW BALANCE HELPERS ----------------

  /**
   * resolveLeasedTruckId
   *
   * Expanded leased-truck matching to include additional historical acquisition variants
   * (starter/started/lease) so truck resolution doesn’t silently fail in mixed data.
   */
  async function resolveLeasedTruckId(lease: LeaseWithName): Promise<string | null> {
    if (!lease.asset_model_id) return null

    const companyId = await resolveCompanyId()
    if (!companyId) return null

    const { data, error } = await supabase
      .from('user_trucks')
      .select('id')
      .eq('owner_company_id', companyId)
      .eq('master_truck_id', lease.asset_model_id)
      .in('acquisition_type', ['leased', 'starter', 'started', 'lease'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data?.id ? String(data.id) : null
  }

  function getLeaseActionCosts(lease: LeaseWithName): {
    remainingPayments: number
    installmentAmount: number
    purchaseCost: number
    cancelPenaltyCost: number
  } {
    const paymentInfo = computePaymentInfo(lease)
    const remainingPayments = paymentInfo?.remainingPayments ?? 0
    const installmentAmount = paymentInfo?.installmentAmount ?? 0
    const purchaseCost = round2(remainingPayments * installmentAmount)
    const cancelPenaltyCost = round2(purchaseCost * 0.3)
    return {
      remainingPayments,
      installmentAmount,
      purchaseCost,
      cancelPenaltyCost,
    }
  }

  const actionDialogCosts = actionDialog ? getLeaseActionCosts(actionDialog.lease) : null
  const actionDialogTitle = actionDialog?.type === 'cancel' ? 'Cancel lease agreement' : 'Purchase leased truck'

  /**
   * fetchLeases
   *
   * Load a single page of leases and the exact total count so we can render
   * pagination controls.
   */
  async function fetchLeases(p: number = 1) {
    setLoading(true)
    setError(null)
    setLeases(null)

    try {
      const companyId = await resolveCompanyId()

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('leases: user=', user)
        // eslint-disable-next-line no-console
        console.log('leases: resolved companyId=', companyId)
        // eslint-disable-next-line no-console
        console.log(
          'leases: scoped current_company_id=',
          user?.id ? localStorage.getItem(`current_company_id:${user.id}`) : null
        )
        // eslint-disable-next-line no-console
        console.log('leases: legacy current_company_id=', localStorage.getItem('current_company_id'))
      }

      if (!companyId) {
        setError('No company context available.')
        setLeases([])
        setTotalCount(0)
        return
      }

      const start = (p - 1) * PAGE_SIZE
      const end = p * PAGE_SIZE - 1

      // Request exact count and only the page slice
      const { data, error: sbError, count } = await supabase
        .from('user_leases')
        .select(
          `
          id,
          asset_model_id,
          owner_company_id,
          lease_start,
          lease_end,
          lease_rate,
          status,
          is_active,
          created_at,
          truck_models!user_leases_asset_model_id_fkey(make,model)
        `,
          { count: 'exact' }
        )
        .eq('owner_company_id', companyId)
        .order('created_at', { ascending: false })
        .range(start, end)

      if (sbError) {
        setError(sbError.message)
        setLeases([])
        setTotalCount(0)
        return
      }

      const rows = (data ?? []) as LeaseRow[]
      const mapped: LeaseWithName[] = rows.map((r) => {
        const joined = r.truck_models
        const joinedName = joined && [joined.make, joined.model].filter(Boolean).join(' ')
        return {
          ...r,
          asset_name: joinedName ?? r.asset_model_id ?? null,
        }
      })

      setLeases(mapped)
      setTotalCount(typeof count === 'number' ? count : rows.length)
      setPage(p)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch leases')
      setLeases([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  // Reset cached company id on user change and refetch.
  React.useEffect(() => {
    companyIdRef.current = null
    fetchLeases(1).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, (user as any)?.company_id])

  /**
   * cancelLease
   */
  async function cancelLease(lease: LeaseWithName) {
    const id = lease.id
    setError(null)
    setActionLoadingId(id)

    try {
      const companyId = await resolveCompanyId()
      if (!companyId) {
        setError('No company context available for lease termination.')
        return
      }

      let accountId: string | null = null
      try {
        accountId = await getPrimaryFinancialAccountId(companyId)
      } catch (e: any) {
        setError(e?.message ?? 'Failed to resolve financial account')
        return
      }

      if (!accountId) {
        setError('No financial account found for this company.')
        return
      }

      const costs = getLeaseActionCosts(lease)
      if (!costs.cancelPenaltyCost || costs.cancelPenaltyCost <= 0) {
        setError('No remaining lease value found for termination penalty.')
        return
      }

      const hasFunds = await hasSufficientCompanyBalance(companyId, costs.cancelPenaltyCost)
      if (!hasFunds) {
        setError(`Insufficient company balance. Required: ${formatMoney(costs.cancelPenaltyCost)}.`)
        return
      }

      const { error: txError } = await supabase.from('financial_transactions').insert({
        account_id: accountId,
        type_code: 'LEASE_TERMINATION',
        kind: 'expense',
        amount: costs.cancelPenaltyCost,
        currency: 'USD',
        note: `Lease termination penalty (30% of ${costs.remainingPayments} remaining payments)`,
        metadata: {
          lease_id: lease.id,
          action: 'cancel_lease',
          remaining_payments: costs.remainingPayments,
          installment_amount: costs.installmentAmount,
          charge_percent: 30,
          charged_amount: costs.cancelPenaltyCost,
        },
      })

      if (txError) {
        setError(txError.message || 'Failed to create lease termination transaction')
        return
      }

      let leasedTruckId: string | null = null
      try {
        leasedTruckId = await resolveLeasedTruckId(lease)
      } catch (e: any) {
        setError(e?.message ?? 'Lease charge completed, but failed to resolve leased truck.')
        return
      }

      if (leasedTruckId) {
        const { error: truckDeleteErr } = await supabase.from('user_trucks').delete().eq('id', leasedTruckId)
        if (truckDeleteErr) {
          setError(truckDeleteErr.message || 'Lease charge completed, but failed to remove truck from fleet.')
          return
        }
      }

      const { error: leaseDeleteErr } = await supabase.from('user_leases').delete().eq('id', id)

      if (leaseDeleteErr) {
        setError(leaseDeleteErr.message || 'Lease charge completed, but failed to remove lease row.')
        return
      }

      setActionDialog(null)
      await fetchLeases(page)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to cancel lease')
    } finally {
      setActionLoadingId(null)
    }
  }

  /**
   * purchaseTruck
   */
  async function purchaseTruck(lease: LeaseWithName) {
    const id = lease.id
    setError(null)
    setActionLoadingId(id)

    try {
      const companyId = await resolveCompanyId()
      if (!companyId) {
        setError('No company context available for purchase.')
        return
      }

      let accountId: string | null = null
      try {
        accountId = await getPrimaryFinancialAccountId(companyId)
      } catch (e: any) {
        setError(e?.message ?? 'Failed to resolve financial account')
        return
      }

      if (!accountId) {
        setError('No financial account found for this company.')
        return
      }

      const costs = getLeaseActionCosts(lease)
      if (!costs.purchaseCost || costs.purchaseCost <= 0) {
        setError('No remaining lease value found for buyout.')
        return
      }

      const hasFunds = await hasSufficientCompanyBalance(companyId, costs.purchaseCost)
      if (!hasFunds) {
        setError(`Insufficient company balance. Required: ${formatMoney(costs.purchaseCost)}.`)
        return
      }

      const { error: txError } = await supabase.from('financial_transactions').insert({
        account_id: accountId,
        type_code: 'LEASE_PURCHASE',
        kind: 'expense',
        amount: costs.purchaseCost,
        currency: 'USD',
        note: `Lease buyout (${costs.remainingPayments} remaining payments)`,
        metadata: {
          lease_id: lease.id,
          action: 'purchase_lease_truck',
          remaining_payments: costs.remainingPayments,
          installment_amount: costs.installmentAmount,
          buyout_amount: costs.purchaseCost,
        },
      })

      if (txError) {
        setError(txError.message || 'Failed to create lease purchase transaction')
        return
      }

      let leasedTruckId: string | null = null
      try {
        leasedTruckId = await resolveLeasedTruckId(lease)
      } catch (e: any) {
        setError(e?.message ?? 'Purchase charged, but failed to resolve leased truck.')
        return
      }

      if (leasedTruckId) {
        const { error: truckUpdateErr } = await supabase
          .from('user_trucks')
          .update({
            acquisition_type: 'used',
            purchase_date: new Date().toISOString(),
            purchase_price: costs.purchaseCost,
          })
          .eq('id', leasedTruckId)

        if (truckUpdateErr) {
          setError(truckUpdateErr.message || 'Purchase charged, but failed to update truck ownership state.')
          return
        }
      }

      const { error: deleteErr } = await supabase.from('user_leases').delete().eq('id', id)

      if (deleteErr) {
        setError(deleteErr.message || 'Purchase charged, but failed to remove lease row.')
        return
      }

      setActionDialog(null)
      await fetchLeases(page)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to purchase truck')
    } finally {
      setActionLoadingId(null)
    }
  }

  /**
   * gotoPrevPage
   */
  function gotoPrevPage() {
    if (page <= 1) return
    fetchLeases(page - 1).catch(() => {})
  }

  /**
   * gotoNextPage
   */
  function gotoNextPage() {
    if (!totalCount) return
    const maxP = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
    if (page >= maxP) return
    fetchLeases(page + 1).catch(() => {})
  }

  const maxPage = totalCount ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : 1

  return (
    <div className="space-y-4">
      <IntroCard />

      {/* in-app confirmation dialog */}
      {actionDialog && actionDialogCosts && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 p-6">
            <h3 className="text-xl font-semibold text-slate-900">{actionDialogTitle}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Truck:{' '}
              <span className="font-medium text-slate-700">
                {actionDialog.lease.asset_name ?? actionDialog.lease.id}
              </span>
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Remaining installments</div>
                <div className="font-semibold text-slate-900">{actionDialogCosts.remainingPayments}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Installment amount</div>
                <div className="font-semibold text-slate-900">{formatMoney(actionDialogCosts.installmentAmount)}</div>
              </div>
            </div>

            {actionDialog.type === 'cancel' ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm">
                <p className="font-medium text-rose-800">Lease termination penalty</p>
                <p className="mt-1 text-rose-700">
                  Cancelling now charges <span className="font-semibold">30%</span> of all remaining lease payments.
                </p>
                <p className="mt-2 text-rose-700">
                  Remaining value: <span className="font-semibold">{formatMoney(actionDialogCosts.purchaseCost)}</span>
                </p>
                <p className="text-rose-800">
                  Penalty charged immediately:{' '}
                  <span className="font-semibold">{formatMoney(actionDialogCosts.cancelPenaltyCost)}</span>
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
                <p className="font-medium text-emerald-800">Lease buyout total</p>
                <p className="mt-1 text-emerald-700">
                  Purchasing now charges the full remaining lease value ({actionDialogCosts.remainingPayments} payments).
                </p>
                <p className="mt-2 text-emerald-800">
                  Amount charged immediately:{' '}
                  <span className="font-semibold">{formatMoney(actionDialogCosts.purchaseCost)}</span>
                </p>
              </div>
            )}

            {/* visible error feedback inside modal */}
            {error && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-4 text-xs text-slate-500">
              Confirming will apply the financial transaction immediately and remove this truck from the lease list.
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={() => setActionDialog(null)}
                disabled={actionLoadingId === actionDialog.lease.id}
              >
                Keep lease
              </button>

              <button
                type="button"
                className={`px-4 py-2 rounded-lg text-white ${
                  actionDialog.type === 'cancel' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
                onClick={() => {
                  void (actionDialog.type === 'cancel'
                    ? cancelLease(actionDialog.lease)
                    : purchaseTruck(actionDialog.lease))
                }}
                disabled={actionLoadingId === actionDialog.lease.id}
              >
                {actionLoadingId === actionDialog.lease.id
                  ? 'Processing…'
                  : actionDialog.type === 'cancel'
                  ? `Confirm cancel (${formatMoney(actionDialogCosts.cancelPenaltyCost)})`
                  : `Confirm purchase (${formatMoney(actionDialogCosts.purchaseCost)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs text-slate-500">Published company truck lease deals</div>
            </div>
          </div>

          <button
            onClick={() => fetchLeases(1)}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm border"
            type="button"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {error && <div className="text-xs text-rose-600 mb-2">{error}</div>}
        {loading && <div className="text-xs text-slate-500 mb-2">Loading…</div>}

        {leases?.map((l) => {
          const paymentInfo = computePaymentInfo(l)
          const isActing = actionLoadingId === l.id

          return (
            <div key={l.id} className="p-3 bg-slate-50 rounded border flex justify-between mb-3">
              <div>
                <div className="text-sm font-medium">{l.asset_name ?? l.id}</div>

                {paymentInfo && paymentInfo.remainingPayments > 0 && (
                  <div className="text-xs text-slate-500">
                    {paymentInfo.remainingPayments} installments left •{' '}
                    <span className="font-semibold text-emerald-600">
                      {currencyFormatter.format(paymentInfo.installmentAmount ?? 0)}
                    </span>{' '}
                    each • Next: {paymentInfo.nextPaymentDate?.toLocaleDateString() ?? '—'}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => setActionDialog({ type: 'cancel', lease: l })}
                    disabled={isActing}
                    className="px-3 py-1 rounded-md text-sm border text-rose-600 hover:bg-rose-50 transition"
                    type="button"
                    aria-label={`Cancel leasing ${l.id}`}
                  >
                    {isActing ? 'Working…' : 'Cancel Leasing'}
                  </button>

                  <button
                    onClick={() => setActionDialog({ type: 'purchase', lease: l })}
                    disabled={isActing}
                    className="px-3 py-1 rounded-md text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    type="button"
                    aria-label={`Purchase truck ${l.id}`}
                  >
                    {isActing ? 'Working…' : 'Purchase Truck'}
                  </button>
                </div>
              </div>

              <div className="text-right text-xs">
                <div>{l.status}</div>
                <div>
                  {l.lease_start ? new Date(l.lease_start).toLocaleDateString() : '—'} →{' '}
                  {l.lease_end ? new Date(l.lease_end).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          )
        })}

        {leases && leases.length === 0 && <div className="text-xs text-slate-500">No leases published.</div>}

        {/* Pagination controls */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Showing page {page} of {maxPage}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={gotoPrevPage}
              disabled={page <= 1}
              className="px-3 py-1 rounded-md text-sm border text-slate-700 disabled:opacity-50"
              type="button"
            >
              Prev
            </button>

            <button
              onClick={gotoNextPage}
              disabled={page >= maxPage}
              className="px-3 py-1 rounded-md text-sm border text-slate-700 disabled:opacity-50"
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}