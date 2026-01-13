/**
 * NewThreadModal.tsx
 *
 * Modal dialog used to create a new conversation (thread) with another user.
 * - Renders an email input, performs basic validation and calls onCreate(email).
 * - Uses the app ModalShell to keep UI consistent with other modals.
 */

import React, { useState, useEffect } from 'react'
import ModalShell from '../../common/ModalShell'

/**
 * NewThreadModalProps
 *
 * Props for the NewThreadModal component.
 */
export interface NewThreadModalProps {
  open: boolean
  onClose: () => void
  onCreate: (email: string) => Promise<void> | void
}

/**
 * NewThreadModal
 *
 * Presents a small form to enter an email address and create a new thread.
 *
 * @param props - NewThreadModalProps
 */
export default function NewThreadModal({ open, onClose, onCreate }: NewThreadModalProps) {
  const [email, setEmail] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)

  useEffect(() => {
    if (!open) {
      setEmail('')
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  /**
   * validateEmail
   *
   * Basic email format check.
   *
   * @param e - email string
   * @returns boolean valid
   */
  function validateEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
  }

  async function handleCreate() {
    const v = email.trim()
    if (!v) {
      setError('Please enter an email.')
      return
    }
    if (!validateEmail(v)) {
      setError('Please enter a valid email address.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onCreate(v)
      onClose()
    } catch (err) {
      setError((err as any)?.message || 'Failed to create conversation.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} title="New Conversation" size="sm" showCloseButton>
      <div>
        <p className="text-sm text-slate-600 mb-3">Start a conversation with an existing user by email.</p>
        <div className="mb-3">
          <label className="block text-xs text-slate-700 mb-1">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded text-black"
            placeholder="user@example.com"
            aria-label="Participant email"
            type="email"
          />
        </div>
        {error ? <div className="text-xs text-rose-600 mb-3">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border text-black">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="px-3 py-1 rounded bg-sky-600 text-white"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}