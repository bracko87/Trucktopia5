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
 * resolveCompanyUserIds
 *
 * Best-effort helper used by the legacy fallback path when job_assignments
 * does not expose carrier_company_id. It resolves user ids for a company so
 * fallback queries can be scoped via user_id instead.
 *
 * Note:
 * - This assumes a `company_users` table with `company_id` and `user_id`.
 * - If your project uses a different membership table, update this helper.
 */
async function resolveCompanyUserIds(companyId?: string | null): Promise<string[]> {
  if (!companyId) return []

  try {
    const { data, error } = await supabase
      .from('company_users')
      .select('user_id')
      .eq('company_id', companyId)
      .limit(5000)

    if (error) {
      // eslint-disable-next-line no-console
      console.debug('resolveCompanyUserIds: company_users lookup failed', error)
      return []
    }

    const rows = Array.isArray(data) ? data : []
    return rows
      .map((row: any) => row?.user_id)
      .filter((v: any): v is string => typeof v === 'string' && v.length > 0)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.debug('resolveCompanyUserIds: unexpected lookup failure', e)
    return []
  }
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
  } catch (e) {
    // eslint-disable-next-line no-console
    console.debug('loadOnDutySessions: driving_sessions fetch failed, falling back to job_assignments', e)
  }

  // Fallback: load active job_assignments for the company and convert them
  try {
    const statusScope = ['assigned', 'picking_load', 'to_pickup', 'in_progress', 'delivering', 'IN_PROGRESS']
    const companyUserIds = await resolveCompanyUserIds(companyId)

    async function queryAssignments(includeDistanceColumns: boolean, useCarrierFilter: boolean) {
      const distanceColumns = includeDistanceColumns ? 'distance_completed_km,total_distance_km,' : ''

      let q = supabase
        .from('job_assignments')
        .select(`
          id,
          status,
          user_id,
          ${distanceColumns}
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
        .in('status', statusScope)
        .order('created_at', { ascending: false })
        .limit(500)

      if (companyId && useCarrierFilter) q = (q as any).eq('carrier_company_id', companyId)

      if (companyId && !useCarrierFilter) {
        if (companyUserIds.length === 0) return { data: [], error: null as any }
        q = (q as any).in('user_id', companyUserIds)
      }

      return await q
    }

    let { data, error } = await queryAssignments(true, true)

    const missingColumnsError =
      error &&
      (error as any)?.code === '42703' &&
      /carrier_company_id|distance_completed_km|total_distance_km/i.test(String((error as any)?.message ?? ''))

    if (missingColumnsError) {
      ;({ data, error } = await queryAssignments(false, false))
    }

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