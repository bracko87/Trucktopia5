/**
 * users.ts
 *
 * Thin re-exports / adapters for user-related helpers coming from the legacy db.ts.
 * This allows gradually moving user logic into the modular structure while keeping
 * the existing implementation intact.
 */

import type { UserRow } from '../../db'
import { insertUserProfile, ensureUserProfile } from '../../db'

/**
 * createUserProfile
 *
 * Wrapper around the legacy insertUserProfile to provide a clear module surface.
 *
 * @param user - UserRow payload
 */
export async function createUserProfile(user: UserRow) {
  return insertUserProfile(user)
}

/**
 * ensureUserProfileAdapter
 *
 * Wrapper that forwards to the existing ensureUserProfile implementation.
 *
 * @param authUserId - auth UID
 * @param email - user email
 * @param username - optional display name
 */
export async function ensureUserProfileAdapter(authUserId: string, email: string, username?: string) {
  return ensureUserProfile(authUserId, email, username)
}

// Re-export types for callers
export type { UserRow }