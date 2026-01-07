/**
 * trucksApi.ts
 *
 * Small typed helpers to fetch and update user_trucks + related data (truck_models, hubs).
 *
 * Provides a batched list fetch that returns truck rows enriched with model info and
 * the exact columns required by TruckCard (mileage_km, fuel_level_l, class, max_payload, tonnage, country).
 */

import { supabaseFetch, getTable } from '../lib/supabase'

/**
 * TruckModelInfo
 *
 * Basic truck_models fields we display.
 */
export interface TruckModelInfo {
  id: string
  make?: string | null
  model?: string | null
  country?: string | null
  class?: string | null
  max_load_kg?: number | null
  tonnage?: number | null
  year?: number | null
  load_type?: string | null
  fuel_tank_capacity_l?: number | null
  fuel_type?: string | null
  image_url?: string | null
}

/**
 * HubRow
 *
 * Minimal hub shape returned to populate select options.
 */
export interface HubRow {
  id: string
  city?: string | null
  city_id?: string | null
  country?: string | null
  is_main?: boolean | null
}

/**
 * TruckDetailsRow
 *
 * Minimal shape for a user_trucks row combined with nested truck_models.
 */
export interface TruckDetailsRow {
  id: string
  master_truck_id: string
  owner_user_id?: string | null
  owner_company_id?: string | null
  purchase_date?: string | null
  mileage_km?: number | null
  fuel_level_l?: number | null
  last_maintenance_at?: string | null
  next_maintenance_km?: number | null
  condition_score?: number | null
  status?: string | null
  hub_id?: string | null
  location_city_id?: string | null
  truck_models?: TruckModelInfo | null
  [key: string]: any
}

/**
 * TruckCardRow
 *
 * Compact shape consumed by TruckCard and list components.
 */
export interface TruckCardRow {
  id: string
  name?: string | null
  registration?: string | null
  purchase_date?: string | null
  created_at?: string | null
  mileage_km?: number | null
  fuel_level_l?: number | null
  condition_score?: number | null
  status?: string | null
  location_city_id?: string | null
  location_city_name?: string | null
  model?: TruckModelInfo | null
  _raw?: any
}

/**
 * fetchTruckDetails
 *
 * Fetch a single user_trucks row (by id) and include joined truck_models fields.
 *
 * @param id - truck id (user_trucks.id)
 * @returns TruckDetailsRow | null
 */
export async function fetchTruckDetails(id: string): Promise<TruckDetailsRow | null> {
  if (!id) return null
  try {
    const q = `id=eq.${encodeURIComponent(id)}&select=*,truck_models(id,make,model,country,class,max_payload,tonnage,year)&limit=1`
    const res = await supabaseFetch(`/rest/v1/user_trucks?${q}`)
    if (res && Array.isArray(res.data) && res.data.length > 0) {
      return res.data[0] as TruckDetailsRow
    }
    return null
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchTruckDetails error', err)
    return null
  }
}

/**
 * fetchHubsForCompany
 *
 * Return hubs for a given company owner_id. If companyId is not provided, fetch a small
 * list of public/main hubs to populate the select.
 *
 * @param companyId - optional companies.id
 * @returns HubRow[]
 */
export async function fetchHubsForCompany(companyId?: string): Promise<HubRow[]> {
  try {
    if (companyId) {
      const q = `?select=id,city,city_id,country,is_main&owner_id=eq.${encodeURIComponent(companyId)}&order=is_main.desc,city.asc`
      const res = await getTable('hubs', q)
      return Array.isArray(res.data) ? (res.data as HubRow[]) : []
    } else {
      // fallback: few main hubs
      const res = await getTable('hubs', '?select=id,city,city_id,country,is_main&order=is_main.desc,city.asc&limit=50')
      return Array.isArray(res.data) ? (res.data as HubRow[]) : []
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchHubsForCompany error', err)
    return []
  }
}

/**
 * updateTruck
 *
 * Patch a user_trucks row. Use this for saving hub assignment (hub_id) or location_city_id.
 *
 * @param truckId - user_trucks.id
 * @param patch - partial object with fields to update
 * @returns result object from supabaseFetch
 */
export async function updateTruck(truckId: string, patch: Record<string, any>) {
  if (!truckId) return { status: 0, error: 'missing truckId' }
  try {
    const path = `/rest/v1/user_trucks?id=eq.${encodeURIComponent(truckId)}`
    const res = await supabaseFetch(path, {
      method: 'PATCH',
      body: JSON.stringify(patch),
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    })
    return res
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('updateTruck error', err)
    return { status: 0, error: (err as any)?.message ?? String(err) }
  }
}

/**
 * fetchTrucksForAuthUser
 *
 * Fetch user_trucks rows for the supplied auth user id (resolve public.users row first),
 * include nested truck_models columns (make, model, country, class, max_payload, tonnage)
 * and return a compact TruckCardRow[] suitable for feeding TruckCard components.
 *
 * Behavior:
 *  - Resolve public.users row for auth_user_id to obtain public.users.id and company_id
 *  - Fetch user_trucks where owner_user_id == public.users.id
 *  - Additionally fetch rows where owner_company_id == public.users.company_id (if present)
 *  - Avoid duplicates and map nested truck_models -> model
 *
 * @param authUserId - Supabase GoTrue auth user id (auth.uid())
 * @returns TruckCardRow[] (empty array on error)
 */
export async function fetchTrucksForAuthUser(authUserId: string): Promise<TruckCardRow[]> {
  if (!authUserId) return []
  try {
    // Resolve public.users row
    const userRes = await supabaseFetch(
      `/rest/v1/users?select=id,company_id&auth_user_id=eq.${encodeURIComponent(authUserId)}&limit=1`
    )
    const publicUser = Array.isArray(userRes?.data) ? userRes.data[0] : null
    const ownerUserId = publicUser?.id ?? null
    const ownerCompanyId = publicUser?.company_id ?? null

    const selectFragment =
      'select=id,master_truck_id,owner_user_id,owner_company_id,name,registration,purchase_date,created_at,mileage_km,fuel_level_l,condition_score,status,location_city_id,location_city_name,truck_models:truck_models!user_trucks_master_truck_id_fkey(id,make,model,country,class,year,max_load_kg,tonnage,load_type,fuel_tank_capacity_l,fuel_type,image_url)'

    const results: any[] = []

    async function fetchForFilter(filterKey: 'owner_user_id' | 'owner_company_id', idValue: string) {
      const q = `${selectFragment}&${filterKey}=eq.${encodeURIComponent(idValue)}&order=created_at.desc`
      const path = `/rest/v1/user_trucks?${q}`
      try {
        const r = await supabaseFetch(path)
        if (r && Array.isArray(r.data)) return r.data as any[]
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug('fetchTrucksForAuthUser.fetchForFilter error', filterKey, err)
      }
      return []
    }

    if (ownerUserId) {
      const byUser = await fetchForFilter('owner_user_id', ownerUserId)
      results.push(...byUser)
    }

    if (ownerCompanyId) {
      const byCompany = await fetchForFilter('owner_company_id', ownerCompanyId)
      const existing = new Set(results.map((t) => String(t.id)))
      for (const t of byCompany) {
        if (!existing.has(String(t.id))) results.push(t)
      }
    }

    // Map into TruckCardRow shape
    const mapped: TruckCardRow[] = results.map((r: any) => {
      const model = r.truck_models ?? null
      return {
        id: String(r.id),
        name: r.name ?? null,
        registration: r.registration ?? null,
        purchase_date: r.purchase_date ?? null,
        created_at: r.created_at ?? null,
        mileage_km: typeof r.mileage_km === 'number' ? r.mileage_km : (r.mileage_km ? Number(r.mileage_km) : null),
        fuel_level_l: typeof r.fuel_level_l === 'number' ? r.fuel_level_l : (r.fuel_level_l ? Number(r.fuel_level_l) : null),
        condition_score: typeof r.condition_score === 'number' ? r.condition_score : (r.condition_score ? Number(r.condition_score) : null),
        status: r.status ?? null,
        location_city_id: r.location_city_id ?? null,
        location_city_name: r.location_city_name ?? null,
        model: model
          ? {
              id: model.id,
              make: model.make ?? null,
              model: model.model ?? null,
              country: model.country ?? null,
              class: model.class ?? null,
              max_payload: model.max_payload ?? null,
              tonnage: model.tonnage ?? null,
              year: model.year ?? null,
            }
          : null,
        _raw: r,
      }
    })

    return mapped
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchTrucksForAuthUser error', err)
    return []
  }
}

/**
 * getUserTrucksWithModels
 *
 * Fetch user_trucks joined with truck_models using a single REST select.
 *
 * IMPORTANT:
 * - Do NOT apply client-side owner filtering here. Row Level Security (RLS) on the backend
 *   must enforce that only trucks belonging to the logged-in user are returned.
 * - This function returns the raw rows from the REST API; truck_models will be included
 *   as a nested field when available (server-side join).
 *
 * @returns Array of user_trucks rows with nested truck_models (or empty array on error)
 */
export async function getUserTrucksWithModels(): Promise<any[]> {
  try {
    // Use select with join to truck_models. Avoid adding owner_user_id filters here;
    // RLS will restrict results appropriately for the logged-in session.
    const qs = encodeURI(
      `/rest/v1/user_trucks?select=*,truck_models:truck_models!user_trucks_master_truck_id_fkey(id,make,model,country,class,year,max_load_kg,tonnage,load_type,fuel_tank_capacity_l,fuel_type,image_url)&order=created_at.desc&limit=500`
    )
    const res = await supabaseFetch(qs)

    if (!res) {
      return []
    }

    if (typeof res.status === 'number' && (res.status < 200 || res.status >= 300)) {
      // eslint-disable-next-line no-console
      console.debug('getUserTrucksWithModels fetch failed', res)
      return []
    }

    return Array.isArray(res.data) ? res.data : []
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getUserTrucksWithModels error', err)
    return []
  }
}