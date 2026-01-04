/**
 * supabase.ts
 *
 * Lightweight Supabase REST helper methods using fetch.
 *
 * Responsibilities:
 * - Manage in-memory and persisted user JWT so PostgREST can evaluate auth.uid()
 * - Provide supabaseFetch wrapper used by the app for REST/Gotrue calls
 * - Provide small helpers: authSignUp, authSignIn, getTable, insertRow
 *
 * Persistence:
 * - Stores a minimal session object in localStorage under the key SB_SESSION_KEY
 *
 * Note:
 * - Do NOT include secrets in source in production. This file is tailored to the demo iframe env.
 */

/**
 * Session storage key
 */
const SB_SESSION_KEY = 'sider.supabase.session'

/**
 * JSDoc type: StoredSession
 *
 * @property access_token - JWT for user session
 * @property refresh_token - refresh token (optional)
 * @property expires_at - epoch seconds when token expires (optional)
 */
type StoredSession = {
  access_token?: string | null
  refresh_token?: string | null
  expires_at?: number | null
}

/**
 * In-memory auth token used for authenticated REST calls.
 * - setAuthToken persists to localStorage.
 * - initAuthFromStorage will try to restore any persisted session on module load.
 */
let AUTH_TOKEN: string | null = null

/**
 * setAuthToken
 *
 * Store the provided JWT in-memory and persist a minimal session to localStorage.
 *
 * @param token - JWT access token string or null to clear
 * @param opts - optional refresh token/expires to persist with session
 */
export function setAuthToken(token: string | null, opts?: { refresh_token?: string | null; expires_at?: number | null }) {
  AUTH_TOKEN = token || null

  if (typeof window !== 'undefined') {
    if (token) {
      const session: StoredSession = {
        access_token: token,
        refresh_token: opts?.refresh_token || null,
        expires_at: opts?.expires_at || null,
      }
      try {
        window.localStorage.setItem(SB_SESSION_KEY, JSON.stringify(session))
      } catch {
        // ignore storage errors
      }
    } else {
      try {
        window.localStorage.removeItem(SB_SESSION_KEY)
      } catch {
        // ignore
      }
    }
  }
}

/**
 * clearAuthToken
 *
 * Clear the in-memory auth token and remove persisted session.
 */
export function clearAuthToken() {
  AUTH_TOKEN = null
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(SB_SESSION_KEY)
  } catch {
    // ignore
  }
}

/**
 * getAuthToken
 *
 * Return the current in-memory token.
 *
 * @returns token or null
 */
export function getAuthToken() {
  return AUTH_TOKEN
}

/**
 * initAuthFromStorage
 *
 * Try to read persisted session from localStorage and set AUTH_TOKEN.
 * This runs on module init so components can rely on a restored token if present.
 */
function initAuthFromStorage() {
  try {
    if (typeof window === 'undefined') return
    const v = window.localStorage.getItem(SB_SESSION_KEY)
    if (!v) return
    const parsed: StoredSession = JSON.parse(v)
    if (parsed && parsed.access_token) AUTH_TOKEN = parsed.access_token
  } catch {
    // ignore parse errors
  }
}

/**
 * Environment helpers for base URL and anon key
 */
function getEnv(nodeKey: string, globalKey: string, fallback: string) {
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

let SUPABASE_URL = getEnv('REACT_APP_SUPABASE_URL', 'SUPABASE_URL', 'https://iiunrkztuhhbdgxzqqgq.supabase.co')
const SUPABASE_ANON_KEY = getEnv('REACT_APP_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM')

function normalizeUrl(url: string) {
  let u = String(url || '').trim()
  if (!u) return u
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  if (u.endsWith('/')) u = u.slice(0, -1)
  return u
}

SUPABASE_URL = normalizeUrl(SUPABASE_URL)

/**
 * aliasTableName
 *
 * Map common short aliases to actual table names used in the DB.
 * Helps avoid 404s caused by legacy shorthand endpoints.
 *
 * @param table - provided table name or alias
 * @returns canonical table name for REST path
 */
function aliasTableName(table: string) {
  const t = (table || '').trim()
  if (!t) return t
  const map: Record<string, string> = {
    trucks: 'user_trucks',
    truck: 'user_trucks',
    jobs: 'job_offers',
    job: 'job_offers',
    leases: 'user_leases',
    lease: 'user_leases',
    truck_models: 'truck_models',
    users: 'users',
    companies: 'companies',
    hubs: 'hubs',
  }
  return map[t] || t
}

/**
 * supabaseFetch
 *
 * Generic helper to call Supabase REST/Gotrue endpoints.
 *
 * - Adds apikey header (anon key) always.
 * - Adds Authorization: Bearer <JWT> ONLY when a real user JWT is available.
 * - Returns a structured { status, data, error? } object and never throws.
 *
 * @param path - REST path after base URL (e.g. '/rest/v1/cities' or '/auth/v1/token')
 * @param opts - fetch init options
 */
export async function supabaseFetch(path: string, opts: RequestInit = {}) {
  try {
    const p = path.startsWith('/') ? path : `/${path}`
    const url = `${SUPABASE_URL}${p}`

    const headers: Record<string, string> = {
      accept: 'application/json',
      apikey: SUPABASE_ANON_KEY,
      ...((opts.headers as Record<string, string>) || {}),
    }

    // Attach Authorization header only if we have a real user token.
    if (AUTH_TOKEN) {
      headers.Authorization = `Bearer ${AUTH_TOKEN}`
    }

    if (!headers['Content-Type'] && opts.body) headers['Content-Type'] = 'application/json'

    const res = await fetch(url, {
      ...opts,
      headers,
    })

    const text = await res.text()
    try {
      const parsed = text ? JSON.parse(text) : null
      return { status: res.status, data: parsed }
    } catch (err) {
      return { status: res.status, data: text }
    }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('supabaseFetch network error:', err)
    return { status: 0, data: null, error: err?.message || 'Network error' }
  }
}

/**
 * Helper: authSignUp
 *
 * Sign up a new user via GoTrue endpoint.
 *
 * @param email - user email
 * @param password - user password
 * @param data - optional user metadata
 */
export async function authSignUp(email: string, password: string, data?: Record<string, any>) {
  return supabaseFetch('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, data }),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Helper: authSignIn
 *
 * Sign in using password grant. Returns session-like object when successful:
 * { access_token, refresh_token, user }
 *
 * @param email - user email
 * @param password - user password
 */
export async function authSignIn(email: string, password: string) {
  return supabaseFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * getTable
 *
 * Fetch rows from a given table using Supabase REST API.
 *
 * @param table - table name (alias allowed)
 * @param query - optional query string (e.g. '?select=*')
 */
export async function getTable(table: string, query = '?select=*') {
  const canonical = aliasTableName(table)
  return supabaseFetch(`/rest/v1/${canonical}${query}`, { method: 'GET' })
}

/**
 * insertRow
 *
 * Insert a row into a table.
 *
 * @param table - table name (alias allowed)
 * @param row - object to insert
 */
export async function insertRow(table: string, row: object) {
  const canonical = aliasTableName(table)
  return supabaseFetch(`/rest/v1/${canonical}`, {
    method: 'POST',
    body: JSON.stringify(row),
    headers: { Prefer: 'return=representation', 'Content-Type': 'application/json' },
  })
}

/**
 * getCurrentUser
 *
 * Request the currently authenticated user from GoTrue endpoint.
 * Requires a valid user JWT set via setAuthToken.
 */
export async function getCurrentUser() {
  return supabaseFetch('/auth/v1/user', { method: 'GET' })
}

/**
 * init module: attempt to restore persisted session
 */
initAuthFromStorage()