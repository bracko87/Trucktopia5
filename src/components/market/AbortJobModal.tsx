/**
 * AbortJobModal.tsx
 *
 * Modal that asks the user to confirm aborting (returning) an active job to the market.
 * Calls POST /assignments/{id}/abort on confirm and dispatches global events on success.
 *
 * Includes a blurred backdrop to match the requested visual style.
 */

import React, { useEffect, useState } from 'react'
import ModalShell from '../common/ModalShell'
import { AlertTriangle } from 'lucide-react'

/**
 * AbortJobModal
 *
 * Listens for the global "openAbortModal" CustomEvent to open the modal.
 * When the user confirms, performs a POST to /assignments/{id}/abort and
 * dispatches helpful global events so other parts of the app can react.
 *
 * Emits:
 * - assignmentAborted { assignmentId }
 * - staging:reload (so lists refresh)
 *
 * @returns JSX.Element | null
 */
export default function AbortJobModal(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [assignmentId, setAssignmentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * handleOpenEvent
   *
   * Open handler for the custom event used to open this modal.
   *
   * @param e CustomEvent<{ assignmentId?: string }>
   */
  function handleOpenEvent(e: any) {
    setAssignmentId(e?.detail?.assignmentId ?? null)
    setError(null)
    setOpen(true)
  }

  useEffect(() => {
    window.addEventListener('openAbortModal', handleOpenEvent as EventListener)
    return () => {
      window.removeEventListener('openAbortModal', handleOpenEvent as EventListener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * doAbort
   *
   * Perform the POST /assignments/{id}/abort request. On success:
   * - emit 'assignmentAborted' with id
   * - emit 'staging:reload' to refresh panels that list assignments
   * - close the modal
   *
   * @returns void
   */
  async function doAbort() {
    if (!assignmentId) {
      setError('No assignment id provided.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/assignments/${encodeURIComponent(assignmentId)}/abort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        setError(`Server error: ${res.status} ${text || ''}`)
        return
      }

      // Notify other app parts that the assignment was aborted
      try {
        window.dispatchEvent(
          new CustomEvent('assignmentAborted', {
            detail: { assignmentId },
          }),
        )
      } catch {
        // ignore
      }

      // Ask panels to refresh (non-invasive)
      try {
        window.dispatchEvent(new CustomEvent('staging:reload'))
      } catch {
        // ignore
      }

      setOpen(false)
      setAssignmentId(null)
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Blurred backdrop to match requested visual effect; clicking it closes the modal */}
      <div
        aria-hidden
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={() => {
          setOpen(false)
          setAssignmentId(null)
          setError(null)
        }}
      />
      <div className="relative z-50">
        <ModalShell
          open={open}
          onClose={() => {
            setOpen(false)
            setAssignmentId(null)
            setError(null)
          }}
          title="Abort current job?"
          size="sm"
          showCloseButton
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setAssignmentId(null)
                  setError(null)
                }}
                className="bg-white px-4 py-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
              >
                Continue Job
              </button>

              <button
                type="button"
                onClick={() => doAbort()}
                disabled={loading}
                className={`ml-auto px-4 py-2 rounded-md text-white text-sm transition shadow ${loading ? 'bg-rose-400 cursor-wait' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {loading ? 'Aborting…' : 'Abort Job'}
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
                <div className="text-sm text-slate-700 font-semibold">Abort current job?</div>
                <div className="text-xs text-slate-400 mt-1">Cargo returns to job market. Assets return to hub.</div>
                {assignmentId && <div className="text-xs text-slate-400 mt-1">Assignment: {assignmentId}</div>}
              </div>
            </div>

            {error && <div className="text-sm text-rose-600">{error}</div>}
          </div>
        </ModalShell>
      </div>
    </>
  )
}