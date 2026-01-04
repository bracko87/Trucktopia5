/**
 * Register.tsx
 *
 * Registration page where users create an account.
 *
 * Purpose:
 * - Provide a registration form and call AuthContext.signUp to register users.
 * - Do NOT pre-insert public.users rows from the client (prevents anonymous rows with null auth_user_id).
 * - Rely on AuthContext.signUp and ensureUserProfile to create/patch the DB profile server-side.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'

/**
 * RegisterPage
 *
 * Presents a registration form with basic validation.
 * This component intentionally does NOT create a public.users row client-side before sign up.
 * The server-side ensureUserProfile logic (called from AuthContext.signUp) will handle creating
 * or linking the DB profile so public.users.id == auth.uid() where possible.
 */
export default function RegisterPage(): JSX.Element {
  const nav = useNavigate()
  const { signUp } = useAuth()
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  /**
   * handleSubmit
   *
   * Validate the form and call AuthContext.signUp.
   * On success navigate to create-company. No client-side DB inserts are performed here.
   *
   * @param e - form submit event
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.password !== form.password2) {
      setError('Passwords do not match.')
      return
    }
    if (!form.email || !form.username) {
      setError('Please fill all fields.')
      return
    }

    setLoading(true)

    try {
      // Call signUp from AuthContext. AuthContext is responsible for setting the JWT
      // and calling ensureUserProfile so the DB user is created/linked server-side.
      const res = await signUp(form.email, form.password, form.username)
      setLoading(false)

      // Provide user-friendly messages depending on the response.
      if (res && (res.status === 200 || res.status === 201)) {
        // Typical success. The backend may require email confirmation.
        setInfo('Registration successful. If your provider requires email confirmation, check your inbox.')
        // Proceed to next step of flow (company creation). create-company will rely on server linkage.
        nav('/create-company')
      } else if (res && res.status === 400) {
        setError('Invalid registration data. Please check your input.')
        console.warn('signUp returned 400:', res)
      } else {
        // Generic fallback: surface server message if available
        const serverMsg = (res && (res.data?.message || res.data?.error || JSON.stringify(res.data))) || ''
        setError(
          serverMsg
            ? `Registration failed: ${serverMsg}`
            : 'Registration failed. Please ensure email is unique or check your inbox for confirmation.'
        )
        console.warn('signUp response:', res)
      }
    } catch (err: any) {
      setLoading(false)
      setError(err?.message || 'Registration failed due to network error.')
      console.error('signUp error:', err)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-md bg-white rounded shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Create your Tracktopia account</h2>
        {error && <div className="mb-3 text-red-600">{error}</div>}
        {info && <div className="mb-3 text-green-700">{info}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Confirm Password</label>
            <input
              type="password"
              value={form.password2}
              onChange={(e) => setForm({ ...form, password2: e.target.value })}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>

          <div className="flex justify-between items-center">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-black text-yellow-400 rounded font-semibold"
            >
              {loading ? 'Creating...' : 'Register'}
            </button>
            <button
              type="button"
              onClick={() => nav('/')}
              className="text-sm text-black/70 underline"
            >
              Back
            </button>
          </div>
        </form>
        <div className="mt-3 text-xs text-gray-500">
          {/* Helpful debug hint for developers */}
          <div>Note: client will not create users rows directly. Server ensures profile linkage.</div>
        </div>
      </div>
    </div>
  )
}