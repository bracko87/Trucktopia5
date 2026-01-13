/**
 * InsuranceModal.tsx
 *
 * Modal to present insurance offers for a truck and allow the user to choose a plan.
 *
 * The visible "Truck: <id>" line and the visible header debug toggle have been removed
 * from the header to avoid exposing internal IDs and to keep the header compact.
 * Duration selection UI has been replaced with a static "12 Months" display.
 */

import React, { useState } from 'react'
import { Shield } from 'lucide-react'
import ModalShell from '../common/ModalShell'
import useInsuranceOffers, { InsuranceOffer } from '../../hooks/useInsuranceOffers'
import { purchaseInsurance } from '../../lib/insurance'

/**
 * Props for InsuranceModal
 */
export interface InsuranceModalProps {
  /** Truck id for context (user_trucks.id) */
  truckId: string
  /** Truck condition score (0-100) used as supplemental hint (optional) */
  condition?: number
  /** Open state */
  open: boolean
  /** Close handler */
  onClose: () => void
  /**
   * Optional purchase delegate. If provided it will be called as onPurchase(planCode, months)
   * and should perform the actual purchase. If omitted the modal will call purchaseInsurance helper.
   */
  onPurchase?: (planCode: string, months: number) => Promise<void> | void
}

/**
 * Default duration in months (now fixed)
 */
const DEFAULT_DURATION_MONTHS = 12

/**
 * InsuranceModal
 *
 * Displays computed offers and allows the user to pick purchase.
 * The duration selection buttons were removed and replaced with a static "12 Months" label.
 *
 * @param props - InsuranceModalProps
 * @returns JSX.Element or null when closed
 */
export default function InsuranceModal({
  truckId,
  condition = 100,
  open,
  onClose,
  onPurchase,
}: InsuranceModalProps): JSX.Element | null {
  const { loading, offers, error, refresh, debug } = useInsuranceOffers(truckId)
  const [duration] = useState<number>(DEFAULT_DURATION_MONTHS)
  const [pending, setPending] = useState<boolean>(false)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [showDebug] = useState<boolean>(false)

  /**
   * handleBuy
   *
   * Perform purchase for the selected plan code and duration. Uses delegate if provided,
   * otherwise calls purchaseInsurance helper. On success refreshes offers and closes modal.
   *
   * @param planCode - plan code (e.g. 'basic')
   * @param months - duration months
   */
  async function handleBuy(planCode: string, months: number) {
    setPending(true)
    try {
      if (onPurchase) {
        await onPurchase(planCode, months)
      } else {
        await purchaseInsurance(truckId, planCode, months)
      }
      // Minimal UX feedback
      // eslint-disable-next-line no-alert
      alert('Insurance purchased successfully.')
      refresh()
      onClose()
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Purchase failed', err)
      // eslint-disable-next-line no-alert
      alert('Purchase failed: ' + (err?.message ?? String(err)))
    } finally {
      setPending(false)
    }
  }

  /**
   * renderOfferCard
   *
   * Render single offer card for the UI.
   *
   * @param o - InsuranceOffer
   */
  function renderOfferCard(o: InsuranceOffer) {
    const active =
      selectedCode === o.code || (selectedCode === null && o.code === offers[0]?.code)
    const percent = Math.round(o.percent ?? 0)
    const price = Math.round(o.premiumAmount ?? 0)
    const coverage = o.coveragePercent ?? undefined

    return (
      <div
        key={o.code}
        role="button"
        onClick={() => setSelectedCode(o.code)}
        className={`p-3 rounded border ${active ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'} hover:shadow-sm cursor-pointer`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-800">{o.title}</div>
            <div className="text-xs text-slate-500">{o.code.toUpperCase()}</div>
          </div>

          <div className="text-right">
            <div className="text-lg font-semibold text-slate-800">${price}</div>
            <div className="text-xs text-slate-500">{percent}%</div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-600">
          <ul className="list-disc pl-4 space-y-1">
            <li>Coverage: {coverage != null ? `${coverage}%` : 'Varies'}</li>
            <li>Computed from list price: {o.listPrice != null ? `$${o.listPrice}` : '—'}</li>
            <li>Age: {o.ageYears != null ? `${o.ageYears} yr` : '—'}</li>
          </ul>
        </div>
      </div>
    )
  }

  const selectedOffer: InsuranceOffer | undefined = offers.find(
    (a) => a.code === (selectedCode ?? offers[0]?.code)
  )

  const footer = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div>
          <div className="text-xs text-slate-500">Duration</div>
          <div className="text-sm font-medium text-slate-800">12 Months</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Selected</div>
          <div className="text-sm font-medium text-slate-800">{selectedOffer ? `${selectedOffer.title}` : '—'}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1 rounded border bg-white hover:bg-slate-100 text-sm border-slate-200" disabled={pending}>
          Cancel
        </button>

        <button
          type="button"
          onClick={() => selectedOffer && handleBuy(selectedOffer.code, duration)}
          className={`px-4 py-1 rounded bg-sky-600 hover:bg-sky-700 text-white text-sm ${pending ? 'opacity-70 pointer-events-none' : ''}`}
          disabled={pending || !selectedOffer}
        >
          {pending ? 'Processing…' : 'Purchase'}
        </button>
      </div>
    </div>
  )

  return (
    <ModalShell open={open} onClose={onClose} title="Insurance offers" size="lg" footer={footer}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-sky-500" />
          <div>
            <div className="font-medium text-slate-800">Choose an insurance offer for this truck</div>
            {/* Inline "Truck: <id>" intentionally removed to avoid exposing IDs in the UI */}
            <div className="text-xs text-slate-500">Condition score: <span className="font-medium text-slate-800">{condition}</span></div>
          </div>

          {/* Header debug toggle removed from visible UI to avoid exposing debug controls */}
        </div>

        <div>
          {loading ? (
            <div className="text-sm text-slate-500">Loading offers…</div>
          ) : error ? (
            <div className="text-sm text-rose-600">Error loading offers: {String(error)}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {offers.map((o) => renderOfferCard(o))}
            </div>
          )}
        </div>

        {showDebug && (
          <div className="bg-slate-50 border border-slate-200 p-3 rounded text-xs space-y-3">
            <div className="font-medium text-slate-700">Debug</div>

            <div>
              <div className="text-xs text-slate-500">Loading:</div>
              <div className="text-sm text-slate-800">{String(loading)}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Error:</div>
              <div className={`text-sm ${error ? 'text-rose-600' : 'text-slate-700'}`}>{error ? String(error) : 'None'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">Offers (raw):</div>
              <pre className="text-xs bg-white p-2 rounded border border-slate-100 overflow-auto max-h-40">{JSON.stringify(offers, null, 2)}</pre>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">Hook debug info:</div>
              <pre className="text-xs bg-white p-2 rounded border border-slate-100 overflow-auto max-h-48">{JSON.stringify(debug || {}, null, 2)}</pre>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">Readable compute results:</div>
              <div className="space-y-1">
                {(debug?.computeResults || []).map((r, idx) => (
                  <div key={idx} className="p-2 rounded bg-white border border-slate-100">
                    {'ok' in r && r.ok ? (
                      <div>
                        <div className="text-xs text-slate-600">Code: <span className="font-medium text-slate-800">{r.code}</span></div>
                        <div className="text-xs text-slate-600">Title: <span className="font-medium text-slate-800">{r.offer.title}</span></div>
                        <div className="text-xs text-slate-600">Percent: <span className="font-medium text-slate-800">{r.offer.percent}%</span></div>
                        <div className="text-xs text-slate-600">Premium: <span className="font-medium text-slate-800">${r.offer.premiumAmount}</span></div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs text-rose-600">Code: <span className="font-medium">{r.code}</span> — Error: {r.err}</div>
                      </div>
                    )}
                  </div>
                ))}
                {(!debug || (debug.computeResults || []).length === 0) && <div className="text-xs text-slate-500">No compute results available.</div>}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Next steps</div>
              <div className="text-xs text-slate-700">If compute results show plan errors or missing plan metadata, the backend tables <code>insurance_plans</code> and <code>insurance_plan_rates</code> likely lack entries for the requested codes (basic/standard/premium) or RLS prevents access. Paste the debug JSON here and I will propose targeted fixes.</div>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  )
}
