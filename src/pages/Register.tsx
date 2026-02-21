/**
 * Register.tsx
 *
 * Registration page where users create an account.
 * Uses AuthContext.signUp and relies on server-side ensureUserProfile.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import BackgroundImageLayer from '../components/BackgroundImageLayer'

/**
 * RegisterPage
 *
 * Renders account creation form with decorative background and a soft dark-yellow overlay.
 *
 * @returns JSX.Element
 */
export default function RegisterPage(): JSX.Element {
  const nav = useNavigate()
  const { signUp } = useAuth()

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  /**
   * handleSubmit
   *
   * Validates and submits registration form.
   *
   * @param e Form event
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!form.username || !form.email) {
      setError('Please fill all fields.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.password !== form.password2) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const res = await signUp(form.email, form.password, form.username)
      setLoading(false)

      // ✅ CORRECT success check (AuthContext returns { error? })
      if (res?.error) {
        setError(res.error)
        return
      }

      setInfo(
        'Registration successful. If email confirmation is required, check your inbox.'
      )
      nav('/create-company')
    } catch (err: any) {
      setLoading(false)
      setError(err?.message || 'Registration failed.')
    }
  }

  // Decorative background image
  const bgTruckUrl =
    'https://i.ibb.co/PsJwZH0v/Chat-GPT-Image-Feb-19-2026-10-31-26-AM.png'

  return (
    <div className="min-h-screen relative">
      {/* Yellow base background layer (bottom) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none z-0 bg-white-00"
      />

      {/* Decorative image with subtle visibility and a soft dark-yellow overlay at 50% */}
      <BackgroundImageLayer
        src={bgTruckUrl}
        opacity={0.1}
        alt="Decorative background"
        overlayColor="rgba(187,144,0,0.5)" /* soft dark yellow at 50% */
        overlayOpacity={1}
        className="z-10"
      />

      {/* Gradient overlay to softly fade toward the bottom */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0) 30%, rgba(255,255,255,1) 95%)',
        }}
      />

      {/* Content on top */}
      <div className="relative z-30 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md bg-white rounded shadow p-6">
          <h2 className="text-2xl font-bold mb-4">
            Create your Tracktopia account
          </h2>

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
                {loading ? 'Creating…' : 'Register'}
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
            Client does not create users rows directly. Server ensures linkage.
          </div>
        </div>
      </div>
    </div>
  )
}
