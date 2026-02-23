/**
 * src/components/market/AcceptModal.tsx
 *
 * Presentational confirmation modal used when accepting a job.
 * - Simplified: no truck selector UI. Truck resolution is performed in the Market page.
 * - onConfirm is a no-argument callback: () => Promise<void> | void
 *
 * Notes:
 * - Keeps formatting helpers and local error/confirming state.
 * - The modal shows job summary + Confirm/Cancel buttons only.
 */

import React, { useState } from 'react'
import type { JobRow } from './JobCard'
import { useAuth } from '../../context/AuthContext'

/**
 * AcceptModalProps
 *
 * Props for the AcceptModal component.
 */
export interface AcceptModalProps {
  open: boolean
  jobId: string | null
  job: JobRow | null
  onClose: () => void
  /**
   * onConfirm
   *
   * No-argument confirm callback. Truck resolution / selection is performed by
   * the caller (Market page). The modal only confirms the action.
   */
  onConfirm: () => Promise<void> | void
}

/**
 * formatNumber
 *
 * Pretty-format small numbers for UI.
 *
 * @param n numeric value
 * @returns formatted string
 */
function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 1000) return `${Math.round(n).toLocaleString()}`
  return String(n)
}

/**
 * formatDateTime
 *
 * Convert ISO timestamp to DD-MM-YYYY HH:MM:SS or '—' when invalid.
 *
 * @param iso ISO datetime string
 * @returns formatted datetime or placeholder
 */
function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'

  const pad = (n: number) => String(n).padStart(2, '0')
  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const year = d.getFullYear()
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  const seconds = pad(d.getSeconds())

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`
}

/**
 * formatTransportMode
 *
 * Human-friendly transport mode label.
 *
 * @param m transport mode string
 * @returns pretty label
 */
function formatTransportMode(m?: string | null): string {
  if (!m) return '—'
  const s = String(m).trim().toLowerCase()
  if (s === 'trailer_cargo') return 'Trailer Cargo'
  if (s === 'load_cargo') return 'Load Cargo'
  if (s.includes('trailer')) return 'Trailer Cargo'
  if (s.includes('load')) return 'Load Cargo'
  return s
}

/**
 * AcceptModal
 *
 * Presentational confirmation modal used when accepting a job. Truck selection
 * is intentionally absent; the caller resolves the truck before calling the
 * accept RPC. On success this modal closes; on failure it shows a local error.
 */
export default function AcceptModal({
  open,
  jobId,
  job,
  onClose,
  onConfirm,
}: AcceptModalProps) {
  const { user } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  if (!open || !jobId) return null

  const displayJob = job
  const mode = formatTransportMode(displayJob?.transport_mode ?? null)

  const reward =
    displayJob?.transport_mode === 'trailer_cargo'
      ? displayJob?.reward_trailer_cargo ?? displayJob?.reward_load_cargo
      : displayJob?.reward_load_cargo ?? displayJob?.reward_trailer_cargo

  const distance = displayJob?.distance_km != null ? `${formatNumber(displayJob.distance_km)} km` : '—'
  const pickupFormatted = formatDateTime(displayJob?.pickup_time ?? null)
  const deliveryFormatted = formatDateTime(displayJob?.delivery_deadline ?? null)

  /**
   * handleConfirm
   *
   * Call the caller-provided onConfirm (no args). Keep confirming state and
   * surface any thrown error as a local error message without closing modal.
   */
  async function handleConfirm() {
    if (confirming) return

    setLocalError(null)
    setConfirming(true)
    try {
      await Promise.resolve(onConfirm())
      onClose()
    } catch (err: any) {
      console.error('AcceptModal onConfirm error', err)
      setLocalError(err?.message ?? 'Accept failed')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-lg p-5 w-full max-w-md shadow-lg">
        <h3 className="text-lg font-semibold mb-2">Accept job</h3>

        <p className="text-sm text-slate-600 mb-4">Confirm job details before accepting.</p>

        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-2 font-semibold">Job summary</div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col">
              <div className="text-xs text-slate-500 font-semibold">Pickup</div>
              <div className="text-black/80">{pickupFormatted}</div>
            </div>

            <div className="flex flex-col">
              <div className="text-xs text-slate-500 font-semibold">Delivery</div>
              <div className="text-black/80">{deliveryFormatted}</div>
            </div>

            <div className="flex flex-col">
              <div className="text-xs text-slate-500 font-semibold">Type</div>
              <div className="text-black/80">{mode}</div>
            </div>

            <div className="flex flex-col">
              <div className="text-xs text-slate-500 font-semibold">Reward</div>
              <div className="text-sm font-semibold text-emerald-600" aria-label="reward-value">
                {reward != null ? `${formatNumber(Number(reward))} USD` : '—'}
              </div>
            </div>

            <div className="flex flex-col col-span-2">
              <div className="text-xs text-slate-500 font-semibold">Distance</div>
              <div className="text-black/80">{distance}</div>
            </div>
          </div>
        </div>

        {localError && (
          <div className="mt-3 p-2 rounded bg-rose-50 border border-rose-100 text-rose-700 text-sm">
            {localError}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border text-sm" disabled={confirming}>
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            className="px-3 py-1 rounded bg-sky-600 text-white text-sm"
            disabled={confirming}
            style={{ pointerEvents: confirming ? 'none' : 'auto' }}
            aria-disabled={confirming}
          >
            {confirming ? 'Accepting…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
