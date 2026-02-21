/**
 * ConfirmAcceptModal.tsx
 *
 * Confirmation modal shown when the user accepts a job.
 *
 * - Displays the most important job information (pickup, delivery, transport mode,
 *   distance, reward) above the Truck ID input.
 * - Keeps the existing visual layout and classes used by AcceptModal to avoid any
 *   design changes.
 */

import React, { useEffect, useState } from 'react'
import type { JobRow } from './JobCard'

/**
 * Props for ConfirmAcceptModal
 */
export interface ConfirmAcceptModalProps {
  open: boolean
  job: JobRow | null
  onClose: () => void
  onConfirm: (truckId: string) => void
}

/**
 * formatNumber
 *
 * Small helper to format numeric values (distance, reward) in a compact way.
 *
 * @param n number | null
 * @returns string
 */
function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 1000) return `${Math.round(n).toLocaleString()}`
  return n.toString()
}

/**
 * haversineDistanceKm
 *
 * Compute approximate great-circle distance between two lat/lon points.
 *
 * @param a [lat, lon]
 * @param b [lat, lon]
 * @returns distance in kilometers
 */
function haversineDistanceKm(a: [number, number], b: [number, number]) {
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371 // km
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])

  const v =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v))
  return R * c
}

/**
 * ConfirmAcceptModal
 *
 * Shows a modal with job summary (pickup, delivery, transport mode, distance, reward)
 * and the existing Truck ID input + Cancel/Confirm actions. The visual layout and classes
 * are kept identical to the current modal so no design changes occur.
 *
 * @param props ConfirmAcceptModalProps
 */
export default function ConfirmAcceptModal({ open, job, onClose, onConfirm }: ConfirmAcceptModalProps) {
  const [truckId, setTruckId] = useState('')
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [loadingDistance, setLoadingDistance] = useState(false)

  useEffect(() => {
    setTruckId('')
    setDistanceKm(null)
    setLoadingDistance(false)

    // Best-effort distance lookup: try to fetch city coordinates by name from /rest/v1/cities
    // If coordinates are available for both cities compute haversine distance.
    async function computeDistance() {
      if (!open || !job) return
      const origin = (job.origin_city_name ?? '').trim()
      const dest = (job.destination_city_name ?? '').trim()
      if (!origin || !dest || origin === dest) {
        setDistanceKm(null)
        return
      }

      setLoadingDistance(true)

      async function fetchCoords(cityName: string): Promise<[number, number] | null> {
        try {
          // PostgREST query: look for latitude/longitude columns (best-effort - may not exist)
          const q = `/rest/v1/cities?city_name=eq.${encodeURIComponent(cityName)}&select=latitude,longitude&limit=1`
          const res = await fetch(q)
          if (!res.ok) return null
          const json = (await res.json()) as any[]
          if (!json || json.length === 0) return null
          const row = json[0] as any
          if (row.latitude == null || row.longitude == null) return null
          const lat = Number(row.latitude)
          const lon = Number(row.longitude)
          if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon]
        } catch {
          // ignore errors, distance stays null
        }
        return null
      }

      const [a, b] = await Promise.all([fetchCoords(origin), fetchCoords(dest)])
      if (a && b) {
        try {
          const d = haversineDistanceKm(a, b)
          setDistanceKm(d)
        } catch {
          setDistanceKm(null)
        }
      } else {
        setDistanceKm(null)
      }
      setLoadingDistance(false)
    }

    computeDistance()
  }, [open, job])

  if (!open || !job) return null

  // Choose reward based on transport mode (best-effort)
  const mode = job.transport_mode ?? '—'
  const reward =
    job.transport_mode === 'trailer_cargo'
      ? job.reward_trailer_cargo ?? job.reward_load_cargo
      : job.reward_load_cargo ?? job.reward_trailer_cargo

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg p-5 w-full max-w-md shadow-lg">
        <h3 className="text-lg font-semibold mb-2">Accept job</h3>
        <p className="text-sm text-slate-600 mb-4">Provide the truck id that will take this job.</p>

        {/* --- Important job information (kept compact and visually inline with modal) --- */}
        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-2">Job summary</div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col">
              <div className="text-xs text-slate-500">Pickup</div>
              <div className="text-black/80">{job.pickup_time ?? '—'}</div>
            </div>

            <div className="flex flex-col">
              <div className="text-xs text-slate-500">Delivery</div>
              <div className="text-black/80">{job.delivery_deadline ?? '—'}</div>
            </div>

            <div className="flex flex-col">
              <div className="text-xs text-slate-500">Mode</div>
              <div className="text-black/80">{mode}</div>
            </div>

            <div className="flex flex-col">
              <div className="text-xs text-slate-500">Reward</div>
              <div className="text-black/80">{reward != null ? `${formatNumber(Number(reward))} USD` : '—'}</div>
            </div>

            <div className="flex flex-col col-span-2">
              <div className="text-xs text-slate-500">Distance</div>
              <div className="text-black/80">
                {loadingDistance ? 'Calculating…' : distanceKm != null ? `${formatNumber(distanceKm)} km` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* --- Truck ID input (preserves original layout) --- */}
        <label className="block text-sm mb-3">
          <div className="text-xs text-slate-500 mb-1">Truck ID</div>
          <input
            value={truckId}
            onChange={(e) => setTruckId(e.target.value)}
            placeholder="Enter truck id (or leave blank)"
            className="w-full px-3 py-2 border rounded"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border text-sm">
            Cancel
          </button>
          <button
            disabled={false}
            onClick={() => {
              onConfirm(truckId)
              setTruckId('')
            }}
            className="px-3 py-1 rounded bg-sky-600 text-white text-sm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}