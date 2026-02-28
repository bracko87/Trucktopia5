/**
 * loadOnDutySessions.ts
 *
 * Service helper that loads on-duty driving sessions for a company.
 *
 * Purpose:
 * - Try to read from driving_sessions when the table exists.
 * - If driving_sessions is missing (404 / API error), fall back to reading
 *   active job_assignments and synthesize a compatible driving-session-like
 *   shape so callers (staging panels) can continue to work.
 *
 * This is a resilient compatibility layer intended to avoid runtime 404s
 * when the driving_sessions table/view is not present in some environments.
 */

import { supabase } from '../lib/supabase'

/**
 * DrivingSessionRow
 *
 * Minimal shape used by components that render on-duty sessions.
 */
export interface DrivingSessionRow {
  id: string
  phase?: string | null
  distance_completed_km?: number | null
  total_distance_km?: number | null
  updated_at?: string | null
  created_at?: string | null
  job_assignment?: any | null
  relocation_ready_at?: string | null
  phase_started_at?: string | null
  [key: string]: any
}

/**
 * loadOnDutySessions
 *
 * Attempt to load driving_sessions for a company. If driving_sessions is not
 * available, fall back to job_assignments and map rows into a driving-session-like
 * structure so UI code can continue to function.
 *
 * @param companyId - company id to scope the query (may be null/undefined)
 * @returns Promise resolving to an array of DrivingSessionRow
 */
export async function loadOnDutySessions(companyId?: string | null): Promise<DrivingSessionRow[]> {
  // Try driving_sessions first (if present)
  try {
    const q = supabase.from('driving_sessions').select(`
      id,
      phase,
      distance_completed_km,
      total_distance_km,
      updated_at,
      created_at,
      job_assignment_id,
      relocation_ready_at,
      phase_started_at,
      job_assignment:job_assignment_id(
        id,
        status,
        job_offer:job_offer_id(
          id,
          distance_km,
          pickup_time,
          delivery_deadline,
          origin_city:origin_city_id(city_name,country_code),
          destination_city:destination_city_id(city_name,country_code)
        ),
        distance_completed_km,
        total_distance_km,
        created_at
      )
    `)
    if (companyId) (q as any).eq('company_id', companyId)
    const { data, error } = await q.order('updated_at', { ascending: false }).limit(500)
    if (!error && Array.isArray(data)) {
      // Map PostgREST returned rows to DrivingSessionRow
      return data.map((r: any) => ({
        id: String(r.id),
        phase: r.phase ?? null,
        distance_completed_km: r.distance_completed_km ?? r.job_assignment?.distance_completed_km ?? null,
        total_distance_km: r.total_distance_km ?? r.job_assignment?.total_distance_km ?? null,
        updated_at: r.updated_at ?? null,
        created_at: r.created_at ?? null,
        job_assignment: r.job_assignment ?? null,
        relocation_ready_at: r.relocation_ready_at ?? null,
        phase_started_at: r.phase_started_at ?? null,
        _raw: r,
      }))
    }
    // If there is an error, fall through to fallback path below
  } catch (e) {
    // swallow and try fallback
    // eslint-disable-next-line no-console
    console.debug('loadOnDutySessions: driving_sessions fetch failed, falling back to job_assignments', e)
  }

  // Fallback: load active job_assignments for the company and convert them
  try {
    const q = supabase
      .from('job_assignments')
      .select(`
        id,
        status,
        distance_completed_km,
        total_distance_km,
        created_at,
        job_offer:job_offer_id(
          id,
          distance_km,
          pickup_time,
          delivery_deadline,
          origin_city:origin_city_id(city_name,country_code),
          destination_city:destination_city_id(city_name,country_code)
        )
      `)
      // only non-terminal statuses (keep it aligned with UI expectations)
      .in('status', ['assigned', 'picking_load', 'to_pickup', 'in_progress', 'delivering'])
      .order('created_at', { ascending: false })
      .limit(500)

    if (companyId) (q as any).eq('carrier_company_id', companyId)

    const { data, error } = await q
    if (error) {
      // eslint-disable-next-line no-console
      console.debug('loadOnDutySessions fallback: job_assignments query failed', error)
      return []
    }
    const rows = Array.isArray(data) ? data : []
    // Map job_assignments -> DrivingSessionRow-like objects
    return rows.map((row: any) => {
      const jobOffer = row.job_offer ?? {}
      const total = Number(row.total_distance_km ?? jobOffer.distance_km ?? 0)
      const completed = Number(row.distance_completed_km ?? 0)
      return {
        id: String(row.id),
        phase: (row.status ?? null) as string | null,
        distance_completed_km: Number.isFinite(completed) ? completed : null,
        total_distance_km: Number.isFinite(total) ? total : null,
        updated_at: null,
        created_at: row.created_at ?? null,
        job_assignment: {
          id: row.id,
          status: row.status,
          job_offer: jobOffer,
          distance_completed_km: row.distance_completed_km ?? null,
          total_distance_km: row.total_distance_km ?? null,
        },
        _raw: row,
      } as DrivingSessionRow
    })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.debug('loadOnDutySessions: fallback job_assignments fetch failed', e)
    return []
  }
}