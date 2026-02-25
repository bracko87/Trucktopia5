/**
 * LeasesPanel.tsx
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

  const serverPaid =
    (lease as any).payments_paid ?? (lease as any).payments_count ?? null

  const estimatedPaid = Math.max(0, weeksDiffInclusive(start, today))

  const installmentsPaid = Math.min(
    totalPayments,
    Math.max(0, typeof serverPaid === 'number' ? serverPaid : estimatedPaid)
  )

  const remainingPayments = Math.max(0, totalPayments - installmentsPaid)

  let installmentAmount: number | null = null
  if (lease.lease_rate !== null && lease.lease_rate !== undefined) {
    const total =
      typeof lease.lease_rate === 'string'
        ? parseFloat(lease.lease_rate)
        : Number(lease.lease_rate)
    if (!isNaN(total) && totalPayments > 0) {
      installmentAmount = total / totalPayments
    }
  }

  let nextPaymentDate: Date | null = null
  if (today < start) {
    nextPaymentDate = start
  } else if (remainingPayments > 0) {
    nextPaymentDate = new Date(
      start.getTime() + installmentsPaid * 7 * 24 * 60 * 60 * 1000
    )
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

/**
 * IntroCard
 */
function IntroCard(): JSX.Element {
  return (
    <section
      className="bg-white p-6 rounded-xl shadow"
      style={{ pointerEvents: 'auto' }}
    >
      <h2 className="text-lg font-semibold mb-4">Leases</h2>
      <p className="text-sm text-slate-500 mt-1">
        Company leases. Showing up to 10 entries per page.
      </p>
    </section>
  )
}

export default function LeasesPanel(): JSX.Element {
  const { user } = useAuth()

  const [leases, setLeases] = React.useState<LeaseWithName[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(
    null
  )

  // Pagination state
  const PAGE_SIZE = 10
  const [page, setPage] = React.useState(1)
  const [totalCount, setTotalCount] = React.useState<number | null>(null)

  // Cache the resolved company id so actions (purchase/cancel) don’t depend on fragile user shape
  const companyIdRef = React.useRef<string | null>(null)

  // Flip this to true temporarily if you want console logs
  const DEBUG = false

  /**
   * resolveCompanyIdFromUser
   *
   * Best-effort extraction from common auth/user shapes.
   */
  function resolveCompanyIdFromUser(u: any): string | null {
    if (!u) return null
    const candidate =
      u.company_id ??
      u.companyId ??
      u.user_metadata?.company_id ??
      u.user_metadata?.companyId ??
      null
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
        console.log(
          'leases: legacy current_company_id=',
          localStorage.getItem('current_company_id')
        )
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
        // Optional: show only active leases; comment out if you want history too.
        // .eq('is_active', true)
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
        const joinedName =
          joined && [joined.make, joined.model].filter(Boolean).join(' ')
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

  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  })

  /**
   * cancelLease
   */
  async function cancelLease(id: string) {
    if (!window.confirm('Cancel this leasing agreement?')) return
    setActionLoadingId(id)
    try {
      const { error } = await supabase
        .from('user_leases')
        .update({ status: 'cancelled', is_active: false })
        .eq('id', id)

      if (error) {
        setError(error.message || 'Failed to cancel lease')
      } else {
        await fetchLeases(page)
      }
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
    if (!window.confirm('Purchase this truck now?')) return
    const id = lease.id
    setActionLoadingId(id)

    try {
      const companyId = await resolveCompanyId()
      if (!companyId) {
        setError('No company context available for purchase.')
        setActionLoadingId(null)
        return
      }

      const purchasePrice =
        lease.lease_rate !== null && lease.lease_rate !== undefined
          ? typeof lease.lease_rate === 'string'
            ? parseFloat(lease.lease_rate)
            : Number(lease.lease_rate)
          : null

      const insertPayload: any = {
        master_truck_id: lease.asset_model_id,
        owner_company_id: companyId,
        purchase_date: new Date().toISOString(),
      }

      if (purchasePrice !== null && !isNaN(purchasePrice)) {
        insertPayload.purchase_price = purchasePrice
      }

      const { error: insertErr } = await supabase
        .from('user_trucks')
        .insert(insertPayload)

      if (insertErr) {
        setError(insertErr.message || 'Failed to create truck record')
        setActionLoadingId(null)
        return
      }

      const { error: updateErr } = await supabase
        .from('user_leases')
        .update({ status: 'purchased', is_active: false })
        .eq('id', id)

      if (updateErr) {
        setError(updateErr.message || 'Failed to update lease after purchase')
      } else {
        await fetchLeases(page)
      }
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
    const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
    if (page >= maxPage) return
    fetchLeases(page + 1).catch(() => {})
  }

  const maxPage = totalCount ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : 1

  return (
    <div className="space-y-4">
      <IntroCard />

      <div className="bg-white rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs text-slate-500">
                Published company truck lease deals
              </div>
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
            <div
              key={l.id}
              className="p-3 bg-slate-50 rounded border flex justify-between mb-3"
            >
              <div>
                <div className="text-sm font-medium">{l.asset_name ?? l.id}</div>

                {paymentInfo && paymentInfo.remainingPayments > 0 && (
                  <div className="text-xs text-slate-500">
                    {paymentInfo.remainingPayments} installments left •{' '}
                    <span className="font-semibold text-emerald-600">
                      {currencyFormatter.format(paymentInfo.installmentAmount ?? 0)}
                    </span>{' '}
                    each • Next:{' '}
                    {paymentInfo.nextPaymentDate?.toLocaleDateString() ?? '—'}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => cancelLease(l.id)}
                    disabled={isActing}
                    className="px-3 py-1 rounded-md text-sm border text-rose-600 hover:bg-rose-50 transition"
                    type="button"
                    aria-label={`Cancel leasing ${l.id}`}
                  >
                    {isActing ? 'Working…' : 'Cancel Leasing'}
                  </button>

                  <button
                    onClick={() => purchaseTruck(l)}
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
                  {l.lease_start ? new Date(l.lease_start).toLocaleDateString() : '—'}{' '}
                  → {l.lease_end ? new Date(l.lease_end).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          )
        })}

        {leases && leases.length === 0 && (
          <div className="text-xs text-slate-500">No leases published.</div>
        )}

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