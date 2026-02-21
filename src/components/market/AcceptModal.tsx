/**
 * AcceptModal.tsx
 *
 * Confirmation modal shown when accepting a job.
 *
 * This variant uses the job prop passed by the caller (no fetch) and formats
 * pickup/delivery timestamps to DD-MM-YYYY HH:MM:SS. Headline labels are rendered
 * in bold for better emphasis. Transport mode values are normalized to friendly
 * text (e.g. "trailer_cargo" -> "Trailer Cargo", "load_cargo" -> "Load Cargo").
 */

import React, { useState } from 'react'
import type { JobRow } from './JobCard'

export interface AcceptModalProps {
  /**
   * Whether the modal is open.
   */
  open: boolean
  /**
   * The job id (kept for compatibility). The modal will not render if missing.
   */
  jobId: string | null
  /**
   * The job object passed from the parent. This file relies on this prop
   * instead of performing an extra fetch.
   */
  job: JobRow | null
  /**
   * Called when the modal should close.
   */
  onClose: () => void
  /**
   * Called when the user confirms acceptance. The function may return a Promise.
   */
  onConfirm: (truckId?: string) => Promise<void> | void
}

/**
 * formatNumber
 *
 * Formats numeric values for display (thousands separator, fallback).
 *
 * @param n number | null | undefined
 * @returns formatted string
 */
function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 1000) return `${Math.round(n).toLocaleString()}`
  return n.toString()
}

/**
 * formatDateTime
 *
 * Convert an ISO date string to "DD-MM-YYYY HH:MM:SS". Uses local time.
 *
 * @param iso ISO date string
 * @returns formatted date/time or '—' when missing/invalid
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
 * Convert raw transport_mode values into friendly labels.
 *
 * Examples:
 * - "trailer_cargo" -> "Trailer Cargo"
 * - "load_cargo" -> "Load Cargo"
 *
 * @param m transport mode string
 * @returns human-friendly transport mode
 */
function formatTransportMode(m?: string | null): string {
  if (!m) return '—'
  const s = String(m).trim().toLowerCase()
  if (s === 'trailer_cargo') return 'Trailer Cargo'
  if (s === 'load_cargo') return 'Load Cargo'
  if (s.includes('trailer')) return 'Trailer Cargo'
  if (s.includes('load')) return 'Load Cargo'
  // Fallback: replace underscores and title-case
  return s
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/**
 * AcceptModal
 *
 * Displays job summary and confirmation UI. Uses the provided `job` prop
 * as the source of truth and does NOT re-fetch from /rest/v1/job_offers.
 *
 * Clicking "Confirm" will immediately call onConfirm and there are no extra
 * UI steps after that. The button is disabled while the confirmation is in
 * progress to prevent duplicate actions.
 *
 * @param props AcceptModalProps
 * @returns JSX.Element | null
 */
export default function AcceptModal({
  open,
  jobId,
  job,
  onClose,
  onConfirm,
}: AcceptModalProps) {
  /**
   * Local loading state to prevent double-clicks and indicate progress.
   */
  const [confirming, setConfirming] = useState(false)

  // Require modal open and a jobId (keeps behavior consistent with callers
  // that provide both id and job). Avoids re-fetching which caused 404s.
  if (!open || !jobId) return null

  // Use the passed job (no fetch)
  const displayJob = job

  const mode = formatTransportMode(displayJob?.transport_mode ?? null)

  const reward =
    displayJob?.transport_mode === 'trailer_cargo'
      ? displayJob?.reward_trailer_cargo ?? displayJob?.reward_load_cargo
      : displayJob?.reward_load_cargo ?? displayJob?.reward_trailer_cargo

  const distance =
    displayJob?.distance_km != null ? `${formatNumber(displayJob.distance_km)} km` : '—'

  const pickupFormatted = formatDateTime(displayJob?.pickup_time ?? null)
  const deliveryFormatted = formatDateTime(displayJob?.delivery_deadline ?? null)

  /**
   * handleConfirm
   *
   * Call the provided onConfirm handler and await it if it returns a Promise.
   * Do not proceed to any other client-side steps here — the onConfirm handler
   * is the final action and is responsible for updating parent state.
   *
   * If onConfirm throws, keep the modal open so the caller can surface an error.
   */
  async function handleConfirm() {
    if (confirming) return
    setConfirming(true)
    try {
      await Promise.resolve(onConfirm())
      // Do not call onClose here — parent will typically clear the acceptingJobId
      // which unmounts this modal. If the parent does not, we still keep the modal
      // open so the user can see results; closing is delegated to parent.
    } catch (err) {
      // swallow here; parent should set an error state that is visible on the page.
      // We avoid automatically closing the modal on error.
      console.error('AcceptModal onConfirm error', err)
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

        <div className="flex justify-end gap-2">
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