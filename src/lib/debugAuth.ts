/**
 * debugAuth.ts
 *
 * Small helper that logs the current Supabase auth identity for debugging.
 * Intended for temporary use only - logs user id, email, session presence,
 * session role, and the access token prefix to the browser console.
 */

import { supabase } from './supabase'

/**
 * debugAuth
 *
 * Query Supabase auth state and print a compact debug summary to the console.
 *
 * @param label Short label to identify where the check was triggered.
 */
export async function debugAuth(label: string) {
  try {
    const userRes = await supabase.auth.getUser()
    const sessionRes = await supabase.auth.getSession()

    const user = (userRes as any)?.data?.user
    const session = (sessionRes as any)?.data?.session

    console.log(`[${label}] auth.user.id`, user?.id ?? 'null')
    console.log(`[${label}] auth.user.email`, user?.email ?? 'null')
    console.log(`[${label}] session exists`, Boolean(session))
    console.log(
      `[${label}] session role`,
      (session as any)?.user?.role ?? (session as any)?.role ?? 'n/a'
    )
    console.log(
      `[${label}] access_token prefix`,
      session?.access_token ? String(session.access_token).slice(0, 16) : 'n/a'
    )
  } catch (err) {
    // Keep debug helper safe: never throw during normal app flow.
    // eslint-disable-next-line no-console
    console.error(`[${label}] debugAuth error`, err)
  }
}