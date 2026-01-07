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
 * fetchTruckLogs
 *
 * Fetch recent logs for a user_truck via Supabase REST.
 *
 * @param truckId - user_trucks.id
 * @param limit - max rows to return (default 20)
 * @param before - ISO timestamp; when provided, only return rows with created_at &lt; before
 * @returns array of TruckLog (empty array on error)
 */
export async function fetchTruckLogs(truckId: string, limit = 20, before?: string | null): Promise<TruckLog[]> {
  if (!truckId) return []
  try {
    // build query string
    let qs = `/rest/v1/truck_logs?user_truck_id=eq.${encodeURIComponent(truckId)}&order=created_at.desc&limit=${limit}`
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
 * Insert a new truck_log row using the REST API.
 *
 * @param log - partial payload; user_truck_id and event_type required
 * @returns response object from supabaseFetch (may include inserted representation depending on Prefer header)
 */
export async function insertTruckLog(log: {
  user_truck_id: string
  event_type: string
  message?: string | null
  payload?: any | null
  source?: string | null
  created_by_user_id?: string | null
}) {
  if (!log?.user_truck_id || !log?.event_type) {
    return { status: 0, error: 'missing required fields' }
  }
  try {
    const res = await supabaseFetch('/rest/v1/truck_logs', {
      method: 'POST',
      body: JSON.stringify(log),
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    })
    return res
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('insertTruckLog error', err)
    return { status: 0, error: (err as any)?.message ?? String(err) }
  }
}