/**
 * userApi.ts
 *
 * Small user-related API helpers.
 *
 * Provides lightweight helpers that wrap the existing supabase REST helper
 * (getTable) to return typed, focused values used across the app.
 */

import { getTable } from './supabase'

/**
 * fetchUserCompanyId
 *
 * Retrieve the company_id for a given public.users.id using the
 * existing getTable helper to avoid reimplementing auth/REST logic.
 *
 * @param userId - public.users.id (UUID)
 * @returns company_id string or null when not found
 */
export async function fetchUserCompanyId(userId: string): Promise<string | null> {
  const res: any = await getTable(
    'users',
    `?select=company_id&id=eq.${encodeURIComponent(userId)}&limit=1`
  )

  const row = Array.isArray(res?.data) ? res.data[0] : null
  return row?.company_id ?? null
}