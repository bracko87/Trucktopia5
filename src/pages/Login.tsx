/**
 * Login.tsx
 *
 * Simple login page that authenticates via Supabase and redirects to dashboard.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'

/**
 * LoginPage
 *
 * Presents login form and handles sign in.
 */
export default function LoginPage() {
  const nav = useNavigate()
  const { signIn } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  /**
   * handleSubmit
   *
   * Authenticate user and navigate to dashboard on success.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn(form.email, form.password)
    setLoading(false)
    if (res && res.status === 200) {
      nav('/dashboard')
    } else {
      setError('Invalid credentials.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-yellow-400">
      <div className="w-full max-w-md bg-white rounded shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Sign in to Tracktopia</h2>
        {error && <div className="mb-3 text-red-600">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
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

          <div className="flex justify-between items-center">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-black text-yellow-400 rounded font-semibold"
            >
              {loading ? 'Signing in...' : 'Sign in'}
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
      </div>
    </div>
  )
}
