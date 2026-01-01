/**
 * Register.tsx
 *
 * Registration page where users create an account.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'

/**
 * RegisterPage
 *
 * Presents a registration form with basic validation.
 */
export default function RegisterPage() {
  const nav = useNavigate()
  const { signUp } = useAuth()
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /**
   * handleSubmit
   *
   * Validate form and call signUp, then redirect to create-company.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

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
    const res = await signUp(form.email, form.password, form.username)
    setLoading(false)
    if (res && (res.status === 200 || res.status === 201)) {
      // proceed to create company
      nav('/create-company')
    } else {
      setError('Registration failed. Please ensure email is unique.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-yellow-400">
      <div className="w-full max-w-md bg-white rounded shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Create your Tracktopia account</h2>
        {error && <div className="mb-3 text-red-600">{error}</div>}
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
      </div>
    </div>
  )
}
