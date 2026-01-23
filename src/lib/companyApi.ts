/**
 * companyApi.ts
 *
 * Small helper to resolve the current user's company id.
 *
 * Provides a single exported helper used by components that need to operate
 * under the calling user's company context.
 */

import { supabase } from './supabase'

/**
 * getMyCompanyId
 *
 * Return the company id owned by the authenticated user (owner_auth_user_id).
 *
 * @param authUserId The authenticated user's id (auth.user.id)
 * @returns company id string or throws when not found
 */
export async function getMyCompanyId(authUserId: string): Promise<string> {
  const { data, error } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_auth_user_id', authUserId)
    .single()

  if (error || !data) {
    throw new Error('User has no company')
  }

  return data.id
}
