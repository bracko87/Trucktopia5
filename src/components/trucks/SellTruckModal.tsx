/**
 * SellTruckModal.tsx
 *
 * Modal that presents sell offers for a truck based on its condition score.
 *
 * Responsibilities:
 * - Compute a set of offers derived from the truck condition.
 * - Render the offers and allow the user to accept one (placeholder action).
 * - Use ModalShell for consistent presentation.
 */

import React from 'react'
import ModalShell from '../common/ModalShell'

/**
 * Offer
 *
 * Simple shape describing a sell offer.
 */
interface Offer {
  id: string
  label: string
  price: number
  note?: string
}

/**
 * SellTruckModalProps
 *
 * Props for the SellTruckModal component.
 */
export interface SellTruckModalProps {
  truckId: string
  condition: number
  open: boolean
  onClose: () => void
}

/**
 * formatCurrency
 *
 * Format a number as a simple currency string.
 *
 * @param n - amount in USD
 * @returns formatted string
 */
function formatCurrency(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

/**
 * computeOffers
 *
 * Create three deterministic offers based on the truck condition.
 *
 * - higher condition produces better offers.
 * - we return an array of Offer objects.
 *
 * @param condition - 0..100
 * @returns Offer[]
 */
function computeOffers(condition: number): Offer[] {
  const base = 20000 // base value for a reference truck in good condition
  const condFactor = Math.max(0, Math.min(100, condition)) / 100
  // Dealer (fast, lower), Private sale (better), Auction/Marketplace (highest)
  const dealer = Math.round(base * (0.5 + 0.25 * condFactor)) // 50%..75%
  const privateSale = Math.round(base * (0.7 + 0.4 * condFactor)) // 70%..110%
  const marketplace = Math.round(base * (0.8 + 0.6 * condFactor)) // 80%..140%

  return [
    { id: 'dealer', label: 'Dealer buy (instant)', price: dealer, note: 'Fast sale, instant payout' },
    { id: 'private', label: 'Direct/private sale', price: privateSale, note: 'Best balance between speed and price' },
    { id: 'market', label: 'Marketplace / auction', price: marketplace, note: 'Highest potential price, may take time' },
  ]
}

/**
 * getConditionColor
 *
 * Return a Tailwind color class for the condition percentage.
 *
 * @param c - condition number
 * @returns string Tailwind text color class
 */
function getConditionColor(c: number) {
  if (c > 80) return 'text-emerald-600'
  if (c > 60) return 'text-green-600'
  if (c > 40) return 'text-amber-600'
  if (c > 20) return 'text-orange-600'
  return 'text-red-600'
}

/**
 * SellTruckModal
 *
 * Present a list of offers and allow the user to accept one.
 *
 * @param props - SellTruckModalProps
 */
export default function SellTruckModal({ truckId, condition, open, onClose }: SellTruckModalProps): JSX.Element | null {
  const offers = computeOffers(condition)

  return (
    <ModalShell open={open} onClose={onClose} title="Sell truck" size="md" footer={null}>
      <div className="space-y-3">
        <div className="text-sm text-slate-600">
          This truck (id: <span className="font-mono text-xs text-slate-700">{truckId || '—'}</span>) has a condition score of{' '}
          <span className={`font-semibold ${getConditionColor(condition)}`}>{condition}%</span>.
        </div>

        <div className="grid grid-cols-1 gap-3">
          {offers.map((o) => (
            <div key={o.id} className="p-3 border rounded-md bg-white shadow-sm flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">{o.label}</div>
                <div className="text-xs text-slate-500">{o.note}</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-lg font-semibold text-slate-900">{formatCurrency(o.price)}</div>
                  <div className="text-xs text-slate-500">Estimated</div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    // Placeholder action: in a real app this would trigger the sale flow (API call)
                    // eslint-disable-next-line no-console
                    console.log('Accepted offer', o, 'for truck', truckId)
                    onClose()
                  }}
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                >
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="px-3 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-sm">
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
