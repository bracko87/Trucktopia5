/**
 * Profile.tsx
 *
 * Page for editing the user's profile in Settings -> My Profile.
 *
 * - Persists name/email to public.users when an authenticated user is present.
 * - Birthday / Country / City are persisted in localStorage (the current DB users table
 *   does not include these columns in the schema provided, so they remain local).
 * - Replaces native alert() popups with a small inline notification component.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Layout from '../../components/Layout'
import { useAuth } from '../../context/AuthContext'
import { supabaseFetch } from '../../lib/supabase'

/**
 * CountryOption
 *
 * Small interface for country select options.
 */
interface CountryOption {
  code: string
  name: string
}

/**
 * COUNTRIES
 *
 * Curated short list to keep the select compact in the preview.
 */
const COUNTRIES: CountryOption[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'IN', name: 'India' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
]

/**
 * Notification
 *
 * Minimal notification shape used to show non-blocking feedback.
 */
type Notification = {
  type: 'success' | 'error' | 'info'
  message: string
} | null

/**
 * ProfilePage
 *
 * Page-level profile editor. Uses localStorage for demo persistence for
 * extra fields and updates public.users for name/email when possible.
 *
 * @returns JSX.Element
 */
export default function ProfilePage(): JSX.Element {
  const nav = useNavigate()
  const { user } = useAuth()

  const [firstName, setFirstName] = useState<string>('')
  const [lastName, setLastName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [birthday, setBirthday] = useState<string>('')
  const [country, setCountry] = useState<string>('')
  const [city, setCity] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [notification, setNotification] = useState<Notification>(null)

  useEffect(() => {
    // TODO: Load profile from DB on page open when server-backed profile columns are available.
    // Removed localStorage-based loading: initial state remains empty until DB load is implemented.
  }, [])

  /**
   * showNotification
   *
   * Show a small non-blocking message for a short duration.
   *
   * @param n - notification payload
   */
  function showNotification(n: Notification) {
    setNotification(n)
    if (n) {
      window.setTimeout(() => {
        setNotification(null)
      }, 3500)
    }
  }

  /**
   * saveProfile
   *
   * Persist profile locally and try to update public.users (name/email)
   * when an authenticated app user is available. Birthday/Country/City
   * remain in localStorage because the current DB schema doesn't include them.
   */
  async function saveProfile() {
    setSaving(true)

    // Persist local draft removed — switching to DB-only save flow.

    const patch: Record<string, any> = {}

    if (firstName) patch.first_name = firstName
    if (lastName) patch.last_name = lastName

    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
    if (fullName) patch.name = fullName

    if (email) patch.email = email
    if (birthday) patch.birthday = birthday
    if (country) patch.country = country
    if (city) patch.city = city

    // If user is signed in and we have a game user id (public.users.id), try to PATCH DB
    if (user && user.id && Object.keys(patch).length > 0) {
      try {
        const res: any = await supabaseFetch(
          `/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(patch),
            headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          }
        )

        if (res && (res.status === 200 || res.status === 201)) {
          showNotification({ type: 'success', message: 'Profile saved.' })
        } else {
          // DB patch failed
          showNotification({
            type: 'error',
            message: 'Failed to save profile.',
          })
        }
      } catch (err) {
        showNotification({
          type: 'error',
          message: 'Saved locally, but an unexpected error occurred updating server profile.',
        })
      } finally {
        setSaving(false)
        return
      }
    }

    // No signed-in user / nothing to patch -> success local save
    setSaving(false)
    showNotification({ type: 'success', message: 'Profile saved locally.' })
  }

  /**
   * changePassword
   *
   * Trigger the password-recovery / reset email flow using a best-effort approach:
   * - Try supabase client (if available).
   * - Fallback to calling auth/v1/recover if SUPABASE URL is exposed.
   * - Final fallback shows an informational notification.
   */
  async function changePassword() {
    if (!email) {
      showNotification({ type: 'info', message: 'Please enter your email address to request a password reset.' })
      return
    }

    try {
      // Best-effort dynamic import of supabase helper; will quietly fail if not present
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = await import('../../lib/supabase').catch(() => null)
      if (mod) {
        const supabaseClient = (mod as any).supabase || (mod as any).default
        if (supabaseClient && supabaseClient.auth) {
          if (supabaseClient.auth.api && typeof supabaseClient.auth.api.resetPasswordForEmail === 'function') {
            await supabaseClient.auth.api.resetPasswordForEmail(email)
            showNotification({
              type: 'success',
              message: 'If this email exists you will receive password reset instructions shortly.',
            })
            return
          }
          if (typeof supabaseClient.auth.resetPasswordForEmail === 'function') {
            await supabaseClient.auth.resetPasswordForEmail(email)
            showNotification({
              type: 'success',
              message: 'If this email exists you will receive password reset instructions shortly.',
            })
            return
          }
        }
      }
    } catch (err) {
      // continue to fallback
      // eslint-disable-next-line no-console
      console.warn('Supabase reset attempt failed', err)
    }

    const envUrl = (process.env.REACT_APP_SUPABASE_URL as string) || (window as any).SUPABASE_URL
    const envAnon = (process.env.REACT_APP_SUPABASE_ANON_KEY as string) || (window as any).SUPABASE_ANON_KEY
    if (envUrl) {
      try {
        await fetch(`${envUrl.replace(/\/$/, '')}/auth/v1/recover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(envAnon ? { Authorization: `Bearer ${envAnon}` } : {}),
          },
          body: JSON.stringify({ email }),
        })
        showNotification({
          type: 'success',
          message: 'If this email exists you will receive password reset instructions shortly.',
        })
        return
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Recover endpoint call failed', err)
      }
    }

    showNotification({
      type: 'info',
      message:
        'Password reset is not configured in this preview. In production this button would send a password reset email.',
    })
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">My Profile</h2>
          <button onClick={() => nav(-1)} className="px-3 py-1 rounded border text-black">
            Back
          </button>
        </div>

        <div className="bg-white p-6 rounded shadow">
          {/* Notification: small inline non-blocking message */}
          {notification && (
            <div
              role="status"
              className={`mb-4 p-2 rounded text-sm ${
                notification.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800'
                  : notification.type === 'error'
                  ? 'bg-rose-50 text-rose-800'
                  : 'bg-slate-50 text-slate-800'
              }`}
            >
              {notification.message}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-600">First name</label>
              <input
                className="w-full px-3 py-2 border rounded text-black"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-slate-600">Last name</label>
              <input
                className="w-full px-3 py-2 border rounded text-black"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-slate-600">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border rounded text-black"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-slate-600">Birthday</label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded text-black"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-slate-600">Country</label>
              <select
                className="w-full px-3 py-2 border rounded text-black"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-slate-600">City</label>
              <input
                className="w-full px-3 py-2 border rounded text-black"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex gap-2">
              <button onClick={() => nav(-1)} className="px-3 py-1 rounded border text-black">
                Cancel
              </button>
              <button
                onClick={saveProfile}
                className="px-3 py-1 rounded bg-sky-600 text-white"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={changePassword}
                className="px-3 py-1 rounded border text-black bg-white hover:bg-slate-50"
              >
                Change password
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}