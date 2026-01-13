/**
 * Invite.tsx
 *
 * Invite Friends page (Settings -> Invite Friends)
 *
 * Keeps the original layout and visual design but makes the "Send Invite"
 * action functional:
 * - Validates email on client
 * - POSTs to a backend endpoint (/api/invite) with { email, message, inviterId }
 * - Shows inline status / toasts and disables UI while sending
 *
 * Note: This component expects a server endpoint at /api/invite to persist
 * invites and deliver the email. A serverless example is provided in
 * serverless/invite.ts (not part of the client bundle).
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'

/**
 * isValidEmail
 *
 * Validate a simple email format (client-side only).
 *
 * @param email - string to validate
 * @returns boolean
 */
function isValidEmail(email: string): boolean {
  // Simple RFC-ish approximation suitable for client validation only.
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

/**
 * InvitePage
 *
 * The page component renders the invite form and handles client-side
 * validation + calling the backend. The visual layout is preserved.
 */
export default function InvitePage(): JSX.Element {
  const nav = useNavigate()
  const { user } = useAuth()
  const [email, setEmail] = useState<string>('')
  const [note, setNote] = useState<string>('Join me on Tracktopia!')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  /**
   * sendInvite
   *
   * Validates input and sends a POST request to /api/invite. Expects the
   * backend to handle persistence and delivery via transactional email.
   */
  async function sendInvite() {
    setError(null)
    setSuccess(null)

    if (!email.trim()) {
      setError('Please enter the friend\'s email.')
      return
    }
    if (!isValidEmail(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      const body = {
        email: email.trim(),
        message: note,
        inviterId: user?.id ?? null,
      }

      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        const msg = payload?.error || payload?.message || `Server error (${res.status})`
        throw new Error(msg)
      }

      setSuccess('Invite sent! The recipient should receive an email shortly.')
      setEmail('')
      // small delay so user sees toast before returning
      setTimeout(() => nav(-1), 900)
    } catch (err: any) {
      setError(err?.message || 'Failed to send invite.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Invite Friends</h2>
          <button
            onClick={() => nav(-1)}
            className="px-3 py-1 rounded border text-black"
          >
            Back
          </button>
        </div>

        <div className="bg-white p-6 rounded shadow space-y-4">
          <div>
            <label className="text-xs text-slate-600">Friend's email</label>
            <input
              className="w-full px-3 py-2 border rounded text-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              aria-label="Friend's email"
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-xs text-slate-600">Message</label>
            <input
              className="w-full px-3 py-2 border rounded text-black"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Invite message"
              disabled={loading}
            />
          </div>

          {error && (
            <div role="alert" className="text-sm text-rose-600">
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="text-sm text-emerald-600">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => nav(-1)}
              className="px-3 py-1 rounded border text-black"
              disabled={loading}
            >
              Cancel
            </button>

            <button
              onClick={sendInvite}
              className={`px-3 py-1 rounded bg-emerald-600 text-white ${loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              disabled={loading}
            >
              {loading ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}