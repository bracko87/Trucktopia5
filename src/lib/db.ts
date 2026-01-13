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
 *   so the frontend does not rely solely on DB triggers.
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
  /**
   * Denormalized auth owner column introduced by migration 031.
   * Should match auth.uid() for the owning user.
   */
  owner_auth_user_id?: string | null
}

/**
 * CityRow
 *
 * Interface representing a row in the cities table.
 */
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
 * CargoTypeRow
 *
 * Minimal interface representing a row in the cargo_types table.
 * Includes icon_url which stores an optional HTTP(S) URL for a small icon
 * representing this cargo type (used by the UI as decoration).
 */
export interface CargoTypeRow {
  id?: string
  code?: string | null
  name?: string | null
  description?: string | null
  created_at?: string | null
  icon_url?: string | null
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
  /**
   * Denormalized auth owner column introduced by migration 031.
   * Should match auth.uid() for the owning user.
   */
  owner_auth_user_id?: string | null
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
  // Include lease_start / lease_end to satisfy DB CHECK constraint requiring a 60-week lease window.
  const nowIso = new Date().toISOString()
  const sixtyWeeksMs = 60 * 7 * 24 * 60 * 60 * 1000 // 60 weeks in ms (420 days)
  const payload = {
    asset_model_id: truckModelId,
    asset_type: 'truck',
    owner_company_id: companyId,
    owner_user_id: ownerUserId,
    owner_user_auth_id: ownerUserId,
    acquisition_type: 'starter',
    status: 'active',
    is_active: true,
    lease_start: nowIso,
    lease_end: new Date(Date.now() + sixtyWeeksMs).toISOString(),
  }

  const leaseRes = await insertRow('user_leases', payload)

  // If lease insert failed, return result so caller can inspect.
  if (!(leaseRes && (leaseRes.status === 200 || leaseRes.status === 201))) {
    return {
      status: leaseRes?.status ?? 0,
      error: leaseRes?.error ?? 'lease insert failed',
      data: leaseRes?.data ?? null,
    }
  }

  // Best-effort: create a corresponding user_trucks row so the company has an actual truck instance.
  let truckRes: any = null
  try {
    // Avoid creating duplicate starter trucks if one already exists for this company/model.
    const existingTruckRes = await getTable(
      'user_trucks',
      `?select=id&owner_company_id=eq.${companyId}&master_truck_id=eq.${truckModelId}&acquisition_type=eq.starter`
    )
    const existingTruckRows = Array.isArray(existingTruckRes.data) ? existingTruckRes.data : []

    if (existingTruckRows.length === 0) {
      const userTruckPayload: any = {
        master_truck_id: truckModelId,
        owner_company_id: companyId,
        owner_user_id: ownerUserId,
        owner_user_auth_id: ownerUserId, // explicit denorm, do not rely on triggers
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
      } catch {
        // fallback to direct insert if require() failed (safe-guard)
        truckRes = await insertRow('user_trucks', userTruckPayload)
      }

      // If truck creation failed, include info but continue to attempt syncing count.
      if (!(truckRes && (truckRes.status === 200 || truckRes.status === 201))) {
        // error is non-fatal; continue
      }
    } else {
      // Reuse existing starter truck information in the returned structure.
      truckRes = existingTruckRes
    }

    // recompute the trucks count for the company and patch companies.trucks
    try {
      // prefer modular sync helper
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const trucksModule = require('./db/modules/trucks') as any
        if (trucksModule && typeof trucksModule.syncCompanyTruckCount === 'function') {
          await trucksModule.syncCompanyTruckCount(companyId)
        } else {
          const countRes = await getTable(
            'user_trucks',
            `?select=id&owner_company_id=eq.${companyId}`
          )
          const count = Array.isArray(countRes.data) ? countRes.data.length : 0
          await supabaseFetch(`/rest/v1/companies?id=eq.${companyId}`, {
            method: 'PATCH',
            body: JSON.stringify({ trucks: count }),
            headers: {
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
          })
        }
      } catch {
        // fallback manual count/patch
        const countRes = await getTable(
          'user_trucks',
          `?select=id&owner_company_id=eq.${companyId}`
        )
        const count = Array.isArray(countRes.data) ? countRes.data.length : 0
        await supabaseFetch(`/rest/v1/companies?id=eq.${companyId}`, {
          method: 'PATCH',
          body: JSON.stringify({ trucks: count }),
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
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
 * If the user already has a company, returns the existing one
 * and does not create bonuses a second time.
 *
 * Performs a best-effort update to public.users row to set company_id for immediate consistency.
 *
 * IMPORTANT:
 * - The userId parameter is treated as the auth user id (auth.uid()).
 * - For new users we ensure public.users.id === auth_user_id === userId so that:
 *   - companies.owner_id references users.id
 *   - companies.owner_auth_user_id stores auth.uid()
 *
 * @param userId - auth user id from Supabase (auth.uid())
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

  // Treat incoming userId as auth user id.
  const authUserId = userId

  // Ensure we have a linked public.users row.
  // For new users this will create users.id == authUserId.
  let publicUserId = authUserId
  try {
    const ensured = await ensureUserProfile(authUserId, email, null)
    if (ensured && ensured.data && ensured.data.id) {
      publicUserId = ensured.data.id as string
    }
  } catch {
    // best-effort only
  }

  // 1) Check if company already exists for this auth user.
  // Prefer new denormalized column, fall back to owner_id for safety.
  const existingRes = await getTable(
    'companies',
    `?select=*` +
      `&or=(owner_auth_user_id.eq.${encodeURIComponent(authUserId)},owner_id.eq.${encodeURIComponent(
        publicUserId
      )})` +
      `&limit=1`
  )

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

  // 2) Insert company with initial balance and hub city/country.
  // We explicitly set owner_auth_user_id so new RLS policies work.
  const companyPayload: CompanyRow = {
    owner_id: publicUserId,
    email,
    name: companyName,
    hub_city: city.city_name,
    hub_country: city.country_name,
    balance_cents: INITIAL_BALANCE_CENTS,
    owner_auth_user_id: authUserId,
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

  const bootstrapErrors: string[] = []

  // 3) Robust hub handling to avoid duplicates:
  // We NEVER insert a hub here unless absolutely no hub exists.
  // Instead, we assume a DB trigger may have created a placeholder hub row.
  // We then PATCH the earliest main hub for this company with accurate city info.
  try {
    const hubsRes = await getTable(
      'hubs',
      `?select=*` +
        `&owner_id=eq.${encodeURIComponent(companyId)}` +
        `&is_main=eq.true` +
        `&order=created_at.asc` +
        `&limit=1`
    )
    const hubs = Array.isArray(hubsRes.data) ? hubsRes.data : []
    const existingHub = hubs[0]

    if (existingHub) {
      // Patch the existing hub created by trigger (or earlier run) with accurate info.
      const patchPayload: Partial<HubRow> = {
        city: city.city_name,
        country: city.country_name,
        is_main: true,
        owner_auth_user_id: authUserId,
      }

      if (city.id) patchPayload.city_id = city.id
      if (typeof city.lat !== 'undefined') patchPayload.lat = (city.lat as number) ?? null
      if (typeof city.lon !== 'undefined') patchPayload.lon = (city.lon as number) ?? null

      try {
        await supabaseFetch(`/rest/v1/hubs?id=eq.${encodeURIComponent(existingHub.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(patchPayload),
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
        })
      } catch (err) {
        bootstrapErrors.push(`hub_patch:${(err as any)?.message ?? String(err)}`)
      }
    } else {
      // Fallback: if no hub exists at all (e.g. trigger missing), insert a single hub.
      const hubPayload: HubRow = {
        owner_id: companyId,
        city_id: city.id ?? null,
        city: city.city_name,
        country: city.country_name,
        is_main: true,
        hub_level: 1,
        lat: (city.lat as number | null) ?? null,
        lon: (city.lon as number | null) ?? null,
        owner_auth_user_id: authUserId,
      }

      try {
        await insertHub(hubPayload)
      } catch (err) {
        bootstrapErrors.push(`hub_create:${(err as any)?.message ?? String(err)}`)
      }
    }
  } catch (err) {
    bootstrapErrors.push(`hub_lookup:${(err as any)?.message ?? String(err)}`)
  }

  // 4) Ensure starter lease (best-effort) -> also creates a starter user_trucks row and updates companies.trucks.
  try {
    await ensureStarterLeaseForCompany(publicUserId, companyId, STARTER_TRUCK_MODEL_ID)
  } catch (err) {
    bootstrapErrors.push(`lease:${(err as any)?.message ?? String(err)}`)
  }

  // 5) Best-effort: update public.users row to set company_id for immediate consistency.
  try {
    await supabaseFetch(`/rest/v1/users?id=eq.${encodeURIComponent(publicUserId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ company_id: companyId }),
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    })
  } catch (err) {
    bootstrapErrors.push(`user_patch:${(err as any)?.message ?? String(err)}`)
  }

  const result: any = {
    status: companyRes.status,
    data: {
      company,
      alreadyExists: false,
    },
  }

  if (bootstrapErrors.length > 0) {
    result.bootstrapErrors = bootstrapErrors
  }

  return result
}