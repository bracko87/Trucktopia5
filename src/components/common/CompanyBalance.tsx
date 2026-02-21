/**
 * CompanyBalance.tsx
 *
 * Small header balance widget that reads the authoritative company balance
 * from the public.companies table.
 *
 * Behavior:
 * - When a user is available (from AuthContext) the component queries
 *   public.companies by owner_auth_user_id and reads balance / balance_cents.
 * - Also listens for a 'finances:summary' CustomEvent and will prefer that
 *   event to update the UI if present (keeps compatibility with existing pages).
 * - Exposes small formatting options via props.
 */

import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

/**
 * Props for CompanyBalance component.
 */
interface CompanyBalanceProps {
  className?: string
  noCents?: boolean
}

/**
 * formatCurrency
 *
 * Format a numeric balance to a string with optional removal of cents.
 *
 * @param value - numeric value to format
 * @param noCents - if true, show no fractional digits
 * @returns formatted currency string (e.g. $1,234.56)
 */
function formatCurrency(value: number, noCents?: boolean): string {
  try {
    const opts: Intl.NumberFormatOptions = {
      minimumFractionDigits: noCents ? 0 : 2,
      maximumFractionDigits: noCents ? 0 : 2,
    }
    const abs = Math.abs(value)
    const formatted = new Intl.NumberFormat(undefined, opts).format(abs)
    return `${value < 0 ? '-' : ''}$${formatted}`
  } catch {
    return `${value < 0 ? '-' : ''}$${noCents ? Math.round(value) : value.toFixed(2)}`
  }
}

/**
 * CompanyBalance
 *
 * Renders current company balance for the logged-in user's company.
 *
 * - Primary data source: SELECT balance, balance_cents FROM companies WHERE owner_auth_user_id = user.id
 * - Fallback: listens for 'finances:summary' event dispatched elsewhere in the app.
 *
 * @param props CompanyBalanceProps
 * @returns JSX.Element
 */
export default function CompanyBalance({
  className = 'text-sm font-medium text-white',
  noCents,
}: CompanyBalanceProps): JSX.Element {
  const { user } = useAuth()
  const [balance, setBalance] = useState<number | null>(null)

  /**
   * fetchCompanyBalance
   *
   * Performs a safe read of the companies table to obtain the canonical balance.
   * Uses owner_auth_user_id to avoid relying on users.id denormalization.
   */
  async function fetchCompanyBalance(uid: string) {
    try {
      const res = await supabase
        .from('companies')
        .select('balance, balance_cents')
        .eq('owner_auth_user_id', uid)
        .maybeSingle()

      if (res.error) {
        // If the read fails, do not override an existing balance; just log.
        // eslint-disable-next-line no-console
        console.error('CompanyBalance: failed to fetch company', res.error)
        return
      }

      const company = res.data as { balance?: number | null; balance_cents?: number | null } | null
      if (!company) {
        // no company found for this user
        return
      }

      let val: number | null = null
      if (typeof company.balance === 'number') {
        val = company.balance
      } else if (typeof company.balance_cents === 'number') {
        val = company.balance_cents / 100
      }

      if (typeof val === 'number') {
        setBalance(val)
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('CompanyBalance: unexpected error fetching company balance', err)
    }
  }

  useEffect(() => {
    let mounted = true

    /**
     * handleFinancesSummary
     *
     * If a Finances page dispatches a summary event prefer that value
     * so small UI elements update in sync with the overview page.
     */
    function handleFinancesSummary(ev: Event) {
      try {
        const ce = ev as CustomEvent<{ balance?: number }>
        const next = ce?.detail?.balance
        if (typeof next === 'number' && mounted) {
          setBalance(next)
        }
      } catch {
        // ignore malformed events
      }
    }

    window.addEventListener('finances:summary', handleFinancesSummary)

    if (user && user.id) {
      void fetchCompanyBalance(user.id)
    }

    return () => {
      mounted = false
      window.removeEventListener('finances:summary', handleFinancesSummary)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return <div className={className}>{balance === null ? '—' : formatCurrency(balance, noCents)}</div>
}