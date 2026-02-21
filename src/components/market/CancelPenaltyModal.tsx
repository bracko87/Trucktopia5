/**
 * CancelPenaltyModal.tsx
 *
 * Modal component that displays a cancellation penalty and asks the user to
 * confirm returning a job to the market. Built on top of ModalShell to keep
 * visuals consistent with the rest of the app (blurred backdrop, focus trap).
 */

import React from 'react'
import ModalShell from '../common/ModalShell'
import { AlertTriangle } from 'lucide-react'

/**
 * CancelPenaltyModalProps
 *
 * Props for the CancelPenaltyModal component.
 */
export interface CancelPenaltyModalProps {
  /** Whether the modal is visible */
  open: boolean
  /** Loading indicator while penalty or cancel request is in progress */
  loading?: boolean
  /** Penalty amount in numeric form (optional) */
  penalty?: number | null
  /** Optional assignment id (for display / analytics) */
  assignmentId?: string | undefined
  /** Close handler */
  onClose: () => void
  /** Confirm handler - invoked when user confirms cancellation */
  onConfirm: () => Promise<void> | void
}

/**
 * currencyFormat
 *
 * Format a numeric value to a localized currency string. Defaults to USD when
 * formatting cannot infer currency.
 *
 * @param value - numeric amount
 * @returns formatted currency string
 */
function currencyFormat(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value))
  } catch {
    return `$${Number(value).toFixed(2)}`
  }
}

/**
 * CancelPenaltyModal
 *
 * Presents the user with the penalty details and a confirmation dialog to
 * cancel the job assignment. Uses the global ModalShell for consistent UX.
 *
 * @param props CancelPenaltyModalProps
 */
export default function CancelPenaltyModal({
  open,
  loading = false,
  penalty = null,
  assignmentId,
  onClose,
  onConfirm,
}: CancelPenaltyModalProps): JSX.Element | null {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Cancel Job?"
      size="sm"
      showCloseButton
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-white px-4 py-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
          >
            Keep Job
          </button>

          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={loading}
            className={`ml-auto px-4 py-2 rounded-md text-white text-sm transition shadow ${
              loading ? 'bg-rose-400 cursor-wait' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {loading ? 'Cancelling…' : 'Cancel Job'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-rose-50 p-2 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm text-slate-700 font-semibold">Cancelling this job returns the load to the market.</div>
            {assignmentId && <div className="text-xs text-slate-400 mt-1">Assignment: {assignmentId}</div>}
          </div>
        </div>

        <div className="rounded-lg p-4 bg-white border border-slate-100 shadow-sm">
          <div className="text-xs text-slate-500">Penalty now</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1">{currencyFormat(penalty)}</div>
        </div>

        <div className="text-sm text-slate-600">
          <ul className="list-disc list-inside space-y-1">
            <li>First 12h after acceptance → free</li>
            <li>After that the penalty increases as acceptance ages</li>
            <li>After the deadline → 120% penalty</li>
          </ul>
        </div>
      </div>
    </ModalShell>
  )
}