/**
 * TrucksList.tsx
 *
 * Render a vertical, full-width list of truck rows so each TruckCard
 * visually spans the full horizontal space of the surrounding content area.
 * This list is used both for the user's owned trucks and for market listings.
 *
 * When the server includes the related truck_models via select=*,truck_models(*)
 * we reuse the embedded model data to avoid an extra batch request. If some
 * master_truck_ids are missing embedded models we fall back to a batch fetch.
 */

import React, { useEffect, useState } from 'react'
import TruckCard from './TruckCard'
import MarketTruckCard from './MarketTruckCard'
import { getTruckModelsBatch } from '../../lib/db/modules/truckModels'

interface TrucksListProps {
  trucks: any[]
}

interface ModelLookup {
  [id: string]:
    | {
        make?: string | null
        model?: string | null
        country?: string | null
        class?: string | null
        max_payload?: number | null
        tonnage?: number | null
        year?: number | null
        cargo_type_id?: string | null
        cargo_type_name?: string | null
        max_load_kg?: number | null
        fuel_tank_capacity_l?: number | null
        fuel_type?: string | null
        image_url?: string | null
      }
    | undefined
}

export default function TrucksList({ trucks }: TrucksListProps) {
  const [modelLookup, setModelLookup] = useState<ModelLookup>({})

  useEffect(() => {
    let mounted = true

    const embeddedLookup: ModelLookup = {}
    const missingModelIds = new Set<string>()
    const allModelIds = new Set<string>()

    trucks.forEach((t) => {
      const rawModelId = (t.master_truck_id as unknown as string) ?? ''
      allModelIds.add(rawModelId)

      const embedded =
        Array.isArray(t.truck_models) && t.truck_models.length > 0
          ? t.truck_models[0]
          : null

      if (embedded && rawModelId) {
        embeddedLookup[rawModelId] = {
          make: embedded.make ?? null,
          model: embedded.model ?? null,
          country: embedded.country ?? null,
          class: embedded.class ?? null,
          max_payload:
            typeof embedded.max_payload === 'number'
              ? embedded.max_payload
              : embedded.max_payload
              ? Number(embedded.max_payload)
              : null,
          tonnage:
            typeof embedded.tonnage === 'number'
              ? embedded.tonnage
              : embedded.tonnage
              ? Number(embedded.tonnage)
              : null,
          year:
            typeof embedded.year === 'number'
              ? embedded.year
              : embedded.year
              ? Number(embedded.year)
              : null,
          cargo_type_id: embedded.cargo_type_id ?? null,
          cargo_type_name: embedded.cargo_type_name ?? null,
          max_load_kg:
            typeof embedded.max_load_kg === 'number'
              ? embedded.max_load_kg
              : embedded.max_load_kg
              ? Number(embedded.max_load_kg)
              : null,
          fuel_tank_capacity_l:
            typeof embedded.fuel_tank_capacity_l === 'number'
              ? embedded.fuel_tank_capacity_l
              : embedded.fuel_tank_capacity_l
              ? Number(embedded.fuel_tank_capacity_l)
              : null,
          fuel_type: embedded.fuel_type ?? null,
          image_url: embedded.image_url ?? null,
        }
      } else if (rawModelId) {
        missingModelIds.add(rawModelId)
      }
    })

    const idsToFetch =
      missingModelIds.size === 0
        ? Array.from(allModelIds).filter(Boolean)
        : Array.from(missingModelIds)

    if (idsToFetch.length === 0) {
      if (mounted) setModelLookup(embeddedLookup)
      return
    }

    setModelLookup(embeddedLookup)

    getTruckModelsBatch(idsToFetch)
      .then((map) => {
        if (!mounted) return
        setModelLookup((prev) => ({ ...prev, ...map }))
      })
      .catch((err) => {
        console.debug('TrucksList: getTruckModelsBatch error', err)
      })

    return () => {
      mounted = false
    }
  }, [trucks])

  if (!trucks || trucks.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        No trucks found for your account.
      </div>
    )
  }

  return (
    // FIX: removed -mx-6 px-6 so cards can use full width
    <div className="flex flex-col gap-4 w-full">
      {trucks.map((t) => {
        const rawModelId =
          (t.master_truck_id as unknown as string) ?? ''
        const modelInfo = rawModelId
          ? modelLookup[rawModelId]
          : undefined

        const isMarket = String(t.id ?? '').startsWith('model-')

        return (
          <div key={t.id ?? JSON.stringify(t)} className="w-full">
            {isMarket ? (
              <MarketTruckCard
                marketItem={t}
                modelId={rawModelId}
              />
            ) : (
              <TruckCard
                truck={t}
                modelInfo={modelInfo}
                isMarket={isMarket}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
