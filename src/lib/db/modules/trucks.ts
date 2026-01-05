/**
 * trucks.ts
 *
 * Small helpers for working with the user_trucks table. These are thin wrappers
 * around the existing supabase REST helpers so they can be adopted incrementally.
 */

import { insertRow, getTable, supabaseFetch } from '../../supabase'

/**
 * UserTruck
 *
 * Minimal TypeScript interface representing a user_trucks row used by helpers.
 */
export interface UserTruck {
  id?: string
  master_truck_id: string
  owner_user_id?: string | null
  owner_company_id?: string | null
  acquisition_type?: string | null
  purchase_price?: number | null
  lease_rate?: number | null
  lease_start?: string | null
  lease_end?: string | null
  purchase_date?: string | null
  condition_score?: number | null
  mileage_km?: number | null
  location_city_id?: string | null
  fuel_level_l?: number | null
  last_maintenance_at?: string | null
  next_maintenance_km?: number | null
  status?: string | null
  durability_remaining?: number | null
  is_active?: boolean | null
  created_at?: string | null
  availability_days?: number
}

/**
 * createUserTruck
 *
 * Insert a new user_trucks row. Returns the supabase-style response object.
 *
 * @param truck - Partial UserTruck payload
 */
export async function createUserTruck(truck: Partial<UserTruck>) {
  return insertRow('user_trucks', truck)
}

/**
 * countUserTrucksForCompany
 *
 * Count user_trucks rows for a given owner_company_id.
 *
 * @param companyId - company UUID
 * @returns number of trucks (0 on error)
 */
export async function countUserTrucksForCompany(companyId: string) {
  try {
    const res = await getTable('user_trucks', `?select=id&owner_company_id=eq.${companyId}`)
    const rows = Array.isArray(res.data) ? res.data : []
    return rows.length
  } catch {
    return 0
  }
}

/**
 * syncCompanyTruckCount
 *
 * Best-effort: computes current user_trucks count and patches companies.trucks.
 *
 * @param companyId - company UUID
 * @returns supabaseFetch response from the PATCH (or error structure)
 */
export async function syncCompanyTruckCount(companyId: string) {
  try {
    const count = await countUserTrucksForCompany(companyId)
    return supabaseFetch(`/rest/v1/companies?id=eq.${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify({ trucks: count }),
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    })
  } catch (err: any) {
    return { status: 0, data: null, error: err?.message ?? 'unknown' }
  }
}