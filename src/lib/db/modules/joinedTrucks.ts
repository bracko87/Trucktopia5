/**
 * joinedTrucks.ts
 *
 * Helpers to fetch user_trucks joined with truck_models for a public user (resolved
 * from an auth_user_id). Provides a single batched request that includes:
 * - mileage_km, fuel_level_l and other user_trucks columns
 * - joined truck_models columns: country, class, max_payload, tonnage, make, model
 *
 * This keeps query logic isolated and returns a typed shape consumable by UI.
 */

import { supabaseFetch } from '../../supabaseController'
import type { TruckModelInfo } from './truckModels'

/**
 * JoinedTruckRow
 *
 * Minimal typed shape for a user_trucks row combined with its truck_models info.
 */
export interface JoinedTruckRow {
  id: string
  master_truck_id: string
  owner_user_id?: string | null
  owner_company_id?: string | null
  name?: string | null
  registration?: string | null
  purchase_date?: string | null
  created_at?: string | null
  mileage_km?: number | null
  fuel_level_l?: number | null
  condition_score?: number | null
  status?: string | null
  location_city_id?: string | null
  // Nested model info (may be null if not found)
  model?: TruckModelInfo | null
  [key: string]: any
}

/**
 * tryFetch
 *
 * Attempt a single REST call path and return parsed data array or null on failure.
 *
 * @param path - REST path to call (e.g. /rest/v1/user_trucks?select=...&...)
 * @returns Array of rows or null
 */
async function tryFetch(path: string) {
  try {
    const res = await supabaseFetch(path)
    if (res && Array.isArray(res.data)) return res.data
    return null
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.debug('joinedTrucks.tryFetch error for path', path, err?.message ?? err)
    return null
  }
}

/**
 * fetchTrucksWithModelInfoForAuthUser
 *
 * Resolve the public.users row for the provided authUserId then fetch user_trucks
 * rows that belong to that user and/or their company. Each returned row includes
 * an embedded `model` object with selected truck_models columns (country, class,
 * max_payload, tonnage, make, model).
 *
 * Notes:
 * - Uses the Supabase REST API via supabaseFetch already present in the codebase.
 * - Returns an empty array on error.
 *
 * @param authUserId - Supabase GoTrue auth user id (auth.uid())
 * @returns Array of JoinedTruckRow
 */
export async function fetchTrucksWithModelInfoForAuthUser(authUserId: string) : Promise<JoinedTruckRow[]> {
  try {
    // 1) Resolve public.users row for this auth user id
    const userRes = await tryFetch(
      `/rest/v1/users?select=id,company_id&auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`
    )
    const publicUser = Array.isArray(userRes) ? userRes[0] : null
    const ownerUserId = publicUser?.id ?? null
    const ownerCompanyId = publicUser?.company_id ?? null

    // Build select fragment to include needed columns and embedded model info
    const selectFragment =
      'select=id,master_truck_id,owner_user_id,owner_company_id,name,registration,purchase_date,created_at,mileage_km,fuel_level_l,condition_score,status,location_city_id,truck_models(id,make,model,country,class,max_payload,tonnage)'

    const trucks: JoinedTruckRow[] = []

    async function fetchForFilter(filterKey: 'owner_user_id' | 'owner_company_id', idValue: string) {
      const q = `${selectFragment}&${filterKey}=eq.${encodeURIComponent(idValue)}`
      const path = `/rest/v1/user_trucks?${q}`
      const data = await tryFetch(path)
      return Array.isArray(data) ? data as any[] : []
    }

    if (ownerUserId) {
      const byUser = await fetchForFilter('owner_user_id', ownerUserId)
      trucks.push(...byUser)
    }

    if (ownerCompanyId) {
      const byCompany = await fetchForFilter('owner_company_id', ownerCompanyId)
      // avoid duplicates by id
      const existingIds = new Set(trucks.map((t) => String(t.id)))
      for (const t of byCompany) {
        if (!existingIds.has(String(t.id))) trucks.push(t)
      }
    }

    return trucks.map((r: any) => {
      // Normalize nested truck_models -> model
      const model = r.truck_models ?? null
      // Map fields into JoinedTruckRow shape
      return {
        id: String(r.id),
        master_truck_id: String(r.master_truck_id),
        owner_user_id: r.owner_user_id ?? null,
        owner_company_id: r.owner_company_id ?? null,
        name: r.name ?? null,
        registration: r.registration ?? null,
        purchase_date: r.purchase_date ?? null,
        created_at: r.created_at ?? null,
        mileage_km: typeof r.mileage_km === 'number' ? r.mileage_km : (r.mileage_km ? Number(r.mileage_km) : null),
        fuel_level_l: typeof r.fuel_level_l === 'number' ? r.fuel_level_l : (r.fuel_level_l ? Number(r.fuel_level_l) : null),
        condition_score: typeof r.condition_score === 'number' ? r.condition_score : (r.condition_score ? Number(r.condition_score) : null),
        status: r.status ?? null,
        location_city_id: r.location_city_id ?? null,
        model: model
          ? {
              id: model.id,
              make: model.make ?? null,
              model: model.model ?? null,
              country: model.country ?? null,
              class: model.class ?? null,
              max_payload: model.max_payload ?? null,
              tonnage: model.tonnage ?? null,
            }
          : null,
        // include any additional raw fields for forward compatibility
        _raw: r,
      } as JoinedTruckRow
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchTrucksWithModelInfoForAuthUser error:', err)
    return []
  }
}