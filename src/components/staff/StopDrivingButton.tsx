/**
 * StopDrivingButton.tsx
 *
 * In-page confirmation flow to remove the DRIVER role for a staff_profile.
 * Uses ModalShell for confirmation and performs a delete on staff_profile_roles.
 * No post-success alert is shown — the modal close and local state change are
 * the final visible steps. Parent callback is invoked so callers can refresh UI.
 */

import React from 'react'
import { supabase } from '@/lib/supabase'
import ModalShell from '../common/ModalShell'

/**
 * StopDrivingButtonProps
 *
 * Props for StopDrivingButton component.
 */
export default function StopDrivingButton({
  staffProfileId,
  onStopped,
}: {
  staffProfileId?: string | null
  onStopped?: () => void
}) {
  const [mutating, setMutating] = React.useState(false)
  const [stopped, setStopped] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  /**
   * handleConfirmStop
   *
   * Called when the user confirms the modal. Performs the delete of DRIVER
   * role rows for the supplied staff_profile_id but only when locked = false.
   *
   * Note: no success alert is shown here — the ModalShell confirmation is
   * the last visible step in this flow. Parent callback onStopped is invoked
   * so callers can update UI (refresh lists) as needed.
   */
  async function handleConfirmStop() {
    if (!staffProfileId) {
      alert('No staff profile linked.')
      setConfirmOpen(false)
      return
    }

    setMutating(true)
    try {
      const { error } = await supabase
        .from('staff_profile_roles')
        .delete()
        .eq('staff_profile_id', staffProfileId)
        .eq('role_key', 'DRIVER')
        .eq('locked', false)

      if (error) {
        console.error(error)
        alert(error.message ?? 'Failed to stop driving')
        return
      }

      // update local state and notify parent; do NOT show any additional alerts
      setStopped(true)
      setConfirmOpen(false)
      try {
        if (onStopped) await onStopped()
      } catch {
        // ignore callback errors
      }
    } finally {
      setMutating(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={mutating || stopped}
        className={`text-sm px-3 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 ${mutating || stopped ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label="Stop Driving"
        title={stopped ? 'Driver role removed' : 'Remove driving role from profile'}
        style={{ pointerEvents: mutating || stopped ? 'none' : 'auto' }}
      >
        {mutating ? 'Stopping...' : stopped ? 'Stopped' : 'Stop Driving'}
      </button>

      <ModalShell
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Stop driving role"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className="px-4 py-2 text-sm border rounded"
              onClick={() => setConfirmOpen(false)}
              disabled={mutating}
            >
              Cancel
            </button>

            <button
              className="px-4 py-2 text-sm rounded bg-amber-600 text-white hover:bg-amber-700"
              onClick={handleConfirmStop}
              disabled={mutating}
            >
              {mutating ? 'Stopping…' : 'Confirm'}
            </button>
          </div>
        }
      >
        <div>
          <p className="text-sm text-slate-700">
            Remove the DRIVER role from this profile. This will make the profile no longer appear in the Drivers tab.
          </p>
        </div>
      </ModalShell>
    </>
  )
}