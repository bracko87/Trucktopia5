/**
 * JobCard.tsx
 *
 * Reusable card / row component to display a single job offer in Market.
 *
 * Shows origin/destination, rewards, distance, pickup/delivery times and actions.
 */

import React from 'react'
import { MapPin, Truck, Clock } from 'lucide-react'

/**
 * JobRow
 *
 * Minimal job shape used by the Market page.
 */
export interface JobRow {
  id: string
  origin_city_id?: string | null
  origin_city_name?: string | null
  destination_city_id?: string | null
  destination_city_name?: string | null
  cargo_type?: string | null
  cargo_item?: string | null
  distance_km?: number | null
  pickup_time?: string | null
  delivery_deadline?: string | null
  transport_mode?: 'load' | 'trailer' | string | null
  reward_trailer_cargo?: number | null
  reward_load_cargo?: number | null
}

/**
 * Props for JobCard
 */
export interface JobCardProps {
  job: JobRow
  onView?: (job: JobRow) => void
  onAccept: (job: JobRow) => void
}

/**
 * JobCard
 *
 * Displays a single job as a card. Buttons emit onView and onAccept.
 *
 * @param props - JobCardProps
 */
export default function JobCard({ job, onView, onAccept }: JobCardProps) {
  const rewardTrailer = job.reward_trailer_cargo ?? 0
  const rewardLoad = job.reward_load_cargo ?? 0
  const bestReward = Math.max(rewardTrailer, rewardLoad)

  return (
    <div className="bg-white p-4 rounded-md shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">{
            job.origin_city_name ?? 'Unknown'
          }</div>
          <div className="text-slate-300">→</div>
          <div className="text-sm font-medium">{job.destination_city_name ?? 'Unknown'}</div>
          <div className="ml-3 text-xs text-slate-400">• {job.distance_km ?? '—'} km</div>
        </div>

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <div>{job.cargo_type ?? job.cargo_item ?? 'Cargo'}</div>
          </div>

          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-slate-400" />
            <div>{job.transport_mode ?? '—'}</div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <div>
              Pickup: {job.pickup_time ? new Date(job.pickup_time).toLocaleString() : '—'}
              <span className="ml-2">Deadline: {job.delivery_deadline ? new Date(job.delivery_deadline).toLocaleString() : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-3 md:ml-4">
        <div className="text-right">
          <div className="text-sm text-slate-500">Trailer</div>
          <div className="text-lg font-semibold">€{rewardTrailer.toFixed(2)}</div>
        </div>

        <div className="text-right">
          <div className="text-sm text-slate-500">Load</div>
          <div className="text-xl font-bold text-emerald-600">€{rewardLoad.toFixed(2)}</div>
        </div>

        <div className="flex gap-2 mt-2">
          <button onClick={() => onView?.(job)} className="px-3 py-1 rounded border text-sm">
            View
          </button>
          <button onClick={() => onAccept(job)} className="px-3 py-1 rounded bg-sky-600 text-white text-sm">
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}