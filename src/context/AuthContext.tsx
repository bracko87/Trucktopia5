/**
 * AuthContext.tsx (STABLE BASE)
 *
 * Goal:
 * - Stop the "login works then disappears after 1 second" loop.
 * - AuthContext should ONLY reflect Supabase Auth session state.
 * - NO database calls here (no ensureUserProfile).
 *
 * Why:
 * - If DB calls fail (RLS 403), your auth state gets cleared/mismatched and routing flips.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'

export type User = {
  id: string
  email?: string | null
}

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!mounted) return

        const sessionUser = data?.session?.user ?? null
        if (error || !sessionUser) {
          setUser(null)
          setLoading(false)
          return
        }

        setUser({ id: sessionUser.id, email: sessionUser.email })
        setLoading(false)
      } catch (e) {
        if (!mounted) return
        setUser(null)
        setLoading(false)
      }
    }

    void init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      const sessionUser = session?.user ?? null
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null)
      setLoading(false)
    })

    return () => {
      mounted = false
      try {
        sub?.subscription?.unsubscribe?.()
      } catch {
        // ignore
      }
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user) return { error: error?.message ?? 'Login failed' }

    // Auth state will update via onAuthStateChange, but we can also navigate now.
    navigate('/dashboard')
    return {}
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    return {}
  }

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } finally {
      setUser(null)
      navigate('/login')
    }
  }

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
