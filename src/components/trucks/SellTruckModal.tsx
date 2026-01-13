/**
 * SellTruckModal.tsx
 *
 * Modal that presents sell offers for a truck.
 *
 * Responsibilities:
 * - Fetch the user_trucks row for the truck being sold.
 * - Compute deterministic detailed offers using computeDetailedOffersFromUserTruck.
 * - Render offers using OfferCard and allow the user to accept one.
 */

import React, { useEffect, useState } from 'react'
import ModalShell from '../common/ModalShell'
import OfferCard from './OfferCard'
import {
  fetchUserTruck,
  computeDetailedOffersFromUserTruck,
  computeOffersFromUserTruck,
  acceptOffer,
  UserTruckRow,
  Offer,
} from '../../services/sellService'

/**
 * SellTruckModalProps
 *
 * Props for the SellTruckModal component.
 */
export interface SellTruckModalProps {
  truckId: string
  condition?: number
  open: boolean
  onClose: () => void
}

/**
 * SellTruckModal
 *
 * Present a list of offers computed from the user_trucks row and allow the user to accept one.
 *
 * Behavior:
 * - When opened, fetch the user_trucks row for truckId.
 * - Build 4-5 offers that are close in price; settlement windows vary (instant, 2-5 days, 7-14 days).
 * - Dealer offer can be below the 50% new-price floor but is instant.
 *
 * @param props - SellTruckModalProps
 */
export default function SellTruckModal({ truckId, condition = 100, open, onClose }: SellTruckModalProps) {
  const [truck, setTruck] = useState<UserTruckRow | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!open || !truckId) return
      setLoading(true)
      setError(null)
      try {
        const t = await fetchUserTruck(truckId)
        if (!mounted) return
        setTruck(t)
        if (t) {
          // prefer detailed generator when full row available
          setOffers(computeDetailedOffersFromUserTruck(t))
        } else {
          // fallback to simpler generator using provided condition only
          const fallback: UserTruckRow = {
            id: truckId,
            condition_score: Math.max(0, Math.min(100, condition)),
            purchase_price: undefined,
            purchase_date: undefined,
            mileage_km: undefined,
          }
          setOffers(computeOffersFromUserTruck(fallback))
        }
      } catch (err: any) {
        setError(err?.message ?? String(err))
        const fallback: UserTruckRow = {
          id: truckId,
          condition_score: Math.max(0, Math.min(100, condition)),
          purchase_price: undefined,
          purchase_date: undefined,
          mileage_km: undefined,
        }
        setOffers(computeOffersFromUserTruck(fallback))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [open, truckId, condition])

  /**
   * handleAccept
   *
   * Call acceptOffer and close modal on success.
   *
   * @param offer - offer being accepted
   */
  async function handleAccept(offer: Offer) {
    setAcceptingId(offer.id)
    setError(null)
    try {
      const res = await acceptOffer(truckId, offer)
      if (res.success) {
        onClose()
      } else {
        setError(res.message ?? 'Sale failed')
      }
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setAcceptingId(null)
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} title="Sell truck" size="md" footer={null}>
      <div className="space-y-3">
        {/* Top info line intentionally hidden per request */}

        {loading ? (
          <div className="text-sm text-slate-500">Loading offers…</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} disabled={!!acceptingId} onAccept={() => handleAccept(o)} />
            ))}
          </div>
        )}

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="px-3 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-sm">
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  )
}