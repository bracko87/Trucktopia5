/**
 * CompanyBalance.tsx
 *
 * Small presentational + data component that fetches the current user's company
 * and displays the company's balance.
 *
 * Uses the existing supabaseFetch helper so RLS on the backend ensures the fetch
 * returns only the company(ies) visible to the logged-in user.
 */

import React, { useEffect, useState } from 'react'
import { supabaseFetch } from '../../lib/supabase'

/**
 * CompanyBalanceProps
 *
 * Props for the CompanyBalance component.
 */
interface CompanyBalanceProps {
  className?: string
  /**
   * If true, show a subtle loading placeholder instead of the word "Loading..."
   */
  compact?: boolean
  /**
   * When true, format without cents and use a dot as thousand separator with
   * the dollar sign after the number (e.g. "10.000$").
   */
  noCents?: boolean
}

/**
 * formatCentsToDollar
 *
 * Convert integer cents to a human friendly USD string.
 *
 * @param cents - amount in cents (may be null)
 * @param noCents - whether to format without cents and place $ at the end
 */
function formatCentsToDollar(cents: number | null | undefined, noCents = false) {
  if (cents === null || typeof cents === 'undefined') return '—'
  const dollars = Number(cents) / 100

  if (noCents) {
    const rounded = Math.round(dollars)
    try {
      // Use de-DE to get dot thousands separator, then append $ as requested.
      return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(rounded) + '$'
    } catch {
      return `${rounded}$`
    }
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(dollars)
  } catch {
    // Fallback
    return `$${dollars.toFixed(2)}`
  }
}

/**
 * CompanyBalance
 *
 * Fetches the current user's company (via /rest/v1/companies) and displays
 * companies[0].balance_cents as a formatted USD amount.
 *
 * NOTE:
 * - We intentionally do not add owner filters to the REST path; Row-Level Security
 *   on the backend should limit returned companies to those visible to the session.
 *
 * @param props - CompanyBalanceProps
 */
export default function CompanyBalance({
  className = '',
  compact = false,
  noCents = false
}: CompanyBalanceProps) {
  const [loading, setLoading] = useState<boolean>(true)
  const [balanceCents, setBalanceCents] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        // RLS applies - select balance_cents for the company(ies) visible to the current session.
        const res: any = await supabaseFetch('/rest/v1/companies?select=balance_cents&limit=1', {
          method: 'GET'
        })
        if (!mounted) return
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          const row = res.data[0]
          const cents = row?.balance_cents ?? null
          setBalanceCents(cents !== null && typeof cents !== 'undefined' ? Number(cents) : null)
        } else {
          setBalanceCents(null)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('CompanyBalance: failed to fetch company balance', err)
        setBalanceCents(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return <div className={`${className}`}>{compact ? '…' : 'Loading…'}</div>
  }

  return <div className={`${className}`}>{formatCentsToDollar(balanceCents, noCents)}</div>
}
