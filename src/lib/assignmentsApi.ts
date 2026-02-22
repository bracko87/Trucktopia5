/**
 * assignmentsApi.ts
 *
 * Small helper utilities for safely updating job_assignments via the Supabase
 * PostgREST API. This module centralizes the correct PATCH semantics to avoid
 * PGRST116 / 406 problems (do not use object mode; prefer return=minimal when
 * you don't need a representation).
 */

import { supabase } from './supabase'

/**
 * API base for direct REST requests.
 * Keep in sync with other modules that call the public REST API.
 */
export const API_BASE = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'

/**
 * Public anon key (kept here for local dev / preview usage).
 * In production prefer server-side or environment-injected keys.
 */
export const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

/**
 * updateAssignmentStatus
 *
 * Patch a job_assignments row by id. Uses Prefer: return=minimal which avoids
 * PostgREST object/representation coercion issues that can produce 406/415 errors.
 *
 * @param assignmentId - job_assignments.id (NOT job_offer.id)
 * @param status - new status to write (e.g. 'TO_PICKUP', 'assigned', 'cancelled')
 * @throws Error on missing session, missing assignmentId or network/server errors
 */
export async function updateAssignmentStatus(assignmentId: string, status: string): Promise<void> {
  if (!assignmentId) throw new Error('Missing assignmentId')

  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token
  if (!token) throw new Error('Not logged in')

  const url = `${API_BASE}/rest/v1/job_assignments?id=eq.${encodeURIComponent(assignmentId)}`

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal', // important: avoid object mode coercion issues
    },
    body: JSON.stringify({ status }),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(txt || `Failed to update assignment (${res.status})`)
  }
}