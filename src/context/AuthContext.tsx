/**
 * AuthContext.tsx
 *
 * Provides a minimal in-memory authentication context using Supabase REST auth endpoints.
 *
 * Important:
 * - This context stores session/token in memory (no localStorage), so page reload clears session.
 * - For persistent sessions, integrate supabase-js or server cookie approach.
 */

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { authSignUp, authSignIn } from '../lib/supabase'
import { useNavigate } from 'react-router'

/**
 * User
 *
 * Minimal user interface returned by Supabase auth responses.
 */
export interface User {
  id: string
  email?: string
}

/**
 * AuthContextValue
 *
 * Describes the context state and actions.
 */
interface AuthContextValue {
  user: User | null
  accessToken: string | null
  signUp: (email: string, password: string, username?: string) => Promise<any>
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => void
}

/**
 * AuthContext
 *
 * React context to hold authentication state for the app.
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * AuthProviderProps
 */
interface AuthProviderProps {
  children: ReactNode
}

/**
 * AuthProvider
 *
 * Provides auth state and actions to the subtree.
 *
 * @param children - application children
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const navigate = useNavigate()

  /**
   * signUp
   *
   * Register user with Supabase and set local in-memory session.
   */
  async function signUp(email: string, password: string, username?: string) {
    try {
      const res = await authSignUp(email, password, { username })
      if (res && (res.status === 200 || res.status === 201)) {
        // Supabase returns user info sometimes in res.data.user
        const maybeUser = (res.data && (res.data.user || res.data)) || null
        if (maybeUser && maybeUser.id) {
          setUser({ id: maybeUser.id, email: maybeUser.email })
        }
        // SignUp normally sends confirmation flow; for this simple demo redirect to create-company
        return res
      }
      return res
    } catch (err: any) {
      // Network or unexpected error - return a consistent shape
      // eslint-disable-next-line no-console
      console.error('signUp error', err)
      return { status: 0, error: err?.message || 'Network error' }
    }
  }

  /**
   * signIn
   *
   * Authenticate user and store token & basic user in-memory.
   */
  async function signIn(email: string, password: string) {
    try {
      const res = await authSignIn(email, password)
      if (res && res.status === 200 && res.data) {
        const session = res.data
        const token = session.access_token || session.accessToken || null
        const userObj = session.user || session
        setAccessToken(token)
        if (userObj && userObj.id) setUser({ id: userObj.id, email: userObj.email })
        return res
      }
      return res
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('signIn error', err)
      return { status: 0, error: err?.message || 'Network error' }
    }
  }

  /**
   * signOut
   *
   * Clear in-memory session.
   */
  function signOut() {
    setUser(null)
    setAccessToken(null)
    navigate('/')
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth
 *
 * Hook to access AuthContext.
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
