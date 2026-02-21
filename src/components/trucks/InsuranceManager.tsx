import React, { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import InsuranceModal from './InsuranceModal'
import { purchaseInsurance, listInsurancesForTruck } from '../../lib/insurance'

export interface InsuranceManagerProps {
  userTruckId: string
  className?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

export default function InsuranceManager({
  userTruckId,
  className,
  children,
  style,
}: InsuranceManagerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [disabled, setDisabled] = useState(false)

  useEffect(() => {
    async function checkInsurance() {
      try {
        const rows = await listInsurancesForTruck(userTruckId)

        console.log('Insurance rows:', rows)

        if (!rows?.length) {
          setDisabled(false)
          return
        }

        const active = rows.find((r: any) => r.is_active)

        console.log('Active insurance:', active)

        if (!active?.end_date) {
          setDisabled(false)
          return
        }

        const end = new Date(active.end_date)
        const now = new Date()

        const daysLeft =
          (end.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)

        console.log('Days left:', daysLeft)

        const shouldDisable = daysLeft > 60
        console.log('Button disabled:', shouldDisable)

        setDisabled(shouldDisable)
      } catch (e) {
        console.error('Insurance check failed', e)
        setDisabled(false)
      }
    }

    checkInsurance()
  }, [userTruckId])

  async function handlePurchase(planCode: string, months: number) {
    setPending(true)
    try {
      await purchaseInsurance(userTruckId, planCode, months)
      alert('Insurance purchased successfully.')
      setOpen(false)
    } catch (err: any) {
      console.error('purchaseInsurance failed', err)
      alert('Purchase failed.')
    } finally {
      setPending(false)
    }
  }

  const defaultClass =
    'px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center gap-2'

  const btnClass =
    (className || defaultClass) +
    (disabled
      ? ' opacity-40 cursor-not-allowed hover:bg-white'
      : '')

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen(true)
        }}
        disabled={disabled}
        className={btnClass}
        style={{ ...(style || {}) }}
        aria-label="Open insurance modal"
        title={
          disabled
            ? 'New insurance available 60 days before expiry'
            : 'Open insurance modal'
        }
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

      <InsuranceModal
        truckId={userTruckId}
        open={open}
        onClose={() => setOpen(false)}
        onPurchase={handlePurchase}
      />
    </>
  )
}
