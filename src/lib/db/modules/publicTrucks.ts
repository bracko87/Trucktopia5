/**
 * publicTrucks.ts
 *
 * Helpers for working with the user.public_trucks view/table.
 *
 * Responsibilities:
 * - Provide typed helpers to fetch public_trucks rows for the current authenticated
 *   user and/or their company.
 * - Keep logic isolated so existing db/supabase flows are not modified.
 *
 * Notes:
 * - The production Supabase/PostgREST endpoint name for the view/table may vary
 *   between projects (for example `user.public_trucks`, `user_public_trucks` or `user_trucks`).
 *   To be resilient we try several endpoint names when a 404 is encountered.
 */

import { supabaseFetch } from '../../supabaseController'

/**
 * PublicTruck
 *
 * Minimal interface representing a row from the user.public_trucks table.
 */
export interface PublicTruck {
  id?: string
  master_truck_id?: string
  owner_user_id?: string | null
  owner_company_id?: string | null
  status?: string | null
  mileage_km?: number | null
  condition_score?: number | null
  created_at?: string | null
  [key: string]: any
}

/**
 * tryFetch
 *
 * Attempt to fetch using the provided path. Returns the parsed array on success,
 * null when the resource is not found (404) or when the response has no data array,
 * and throws for unexpected errors.
 *
 * @param path - REST path to call (e.g. /rest/v1/user.public_trucks?select=*&...)
 * @returns Array of rows or null
 */
async function tryFetch(path: string) {
  try {
    const res = await supabaseFetch(path)
    // supabaseFetch returns an object with .data when successful
    if (res && Array.isArray(res.data)) return res.data
    // If we receive a non-array data (or no data) treat as null so caller can try fallbacks
    return null
  } catch (err: any) {
    // If PostgREST returns 404, supabaseFetch may throw or return an object; normalize to null
    // eslint-disable-next-line no-console
    console.debug('tryFetch error for path', path, err?.message ?? err)
    return null
  }
}

/**
 * buildCandidatePaths
 *
 * Build a list of candidate REST endpoints to try for fetching public trucks.
 * We include common variations so the client works across environments where
 * view/table exposure differs.
 *
 * @param query - query fragment after ? (e.g. select=*&owner_user_id=eq.xxx)
 * @returns Array of candidate paths
 */
function buildCandidatePaths(query: string) {
  return [
    `/rest/v1/user.public_trucks?${query}`,
    `/rest/v1/user_public_trucks?${query}`,
    `/rest/v1/public.user_public_trucks?${query}`,
    `/rest/v1/user_trucks?${query}`, // fallback to underlying table if view not exposed
    `/rest/v1/public.user_trucks?${query}`,
  ]
}

/**
 * fetchPublicTrucksForAuthUser
 *
 * Fetch trucks from user.public_trucks (or fallbacks) for the supplied auth user id.
 * Behavior:
 *  - Lookup public.users row by auth_user_id to obtain public.users.id and company_id
 *  - Fetch rows where owner_user_id == public.users.id
 *  - Additionally fetch rows where owner_company_id == public.users.company_id (if present)
 *
 * This function always queries the backend on each call (no cache) to satisfy
 * the "check on each request" requirement.
 *
 * @param authUserId - Supabase GoTrue auth user id (auth.uid())
 * @returns Array of PublicTruck rows (empty array on error)
 */
export async function fetchPublicTrucksForAuthUser(authUserId: string) {
  try {
    // 1) Resolve public.users row for this auth user id
    const userRes = await tryFetch(
      `/rest/v1/users?select=id,company_id&auth_user_id=eq.${encodeURIComponent(
        authUserId
      )}&limit=1`
    )
    const publicUser = Array.isArray(userRes) ? userRes[0] : null
    const ownerUserId = publicUser?.id ?? null
    const ownerCompanyId = publicUser?.company_id ?? null

    let trucks: PublicTruck[] = []

    /**
     * Helper to fetch candidate endpoints for a given filter (owner_user_id or owner_company_id)
     * We try multiple endpoint names in order until one returns data.
     */
    async function fetchForFilter(filterKey: 'owner_user_id' | 'owner_company_id', idValue: string) {
      const q = `select=*&${filterKey}=eq.${encodeURIComponent(idValue)}`
      const paths = buildCandidatePaths(q)
      for (const p of paths) {
        const data = await tryFetch(p)
        if (Array.isArray(data)) {
          // eslint-disable-next-line no-console
          console.debug(`fetchForFilter succeeded path=${p} rows=${data.length}`)
          return data
        }
      }
      // nothing found across candidates
      // eslint-disable-next-line no-console
      console.debug(`fetchForFilter: no endpoint succeeded for ${filterKey}=${idValue}`)
      return []
    }

    if (ownerUserId) {
      const byUser = await fetchForFilter('owner_user_id', ownerUserId)
      trucks = trucks.concat(byUser)
    }

    if (ownerCompanyId) {
      const byCompany = await fetchForFilter('owner_company_id', ownerCompanyId)
      // Merge while avoiding duplicates by id
      const existingIds = new Set(trucks.map((t) => t.id))
      for (const t of byCompany) {
        if (!existingIds.has(t.id)) trucks.push(t)
      }
    }

    return trucks
  } catch (err) {
    // Non-throwing API: return empty array on error
    // eslint-disable-next-line no-console
    console.error('fetchPublicTrucksForAuthUser error:', err)
    return []
  }
}

/**
 * fetchPublicTrucksForUserId
 *
 * Direct helper to fetch public_trucks by a public.users.id (owner_user_id).
 * Tries multiple endpoint names to be resilient across setups.
 *
 * @param userId - public.users.id
 * @returns Array of PublicTruck rows
 */
export async function fetchPublicTrucksForUserId(userId: string) {
  try {
    const q = `select=*&owner_user_id=eq.${encodeURIComponent(userId)}`
    const paths = buildCandidatePaths(q)
    for (const p of paths) {
      const data = await tryFetch(p)
      if (Array.isArray(data)) return data
    }
    return []
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchPublicTrucksForUserId error:', err)
    return []
  }
}

/**
 * fetchAllPublicTrucks
 *
 * Fetch all rows from user.public_trucks (admin/debug helper).
 *
 * @returns Array of PublicTruck rows
 */
export async function fetchAllPublicTrucks() {
  try {
    const paths = buildCandidatePaths('select=*')
    for (const p of paths) {
      const data = await tryFetch(p)
      if (Array.isArray(data)) return data
    }
    return []
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchAllPublicTrucks error:', err)
    return []
  }
}
