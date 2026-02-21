/**
 * MarketTruckCard.tsx
 *
 * Read-only presentation card for truck models (used on New Trucks Market).
 * Fetches truck_models row (via REST helper) and renders a compact, non-editable card.
 *
 * Note: Location display removed from the header area per user request while keeping
 * layout and design intact (menu button remains at the right).
 */

import React, { useEffect, useState } from 'react'
import { Gauge, Menu } from 'lucide-react'
import { supabaseFetch } from '../../lib/supabase'

interface MarketItem {
  id?: string
  master_truck_id?: string | null
  name?: string | null
  make?: string | null
  model?: string | null
  country?: string | null
  year?: number | null
  mileage_km?: number | null
  condition_score?: number | null
  image_url?: string | null
  secondary_image?: string | null
  location_city_name?: string | null
  status?: string | null
  thumbnail?: string | null
  [k: string]: any
}

interface TruckModelRow {
  id: string
  make?: string | null
  model?: string | null
  country?: string | null
  year?: number | null
  image_url?: string | null
  [k: string]: any
}

interface MarketTruckCardProps {
  marketItem: MarketItem
  modelId?: string | null
}

export default function MarketTruckCard({
  marketItem,
  modelId,
}: MarketTruckCardProps) {
  const [model, setModel] = useState<TruckModelRow | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let mounted = true

    async function loadModel() {
      setLoading(true)
      try {
        const id =
          modelId ??
          marketItem?.master_truck_id ??
          marketItem?.id ??
          null

        if (!id) {
          if (mounted) {
            setModel(null)
            setLoading(false)
          }
          return
        }

        const res = await supabaseFetch(
          `/rest/v1/truck_models?id=eq.${encodeURIComponent(
            String(id)
          )}&select=*&limit=1`
        )

        if (!mounted) return

        if (res && Array.isArray(res.data) && res.data.length > 0) {
          setModel(res.data[0] as TruckModelRow)
        } else {
          setModel(null)
        }
      } catch (err) {
        console.debug('MarketTruckCard: failed to load model', err)
        if (mounted) setModel(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadModel()
    return () => {
      mounted = false
    }
  }, [marketItem, modelId])

  const makePart = model?.make ?? marketItem?.make ?? ''
  const modelPart = model?.model ?? marketItem?.model ?? ''

  let displayName = `${makePart} ${modelPart}`.trim()
  if (displayName === '') {
    displayName = marketItem?.name ?? 'Model'
  }

  const condition =
    marketItem?.condition_score ??
    marketItem?.condition ??
    0

  const status = (marketItem?.status ?? 'available').toString()

  const image =
    model?.image_url ??
    marketItem?.image_url ??
    marketItem?.thumbnail ??
    undefined

  return (
    <div
      className="modern-card relative w-full rounded-lg bg-white overflow-visible border border-gray-200"
      role="article"
    >
      {/* Header row */}
      <div className="flex items-center gap-4 p-3 w-full">
        {/* left accent bar */}
        <div className="h-12 w-1 rounded-full bg-gradient-to-b from-sky-400 to-emerald-400" />

        {/* Model block expands */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="min-w-0 w-full">
            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-xs text-slate-500">
                  Truck Model:
                </div>
                <div className="text-sm font-medium truncate">
                  {loading ? 'Loading…' : displayName}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          {image && (
            <img
              src={image}
              alt="Model"
              className="w-10 h-10 rounded-sm border border-slate-100 bg-white object-cover"
            />
          )}

          {marketItem?.secondary_image && (
            <img
              src={marketItem.secondary_image}
              alt="Secondary"
              className="w-10 h-10 rounded-sm border border-slate-100 bg-white object-cover"
            />
          )}
        </div>

        {/* Condition + status */}
        <div className="flex items-center gap-4 ml-6 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-[88px]">
            <div className="p-1 rounded bg-gray-50 flex items-center justify-center">
              <Gauge className="w-4 h-4 text-slate-400" />
            </div>

            <div className="min-w-0">
              <div className="text-xs text-slate-500">
                Condition
              </div>
              <div className="text-sm font-medium text-slate-800 truncate">
                {condition}
              </div>
            </div>
          </div>

          <div className="w-20 flex items-center justify-center flex-shrink-0">
            <div className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-emerald-100 ring-1 text-center">
              <span className="capitalize">
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Menu button aligned right */}
        <div className="ml-auto flex items-center gap-4">
          <div className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
              aria-label="Open truck details"
              className="p-2 rounded-md hover:bg-gray-100 text-slate-600"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
