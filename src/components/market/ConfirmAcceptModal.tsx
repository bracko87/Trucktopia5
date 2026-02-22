/**
 * ConfirmAcceptModal.tsx
 *
 * Lightweight confirm modal used when a carrier confirms acceptance details
 * for a job assignment. This component performs a safe PATCH against
 * job_assignments using the assignmentsApi.updateAssignmentStatus helper to
 * avoid PostgREST 406/415 issues (Prefer: return=minimal, patch by assignment id).
 *
 * The UI is intentionally minimal so it can be dropped in as a replacement
 * for the previous modal without layout changes elsewhere.
 */

import React, { useState } from 'react'
import type { JobRow } from './JobCard'
import { updateAssignmentStatus } from '../../lib/assignmentsApi'

/**
 * ConfirmAcceptModalProps
 *
 * @property open - whether the modal is visible
 * @property job - job row (may include assignment_id). JobRow comes from JobCard.
 * @property onClose - close handler
 * @property onConfirm - called after successful server update with selected truckId
 */
export interface ConfirmAcceptModalProps {
  open: boolean
  job: JobRow | null
  onClose: () => void
  onConfirm: (truckId: string) => Promise<void> | void
}

/**
 * ConfirmAcceptModal
 *
 * Presents minimal confirm UI and updates the job_assignment.status using the
 * assignment id. If assignment_id is missing, an error is shown.
 */
export default function ConfirmAcceptModal({ open, job, onClose, onConfirm }: ConfirmAcceptModalProps) {
  const [truckId, setTruckId] = useState<string>(() => localStorage.getItem('staging_selected_driver') ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  /**
   * handleConfirm
   *
   * Update the assignment status (PATCH job_assignments by id) and invoke the
   * parent onConfirm callback with the chosen truck id.
   */
  async function handleConfirm() {
    setError(null)

    if (!job) {
      setError('No job selected')
      return
    }

    const assignmentId = (job as any).assignment_id ?? null
    if (!assignmentId) {
      setError('Missing assignment_id on job row')
      return
    }

    setLoading(true)
    try {
      // Set the assignment to the next phase (example: TO_PICKUP).
      // Adjust the status value as required by your workflow.
      await updateAssignmentStatus(String(assignmentId), 'TO_PICKUP')

      // Persist chosen truck as convenience
      try {
        if (truckId) localStorage.setItem('staging_selected_driver', truckId)
      } catch {}

      await onConfirm(truckId)
      onClose()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to confirm assignment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={() => onClose()} />
      <div className="bg-white rounded-lg shadow-lg p-6 z-10 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">Confirm assignment</h3>

        <div className="text-sm text-slate-700 mb-3">
          <div className="font-medium">{job?.origin_city_name ?? '—'} → {job?.destination_city_name ?? '—'}</div>
          <div className="text-xs text-slate-500">
            Pickup: {job?.pickup_time ?? '—'} • Deadline: {job?.delivery_deadline ?? '—'}
          </div>
        </div>

        <label className="block text-xs text-slate-600 mb-1">Truck / Driver ID</label>
        <input
          value={truckId}
          onChange={(e) => setTruckId(e.target.value)}
          placeholder="Enter truck id (optional)"
          className="w-full border rounded px-3 py-2 mb-3"
        />

        {error && <div className="text-sm text-rose-600 mb-2">{error}</div>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onClose()} className="px-4 py-2 rounded border bg-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={loading}
            className={`px-4 py-2 rounded text-white ${loading ? 'bg-slate-400' : 'bg-sky-600 hover:bg-sky-700'}`}
          >
            {loading ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}