/**
 * OfferCard.tsx
 *
 * Small presentational card for a single sell offer shown in SellTruckModal.
 * - Displays label, note, deterministic price and settlement timeframe.
 * - Exposes Accept action via onAccept callback.
 */

import React from 'react'

/**
 * Offer
 *
 * Public shape describing an offer returned by sellService.
 */
export interface Offer {
  id: string
  label: string
  price: number
  settlementDays: [number, number]
  note?: string
}

/**
 * OfferCardProps
 *
 * Props for the OfferCard component.
 */
export interface OfferCardProps {
  offer: Offer
  disabled?: boolean
  onAccept: () => void
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
 * OfferCard
 *
 * Presentational card for a sell offer. Shows price, note and settlement window.
 *
 * @param props - OfferCardProps
 */
export default function OfferCard({ offer, disabled, onAccept }: OfferCardProps) {
  const [minDays, maxDays] = offer.settlementDays ?? [0, 0]
  const settlementText =
    minDays === maxDays ? `${minDays} day${minDays === 1 ? '' : 's'}` : `${minDays}-${maxDays} days`

  return (
    <div className="p-3 rounded-lg border shadow-sm bg-white flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">{offer.label}</div>
            {offer.note ? <div className="text-xs text-slate-500 mt-0.5">{offer.note}</div> : null}
          </div>

          <div className="text-right">
            <div className="text-lg font-bold text-slate-900">{formatCurrency(offer.price)}</div>
            <div className="text-xs text-slate-500">Estimated</div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-600">
          Settlement: <span className="font-medium text-slate-800">{settlementText}</span>
        </div>
      </div>

      <div className="flex-shrink-0">
        <button
          type="button"
          onClick={onAccept}
          disabled={disabled}
          className={`px-3 py-1 rounded-md text-sm font-medium text-white ${
            disabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
