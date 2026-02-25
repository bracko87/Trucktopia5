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
 * loadActiveAssignmentsFallback
 *
 * Fallback loader for environments where driving_sessions INSERT/SELECT is blocked by RLS,
 * or when sessions come back empty/unlinked and staging would otherwise show a blank state.
 *
 * IMPORTANT:
 * - This fallback builds session-shaped rows from active job_assignments so Staging Active
 *   remains usable.
 * - It is NOT a full replacement for proper movement tracking / triggers on driving_sessions.
 */
async function loadActiveAssignmentsFallback(companyId: string) {
  // IMPORTANT: Do not include plain "assigned" here.
  // Accepted-but-not-started jobs should not pollute Staging "Active".
  const activeStatuses = [
    'picking_load',
    'PICKING_LOAD',
    'to_pickup',
    'TO_PICKUP',
    'in_progress',
    'IN_PROGRESS',
    'delivering',
    'DELIVERING',
    'waiting_driver',
    'WAITING_DRIVER',
  ]

  const { data: rows, error } = await supabase
    .from('job_assignments')
    .select(
      [
        'id',
        'status',
        'carrier_company_id',
        'user_truck_id',
        'user_trailer_id',
        'user_id',
        'final_reward',
        'accepted_at',
        'assigned_payload_kg',
        'payload_remaining_kg',
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
    .eq('carrier_company_id', companyId)
    .in('status', activeStatuses)
    .order('accepted_at', { ascending: false })
    .limit(200)

  if (error || !Array.isArray(rows)) {
    console.warn('loadOnDutySessions: fallback active assignments load failed', error)
    return []
  }

  return rows.map((a: any) => ({
    id: `fallback-${a.id}`,
    job_assignment_id: a.id,
    phase: a.status,
    distance_completed_km: 0,
    total_distance_km: Number(a?.job_offer?.distance_km ?? 0) || 0,
    phase_started_at: a.accepted_at ?? null,
    created_at: a.accepted_at ?? null,
    user_truck_id: a.user_truck_id ?? null,
    driver_id: a.user_id ?? null,
    relocation_ready_at: null,
    user_truck: null,
    job_assignment: {
      ...a,
      resolved_reward:
        a.final_reward ??
        (a?.job_offer?.transport_mode === 'trailer_cargo'
          ? a?.job_offer?.reward_trailer_cargo
          : a?.job_offer?.reward_load_cargo) ??
        null,
    },
  }))
}

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
 * NOTE:
 * - When driving_sessions are blocked (e.g. RLS) or come back empty/unlinked, staging may
 *   use fallback-from-job_assignments to avoid a total blank state.
 * - That fallback is a temporary UI safeguard and not a full replacement for proper
 *   movement tracking/triggers on driving_sessions.
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
    // Some environments drifted from user_truck_id -> truck_id, so try both and normalize.
    // Some environments are more limited; final fallback variant requests only minimal columns.
    console.debug('loadOnDutySessions: fetching driving_sessions (step 1)')

    const selectVariants = [
      [
        'id',
        'phase',
        'distance_completed_km',
        'total_distance_km',
        'phase_started_at',
        'created_at',
        'user_truck_id',
        'job_assignment_id',
        'driver_id',
        'relocation_ready_at',
      ].join(','),
      [
        'id',
        'phase',
        'distance_completed_km',
        'total_distance_km',
        'phase_started_at',
        'created_at',
        'truck_id',
        'job_assignment_id',
        'driver_id',
        'relocation_ready_at',
      ].join(','),
      [
        'id',
        'phase',
        'distance_completed_km',
        'total_distance_km',
        'phase_started_at',
        'created_at',
        'job_assignment_id',
      ].join(','),
    ]

    let sessions: any[] | null = null
    let sessErr: any = null

    for (const selectClause of selectVariants) {
      console.debug('loadOnDutySessions: trying driving_sessions select variant', selectClause)

      const res = await supabase
        .from('driving_sessions')
        .select(selectClause)
        .order('created_at', { ascending: false })
        .limit(200)

      if (!res.error) {
        sessions = Array.isArray(res.data)
          ? res.data.map((row: any) => ({
              ...row,
              user_truck_id: row?.user_truck_id ?? row?.truck_id ?? null,
            }))
          : []
        sessErr = null
        break
      }

      const code = String(res.error?.code ?? '')
      if (code !== '42703') {
        sessErr = res.error
        break
      }

      // Schema drift (missing column in this variant) — try next variant.
      console.warn('loadOnDutySessions: select variant hit 42703, trying next variant', res.error)
      sessErr = res.error
    }

    if (sessErr) {
      const msg = String(sessErr?.message ?? '').toLowerCase()
      const code = String(sessErr?.code ?? '')
      if (code === '42501' || code === '42703' || msg.includes('row-level security policy')) {
        console.warn('loadOnDutySessions: driving_sessions unavailable, using assignments fallback', sessErr)
        return await loadActiveAssignmentsFallback(String(companyId))
      }

      // Unexpected sessions load error — log and return empty so UI does not break.
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
      console.debug(
        'loadOnDutySessions: no assignmentIds found (sessions empty/unlinked) — using fallback-from-job_assignments for staging; fallback only, not a full replacement for driving_sessions tracking/triggers'
      )
      return await loadActiveAssignmentsFallback(String(companyId))
    }

    // STEP 2: load assignments with a safe embedded job_offer (minimal)
    console.debug('loadOnDutySessions: fetching job_assignments (step 2)')
    const { data: assignments, error: assErr } = await supabase
      .from('job_assignments')
      .select(
        [
          'id',
          'status',
          'carrier_company_id',
          'user_truck_id',
          'user_trailer_id',
          'user_id',
          'final_reward',
          'assigned_payload_kg',
          'payload_remaining_kg',
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
      console.debug(
        'loadOnDutySessions: assignments is not an array — returning sessions-only fallback'
      )
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
            console.debug(
              `loadOnDutySessions: users fallback loaded = ${Object.keys(driverMap).length}`
            )
          }
        } catch (e) {
          console.warn('loadOnDutySessions: users fallback load failed', e)
        }
      }
    }

    /**
     * Terminal phase/status values.
     *
     * The backend has had multiple naming variants over time, so treat anything
     * not terminal as active instead of hard-coding a small allow-list.
     */
    const terminalPhases = new Set([
      'completed',
      'delivered',
      'cancelled',
      'canceled',
      'failed',
      'aborted',
      'done',
      'closed',
      'finished',
      'idle',
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
            if (
              jobOffer.reward_load_cargo !== undefined &&
              jobOffer.reward_load_cargo !== null
            ) {
              resolvedReward = jobOffer.reward_load_cargo
            } else if (
              jobOffer.reward_trailer_cargo !== undefined &&
              jobOffer.reward_trailer_cargo !== null
            ) {
              resolvedReward = jobOffer.reward_trailer_cargo
            } else {
              resolvedReward = null
            }
          }
        } else {
          resolvedReward = null
        }

        // Prefer truck from assignment; fall back to truck referenced directly on driving_sessions
        const truckFromAssignmentId = assignment.user_truck_id
          ? String(assignment.user_truck_id)
          : null
        const truckFromSessionId = s.user_truck_id ? String(s.user_truck_id) : null

        const truck =
          (truckFromAssignmentId ? truckMap[truckFromAssignmentId] ?? null : null) ??
          (truckFromSessionId ? truckMap[truckFromSessionId] ?? null : null)

        const trailer = assignment.user_trailer_id
          ? trailerMap[String(assignment.user_trailer_id)] ?? null
          : null

        // Driver resolution: prefer assignment.user_id, then session-level driver_id
        let driver = (assignment.user_id ? driverMap[String(assignment.user_id)] : null) ?? null

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
      // Filter to active sessions using phase first, then assignment status fallback.
      .filter((row: any) => {
        const phaseRaw = row.phase ?? row.job_assignment?.status ?? ''
        const normalized = String(phaseRaw).trim().toLowerCase().replace(/[\s-]/g, '_')
        if (!normalized) return false
        return !terminalPhases.has(normalized)
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