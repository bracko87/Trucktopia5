/**
 * Login.tsx
 *
 * Sign-in page for Tracktopia.
 *
 * FIX:
 * - Actually authenticate with Supabase using signInWithPassword
 * - Show error if credentials are wrong
 * - Navigate to /dashboard only after successful login
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import BackgroundImageLayer from '../components/BackgroundImageLayer'
import { supabase } from '../lib/supabase'

export default function LoginPage(): JSX.Element {
  const nav = useNavigate()

  const [email, setEmail] = useState('bracko87@live.com')
  const [password, setPassword] = useState('Esta2020')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInErr) {
        setError(signInErr.message || 'Login failed.')
        return
      }

      if (!data.session) {
        setError('No session returned. Please try again.')
        return
      }

      nav('/dashboard', { replace: true })
    } catch (err) {
      console.error('login error:', err)
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const bgSrc = 'https://i.ibb.co/bMkDQr71/Chat-GPT-Image-Feb-17-2026-01-26-22-PM.png'

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-white-400" />

      <BackgroundImageLayer
        src={bgSrc}
        opacity={0.1}
        alt="Decorative background"
        className="z-10"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0) 20%, rgba(255,255,255,1) 95%)',
        }}
      />

      <div className="relative z-30 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded shadow p-6">
          <h2 className="text-2xl font-bold mb-4">Sign in to Tracktopia</h2>

          {error && <div className="mb-3 text-red-600 text-sm">{error}</div>}

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border px-3 py-2 rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border px-3 py-2 rounded"
              />
            </div>

            <div className="flex justify-between items-center">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-black text-yellow-400 rounded font-semibold disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              <button
                type="button"
                onClick={() => nav('/')}
                className="text-sm text-black/70 underline"
              >
                Back to Home Page
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
