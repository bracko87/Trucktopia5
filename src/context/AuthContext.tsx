/**
 * AuthContext.tsx
 *
 * Provide a simple AuthContext that:
 * - Performs signUp / signIn using the lightweight supabase helpers.
 * - Persists user JWT via setAuthToken so REST calls include Authorization.
 * - Ensures user profile via ensureUserProfile after we can detect auth user id.
 *
 * Notes:
 * - This file intentionally keeps UI/layout untouched and focuses on auth wiring.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  authSignUp,
  authSignIn,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  getCurrentUser,
} from '../lib/supabase'
import { ensureUserProfile } from '../lib/db'

/**
 * User type
 */
export type User = {
  id: string
  email?: string | null
}

/**
 * AuthContext shape
 */
export interface AuthContextType {
  user: User | null
  accessToken: string | null
  signUp: (email: string, password: string, username?: string) => Promise<any>
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => void
}

/**
 * Create context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * AuthProvider
 *
 * Wraps application and keeps token in-memory and persisted via lib/supabase.
 *
 * @param children - React children
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const navigate = useNavigate()

  /**
   * onInit
   *
   * Attempt to restore session from persistence and load current user.
   */
  useEffect(() => {
    async function init() {
      const token = getAuthToken()
      if (token) {
        // set access token state
        setAccessToken(token)
        // fetch current auth user from GoTrue /auth/v1/user
        const current = await getCurrentUser()
        if (current && (current.status === 200 || current.status === 201) && current.data) {
          const u = current.data
          // ensure profile exists server-side (RPC expects Authorization header)
          if (u?.id) {
            try {
              // ensureUserProfile will return the linked public.users row (and create/patch as needed).
              // This call expects Authorization header to be present so setAuthToken must have been called earlier.
              const ensured = await ensureUserProfile(u.id, u.email || null, (u.user_metadata && u.user_metadata.username) || null)
              if (ensured && ensured.data && ensured.data.id) {
                // Use the public.users.id as the app user id (game user id).
                setUser({ id: ensured.data.id, email: ensured.data.email || u.email })
              } else {
                // Fallback: if ensure didn't return expected data, fall back to auth id
                setUser({ id: u.id, email: u.email })
              }
            } catch {
              // on error, still expose auth id to keep UI usable
              setUser({ id: u.id, email: u.email })
            }
          }
        } else {
          // no valid session -> clear persisted token
          clearAuthToken()
          setAccessToken(null)
          setUser(null)
        }
      } else {
        // no token in memory; keep user null
        setUser(null)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * pickUserIdFromResponse
   *
   * Attempt to extract a user id from a variety of auth provider response shapes.
   *
   * @param raw - response data
   * @returns id string or null
   */
  function pickUserIdFromResponse(raw: any): string | null {
    if (!raw) return null
    // common shapes: { user: { id } }, { id }, { data: { user: { id } } }, { user_id }
    if (raw.user && (raw.user.id || raw.user.user_id)) return raw.user.id || raw.user.user_id || null
    if (raw.id) return raw.id
    if (raw.user_id) return raw.user_id
    if (raw.data) {
      if (raw.data.user && (raw.data.user.id || raw.data.user.user_id)) return raw.data.user.id || raw.data.user.user_id || null
      if (raw.data.id) return raw.data.id
      if (raw.data.user_id) return raw.data.user_id
    }
    // fallback: some providers return array or nested objects; try to find first id-like prop
    try {
      const json = JSON.parse(JSON.stringify(raw))
      const walk = (o: any): string | null => {
        if (!o || typeof o !== 'object') return null
        if (o.id && typeof o.id === 'string') return o.id
        if (o.user_id && typeof o.user_id === 'string') return o.user_id
        for (const k of Object.keys(o)) {
          const v = walk(o[k])
          if (v) return v
        }
        return null
      }
      return walk(json)
    } catch {
      return null
    }
  }

  /**
   * signUp
   *
   * Register user via authSignUp. If response includes access_token or user id,
   * store token and ensure profile linking by calling ensureUserProfile.
   *
   * @param email - user email
   * @param password - user password
   * @param username - optional username to pass through to profile RPC
   */
  async function signUp(email: string, password: string, username?: string) {
    const res = await authSignUp(email, password, { username })
    if (res && (res.status === 200 || res.status === 201)) {
      const raw = res.data || {}
      // extract access token if present
      const accessToken =
        raw.access_token ||
        raw.accessToken ||
        (raw?.session?.access_token) ||
        (raw?.data?.access_token) ||
        null

      // Try to extract a user id from the response even if no token is returned
      let authUserId = pickUserIdFromResponse(raw)

      // If we have a token but no user id, fetch current user
      if (!authUserId && accessToken) {
        try {
          setAuthToken(accessToken)
          setAccessToken(accessToken)
          const current = await getCurrentUser()
          if (current && (current.status === 200 || current.status === 201) && current.data) {
            authUserId = current.data.id || null
          }
        } catch {
          // ignore
        }
      }

      // If we extracted a user id, ensure user profile is linked on DB side and set app user to public.users.id
      if (authUserId) {
        try {
          // If we have a token, ensure it's set so ensureUserProfile can PATCH safely.
          if (accessToken) {
            setAuthToken(accessToken)
            setAccessToken(accessToken)
          }
          const ensured = await ensureUserProfile(authUserId, email, username ?? null)
          if (ensured && ensured.data && ensured.data.id) {
            setUser({ id: ensured.data.id, email })
          } else {
            // fallback: set auth id so UI is not blocked; create-company should wait for linked profile
            setUser({ id: authUserId, email })
          }
        } catch {
          // ignore ensure errors; still set user to auth id so UI can proceed, but linkage may be missing
          setUser({ id: authUserId, email })
        }
      } else if (accessToken) {
        // We have a token but couldn't extract id earlier; try to fetch user and set state
        try {
          setAuthToken(accessToken)
          setAccessToken(accessToken)
          const current = await getCurrentUser()
          if (current && (current.status === 200 || current.status === 201) && current.data) {
            const u = current.data
            if (u?.id) {
              try {
                const ensured = await ensureUserProfile(u.id, u.email || email, username ?? null)
                if (ensured && ensured.data && ensured.data.id) {
                  setUser({ id: ensured.data.id, email: ensured.data.email || u.email || email })
                } else {
                  setUser({ id: u.id, email: u.email || email })
                }
              } catch {
                setUser({ id: u.id, email: u.email || email })
              }
            }
          }
        } catch {
          // ignore
        }
      } else {
        // No token and no user id in response: best-effort fallback:
        // leave client without authenticated token. The registration likely requires email confirmation.
        // We still return the original response so the caller can proceed to company creation UI,
        // but company creation will require an authenticated & linked user.
      }
    }
    return res
  }

  /**
   * signIn
   *
   * Authenticate via password grant. On success store access token and ensure profile.
   *
   * @param email - user email
   * @param password - user password
   */
  async function signIn(email: string, password: string) {
    const res = await authSignIn(email, password)
    if (res && (res.status === 200 || res.status === 201) && res.data) {
      const session = res.data
      const token: string | null =
        session.access_token || session.accessToken || (session?.session?.access_token) || (session?.data?.access_token) || null
      let userObj = session.user || session || session?.user || session?.data || null

      if (token) {
        // set token early so subsequent ensureUserProfile PATCH requests are authorized
        setAuthToken(token)
        setAccessToken(token)

        // Best-effort: fetch current user when provider doesn't return user in response
        try {
          const current = await getCurrentUser()
          if (current && (current.status === 200 || current.status === 201) && current.data) {
            userObj = current.data
          }
        } catch {
          // ignore
        }
      }

      if (userObj && userObj.id) {
        try {
          // ensureUserProfile will return the linked public.users row (creating or patching as necessary)
          const ensured = await ensureUserProfile(userObj.id, userObj.email || email, null)
          if (ensured && ensured.data && ensured.data.id) {
            setUser({ id: ensured.data.id, email: ensured.data.email || userObj.email || email })
          } else {
            // fallback: set auth id
            setUser({ id: userObj.id, email: userObj.email || email })
          }
        } catch {
          // ignore
          setUser({ id: userObj.id, email: userObj.email || email })
        }
      }
    }
    return res
  }

  /**
   * signOut
   *
   * Clears state and persisted token.
   */
  function signOut() {
    setUser(null)
    setAccessToken(null)
    clearAuthToken()
    navigate('/')
  }

  const value = useMemo(
    () => ({
      user,
      accessToken,
      signUp,
      signIn,
      signOut,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, accessToken]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * useAuth
 *
 * Simple helper to access AuthContext
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}