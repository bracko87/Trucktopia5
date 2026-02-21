/**
 * src/services/loadOnDutySessions.ts
 *
 * Safe loader for driving sessions + related assignment entities with
 * additional runtime debugging to help diagnose missing rows.
 *
 * Export:
 *   - loadOnDutySessions(companyId?: string | null): Promise<any[]>
 */

import { supabase } from '../lib/supabase'

/**
 * loadOnDutySessions
 *
 * Load driving sessions for the app's "On Duty" panel in a safe, three-step manner
 * to avoid PostgREST nested relation resolution errors.
 *
 * - Returns only sessions whose job_assignment exists and (optionally)
 *   belong to the provided companyId.
 *
 * This variant includes extra console.debug calls so you can inspect:
 *  - queries made to the API
 *  - counts of returned rows
 *  - any errors encountered when a column/table is missing
 *
 * @param {string | null | undefined} companyId - ID of the company to filter by.
 * @returns {Promise<any[]>} Array of enriched driving session rows.
 */
export async function loadOnDutySessions(companyId?: string | null) {
  if (!companyId) {
    console.debug('loadOnDutySessions: no companyId provided — returning empty list')
    return []
  }

  try {
    // STEP 1: sessions only (safe select)
    // NOTE: Do NOT request non-existing columns - a single bad column breaks the whole query.
    console.debug('loadOnDutySessions: fetching driving_sessions (step 1)')
    const { data: sessions, error: sessErr } = await supabase
      .from('driving_sessions')
      .select(
        [
          'id',
          'phase',
          'distance_completed_km',
          'total_distance_km',
          'phase_started_at',
          'created_at',
          'user_truck_id',
          'job_assignment_id',
          // driver_id kept as some schemas put driver on the session row
          'driver_id',
          'relocation_ready_at',
        ].join(',')
      )
      .order('created_at', { ascending: false })
      .limit(200)

    if (sessErr) {
      // Log full error and return empty so UI does not break.
      console.error('loadOnDutySessions: sessions load error', sessErr)
      return []
    }

    if (!Array.isArray(sessions)) {
      console.debug('loadOnDutySessions: sessions is not an array — returning empty', sessions)
      return []
    }

    console.debug(`loadOnDutySessions: sessions fetched = ${sessions.length}`)

    const assignmentIds = Array.from(
      new Set(sessions.map((s: any) => s.job_assignment_id).filter(Boolean))
    )

    console.debug(`loadOnDutySessions: derived assignmentIds = ${assignmentIds.length}`)

    if (assignmentIds.length === 0) {
      console.debug('loadOnDutySessions: no assignmentIds found — returning empty list')
      return []
    }

    // STEP 2: load assignments with a safe embedded job_offer (minimal)
    console.debug('loadOnDutySessions: fetching job_assignments (step 2)')
    const { data: assignments, error: assErr } = await supabase
      .from('job_assignments')
      .select(
        [
          'id',
          'carrier_company_id',
          'user_truck_id',
          'user_trailer_id',
          'user_id',
          'final_reward',
          'job_offer:job_offer_id(' +
            'id,' +
            'transport_mode,' +
            'reward_load_cargo,' +
            'reward_trailer_cargo,' +
            'distance_km,' +
            'origin_city:origin_city_id(city_name),' +
            'destination_city:destination_city_id(city_name),' +
            'pickup_time,' +
            'delivery_deadline' +
            ')',
        ].join(',')
      )
      .in('id', assignmentIds)

    if (assErr) {
      console.error('loadOnDutySessions: assignments load error', assErr)
      // Fallback: return sessions (without attached assignment) so UI isn't blank
      return sessions
    }

    if (!Array.isArray(assignments)) {
      console.debug('loadOnDutySessions: assignments is not an array — returning sessions-only fallback')
      return sessions
    }

    console.debug(`loadOnDutySessions: assignments fetched = ${assignments.length}`)

    // Build lookup maps
    const assignmentMap: Record<string, any> = {}
    const truckIds = new Set<string>()
    const trailerIds = new Set<string>()
    const userIds = new Set<string>()

    assignments.forEach((a: any) => {
      assignmentMap[String(a.id)] = a
      if (a.user_truck_id) truckIds.add(String(a.user_truck_id))
      if (a.user_trailer_id) trailerIds.add(String(a.user_trailer_id))
      if (a.user_id) userIds.add(String(a.user_id))
    })

    // Add drivers and trucks referenced on sessions (some schemas put these on the session row)
    sessions.forEach((s: any) => {
      if (s.driver_id) userIds.add(String(s.driver_id))
      if (s.user_truck_id) truckIds.add(String(s.user_truck_id))
    })

    console.debug(
      `loadOnDutySessions: aggregated truckIds=${truckIds.size} trailerIds=${trailerIds.size} userIds=${userIds.size}`
    )

    // STEP 3: batch load related entities (trucks, trailers, drivers)
    const truckMap: Record<string, any> = {}
    const trailerMap: Record<string, any> = {}
    const driverMap: Record<string, any> = {}

    // Trucks (best-effort) - include master_truck name via relation
    if (truckIds.size > 0) {
      try {
        const ids = Array.from(truckIds)
        console.debug('loadOnDutySessions: fetching user_trucks for ids', ids)
        const { data: trucks, error: truckErr } = await supabase
          .from('user_trucks')
          .select('id,registration,owner_company_id,master_truck:master_truck_id(name)')
          .in('id', ids)

        if (truckErr) {
          console.warn('loadOnDutySessions: trucks load returned error', truckErr)
        } else if (Array.isArray(trucks)) {
          trucks.forEach((t: any) => {
            if (t?.id) {
              const normalized = {
                ...t,
                name: (t.master_truck && t.master_truck.name) || t.registration || null,
              }
              truckMap[String(t.id)] = normalized
            }
          })
          console.debug(`loadOnDutySessions: trucks loaded = ${Object.keys(truckMap).length}`)
        }
      } catch (e) {
        console.warn('loadOnDutySessions: trucks load failed', e)
      }
    }

    // Trailers (best-effort; some schemas may not have user_trailers)
    if (trailerIds.size > 0) {
      try {
        const ids = Array.from(trailerIds)
        console.debug('loadOnDutySessions: fetching user_trailers for ids', ids)
        const { data: trailers, error: trailerErr } = await supabase
          .from('user_trailers')
          .select('id,name,registration')
          .in('id', ids)

        if (trailerErr) {
          console.warn('loadOnDutySessions: trailers load returned error', trailerErr)
        } else if (Array.isArray(trailers)) {
          trailers.forEach((tr: any) => {
            if (tr?.id) trailerMap[String(tr.id)] = tr
          })
          console.debug(`loadOnDutySessions: trailers loaded = ${Object.keys(trailerMap).length}`)
        }
      } catch (e) {
        console.warn('loadOnDutySessions: trailers load failed', e)
      }
    }

    // Drivers: try hired_staff first (game model), then fallback to users table
    if (userIds.size > 0) {
      const ids = Array.from(userIds)
      try {
        console.debug('loadOnDutySessions: fetching hired_staff for ids', ids)
        const { data: hs, error: hsErr } = await supabase
          .from('hired_staff')
          .select('id,first_name,last_name,name')
          .in('id', ids)

        if (hsErr) {
          console.warn('loadOnDutySessions: hired_staff load returned error', hsErr)
        } else if (Array.isArray(hs)) {
          hs.forEach((h: any) => {
            if (h?.id) driverMap[String(h.id)] = h
          })
          console.debug(`loadOnDutySessions: hired_staff loaded = ${Object.keys(driverMap).length}`)
        }
      } catch (e) {
        console.warn('loadOnDutySessions: hired_staff load failed', e)
      }

      const unresolved = ids.filter((id) => !driverMap[id])
      if (unresolved.length > 0) {
        try {
          console.debug('loadOnDutySessions: fetching public.users fallback for ids', unresolved)
          const { data: users, error: usersErr } = await supabase
            .from('users')
            .select('id,first_name,last_name,name,email')
            .in('id', unresolved)

          if (usersErr) {
            console.warn('loadOnDutySessions: users fallback load returned error', usersErr)
          } else if (Array.isArray(users)) {
            users.forEach((u: any) => {
              if (u?.id && !driverMap[String(u.id)]) {
                driverMap[String(u.id)] = u
              }
            })
            console.debug(`loadOnDutySessions: users fallback loaded = ${Object.keys(driverMap).length}`)
          }
        } catch (e) {
          console.warn('loadOnDutySessions: users fallback load failed', e)
        }
      }
    }

    /**
     * Active phases normalization set (safe + future-proof)
     *
     * This list contains common normalized forms. We normalize by lowercasing
     * and replacing spaces/hyphens with underscores before testing.
     */
    const activePhases = new Set([
      'waiting_driver',
      'waiting',
      'awaiting_driver',

      'assigned',

      'to_pickup',
      'picking_load',
      'loading',

      'to_delivery',
      'delivering',

      'unloading',

      'return_to_hub',
      'returning',
      'return',
    ])

    // Attach related data and resolve reward fallback
    const result = sessions
      .map((s: any) => {
        const assignment = assignmentMap[String(s.job_assignment_id)] ?? null
        if (!assignment) {
          return { ...s, job_assignment: null }
        }

        const jobOffer = assignment.job_offer ?? null

        // Resolve reward: prefer assignment.final_reward otherwise fall back to job_offer rewards
        let resolvedReward: any = null
        if (assignment.final_reward !== undefined && assignment.final_reward !== null) {
          resolvedReward = assignment.final_reward
        } else if (jobOffer) {
          const mode = jobOffer.transport_mode ?? null
          if (mode === 'load_cargo') {
            resolvedReward = jobOffer.reward_load_cargo ?? null
          } else if (mode === 'trailer_cargo') {
            resolvedReward = jobOffer.reward_trailer_cargo ?? null
          } else {
            if (jobOffer.reward_load_cargo !== undefined && jobOffer.reward_load_cargo !== null) {
              resolvedReward = jobOffer.reward_load_cargo
            } else if (jobOffer.reward_trailer_cargo !== undefined && jobOffer.reward_trailer_cargo !== null) {
              resolvedReward = jobOffer.reward_trailer_cargo
            } else {
              resolvedReward = null
            }
          }
        } else {
          resolvedReward = null
        }

        // Prefer truck from assignment; fall back to truck referenced directly on driving_sessions
        const truckFromAssignmentId = assignment.user_truck_id ? String(assignment.user_truck_id) : null
        const truckFromSessionId = s.user_truck_id ? String(s.user_truck_id) : null

        const truck =
          (truckFromAssignmentId ? truckMap[truckFromAssignmentId] ?? null : null) ??
          (truckFromSessionId ? truckMap[truckFromSessionId] ?? null : null)

        const trailer = assignment.user_trailer_id ? trailerMap[String(assignment.user_trailer_id)] ?? null : null

        // Driver resolution: prefer assignment.user_id, then session-level driver_id
        let driver =
          (assignment.user_id ? driverMap[String(assignment.user_id)] : null) ?? null

        if (!driver) {
          if (s.driver_id && driverMap[String(s.driver_id)]) driver = driverMap[String(s.driver_id)]
        }

        return {
          ...s,
          // Expose truck directly on the session for easy access in UI components
          user_truck: truck,
          job_assignment: {
            ...assignment,
            job_offer: jobOffer,
            resolved_reward: resolvedReward,
            user_truck: truck,
            user_trailer: trailer,
            driver,
          },
        }
      })
      // Filter to active phases using normalization
      .filter((row: any) => {
        const phaseRaw = String(row.phase ?? '')
        const phase = phaseRaw.toLowerCase().replace(/[\s-]/g, '_')
        return activePhases.has(phase)
      })
      // Company ownership filter (only filter if assignment exists)
      .filter((row: any) => {
        const ja = row.job_assignment
        if (!ja) return false

        // Allow rows if carrier_company_id missing (avoid removing valid sessions)
        if (!ja.carrier_company_id) return true

        return String(ja.carrier_company_id) === String(companyId)
      })

    console.debug(`loadOnDutySessions: final result count = ${result.length}`)
    return result
  } catch (err) {
    console.error('loadOnDutySessions: unexpected error', err)
    return []
  }
}