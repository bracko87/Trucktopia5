/**
 * TruckInsurance.tsx
 *
 * Small reusable component to display the current insurance status for a truck.
 *
 * Responsibilities:
 * - Fetch the truck's insurances and available plans.
 * - Pick the most relevant insurance row (active, newest by end_date/created_at).
 * - Render a single-line summary: "Insurance: {PlanName} — until {date}" or "None".
 */

import React, { useEffect, useState } from 'react'
import { listInsurancesForTruck, getInsurancePlans } from '../../lib/insurance'

/**
 * Minimal shape for a truck_insurances row used by this component.
 */
interface TruckInsuranceRow {
  id: string
  plan_id: string
  start_date: string | null
  end_date: string | null
  is_active?: boolean | null
  created_at?: string | null
  [key: string]: any
}

/**
 * Minimal shape for an insurance plan used for display.
 */
interface InsurancePlanSmall {
  id: string
  code?: string | null
  name?: string | null
}

/**
 * Props for TruckInsurance
 *
 * - userTruckId: id of the user_trucks row to inspect
 * - className: optional container class
 */
export interface TruckInsuranceProps {
  userTruckId: string
  className?: string
}

/**
 * TruckInsurance
 *
 * Fetches insurance info and renders a one-line summary suitable for inclusion
 * in truck detail grids:
 *
 * Insurance: Premium — until 2026-04-01
 *
 * If no insurance exists, renders "Insurance: None".
 *
 * @param props TruckInsuranceProps
 * @returns JSX.Element
 */
export default function TruckInsurance({ userTruckId, className = '' }: TruckInsuranceProps): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true)
  const [insurance, setInsurance] = useState<TruckInsuranceRow | null>(null)
  const [plansById, setPlansById] = useState<Record<string, InsurancePlanSmall>>({})

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        // Fetch insurances and plans in parallel
        const [insRows, plans] = await Promise.all([listInsurancesForTruck(userTruckId), getInsurancePlans()])

        if (!mounted) return

        // Map plans by id for quick lookup
        const map: Record<string, InsurancePlanSmall> = {}
        for (const p of plans || []) {
          map[p.id] = { id: p.id, code: p.code, name: p.name }
        }
        setPlansById(map)

        // Choose the best insurance row:
        // Prefer active rows; otherwise pick newest by end_date, then created_at.
        const rows: TruckInsuranceRow[] = Array.isArray(insRows) ? insRows : []
        if (rows.length === 0) {
          setInsurance(null)
          return
        }

        // Separate actives
        const activeRows = rows.filter((r) => r.is_active === true)
        const candidates = activeRows.length > 0 ? activeRows : rows

        // Sort by end_date desc (nulls -> far future), then created_at desc
        candidates.sort((a, b) => {
          const aEnd = a.end_date ? new Date(a.end_date).getTime() : Number.POSITIVE_INFINITY
          const bEnd = b.end_date ? new Date(b.end_date).getTime() : Number.POSITIVE_INFINITY
          if (aEnd !== bEnd) return bEnd - aEnd
          const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
          const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
          return bCreated - aCreated
        })

        setInsurance(candidates[0] || null)
      } catch (err) {
        // On error treat as no insurance (don't throw in UI)
        // eslint-disable-next-line no-console
        console.error('TruckInsurance load error', err)
        if (mounted) setInsurance(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [userTruckId])

  /**
   * formatDate
   *
   * Format ISO date string to a short human-readable date. Returns '—' when missing.
   *
   * @param iso ISO date string or null
   */
  function formatDate(iso: string | null | undefined) {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      return d.toLocaleDateString()
    } catch {
      return iso
    }
  }

  // Resolve plan display name
  const planName =
    insurance && plansById && plansById[insurance.plan_id]
      ? plansById[insurance.plan_id].name ?? plansById[insurance.plan_id].code ?? 'Plan'
      : insurance
      ? 'Plan'
      : null

  const content = loading ? 'Loading...' : insurance ? `${planName} — until ${formatDate(insurance.end_date)}` : 'None'

  return (
    <div className={`col-span-1 sm:col-span-1 ${className}`}>
      <div className="text-xs text-slate-500">Insurance</div>
      <div className="text-sm font-medium text-slate-800 truncate min-w-0">{content}</div>
    </div>
  )
}
