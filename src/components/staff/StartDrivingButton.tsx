/**
 * StartDrivingButton.tsx
 *
 * In-page confirmation flow to add the DRIVER role for a staff_profile.
 * Uses ModalShell for confirmation and performs a direct insert into
 * staff_profile_roles. No post-success alert is shown — the modal close and
 * local state change are the final visible steps. Parent callback is invoked
 * so callers can update UI as needed.
 */

import React from 'react'
import { supabase } from '@/lib/supabase'
import ModalShell from '../common/ModalShell'

/**
 * StartDrivingButtonProps
 *
 * Props for StartDrivingButton component.
 */
export default function StartDrivingButton({
  staffProfileId,
  onStarted,
}: {
  /** linked staff_profiles.id */
  staffProfileId?: string | null
  /** optional callback after successful insert */
  onStarted?: () => void
}) {
  const [mutating, setMutating] = React.useState(false)
  const [started, setStarted] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  /**
   * attemptAddDriverRole
   *
   * Try to insert a DRIVER role entry for the profile using the exact table
   * shape: { staff_profile_id, role_key, locked }.
   *
   * Treat unique/conflict errors as success (ON CONFLICT DO NOTHING semantics).
   *
   * @returns boolean true when insert succeeded or already existed
   */
  async function attemptAddDriverRole(): Promise<boolean> {
    if (!staffProfileId) return false

    try {
      const { error } = await supabase
        .from('staff_profile_roles')
        .insert(
          {
            staff_profile_id: staffProfileId,
            role_key: 'DRIVER',
            locked: false,
          },
          { returning: 'minimal' }
        )

      if (!error) return true

      // Treat duplicate/unique conflicts as success (ON CONFLICT DO NOTHING)
      const msg = String(error.message ?? '').toLowerCase()
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')) {
        return true
      }

      console.error('StartDriving insert error', error)
      return false
    } catch (e) {
      console.error('StartDriving exception', e)
      return false
    }
  }

  /**
   * handleConfirmStart
   *
   * Called after user confirms in the modal. Runs the insert and notifies parent.
   * No user-visible alert is shown on success; modal close + state change is final.
   */
  async function handleConfirmStart() {
    if (!staffProfileId) {
      alert('Start Driving is only available for profiles linked to a staff_profile.')
      setConfirmOpen(false)
      return
    }

    setMutating(true)
    try {
      const ok = await attemptAddDriverRole()
      if (ok) {
        setStarted(true)
        setConfirmOpen(false)
        try {
          if (onStarted) await onStarted()
        } catch {
          // ignore callback errors
        }
      } else {
        alert('Failed to add driver role. Please verify the staff_profile_roles schema and permissions.')
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
        disabled={mutating || started}
        className={`text-sm px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 ${mutating || started ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label="Start Driving"
        title={started ? 'Driver role added' : 'Add driving role to profile'}
        style={{ pointerEvents: mutating || started ? 'none' : 'auto' }}
      >
        {mutating ? 'Starting...' : started ? 'Started' : 'Start Driving'}
      </button>

      <ModalShell
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Add driving role"
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
              className="px-4 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleConfirmStart}
              disabled={mutating}
            >
              {mutating ? 'Adding…' : 'Confirm'}
            </button>
          </div>
        }
      >
        <div>
          <p className="text-sm text-slate-700">
            Add the DRIVER role to this profile. This will make the profile appear in the Drivers tab.
          </p>
        </div>
      </ModalShell>
    </>
  )
}