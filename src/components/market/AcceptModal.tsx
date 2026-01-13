/**
 * AcceptModal.tsx
 *
 * Lightweight modal prompting for truck_id when accepting a job.
 *
 * This modal is intentionally minimal to avoid adding new UI dependencies.
 */

import React, { useState } from 'react'

/**
 * Props for AcceptModal
 */
export interface AcceptModalProps {
  open: boolean
  jobId: string | null
  onClose: () => void
  onConfirm: (truckId: string) => void
}

/**
 * AcceptModal
 *
 * Shows a small overlay with a truck id input and confirm/cancel actions.
 *
 * @param props - AcceptModalProps
 */
export default function AcceptModal({ open, jobId, onClose, onConfirm }: AcceptModalProps) {
  const [truckId, setTruckId] = useState('')

  if (!open || !jobId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg p-5 w-full max-w-md shadow-lg">
        <h3 className="text-lg font-semibold mb-2">Accept job</h3>
        <p className="text-sm text-slate-600 mb-4">Provide the truck id that will take this job.</p>

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