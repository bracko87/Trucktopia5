/**
 * TruckDetails.tsx
 *
 * Presentational & data logic component to fetch and update a single truck's details.
 *
 * - Fetches the truck row + nested truck_models using fetchTruckDetails
 * - Loads hub options for the truck's company and allows assigning a hub
 * - Saves changes via updateTruck
 */

import React, { useEffect, useState } from 'react'
import type { TruckDetailsRow, HubRow } from '../../lib/trucksApi'
import { fetchTruckDetails, fetchHubsForCompany, updateTruck } from '../../lib/trucksApi'

/**
 * TruckDetailsProps
 *
 * @property truckId - id of the user_truck to display
 */
export interface TruckDetailsProps {
  truckId: string
}

/**
 * TruckDetails
 *
 * Small UI card that displays truck metadata and allows assigning a hub.
 *
 * @param props - TruckDetailsProps
 * @returns JSX.Element
 */
export default function TruckDetails({ truckId }: TruckDetailsProps) {
  const [truck, setTruck] = useState<TruckDetailsRow | null>(null)
  const [hubs, setHubs] = useState<HubRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const t = await fetchTruckDetails(truckId)
        if (!mounted) return
        setTruck(t)
        // load hubs for company if available
        const companyId = t?.owner_company_id ?? undefined
        const hubRows = await fetchHubsForCompany(companyId)
        if (!mounted) return
        setHubs(hubRows)
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message ?? 'Failed to load truck')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    if (truckId) load()
    return () => {
      mounted = false
    }
  }, [truckId])

  /**
   * handleHubChange
   *
   * Save hub assignment for the truck. If the truck schema includes a hub_id column we patch it;
   * otherwise we attempt to set location_city_id to the hub.city_id when available.
   *
   * @param hubId - selected hub id
   */
  async function handleHubChange(hubId: string | '') {
    if (!truck) return
    setSaving(true)
    setError(null)
    try {
      const selected = hubs.find((h) => h.id === hubId) ?? null
      const patch: Record<string, any> = {}
      if ('hub_id' in truck) {
        patch.hub_id = hubId || null
      } else if (selected && selected.city_id) {
        patch.location_city_id = selected.city_id
      } else {
        // fallback: no hub_id field and no city_id to patch
        // attempt to set a generic hub_id if backend will accept it
        patch.hub_id = hubId || null
      }

      const res = await updateTruck(truck.id, patch)
      if (res && (res.status === 200 || res.status === 201)) {
        // update local state using returned representation when available
        const updated = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null
        setTruck((prev) => ({ ...(prev ?? {}), ...(updated ?? patch) }))
        // minimal success indicator
        // eslint-disable-next-line no-console
        console.debug('Truck updated', res)
      } else {
        const msg = (res && (res.error || JSON.stringify(res.data || res))) || 'Update failed'
        setError(String(msg))
      }
    } catch (err: any) {
      setError(err?.message ?? 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (!truck) return <div className="p-4 text-sm text-slate-500">Truck not found</div>

  const model = truck.truck_models
  const modelName = model ? [model.make, model.model].filter(Boolean).join(' ') : truck.master_truck_id
  const producer = model?.make ?? '—'

  return (
    <div className="p-4 bg-white border rounded shadow-sm max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-slate-500">Truck model</div>
          <div className="text-sm font-medium text-slate-800 truncate min-w-0">{modelName}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Producer</div>
          <div className="text-sm font-medium text-slate-800">{producer}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Country</div>
          <div className="text-sm font-medium text-slate-800">{model?.country ?? '—'}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Class</div>
          <div className="text-sm font-medium text-slate-800">{model?.class ?? '—'}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Year</div>
          <div className="text-sm font-medium text-slate-800">{model?.year ?? '—'}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Max payload</div>
          <div className="text-sm font-medium text-slate-800">{model?.max_payload ?? '—'}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Tonnage</div>
          <div className="text-sm font-medium text-slate-800">{model?.tonnage ?? '—'}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Load type</div>
          <div className="text-sm font-medium text-slate-800">—</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Purchase date</div>
          <div className="text-sm font-medium text-slate-800">{truck.purchase_date ? new Date(truck.purchase_date).toLocaleString() : '—'}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Mileage</div>
          <div className="text-sm font-medium text-slate-800">{truck.mileage_km ?? '—'}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Fuel level</div>
          <div className="text-sm font-medium text-slate-800">{truck.fuel_level_l ?? '—'}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Last maintenance</div>
          <div className="text-sm font-medium text-slate-800">{truck.last_maintenance_at ? new Date(truck.last_maintenance_at).toLocaleString() : '—'}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Next maintenance (km)</div>
          <div className="text-sm font-medium text-slate-800">{truck.next_maintenance_km ?? '—'}</div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Hub</div>
          <select
            aria-label="Select hub"
            className="text-sm px-2 py-1 border border-slate-200 rounded bg-white w-full"
            value={truck.hub_id ?? ''}
            onChange={(e) => handleHubChange(e.target.value)}
            disabled={saving}
          >
            <option value="">— Unassigned —</option>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.city ? `${h.city} ${h.is_main ? '— main' : ''}` : h.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      {saving ? <div className="mt-3 text-sm text-slate-500">Saving...</div> : null}
    </div>
  )
}