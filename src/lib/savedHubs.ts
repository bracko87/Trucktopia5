/**
 * savedHubs.ts
 *
 * Helpers for server-backed saved_hubs table.
 *
 * Provides:
 * - fetchSavedHub(args) -> fetch one saved hub for a user or a company
 * - upsertSavedHub(payload) -> create or update a saved hub row
 * - deleteSavedHub(id) -> delete a saved hub row by id
 *
 * These helpers use the existing low-level REST helpers so requests behave
 * consistently with the rest of the app and respect RLS policies.
 */

import { getTable, insertRow, supabaseFetch } from './supabase'

/**
 * FetchSavedHubArgs
 *
 * Either userId (public.users.id) OR companyId (companies.id) must be supplied.
 */
export type FetchSavedHubArgs =
  | { userId: string; companyId?: never }
  | { companyId: string; userId?: never }

/**
 * SavedHubRow
 *
 * Minimal shape for a saved_hubs row returned by the DB.
 */
export interface SavedHubRow {
  id: string
  user_id?: string | null
  company_id?: string | null
  country?: string | null
  city?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/**
 * fetchSavedHub
 *
 * Retrieve a single saved_hubs row for the provided user or company id.
 *
 * @param args - object with either userId or companyId
 * @returns SavedHubRow | null
 * @throws when the underlying request returns an error
 */
export async function fetchSavedHub(args: FetchSavedHubArgs): Promise<SavedHubRow | null> {
  const where =
    'userId' in args
      ? `?select=*&user_id=eq.${encodeURIComponent(args.userId)}&limit=1`
      : `?select=*&company_id=eq.${encodeURIComponent((args as any).companyId)}&limit=1`

  const res = await getTable('saved_hubs', where)
  if (!res) throw new Error('fetchSavedHub: unexpected empty response')
  if (res.error) throw res.error
  const rows = Array.isArray(res.data) ? res.data : []
  return rows[0] ?? null
}

/**
 * UpsertSavedHubArgs
 *
 * When id is provided the function will PATCH the existing row.
 * Otherwise it will INSERT a new row and return the created record.
 */
export type UpsertSavedHubArgs = {
  id?: string
  user_id?: string | null
  company_id?: string | null
  country: string | null
  city: string | null
}

/**
 * upsertSavedHub
 *
 * Create or update a saved_hubs row.
 *
 * - If payload.id is provided -> PATCH /rest/v1/saved_hubs?id=eq.<id>
 * - Else -> INSERT a new row (user_id or company_id must be provided)
 *
 * @param payload - UpsertSavedHubArgs
 * @returns SavedHubRow
 * @throws on validation error or remote request error
 */
export async function upsertSavedHub(payload: UpsertSavedHubArgs): Promise<SavedHubRow> {
  if (!payload.id && !payload.user_id && !payload.company_id) {
    throw new Error('upsertSavedHub: must provide id or user_id or company_id')
  }

  if (payload.id) {
    // PATCH existing row via REST endpoint to leverage Prefer: return=representation
    const body = {
      country: payload.country,
      city: payload.city,
      updated_at: new Date().toISOString(),
    }
    const patchRes = await supabaseFetch(`/rest/v1/saved_hubs?id=eq.${encodeURIComponent(payload.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    })

    if (!patchRes || patchRes.error) {
      throw patchRes?.error ?? new Error('upsertSavedHub: patch failed')
    }
    const patched = Array.isArray(patchRes.data) ? patchRes.data[0] : patchRes.data
    return patched as SavedHubRow
  } else {
    // Insert new row using insertRow helper
    const insertPayload: any = {
      user_id: payload.user_id ?? null,
      company_id: payload.company_id ?? null,
      country: payload.country,
      city: payload.city,
    }
    const insertRes = await insertRow('saved_hubs', insertPayload)
    if (!insertRes || insertRes.error) {
      throw insertRes?.error ?? new Error('upsertSavedHub: insert failed')
    }
    const inserted = Array.isArray(insertRes.data) ? insertRes.data[0] : insertRes.data
    return inserted as SavedHubRow
  }
}

/**
 * deleteSavedHub
 *
 * Delete a saved_hubs row by id.
 *
 * @param id - saved_hubs.id
 * @returns true when deletion succeeded
 * @throws on remote request error
 */
export async function deleteSavedHub(id: string): Promise<boolean> {
  const res = await supabaseFetch(`/rest/v1/saved_hubs?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  })

  if (!res) throw new Error('deleteSavedHub: empty response')
  if (res.error) throw res.error
  return true
}