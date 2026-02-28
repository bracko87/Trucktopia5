/**
 * truckLogs.ts
 *
 * Client helpers to fetch/insert truck logs via the existing REST helper (supabaseFetch).
 */

import { supabaseFetch } from './supabase'

/**
 * TruckLog
 *
 * Minimal typed shape for a truck_logs row.
 */
export interface TruckLog {
  id: string
  user_truck_id: string
  event_type: string
  message?: string | null
  payload?: any | null
  source?: string | null
  created_by_user_id?: string | null
  created_at: string
}

/**
 * InsertTruckLogInput
 *
 * Raw DB-shaped payload for direct inserts.
 */
export interface InsertTruckLogInput {
  user_truck_id: string
  event_type: string
  message?: string | null
  payload?: any | null
  source?: string | null
  created_by_user_id?: string | null
}

/**
 * AddTruckLogInput
 *
 * App-friendly payload used by UI/service actions.
 */
export interface AddTruckLogInput {
  truckId: string
  eventType: string
  message?: string | null
  payload?: Record<string, unknown> | null
  source?: string | null
  createdByUserId?: string | null
}

/**
 * fetchTruckLogs
 *
 * Fetch recent logs for a user_truck via Supabase REST.
 *
 * @param truckId - user_trucks.id
 * @param limit - max rows to return (default 20)
 * @param before - ISO timestamp; when provided, only return rows with created_at < before
 * @returns array of TruckLog (empty array on error)
 */
export async function fetchTruckLogs(truckId: string, limit = 20, before?: string | null): Promise<TruckLog[]> {
  if (!truckId) return []

  try {
    let qs =
      `/rest/v1/truck_logs` +
      `?user_truck_id=eq.${encodeURIComponent(truckId)}` +
      `&order=created_at.desc` +
      `&limit=${limit}`

    if (before) {
      qs += `&created_at=lt.${encodeURIComponent(before)}`
    }

    const res = await supabaseFetch(qs)

    if (res && Array.isArray(res.data)) {
      return res.data as TruckLog[]
    }

    return []
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchTruckLogs error', err)
    return []
  }
}

/**
 * insertTruckLog
 *
 * Insert a new truck_logs row using the REST API.
 *
 * @param log - DB-shaped payload; user_truck_id and event_type required
 * @returns response object from supabaseFetch
 */
export async function insertTruckLog(log: InsertTruckLogInput) {
  if (!log?.user_truck_id || !log?.event_type) {
    return { status: 0, error: 'missing required fields' }
  }

  try {
    const res = await supabaseFetch('/rest/v1/truck_logs', {
      method: 'POST',
      body: JSON.stringify({
        user_truck_id: log.user_truck_id,
        event_type: log.event_type,
        message: log.message ?? null,
        payload: log.payload ?? {},
        source: log.source ?? 'ui',
        created_by_user_id: log.created_by_user_id ?? null,
      }),
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    })

    return res
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('insertTruckLog error', err)
    return { status: 0, error: (err as any)?.message ?? String(err) }
  }
}

/**
 * addTruckLog
 *
 * App-friendly helper for UI/service layers.
 * Converts camelCase input into DB field names and throws on failure.
 *
 * @param input - easier-to-use payload from the app
 * @returns inserted TruckLog row when available, otherwise null
 */
export async function addTruckLog(input: AddTruckLogInput): Promise<TruckLog | null> {
  if (!input?.truckId || !input?.eventType) {
    throw new Error('missing required fields')
  }

  const res = await insertTruckLog({
    user_truck_id: input.truckId,
    event_type: input.eventType,
    message: input.message ?? null,
    payload: input.payload ?? {},
    source: input.source ?? 'ui',
    created_by_user_id: input.createdByUserId ?? null,
  })

  const failed =
    !res ||
    res.status === 0 ||
    (typeof res.status === 'number' && res.status >= 400) ||
    !!res.error

  if (failed) {
    throw new Error(res?.error ?? 'Failed to insert truck log')
  }

  if (Array.isArray(res.data)) {
    return (res.data[0] as TruckLog) ?? null
  }

  return (res.data as TruckLog) ?? null
}