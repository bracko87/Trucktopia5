/**
 * db.ts
 *
 * Typed DB helper functions for Tracktopia. Wraps Supabase REST helpers.
 *
 * Responsibilities:
 * - Provide typed helpers for inserting/fetching rows used by the app.
 * - Provide ensureUserProfile that is robust to race conditions and will
 *   update an existing public.users row (matched by email) to attach auth_user_id
 *   and name when an auth user is available.
 * - When creating a company, perform a best-effort sync to set the users.company_id
 *   so the frontend doesn't rely solely on DB triggers.
 */

import { getTable, insertRow, supabaseFetch } from './supabase'

/**
 * UserRow
 *
 * Interface representing a row in the users table.
 */
export interface UserRow {
  id?: string
  email: string
  name?: string | null
  auth_user_id?: string | null
  company_id?: string | null
  created_at?: string
}

/**
 * CompanyRow
 *
 * Interface representing a row in the companies table.
 */
export interface CompanyRow {
  id?: string
  owner_id?: string | null
  level?: number
  reputation?: number
  email?: string | null
  hub_city?: string | null
  hub_country?: string | null
  trucks?: number
  trailers?: number
  employees?: number
  balance?: number
  balance_cents?: number
  created_at?: string
  name?: string | null
}

/**
 * CityRow
 *
 * Interface representing a row in the cities table.
 */
export interface CityRow {
  id?: string
  city_name: string
  country_code: string
  country_name: string
  lat?: number | null
  lon?: number | null
  created_at?: string
}

/**
 * HubRow
 *
 * Interface representing a row in the hubs table.
 */
export interface HubRow {
  id?: string
  city?: string | null
  country?: string | null
  is_main?: boolean
  lat?: number | null
  lon?: number | null
  hub_level?: number
  city_id?: string | null
  owner_id?: string | null
  created_at?: string
}

/**
 * insertUserProfile
 *
 * Inserts a user profile row into the users table.
 *
 * @param user - UserRow object to insert (email required)
 * @returns Promise resolving to supabase-style response object
 */
export async function insertUserProfile(user: UserRow) {
  return insertRow('users', user)
}

/**
 * insertCompany
 *
 * Inserts a company row into the companies table.
 *
 * @param company - CompanyRow to insert
 * @returns Promise resolving to supabase-style response object
 */
export async function insertCompany(company: CompanyRow) {
  return insertRow('companies', company)
}

/**
 * insertCity
 *
 * Inserts a city row into the cities table.
 *
 * @param city - CityRow to insert
 * @returns Promise resolving to supabase-style response object
 */
export async function insertCity(city: CityRow) {
  return insertRow('cities', city)
}

/**
 * insertHub
 *
 * Inserts a hub row into the hubs table.
 *
 * @param hub - HubRow to insert
 * @returns Promise resolving to supabase-style response object
 */
export async function insertHub(hub: HubRow) {
  return insertRow('hubs', hub)
}

/**
 * fetchCities
 *
 * Get all cities needed for company creation (ordered by country then city).
 *
 * @returns Promise resolving to supabaseFetch-like object
 */
export async function fetchCities() {
  return getTable(
    'cities',
    '?select=id,city_name,country_name,lat,lon&order=country_name.asc,city_name.asc'
  )
}

/**
 * ensureUserProfile
 *
 * Idempotently ensures that a public.users row exists and is linked to the provided
 * auth_user_id. Behavior:
 * - If a row exists with auth_user_id == provided authUserId -> return it.
 * - Else, try to find an existing users row by email. If found, PATCH that row to set
 *   auth_user_id and optionally update name (only if provided).
 * - Else, insert a new users row. IMPORTANT: when creating a new row we set the users.id
 *   to match the provided authUserId. Making public.users.id == auth.uid() ensures
 *   policies and FK constraints relying on auth.uid() vs users.id behave correctly.
 *
 * This helps when frontend or other processes create a public.users row before GoTrue
 * returns an auth id, by linking the two rows later when the auth id becomes available.
 *
 * @param authUserId - id from Supabase auth.users
 * @param email - user email
 * @param username - optional display name
 */
export async function ensureUserProfile(authUserId: string, email: string, username?: string) {
  // 1) Try to find existing row by auth_user_id
  const selectRes = await getTable('users', `?select=*&auth_user_id=eq.${authUserId}`)
  const existingRows = Array.isArray(selectRes.data) ? selectRes.data : []
  const existing = existingRows[0]
  if (existing) {
    return { status: selectRes.status, data: existing }
  }

  // 2) If not found by auth_user_id, try to find by email and attach auth_user_id
  try {
    const byEmailRes = await getTable('users', `?select=*&email=eq.${encodeURIComponent(email)}`)
    const emailRows = Array.isArray(byEmailRes.data) ? byEmailRes.data : []
    const emailExisting = emailRows[0]

    if (emailExisting && emailExisting.id) {
      // Prepare patch payload: set auth_user_id, and name if provided or keep existing
      const newName = username ?? emailExisting.name ?? null
      const patchPayload: Partial<UserRow> = {
        auth_user_id: authUserId,
        name: newName,
      }

      // Attempt to PATCH the existing row to attach auth_user_id
      const patchRes = await supabaseFetch(`/rest/v1/users?id=eq.${emailExisting.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patchPayload),
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      })

      if (patchRes && (patchRes.status === 200 || patchRes.status === 201)) {
        const patchedArray = Array.isArray(patchRes.data) ? patchRes.data : [patchRes.data]
        return { status: patchRes.status, data: patchedArray[0] }
      }

      // If PATCH conflict (409) or failed for other reason, attempt to re-query by auth_user_id
      const retryRes = await getTable('users', `?select=*&auth_user_id=eq.${authUserId}`)
      const retryRows = Array.isArray(retryRes.data) ? retryRes.data : []
      if (retryRows[0]) {
        return { status: retryRes.status, data: retryRows[0] }
      }
    }
  } catch {
    // ignore and proceed to insert
  }

  // 3) Insert if not exists (fallback)
  // IMPORTANT: include explicit id equal to the authUserId so public.users.id == auth.uid()
  // This ensures RLS policies that compare owner_id = auth.uid() succeed and foreign keys align.
  const insertPayload: any = {
    id: authUserId,
    auth_user_id: authUserId,
    email,
    name: username ?? null,
  }

  const insertRes = await insertRow('users', insertPayload)

  // Insert succeeded with representation
  if (insertRes && (insertRes.status === 200 || insertRes.status === 201)) {
    const insertedArray = Array.isArray(insertRes.data) ? insertRes.data : [insertRes.data]
    return { status: insertRes.status, data: insertedArray[0] }
  }

  // 4) If we hit a conflict (e.g. concurrent insert) re-query by auth_user_id and return
  if (insertRes && insertRes.status === 409) {
    const retryRes = await getTable('users', `?select=*&auth_user_id=eq.${authUserId}`)
    const retryRows = Array.isArray(retryRes.data) ? retryRes.data : []
    const retryExisting = retryRows[0]
    if (retryExisting) {
      return { status: retryRes.status, data: retryExisting }
    }
  }

  // 5) Fallback: bubble up insert error
  return insertRes
}

/**
 * ensureStarterLeaseForCompany
 *
 * Ensures that a given company has at most one starter lease for the specified truck model.
 * Additionally this function will (best-effort):
 *  - create a corresponding user_trucks row for the starter truck (so the company actually has a truck instance)
 *  - update companies.trucks to reflect the current count of user_trucks for the company
 *
 * Non-fatal: failures to create the user_truck or update the companies count will be ignored
 * so company creation is not blocked.
 *
 * @param ownerUserId - game user id (public.users.id)
 * @param companyId - company id
 * @param truckModelId - starter truck model id
 */
/**
 * ensureStarterLeaseForCompany
 *
 * Ensures that a given company has at most one starter lease for the specified truck model.
 * Additionally this function will (best-effort):
 *  - create a corresponding user_trucks row for the starter truck (so the company actually has a truck instance)
 *  - update companies.trucks to reflect the current count of user_trucks for the company
 *
 * This variant uses the modular helper createUserTruck and syncCompanyTruckCount so
 * the operations are clearer and any errors are surfaced in the returned structure.
 *
 * @param ownerUserId - game user id (public.users.id)
 * @param companyId - company id
 * @param truckModelId - starter truck model id
 */
async function ensureStarterLeaseForCompany(
  ownerUserId: string,
  companyId: string,
  truckModelId: string
) {
  // Check if a starter lease already exists for this company/model.
  const existingRes = await getTable(
    'user_leases',
    `?select=id&owner_company_id=eq.${companyId}&asset_model_id=eq.${truckModelId}`
  )
  const rows = Array.isArray(existingRes.data) ? existingRes.data : []
  if (rows.length > 0) {
    return { status: existingRes.status, data: rows[0], alreadyExists: true }
  }

  // Create starter lease
  const payload = {
    asset_model_id: truckModelId,
    asset_type: 'truck',
    owner_company_id: companyId,
    owner_user_id: ownerUserId,
    acquisition_type: 'starter',
    status: 'active',
    is_active: true,
  }

  const leaseRes = await insertRow('user_leases', payload)

  // If lease insert failed, return result so caller can inspect.
  if (!(leaseRes && (leaseRes.status === 200 || leaseRes.status === 201))) {
    return { status: leaseRes?.status ?? 0, error: leaseRes?.error ?? 'lease insert failed', data: leaseRes?.data ?? null }
  }

  // Best-effort: create a corresponding user_trucks row so the company has an actual truck instance.
  let truckRes: any = null
  try {
    const userTruckPayload: any = {
      master_truck_id: truckModelId,
      owner_company_id: companyId,
      owner_user_id: ownerUserId,
      acquisition_type: 'starter',
      condition_score: 100,
      mileage_km: 0,
      status: 'available',
      is_active: true,
    }

    // Create the user_truck using the trucks module helper if available, otherwise fallback to insertRow.
    try {
      // dynamic import-like resolution: prefer modular helper if present
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const trucksModule = require('./db/modules/trucks') as any
      if (trucksModule && typeof trucksModule.createUserTruck === 'function') {
        truckRes = await trucksModule.createUserTruck(userTruckPayload)
      } else {
        truckRes = await insertRow('user_trucks', userTruckPayload)
      }
    } catch (e) {
      // fallback to direct insert if require() failed (safe-guard)
      truckRes = await insertRow('user_trucks', userTruckPayload)
    }

    // If truck creation failed, include info but continue to attempt syncing count.
    if (!(truckRes && (truckRes.status === 200 || truckRes.status === 201))) {
      // attempt to surface the error; continue
    }

    // recompute the trucks count for the company and patch companies.trucks
    try {
      // prefer modular sync helper
      let syncRes: any = null
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const trucksModule = require('./db/modules/trucks') as any
        if (trucksModule && typeof trucksModule.syncCompanyTruckCount === 'function') {
          syncRes = await trucksModule.syncCompanyTruckCount(companyId)
        } else {
          const countRes = await getTable('user_trucks', `?select=id&owner_company_id=eq.${companyId}`)
          const count = Array.isArray(countRes.data) ? countRes.data.length : 0
          syncRes = await supabaseFetch(`/rest/v1/companies?id=eq.${companyId}`, {
            method: 'PATCH',
            body: JSON.stringify({ trucks: count }),
            headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          })
        }
      } catch {
        // fallback manual count/patch
        const countRes = await getTable('user_trucks', `?select=id&owner_company_id=eq.${companyId}`)
        const count = Array.isArray(countRes.data) ? countRes.data.length : 0
        await supabaseFetch(`/rest/v1/companies?id=eq.${companyId}`, {
          method: 'PATCH',
          body: JSON.stringify({ trucks: count }),
          headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        })
      }
    } catch (err) {
      // ignore failures updating count but include in returned structure
      return {
        status: leaseRes.status,
        data: leaseRes.data,
        truck: truckRes,
        countSyncError: (err as any)?.message ?? String(err),
      }
    }
  } catch (err) {
    // non-fatal: return lease result and the truck insert error for debugging
    return {
      status: leaseRes.status,
      data: leaseRes.data,
      truckError: (err as any)?.message ?? String(err),
    }
  }

  // Success: return lease + truck results (truckRes may be null if creation failed)
  return { status: leaseRes.status, lease: leaseRes.data, truck: truckRes?.data ?? truckRes }
}

/**
 * createCompanyWithBootstrap
 *
 * Creates a company for the given user and bootstraps:
 * - main hub in public.hubs
 * - starter lease in public.user_leases (and a starter user_trucks row via ensureStarterLeaseForCompany)
 *
 * If the user already has a company (owner_id match), returns the existing one
 * and does not create bonuses a second time.
 *
 * Performs a best-effort update to public.users row to set company_id for immediate consistency.
 *
 * @param userId - game user id OR auth user id (we will ensure a linked public.users row and use its id)
 * @param email - user email (stored on company.email)
 * @param city - selected CityRow to use as hub
 * @param companyName - chosen company name
 */
export async function createCompanyWithBootstrap(
  userId: string,
  email: string,
  city: CityRow,
  companyName: string
) {
  const INITIAL_BALANCE_CENTS = 1000000 // 10,000 * 100
  const STARTER_TRUCK_MODEL_ID = 'd87583a5-1bf0-4451-ac90-32318b7b1093'

  // Ensure we have a linked public.users row (and that public.users.id == auth uid when possible).
  // If userId is an auth uid, ensureUserProfile will create/patch a public.users row and return it.
  let publicUserId = userId
  try {
    const ensured = await ensureUserProfile(userId, email, null)
    if (ensured && ensured.data && ensured.data.id) {
      publicUserId = ensured.data.id
    }
  } catch {
    // ignore; we'll proceed with provided userId (best-effort)
  }

  // 1) Check if company already exists for this user (owner_id == publicUserId)
  const existingRes = await getTable('companies', `?select=*&owner_id=eq.${publicUserId}`)
  const existingCompanies = Array.isArray(existingRes.data) ? existingRes.data : []
  if (existingCompanies.length > 0) {
    return {
      status: 200,
      data: {
        company: existingCompanies[0],
        alreadyExists: true,
      },
    }
  }

  // 2) Insert company with initial balance and hub city/country
  const companyPayload: CompanyRow = {
    owner_id: publicUserId,
    email,
    name: companyName,
    hub_city: city.city_name,
    hub_country: city.country_name,
    balance_cents: INITIAL_BALANCE_CENTS,
  }

  const companyRes = await insertCompany(companyPayload)
  if (!(companyRes && (companyRes.status === 200 || companyRes.status === 201))) {
    return companyRes
  }

  const insertedArray = Array.isArray(companyRes.data) ? companyRes.data : [companyRes.data]
  const company = insertedArray[0]
  const companyId: string | undefined = company?.id
  if (!companyId) {
    return { status: 500, data: null, error: 'Missing company id from insert response' }
  }

  // 3) Create main hub (best-effort; failures should not block company creation)
  if (city.id) {
    const hubPayload: HubRow = {
      owner_id: companyId,
      city_id: city.id,
      city: city.city_name,
      country: city.country_name,
      is_main: true,
      hub_level: 1,
      lat: (city.lat as number | null) ?? null,
      lon: (city.lon as number | null) ?? null,
    }
    try {
      await insertHub(hubPayload)
    } catch {
      // Non-fatal; hub creation can fail without breaking company creation
    }
  }

  // 4) Ensure starter lease (best-effort) -> now also creates a starter user_trucks row and updates companies.trucks
  try {
    await ensureStarterLeaseForCompany(publicUserId, companyId, STARTER_TRUCK_MODEL_ID)
  } catch {
    // Non-fatal; game can still function without the starter lease/truck
  }

  // 5) Best-effort: update public.users row to set company_id for immediate consistency.
  try {
    await supabaseFetch(`/rest/v1/users?id=eq.${publicUserId}`, {
      method: 'PATCH',
      body: JSON.stringify({ company_id: companyId }),
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    })
  } catch {
    // ignore; DB trigger should still keep things consistent eventually
  }

  return {
    status: companyRes.status,
    data: {
      company,
      alreadyExists: false,
    },
  }
}