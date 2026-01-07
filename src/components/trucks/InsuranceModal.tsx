/**
 * InsuranceModal.tsx
 *
 * Modal to present insurance options for a truck and allow the user to choose a plan.
 *
 * Uses the shared ModalShell for consistent popup appearance and behaviour.
 */

import React, { useMemo, useState } from 'react'
import { Shield } from 'lucide-react'
import ModalShell from '../common/ModalShell'

/**
 * Props for InsuranceModal
 */
export interface InsuranceModalProps {
  /** Truck id for context (not persisted in this placeholder) */
  truckId: string
  /** Truck condition score (0-100) used to derive prices */
  condition?: number
  /** Open state */
  open: boolean
  /** Close handler */
  onClose: () => void
}

/**
 * InsurancePlan
 *
 * Internal representation of a selectable insurance plan.
 */
interface InsurancePlan {
  /** Plan identifier */
  id: 'basic' | 'standard' | 'premium'
  /** Display title */
  title: string
  /** Short description */
  description: string
  /** Price multiplier applied to base price */
  multiplier: number
}

/**
 * computeBasePrice
 *
 * Derive a base price using truck condition: better condition -> lower price.
 *
 * @param cond - condition 0..100
 * @returns base price in USD
 */
function computeBasePrice(cond: number) {
  const normalized = Math.max(0, Math.min(100, cond))
  // Base price between 300 (excellent) and 900 (poor)
  return Math.round(300 + (100 - normalized) * 6)
}

/**
 * InsuranceModal
 *
 * Present insurance tiers, compute estimated price using truck condition,
 * allow selecting a plan and performing a placeholder purchase action.
 *
 * Uses ModalShell to ensure consistent look & behaviour with other modals.
 *
 * @param props - InsuranceModalProps
 * @returns JSX element or null when closed
 */
export default function InsuranceModal({ truckId, condition = 100, open, onClose }: InsuranceModalProps): JSX.Element | null {
  const plans: InsurancePlan[] = [
    { id: 'basic', title: 'Basic', description: 'Mandatory minimal coverage', multiplier: 0.5 },
    { id: 'standard', title: 'Standard', description: 'Balanced coverage with reasonable deductible', multiplier: 1 },
    { id: 'premium', title: 'Premium', description: 'Comprehensive coverage, lowest deductible', multiplier: 1.8 },
  ]

  const [selected, setSelected] = useState<InsurancePlan['id']>('standard')

  const basePrice = useMemo(() => computeBasePrice(condition), [condition])
  const selectedPlan = plans.find((p) => p.id === selected) ?? plans[1]
  const estimatedPrice = Math.round(basePrice * selectedPlan.multiplier)

  const footer = (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs text-slate-500">Estimated price</div>
        <div className="text-lg font-semibold text-slate-800">${estimatedPrice}</div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1 rounded border bg-white hover:bg-slate-100 text-sm border-slate-200">
          Cancel
        </button>

        <button
          type="button"
          onClick={() => {
            // Placeholder purchase action - replace with real API integration later
            // eslint-disable-next-line no-console
            console.log('Purchase insurance', { truckId, plan: selected, price: estimatedPrice })
            // Minimal UX feedback
            alert(`Purchased ${selectedPlan.title} plan for $${estimatedPrice} (placeholder)`)
            onClose()
          }}
          className="px-4 py-1 rounded bg-sky-600 hover:bg-sky-700 text-white text-sm"
        >
          Purchase
        </button>
      </div>
    </div>
  )

  return <ModalShell open={open} onClose={onClose} title="Insurance" size="md" footer={footer}>
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5 text-sky-500" />
        <div>
          <div className="font-medium text-slate-800">Choose a plan for this truck</div>
          <div className="text-xs text-slate-500">Truck: <span className="font-medium text-slate-800">{truckId || '—'}</span></div>
          <div className="text-xs text-slate-500">Condition score: <span className="font-medium text-slate-800">{condition}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {plans.map((plan) => {
          const price = Math.round(basePrice * plan.multiplier)
          const active = plan.id === selected
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelected(plan.id)}
              className={`text-left p-3 rounded border ${active ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'} hover:shadow-sm`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-800">{plan.title}</div>
                  <div className="text-xs text-slate-500">{plan.description}</div>
                </div>
                <div className="text-sm font-mono text-slate-800">${price}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  </ModalShell>
}