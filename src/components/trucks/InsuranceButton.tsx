/**
 * InsuranceButton.tsx
 *
 * Renders an "Insurance" button that is disabled (grayed out) while an active
 * insurance has more than 60 days remaining. Removes pointer-events overrides
 * so the native disabled attribute works correctly. Shows a tooltip explaining
 * when new insurance can be purchased.
 */

import React, { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { listInsurancesForTruck } from '../../lib/insurance'

/**
 * TruckInsuranceRow
 *
 * Minimal shape used by this component from truck_insurances rows.
 */
export interface TruckInsuranceRow {
  id?: string
  user_truck_id?: string
  start_date?: string | null
  end_date?: string | null
  is_active?: boolean | null
  [key: string]: any
}

/**
 * Props for InsuranceButton
 *
 * - userTruckId: user_trucks.id for the truck to insure
 * - onOpen: optional callback when the button is clicked (only when enabled)
 * - className: optional extra classes to apply to the button
 * - children: optional button children (default preserves provided markup)
 * - style: optional inline styles (DO NOT set pointerEvents here)
 */
export interface InsuranceButtonProps {
  userTruckId: string
  onOpen?: () => void
  className?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

/**
 * InsuranceButton
 *
 * Loads current insurances for the truck and computes days left on the active one.
 * The button becomes disabled (grayed and non-interactive) when an active insurance
 * has more than 60 days remaining. Tooltip explains the rule.
 *
 * @param props - InsuranceButtonProps
 * @returns JSX.Element
 */
export default function InsuranceButton({
  userTruckId,
  onOpen,
  className,
  children,
  style,
}: InsuranceButtonProps): JSX.Element {
  const [disabled, setDisabled] = useState<boolean>(false)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true

    async function checkInsurance() {
      try {
        const rows = (await listInsurancesForTruck(userTruckId)) as TruckInsuranceRow[] | undefined
        if (!mounted || !rows || rows.length === 0) {
          setDisabled(false)
          setDaysLeft(null)
          return
        }

        const active = rows.find((r) => r.is_active)
        if (!active || !active.end_date) {
          setDisabled(false)
          setDaysLeft(null)
          return
        }

        const end = new Date(active.end_date)
        const now = new Date()
        const diffMs = end.getTime() - now.getTime()
        const computedDaysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

        if (!mounted) return

        setDaysLeft(computedDaysLeft)
        setDisabled(computedDaysLeft > 60)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug('InsuranceButton.checkInsurance error', err)
        setDisabled(false)
        setDaysLeft(null)
      }
    }

    void checkInsurance()

    return () => {
      mounted = false
    }
  }, [userTruckId])

  const baseClass =
    className ??
    'px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-2'

  const disabledTitle =
    daysLeft != null
      ? `Current insurance expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. New insurance available 60 days before expiry.`
      : 'New insurance available 60 days before expiry.'

  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled && onOpen) onOpen()
      }}
      disabled={disabled}
      className={`${baseClass} ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-white' : ''}`}
      style={{ ...(style || {}) }}
      aria-label="Open insurance modal"
      title={disabled ? disabledTitle : 'Open insurance modal'}
    >
      {children ? (
        children
      ) : (
        <>
          <Shield className="w-4 h-4 text-sky-600" />
          <span>Insurance</span>
        </>
      )}
    </button>
  )
}