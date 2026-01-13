/**
 * InsuranceManager.tsx
 *
 * Small reusable UI component that connects an existing button to the insurance
 * backend. Allows using a custom button appearance or the default button that
 * matches the markup you've shown. Opens InsuranceModal and delegates purchase.
 */

/**
 * File-level: Connect existing button UI to compute/purchase insurance API.
 */

import React, { useState } from 'react'
import { Shield } from 'lucide-react'
import InsuranceModal from './InsuranceModal'
import { purchaseInsurance } from '../../lib/insurance'

/**
 * Props for InsuranceManager
 *
 * - userTruckId: user_trucks.id for the truck to insure
 * - className: optional className to apply to the trigger button (defaults to white button style)
 * - children: optional content to render inside the button; when omitted default text + icon is used
 * - style: optional inline style for the button
 */
export interface InsuranceManagerProps {
  userTruckId: string
  className?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

/**
 * InsuranceManager
 *
 * Renders a button that opens the InsuranceModal for the provided truck.
 * The rendered button defaults to:
 * <button type="button" class="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-2" style="pointer-events: auto;">Insurance</button>
 *
 * If you already have a button in markup, replace it with:
 * <InsuranceManager userTruckId={id} className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-2" />
 *
 * @param props - InsuranceManagerProps
 * @returns JSX.Element
 */
export default function InsuranceManager({
  userTruckId,
  className,
  children,
  style,
}: InsuranceManagerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  /**
   * handlePurchase
   *
   * Called from modal when user confirms purchase. Uses the shared purchaseInsurance helper.
   *
   * @param planCode - plan code (basic | plus | premium)
   * @param months - duration months
   */
  async function handlePurchase(planCode: string, months: number) {
    setPending(true)
    try {
      await purchaseInsurance(userTruckId, planCode, months)
      // eslint-disable-next-line no-alert
      alert('Insurance purchased successfully.')
      setOpen(false)
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('purchaseInsurance failed', err)
      // eslint-disable-next-line no-alert
      alert('Purchase failed.')
    } finally {
      setPending(false)
    }
  }

  const defaultClass =
    'px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-2'
  const btnClass = className || defaultClass

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={btnClass}
        style={{ pointerEvents: 'auto', ...(style || {}) }}
        aria-label="Open insurance modal"
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

      <InsuranceModal truckId={userTruckId} open={open} onClose={() => setOpen(false)} onPurchase={handlePurchase} />
    </>
  )
}