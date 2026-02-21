/**
 * rlsHelpers.ts
 *
 * Small supabase helpers to ensure inserts include the auth fields required by
 * Row Level Security policies (auth_user_id / owner_id / owner_auth_user_id).
 *
 * These helpers call supabase.auth.getUser() and throw if there is no active
 * session to avoid silent 403s from RLS checks.
 */

import { supabase } from './supabase'

/**
 * Insert a users row while ensuring auth_user_id is set to the current auth uid.
 *
 * @param payload - object with user fields (email, name, company_id, ...)
 * @returns the inserted row(s) or throws on error
 */
export async function insertUserProfile(payload: Record<string, any>) {
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) throw new Error('Not authenticated')

  const toInsert = {
    ...payload,
    auth_user_id: user.id, // REQUIRED by your RLS WITH CHECK
  }

  const res = await supabase.from('users').insert(toInsert).select()
  if (res.error) throw res.error
  return res.data
}

/**
 * Insert a company while ensuring owner_id (or owner_auth_user_id) is set to
 * the current auth uid as required by your RLS policies.
 *
 * @param payload - object with company fields (name, hub_city, hub_country, ...)
 * @param useOwnerAuthUserId - if true, also set owner_auth_user_id (optional)
 * @returns the inserted row(s) or throws on error
 */
export async function insertCompanyWithOwner(
  payload: Record<string, any>,
  useOwnerAuthUserId = false
) {
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) throw new Error('Not authenticated')

  const toInsert: Record<string, any> = {
    ...payload,
    owner_id: user.id, // REQUIRED by your RLS WITH CHECK
  }

  if (useOwnerAuthUserId) {
    toInsert.owner_auth_user_id = user.id
  }

  const res = await supabase.from('companies').insert(toInsert).select()
  if (res.error) throw res.error
  return res.data
}