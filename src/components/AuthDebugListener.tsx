/**
 * AuthDebugListener.tsx
 *
 * Small utility component that listens to Supabase auth state changes and
 * performs debugAuth calls after sign-in / sign-out. It also triggers a
 * debugAuth when the user navigates to the Dashboard route.
 *
 * Mount this component near the app root while debugging. Remove it when no
 * longer needed.
 */

import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { supabase } from '../lib/supabase'
import { debugAuth } from '../lib/debugAuth'

/**
 * AuthDebugListener
 *
 * React component that registers a Supabase auth state change listener and
 * observes route changes to call debugAuth at appropriate times.
 *
 * @returns null (no UI)
 */
export default function AuthDebugListener(): JSX.Element | null {
  const location = useLocation()
  const mountedRef = useRef(false)
  const lastPathRef = useRef('')

  useEffect(() => {
    // Register auth state change listener once.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
      // Try to be explicit for common events.
      // Note: Postgres auth may emit different event strings depending on the client.
      // We call debugAuth for any auth-change and include the raw event by querying state.
      void debugAuth('after-auth-change')
    })

    return () => {
      // cleanup
      sub?.subscription?.unsubscribe?.()
    }
    // empty deps: mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Avoid calling on the initial app mount unless we explicitly want that.
    if (!mountedRef.current) {
      mountedRef.current = true
      lastPathRef.current = location.pathname
      return
    }

    // If user navigated to /dashboard, run the dashboard-specific check.
    if (location.pathname === '/dashboard' && lastPathRef.current !== '/dashboard') {
      void debugAuth('Dashboard mount')
    }

    lastPathRef.current = location.pathname
  }, [location.pathname])

  return null
}