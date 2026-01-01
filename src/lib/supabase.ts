/**
 * supabase.ts
 *
 * Lightweight Supabase REST helper methods using fetch.
 *
 * NOTE:
 * - Provide SUPABASE_URL and SUPABASE_ANON_KEY via environment or from globalThis:
 *   window.SUPABASE_URL and window.SUPABASE_ANON_KEY (recommended for this iframe/demo env).
 * - This file adds robust fetch normalization and error handling to avoid uncaught network errors.
 */

/**
 * getEnv
 *
 * Safely reads environment-like variables from Node's process.env (if available) or from globalThis.
 *
 * @param nodeKey - key to check in process.env (e.g. 'REACT_APP_SUPABASE_URL')
 * @param globalKey - key to check on globalThis (e.g. 'SUPABASE_URL')
 * @param fallback - fallback value if none found
 * @returns resolved string value
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

let SUPABASE_URL = getEnv('REACT_APP_SUPABASE_URL', 'SUPABASE_URL', 'https://your-project.supabase.co')
const SUPABASE_ANON_KEY = getEnv('REACT_APP_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'your-anon-key')

/**
 * normalizeUrl
 *
 * Ensure the base URL includes protocol and does not end with a trailing slash.
 *
 * @param url - raw url to normalise
 * @returns normalised base url
 */
function normalizeUrl(url: string) {
  let u = String(url || '').trim()
  if (!u) return u
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`
  }
  // remove trailing slash for consistent concatenation
  if (u.endsWith('/')) u = u.slice(0, -1)
  return u
}

SUPABASE_URL = normalizeUrl(SUPABASE_URL)

/**
 * supabaseFetch
 *
 * Generic helper to call Supabase REST/Gotrue endpoints.
 *
 * Normalizes URLs, attaches anon key and returns a safe object even on network errors.
 *
 * @param path - REST path after base URL (e.g. '/rest/v1/cities' or '/auth/v1/signup')
 * @param opts - fetch options
 * @returns Promise resolving to { status: number, data: any, error?: string }
 */
export async function supabaseFetch(path: string, opts: RequestInit = {}) {
  try {
    // Ensure path begins with a slash
    const p = path.startsWith('/') ? path : `/${path}`
    const url = `${SUPABASE_URL}${p}`

    const headers: Record<string, string> = {
      accept: 'application/json',
      apikey: SUPABASE_ANON_KEY,
      ...((opts.headers as Record<string, string>) || {}),
    }

    // If calling REST insert/update and expecting representation, prefer return=representation
    if (!headers['Content-Type'] && opts.body) {
      headers['Content-Type'] = 'application/json'
    }

    const res = await fetch(url, {
      ...opts,
      headers,
    })

    const text = await res.text()
    try {
      const parsed = text ? JSON.parse(text) : null
      return { status: res.status, data: parsed }
    } catch (err) {
      // response is plain text
      return { status: res.status, data: text }
    }
  } catch (err: any) {
    // Network error or CORS blocked - return structured error instead of throwing
    // eslint-disable-next-line no-console
    console.error('supabaseFetch network error:', err)
    return { status: 0, data: null, error: err?.message || 'Network error' }
  }
}

/**
 * authSignUp
 *
 * Register a new user via Supabase GoTrue endpoint.
 *
 * @param email - user email
 * @param password - user password
 * @param data - optional user metadata
 */
export async function authSignUp(email: string, password: string, data?: Record<string, any>) {
  return supabaseFetch('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, data }),
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * authSignIn
 *
 * Sign in user via Supabase GoTrue endpoint.
 *
 * @param email - user email
 * @param password - user password
 */
export async function authSignIn(email: string, password: string) {
  return supabaseFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * getTable
 *
 * Fetch rows from a given table using Supabase REST API.
 *
 * @param table - table name (e.g. 'cities')
 * @param query - optional query string (e.g. '?select=*')
 */
export async function getTable(table: string, query = '?select=*') {
  return supabaseFetch(`/rest/v1/${table}${query}`, {
    method: 'GET',
  })
}

/**
 * insertRow
 *
 * Insert a row into a table.
 *
 * @param table - table name (e.g. 'companies')
 * @param row - object to insert
 */
export async function insertRow(table: string, row: object) {
  return supabaseFetch(`/rest/v1/${table}`, {
    method: 'POST',
    body: JSON.stringify(row),
    headers: {
      Prefer: 'return=representation',
      'Content-Type': 'application/json',
    },
  })
}
