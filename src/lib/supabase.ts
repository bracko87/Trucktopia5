/**
 * supabase.ts
 *
 * SIDER/IFRAME SAFE AUTH
 * - In some preview/iframe environments, browser Tracking Prevention blocks localStorage.
 * - When Supabase auth can't write to storage, the session can "vanish" shortly after login.
 *
 * Fix:
 * - Detect whether localStorage is writable.
 * - If NOT writable: run Supabase auth in-memory only (persistSession=false).
 *   This keeps the user logged in while the tab is open (no refresh persistence).
 * - If writable: use normal persisted auth.
 *
 * Also:
 * - Export hardSignOut() (your build currently expects it).
 * - Keep supabaseFetch() using the full SUPABASE_URL (never relative /rest/v1).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/* ---------------------------------- */
/* Environment                         */
/* ---------------------------------- */

const SUPABASE_URL =
  (typeof process !== 'undefined' && (process.env?.REACT_APP_SUPABASE_URL as string)) ||
  (globalThis as any)?.SUPABASE_URL ||
  'https://iiunrkztuhhbdgxzqqgq.supabase.co'

const SUPABASE_ANON_KEY =
  (typeof process !== 'undefined' && (process.env?.REACT_APP_SUPABASE_ANON_KEY as string)) ||
  (globalThis as any)?.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

/* ---------------------------------- */
/* Storage detection + in-memory store */
/* ---------------------------------- */

function canUseLocalStorage(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const k = '__sb_test__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      const v = store.get(key)
      return v === undefined ? null : v
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  } as Storage
}

const LOCAL_OK = canUseLocalStorage()
const memoryStorage = createMemoryStorage()

/* ---------------------------------- */
/* Client (SINGLETON)                  */
/* ---------------------------------- */

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // If localStorage is blocked, do NOT attempt to persist at all.
    // This prevents the "login works then disappears" behavior in iframes.
    persistSession: LOCAL_OK,
    storage: LOCAL_OK ? (typeof window !== 'undefined' ? window.localStorage : memoryStorage) : memoryStorage,

    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

/* ---------------------------------- */
/* Helpers                             */
/* ---------------------------------- */

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data?.user ?? null
}

/**
 * hardSignOut
 * - Signs out via Supabase
 * - Clears Supabase keys from localStorage (when accessible)
 * - Clears in-memory storage
 * - Optionally reloads to reset app state
 */
export async function hardSignOut(opts: { reload?: boolean } = {}) {
  const reload = opts.reload !== false

  try {
    await supabase.auth.signOut()
  } catch {
    // ignore
  }

  // Clear in-memory storage always
  try {
    memoryStorage.clear()
  } catch {
    // ignore
  }

  // Clear localStorage keys only if it's accessible
  if (LOCAL_OK) {
    try {
      const projectRef = 'iiunrkztuhhbdgxzqqgq'
      for (const k of Object.keys(window.localStorage)) {
        // common supabase key prefixes: sb-<ref>-auth-token, etc.
        if (k.startsWith('sb-') || k.includes(projectRef)) {
          try {
            window.localStorage.removeItem(k)
          } catch {
            // ignore per-key failures
          }
        }
      }
    } catch {
      // ignore
    }
  }

  if (reload && typeof window !== 'undefined') {
    // With HashRouter, this ensures you land on login after reload
    window.location.hash = '#/login'
    window.location.reload()
  }
}

/**
 * supabaseFetch
 * Minimal REST helper that attaches the current live access token when present.
 * NOTE: Always uses SUPABASE_URL (never relative fetch).
 */
export async function supabaseFetch(path: string, opts: RequestInit = {}) {
  const url = `${SUPABASE_URL}${path.startsWith('/') ? path : `/${path}`}`

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const accessToken = (session as any)?.access_token

  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    accept: 'application/json',
    ...(opts.headers as any),
  }

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'

  const res = await fetch(url, { ...opts, headers })
  const text = await res.text()

  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  return { status: res.status, data }
}

export async function getTable(table: string, query = '?select=*') {
  return supabaseFetch(`/rest/v1/${table}${query}`, { method: 'GET' })
}

export async function insertRow(table: string, row: object) {
  return supabaseFetch(`/rest/v1/${table}`, {
    method: 'POST',
    body: JSON.stringify(row),
    headers: {
      Prefer: 'return=representation',
    },
  })
}

export async function getHiredStaffDirect() {
  const { data, error } = await supabase
    .from('hired_staff')
    .select(
      `
      id,
      first_name,
      last_name,
      age,
      country_code,
      job_category,
      experience,
      hired_at,
      activity_id,
      skill1:skills_master!hired_staff_skill1_id_fkey ( name, description ),
      skill2:skills_master!hired_staff_skill2_id_fkey ( name, description ),
      skill3:skills_master!hired_staff_skill3_id_fkey ( name, description )
    `
    )

  if (error) {
    // eslint-disable-next-line no-console
    console.error('getHiredStaffDirect error:', error)
    throw error
  }

  return data
}
