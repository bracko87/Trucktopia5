/**
 * PurchaseConfirmModal.tsx
 *
 * Confirms truck purchase, calls purchase_market_truck RPC, and creates an in-transit truck
 * that becomes available after availability_days.
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { supabase, purchaseMarketTruckRpc } from '../../lib/supabase'
import { formatUSD } from '../../lib/finance'

/**
 * PurchaseConfirmModalProps
 *
 * Props for the PurchaseConfirmModal component.
 */
interface PurchaseConfirmModalProps {
  open: boolean
  onClose: () => void
  assetModelId?: string | null
  companyId?: string | null
  listPriceOverride?: number | null
  availableDaysOverride?: number | null
  displayNameOverride?: string | null
  onSuccess?: (truckId: string | null) => void
}

/**
 * PurchaseConfirmModal
 *
 * Modal UI that confirms a market truck purchase and calls purchase_market_truck RPC.
 *
 * @param props PurchaseConfirmModalProps
 * @returns JSX.Element | null
 */
export default function PurchaseConfirmModal({
  open,
  onClose,
  assetModelId,
  companyId = null,
  listPriceOverride = null,
  availableDaysOverride = null,
  displayNameOverride = null,
  onSuccess,
}: PurchaseConfirmModalProps): JSX.Element | null {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [modelName, setModelName] = React.useState<string | null>(displayNameOverride ?? null)
  const [listPrice, setListPrice] = React.useState<number | null>(listPriceOverride ?? null)
  const [availableDays, setAvailableDays] = React.useState<number>(Math.max(0, Number(availableDaysOverride ?? 0)))
  const [resolvedModelId, setResolvedModelId] = React.useState<string | null>(assetModelId ?? null)

  /**
   * Effect: load truck model details when modal opens (if needed)
   */
  React.useEffect(() => {
    if (!open) return

    let mounted = true
    setError(null)
    setLoading(true)
    setResolvedModelId(assetModelId ?? null)
    setModelName(displayNameOverride ?? null)
    setListPrice(listPriceOverride ?? null)
    setAvailableDays(Math.max(0, Number(availableDaysOverride ?? 0)))

    async function loadModel() {
      try {
        const modelId = assetModelId ?? null
        if (!modelId) {
          if (mounted) {
            setError('No truck model id available.')
            setLoading(false)
          }
          return
        }

        // If caller provided all values, skip fetch
        if (
          displayNameOverride &&
          listPriceOverride !== null &&
          listPriceOverride !== undefined &&
          availableDaysOverride !== null &&
          availableDaysOverride !== undefined
        ) {
          if (mounted) setLoading(false)
          return
        }

        const { data, error: fetchErr } = await supabase
          .from('truck_models')
          .select('id, make, model, list_price, availability_days')
          .eq('id', modelId)
          .maybeSingle()

        if (!mounted) return

        if (fetchErr) {
          setError(fetchErr.message || 'Failed to load model')
          setLoading(false)
          return
        }

        if (!data) {
          setError('Truck model not found')
          setLoading(false)
          return
        }

        const displayName = [data.make, data.model].filter(Boolean).join(' ')
        setModelName(displayName || displayNameOverride || 'Truck')
        setListPrice(
          listPriceOverride !== null && listPriceOverride !== undefined
            ? Number(listPriceOverride)
            : Number((data as any).list_price ?? 0)
        )
        setAvailableDays(
          Math.max(
            0,
            Number(
              availableDaysOverride !== null && availableDaysOverride !== undefined
                ? availableDaysOverride
                : (data as any).availability_days ?? 0
            )
          )
        )
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Unknown load error')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadModel()

    return () => {
      mounted = false
    }
  }, [open, assetModelId, displayNameOverride, listPriceOverride, availableDaysOverride])

  if (!open) return null

  const eta = (() => {
    const d = new Date()
    d.setDate(d.getDate() + Math.max(0, availableDays))
    return d
  })()

  /**
   * handleConfirm
   *
   * Performs authentication checks and calls the purchaseMarketTruckRpc RPC.
   */
  async function handleConfirm() {
    setLoading(true)
    setError(null)

    try {
      if (!resolvedModelId) {
        setError('Model missing')
        setLoading(false)
        return
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      const { data: localUser, error: localUserErr } = await supabase
        .from('users')
        .select('id, company_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (localUserErr) {
        setError(localUserErr.message)
        setLoading(false)
        return
      }

      const ownerUserId = (localUser as any)?.id ?? null
      const ownerCompanyId = companyId ?? ((localUser as any)?.company_id ?? null)

      if (!ownerCompanyId) {
        setError('No company found for current user')
        setLoading(false)
        return
      }

      const price = Number(listPrice ?? 0)
      if (!price || price <= 0) {
        setError('Invalid purchase price')
        setLoading(false)
        return
      }

      const data = await purchaseMarketTruckRpc({
        masterTruckId: resolvedModelId,
        ownerCompanyId,
        ownerUserId,
        ownerUserAuthId: user.id,
        purchasePrice: price,
        availableDays,
        name: modelName,
      })

      const newTruckId =
        Array.isArray(data) ? (data[0] as any)?.id ?? null : (data as any)?.id ?? null

      if (onSuccess) onSuccess(newTruckId)
      onClose()
    } catch (e: any) {
      setError(e?.message ?? 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!loading) onClose()
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-5xl mx-4 bg-white rounded-lg shadow-2xl overflow-auto">
        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/3 px-8 py-10 bg-gradient-to-b from-sky-50 to-white rounded-l-lg">
            <h3 className="text-xl font-semibold mb-3">Confirm purchase</h3>
            <p className="text-sm text-slate-600 mb-6">
              You are about to purchase this truck. Review the price and delivery time before confirming.
            </p>

            <div className="text-xs text-slate-500">Truck</div>
            <div className="text-lg font-medium mb-4">
              {loading ? 'Loading…' : modelName ?? (resolvedModelId ?? assetModelId) ?? 'Unknown model'}
            </div>

            <div className="text-xs text-slate-500">Purchase price</div>
            <div className="text-2xl font-semibold mb-4">
              {loading ? '—' : listPrice !== null ? formatUSD(Number(listPrice)) : '—'}
            </div>

            <div className="text-xs text-slate-500">Delivery time</div>
            <div className="text-sm font-medium mb-2">{loading ? '—' : `${availableDays} day(s)`}</div>

            <div className="text-xs text-slate-500">Expected delivery</div>
            <div className="text-sm font-medium">{loading ? '—' : eta.toLocaleString()}</div>
          </div>

          <div className="md:w-2/3 px-8 py-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="text-lg font-medium">Purchase summary</h4>
                <p className="text-sm text-slate-500">
                  The truck will be added to your fleet immediately. If delivery time is greater than 0 days, it will stay unavailable until delivered.
                </p>
              </div>
              <button
                onClick={() => {
                  if (!loading) onClose()
                }}
                className="text-slate-500 hover:text-slate-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded border border-slate-200 p-4">
                <div className="text-xs text-slate-500">Amount to pay now</div>
                <div className="text-lg font-semibold">{listPrice !== null ? formatUSD(Number(listPrice)) : '—'}</div>
              </div>

              <div className="rounded border border-slate-200 p-4">
                <div className="text-xs text-slate-500">Truck status after purchase</div>
                <div className="text-lg font-semibold">{availableDays > 0 ? 'In transit' : 'Available'}</div>
              </div>
            </div>

            {availableDays > 0 && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                This truck will appear in your Trucks page immediately, but it will be grayed out and cannot be used until delivery is complete.
              </div>
            )}

            {error && <div className="text-xs text-rose-600 mb-4">{error}</div>}

            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => onClose()}
                disabled={loading}
                className="px-4 py-2 rounded-md text-sm bg-white border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading || !resolvedModelId || listPrice === null}
                className="px-4 py-2 rounded-md text-sm bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing…' : 'Confirm purchase'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Render into document body when available
  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
