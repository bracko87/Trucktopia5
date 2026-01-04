/**
 * bootstrap.ts
 *
 * Helpers to bootstrap minimal DB rows for a newly authenticated user.
 *
 * Responsibilities:
 * - ensureUserProfile(session): idempotently create a public.users row for the authenticated user
 * - createCompany(userId, session): idempotently create a companies row owned by the user
 *
 * These functions call the PostgREST endpoints directly (fetch) to avoid accidental
 * colon-style path construction (e.g. users:1) that PostgREST rejects before the insert.
 */

const DEFAULT_SUPABASE_URL = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

/**
 * getEnvValue
 *
 * Resolve an environment-like value from process.env or globalThis with a fallback.
 *
 * @param nodeKey - environment key name
 * @param globalKey - globalThis key name
 * @param fallback - fallback value
 * @returns resolved string value
 */
function getEnvValue(nodeKey: string, globalKey: string, fallback: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc: any = typeof process !== 'undefined' ? (process as any) : undefined
    if (proc && proc.env && (proc.env[nodeKey] || proc.env[globalKey])) {
      return proc.env[nodeKey] || proc.env[globalKey]
    }
  } catch {
    // ignore
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any
  if (g && (g[globalKey] || g[nodeKey])) {
    return g[globalKey] || g[nodeKey]
  }

  return fallback
}

/**
 * normalizeUrl
 *
 * Ensure base url has protocol and no trailing slash.
 *
 * @param url - raw url
 * @returns normalized url
 */
function normalizeUrl(url: string) {
  let u = String(url || '').trim()
  if (!u) return u
  if (!/^https?:\\/\\//i.test(u)) {
    u = `https://${u}`
  }
  if (u.endsWith('/')) u = u.slice(0, -1)
  return u
}

const SUPABASE_URL = normalizeUrl(getEnvValue('REACT_APP_SUPABASE_URL', 'SUPABASE_URL', DEFAULT_SUPABASE_URL))
const SUPABASE_ANON_KEY = getEnvValue('REACT_APP_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', DEFAULT_SUPABASE_ANON_KEY)

/**
 * ensureUserProfile
 *
 * Ensure a users row exists for the provided session. This is idempotent.
 *
 * Implementation notes:
 * - Uses direct fetch to PostgREST to avoid accidental colon-based URL construction (users:1).
 * - First checks for an existing row by auth_user_id, then inserts if missing.
 *
 * @param session - Supabase session object (must include access_token and user.{id,email})
 * @returns created or existing user row, or null on failure
 */
export async function ensureUserProfile(session: any): Promise<any | null> {
  if (!session || !session.user || !(session.access_token || session.accessToken)) {
    console.error('ensureUserProfile: invalid session')
    return null
  }

  // Support different session shapes
  const access_token = session.access_token || session.accessToken
  const user = session.user || session

  if (!user || !user.id) {
    console.error('ensureUserProfile: missing user id in session')
    return null
  }

  try {
    // 1. Check if user exists
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?auth_user_id=eq.${encodeURIComponent(user.id)}&select=id`,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${access_token}`,
        },
      }
    )

    if (!checkRes.ok) {
      console.error('USER CHECK FAILED', await checkRes.text())
      return null
    }

    const existing = await checkRes.json()
    if (Array.isArray(existing) && existing.length > 0) {
      return existing[0]
    }

    // 2. Insert user (NO COLON, NO ID IN URL)
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        email: user.email,
        auth_user_id: user.id,
      }),
    })

    if (!insertRes.ok) {
      console.error('USER INSERT FAILED', await insertRes.text())
      return null
    }

    const inserted = await insertRes.json()
    return Array.isArray(inserted) ? inserted[0] : inserted
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('ensureUserProfile error', err)
    return null
  }
}

/**
 * createCompany
 *
 * Ensure a companies row exists with owner_id = userId. Idempotent.
 *
 * Implementation notes:
 * - Uses direct fetch to PostgREST and checks for existing company before inserting.
 *
 * @param userId - user UUID (owner_id)
 * @param session - Supabase session object (must include access_token and user.email)
 * @returns created or existing company row, or null on failure
 */
export async function createCompany(userId: string, session: any): Promise<any | null> {
  if (!userId || !session || !(session.access_token || session.accessToken)) {
    console.error('createCompany: invalid args')
    return null
  }

  const access_token = session.access_token || session.accessToken

  try {
    // 1. Check existing company for owner_id
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/companies?owner_id=eq.${encodeURIComponent(userId)}&select=id`,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${access_token}`,
        },
      }
    )

    if (!checkRes.ok) {
      console.error('COMPANY CHECK FAILED', await checkRes.text())
      return null
    }

    const existing = await checkRes.json()
    if (Array.isArray(existing) && existing.length > 0) {
      return existing[0]
    }

    // 2. Insert company
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        owner_id: userId,
        email: session.user?.email || null,
      }),
    })

    if (!insertRes.ok) {
      console.error('COMPANY INSERT FAILED', await insertRes.text())
      return null
    }

    const inserted = await insertRes.json()
    return Array.isArray(inserted) ? inserted[0] : inserted
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('createCompany error', err)
    return null
  }
}