/**
 * supabaseController.ts
 *
 * Parallel controller wrapper for src/lib/supabase.ts.
 *
 * Responsibilities:
 * - Act as a safe indirection layer for new flows.
 * - Re-export functions from src/lib/supabase so new code can import from
 *   the controller without directly touching the core file.
 *
 * Usage:
 * - New code should import from './supabaseController' instead of './supabase'
 *   when adding new flows. This reduces risk of breaking existing consumers.
 */

import * as core from './supabase'

/**
 * getTable
 *
 * Forwarding wrapper for getTable.
 *
 * @param table - table name or alias
 * @param query - optional query string
 */
export async function getTable(table: string, query = '?select=*') {
  return core.getTable(table, query)
}

/**
 * insertRow
 *
 * Forwarding wrapper for insertRow.
 *
 * @param table - table name
 * @param row - object to insert
 */
export async function insertRow(table: string, row: object) {
  return core.insertRow(table, row)
}

/**
 * authSignUp
 *
 * Forward to core authSignUp
 */
export async function authSignUp(email: string, password: string, data?: Record<string, any>) {
  return core.authSignUp(email, password, data)
}

/**
 * authSignIn
 *
 * Forward to core authSignIn
 */
export async function authSignIn(email: string, password: string) {
  return core.authSignIn(email, password)
}

/**
 * getCurrentUser
 *
 * Forward to core getCurrentUser
 */
export async function getCurrentUser() {
  return core.getCurrentUser()
}

/**
 * supabaseFetch
 *
 * Re-export the low-level fetch helper for advanced uses.
 */
export const supabaseFetch = core.supabaseFetch

/**
 * Token helpers
 *
 * Expose token helpers via the controller so callers can centralize usage.
 */
export const setAuthToken = core.setAuthToken
export const clearAuthToken = core.clearAuthToken
export const getAuthToken = core.getAuthToken

// Re-export everything for convenience
export default {
  ...core,
}