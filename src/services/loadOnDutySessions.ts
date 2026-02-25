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
 * buildDisplayName
 *
 * Shared display-name normalizer for hydrated related entities.
 * Prefers human-readable values and avoids leaking raw IDs into UI labels.
 */
function buildDisplayName(row: any): string | null {
  if (!row) return null
  if (typeof row.name === 'string' && row.name.trim()) return row.name.trim()

  const first = typeof row.first_name === 'string' ? row.first_name.trim() : ''
  const last = typeof row.last_name === 'string' ? row.last_name.trim() : ''
  const full = [first, last].filter(Boolean).join(' ').trim()
  if (full) return full

  if (typeof row.registration === 'string' && row.registration.trim()) return row.registration.trim()
  if (typeof row.email === 'string' && row.email.trim()) return row.email.trim()
  return null
}

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
 *
 * UPDATE:
 * - Improved Active-name hydration in fallback mode: fallback rows now load and attach
 *   truck/trailer/driver objects by backend IDs (user_trucks, user_trailers, hired_staff/users)
 *   so Active details can show names instead of —.
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

  // ---- NEW: hydrate related entities (trucks/trailers/drivers) for fallback rows ----
  const truckIds = Array.from(new Set(rows.map((r: any) => r?.user_truck_id).filter(Boolean).map(String)))
  const trailerIds = Array.from(new Set(rows.map((r: any) => r?.user_trailer_id).filter(Boolean).map(String)))
  const userIds = Array.from(new Set(rows.map((r: any) => r?.user_id).filter(Boolean).map(String)))

  const truckMap: Record<string, any> = {}
  const trailerMap: Record<string, any> = {}
  const driverMap: Record<string, any> = {}

  if (truckIds.length > 0) {
    const truckSelectVariants = [
      'id,registration,owner_company_id,master_truck:master_truck_id(name)',
      'id,name,registration,owner_company_id',
      'id,registration,owner_company_id',
    ]

    for (const selectClause of truckSelectVariants) {
      const { data: trucks, error: truckErr } = await supabase
        .from('user_trucks')
        .select(selectClause)
        .in('id', truckIds)

      if (truckErr) {
        // schema drift: retry with next variant
        if (
          String(truckErr?.code ?? '') === '42703' ||
          String(truckErr?.code ?? '').startsWith('PGRST') ||
          String(truckErr?.message ?? '').toLowerCase().includes('relationship')
        ) {
          continue
        }
        break
      }

      if (Array.isArray(trucks)) {
        trucks.forEach((t: any) => {
          if (!t?.id) return
          truckMap[String(t.id)] = {
            ...t,
            name: t?.master_truck?.name ?? buildDisplayName(t),
            display_name: t?.master_truck?.name ?? buildDisplayName(t),
          }
        })
      }
      break
    }
  }

  if (trailerIds.length > 0) {
    const trailerSelectVariants = ['id,name,registration', 'id,registration', 'id,name']
    for (const selectClause of trailerSelectVariants) {
      const { data: trailers, error: trailerErr } = await supabase
        .from('user_trailers')
        .select(selectClause)
        .in('id', trailerIds)

      if (trailerErr) {
        // schema drift: retry with next variant
        if (
          String(trailerErr?.code ?? '') === '42703' ||
          String(trailerErr?.code ?? '').startsWith('PGRST') ||
          String(trailerErr?.message ?? '').toLowerCase().includes('relationship')
        ) {
          continue
        }
        break
      }

      if (Array.isArray(trailers)) {
        trailers.forEach((tr: any) => {
          if (!tr?.id) return
          trailerMap[String(tr.id)] = {
            ...tr,
            name: buildDisplayName(tr),
            display_name: buildDisplayName(tr),
          }
        })
      }
      break
    }
  }

  if (userIds.length > 0) {
    const hiredSelectVariants = [
      'id,user_id,first_name,last_name,name',
      'id,first_name,last_name,name',
      'id,user_id,name',
    ]

    for (const selectClause of hiredSelectVariants) {
      const hasUserIdColumn = selectClause.includes('user_id')
      const staffQuery = supabase.from('hired_staff').select(selectClause)

      const { data: hs, error: hsErr } = hasUserIdColumn
        ? await staffQuery.or(`id.in.(${userIds.join(',')}),user_id.in.(${userIds.join(',')})`)
        : await staffQuery.in('id', userIds)

      if (hsErr) {
        // schema drift: retry with next variant
        if (
          String(hsErr?.code ?? '') === '42703' ||
          String(hsErr?.code ?? '').startsWith('PGRST') ||
          String(hsErr?.message ?? '').toLowerCase().includes('relationship')
        ) {
          continue
        }
        break
      }

      if (Array.isArray(hs)) {
        hs.forEach((h: any) => {
          const normalized = { ...h, name: buildDisplayName(h), display_name: buildDisplayName(h) }
          if (h?.id) driverMap[String(h.id)] = normalized
          if (h?.user_id) driverMap[String(h.user_id)] = normalized
        })
      }
      break
    }

    const unresolved = userIds.filter((id) => !driverMap[id])
    if (unresolved.length > 0) {
      const { data: users, error: usersErr } = await supabase
        .from('users')
        .select('id,first_name,last_name,name,email')
        .in('id', unresolved)

      if (usersErr) {
        console.warn('loadOnDutySessions: users fallback load returned error (fallback mode)', usersErr)
      } else if (Array.isArray(users)) {
        users.forEach((u: any) => {
          if (!u?.id) return
          driverMap[String(u.id)] = { ...u, name: buildDisplayName(u), display_name: buildDisplayName(u) }
        })
      }
    }
  }
  // ---- END NEW hydration ----

  return rows.map((a: any) => ({
    id: `fallback-${a.id}`,
    job_assignment_id: a.id,
    phase: a.status,
    distance_completed_km: 0,
    total_distance_km: Number(a?.job_offer?.distance_km ?? 0) || 0,
    phase_started_at: a.accepted_at ?? null,
    created_at: a.accepted_at ?? null,
    user_truck_id: a.user_truck_id ?? null,
    user_trailer_id: a.user_trailer_id ?? null,
    driver_id: a.user_id ?? null,
    relocation_ready_at: null,

    // NEW: attach hydrated truck on the session row too
    user_truck: a.user_truck_id ? truckMap[String(a.user_truck_id)] ?? null : null,

    job_assignment: {
      ...a,

      // NEW: attach hydrated entities so UI can show names/details
      user_truck: a.user_truck_id ? truckMap[String(a.user_truck_id)] ?? null : null,
      user_trailer: a.user_trailer_id ? trailerMap[String(a.user_trailer_id)] ?? null : null,
      driver: a.user_id ? driverMap[String(a.user_id)] ?? null : null,

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
    // Some environments drifted from user_truck_id -> truck_id and user_trailer_id -> trailer_id,
    // so try both and normalize.
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
        'user_trailer_id',
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
        'trailer_id',
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
              user_trailer_id: row?.user_trailer_id ?? row?.trailer_id ?? null,
            }))
          : []
        sessErr = null
        break
      }

      const code = String(res.error?.code ?? '')
      const msg = String(res.error?.message ?? '').toLowerCase()

      // Retry on schema/relation drift, stop on policy errors.
      if (
        code === '42501' ||
        msg.includes('row-level security policy') ||
        msg.includes('permission denied')
      ) {
        sessErr = res.error
        break
      }

      // Schema drift / relation mismatch — try next variant before failing.
      if (code === '42703' || code.startsWith('PGRST') || msg.includes('relationship')) {
        console.warn(
          'loadOnDutySessions: select variant schema/relation mismatch, trying next variant',
          res.error
        )
        sessErr = res.error
        continue
      }

      // Unknown error: stop retry loop and handle below.
      sessErr = res.error
      break
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

    const assignmentIds = Array.from(new Set(sessions.map((s: any) => s.job_assignment_id).filter(Boolean)))

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

    // Add drivers/trucks/trailers referenced on sessions (some schemas put these on the session row)
    sessions.forEach((s: any) => {
      if (s.driver_id) userIds.add(String(s.driver_id))
      if (s.user_truck_id) truckIds.add(String(s.user_truck_id))
      if (s.user_trailer_id) trailerIds.add(String(s.user_trailer_id))
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

        const truckSelectVariants = [
          'id,registration,owner_company_id,master_truck:master_truck_id(name)',
          'id,name,registration,owner_company_id',
          'id,registration,owner_company_id',
        ]

        for (const selectClause of truckSelectVariants) {
          const { data: trucks, error: truckErr } = await supabase
            .from('user_trucks')
            .select(selectClause)
            .in('id', ids)

          if (truckErr) {
            const code = String(truckErr?.code ?? '')
            const msg = String(truckErr?.message ?? '').toLowerCase()
            if (code === '42703' || code.startsWith('PGRST') || msg.includes('relationship')) {
              console.debug('loadOnDutySessions: retry user_trucks select with fallback columns', selectClause)
              continue
            }
            console.warn('loadOnDutySessions: trucks load returned error', truckErr)
            break
          }

          if (Array.isArray(trucks)) {
            trucks.forEach((t: any) => {
              if (t?.id) {
                const normalized = {
                  ...t,
                  name: t?.master_truck?.name ?? buildDisplayName(t),
                  display_name: t?.master_truck?.name ?? buildDisplayName(t),
                }
                truckMap[String(t.id)] = normalized
              }
            })
            console.debug(`loadOnDutySessions: trucks loaded = ${Object.keys(truckMap).length}`)
          }
          break
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

        const trailerSelectVariants = ['id,name,registration', 'id,registration', 'id,name']

        for (const selectClause of trailerSelectVariants) {
          const { data: trailers, error: trailerErr } = await supabase
            .from('user_trailers')
            .select(selectClause)
            .in('id', ids)

          if (trailerErr) {
            const code = String(trailerErr?.code ?? '')
            const msg = String(trailerErr?.message ?? '').toLowerCase()
            if (code === '42703' || code.startsWith('PGRST') || msg.includes('relationship')) {
              console.debug('loadOnDutySessions: retry user_trailers select with fallback columns', selectClause)
              continue
            }
            console.warn('loadOnDutySessions: trailers load returned error', trailerErr)
            break
          }

          if (Array.isArray(trailers)) {
            trailers.forEach((tr: any) => {
              if (tr?.id) {
                const readableName = buildDisplayName(tr)
                trailerMap[String(tr.id)] = {
                  ...tr,
                  name: readableName ?? tr?.name ?? null,
                  display_name: readableName,
                }
              }
            })
            console.debug(`loadOnDutySessions: trailers loaded = ${Object.keys(trailerMap).length}`)
          }
          break
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

        const hiredStaffSelectVariants = [
          'id,user_id,first_name,last_name,name',
          'id,first_name,last_name,name',
          'id,user_id,name',
        ]

        for (const selectClause of hiredStaffSelectVariants) {
          const hasUserIdColumn = selectClause.includes('user_id')
          const staffQuery = supabase.from('hired_staff').select(selectClause)

          const { data: hs, error: hsErr } = hasUserIdColumn
            ? await staffQuery.or(`id.in.(${ids.join(',')}),user_id.in.(${ids.join(',')})`)
            : await staffQuery.in('id', ids)

          if (hsErr) {
            const code = String(hsErr?.code ?? '')
            const msg = String(hsErr?.message ?? '').toLowerCase()
            if (code === '42703' || code.startsWith('PGRST') || msg.includes('relationship')) {
              console.debug('loadOnDutySessions: retry hired_staff select with fallback columns', selectClause)
              continue
            }
            console.warn('loadOnDutySessions: hired_staff load returned error', hsErr)
            break
          }

          if (Array.isArray(hs)) {
            hs.forEach((h: any) => {
              const normalized = {
                ...h,
                name: buildDisplayName(h),
                display_name: buildDisplayName(h),
              }

              if (h?.id) driverMap[String(h.id)] = normalized
              if (h?.user_id) driverMap[String(h.user_id)] = normalized
            })
            console.debug(`loadOnDutySessions: hired_staff loaded = ${Object.keys(driverMap).length}`)
          }
          break
        }
      } catch (e) {
        console.warn('loadOnDutySessions: hired_staff load failed', e)
      }

      // Extra hardening: id-only fallback for schemas where hired_staff.user_id is unavailable
      const unresolved = ids.filter((id) => !driverMap[id])
      if (unresolved.length > 0) {
        try {
          console.debug('loadOnDutySessions: hired_staff id-only fallback for unresolved ids', unresolved)

          const idOnlySelectVariants = ['id,first_name,last_name,name', 'id,name']

          for (const selectClause of idOnlySelectVariants) {
            const { data: hs, error: hsErr } = await supabase
              .from('hired_staff')
              .select(selectClause)
              .in('id', unresolved)

            if (hsErr) {
              const code = String(hsErr?.code ?? '')
              const msg = String(hsErr?.message ?? '').toLowerCase()
              if (code === '42703' || code.startsWith('PGRST') || msg.includes('relationship')) {
                console.debug('loadOnDutySessions: retry hired_staff id-only select with fallback columns', selectClause)
                continue
              }
              console.warn('loadOnDutySessions: hired_staff id-only load returned error', hsErr)
              break
            }

            if (Array.isArray(hs)) {
              hs.forEach((h: any) => {
                const normalized = {
                  ...h,
                  name: buildDisplayName(h),
                  display_name: buildDisplayName(h),
                }
                if (h?.id) driverMap[String(h.id)] = normalized
              })
              console.debug(`loadOnDutySessions: hired_staff id-only loaded = ${Object.keys(driverMap).length}`)
            }
            break
          }
        } catch (e) {
          console.warn('loadOnDutySessions: hired_staff id-only fallback failed', e)
        }
      }

      const stillUnresolved = ids.filter((id) => !driverMap[id])
      if (stillUnresolved.length > 0) {
        try {
          console.debug('loadOnDutySessions: fetching public.users fallback for ids', stillUnresolved)
          const { data: users, error: usersErr } = await supabase
            .from('users')
            .select('id,first_name,last_name,name,email')
            .in('id', stillUnresolved)

          if (usersErr) {
            console.warn('loadOnDutySessions: users fallback load returned error', usersErr)
          } else if (Array.isArray(users)) {
            users.forEach((u: any) => {
              if (u?.id && !driverMap[String(u.id)]) {
                const readableName = buildDisplayName(u)
                driverMap[String(u.id)] = {
                  ...u,
                  name: readableName ?? u?.name ?? null,
                  display_name: readableName,
                }
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
            if (jobOffer.reward_load_cargo !== undefined && jobOffer.reward_load_cargo !== null) {
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
        const truckFromAssignmentId = assignment.user_truck_id ? String(assignment.user_truck_id) : null
        const truckFromSessionId = s.user_truck_id ? String(s.user_truck_id) : null

        const truck =
          (truckFromAssignmentId ? truckMap[truckFromAssignmentId] ?? null : null) ??
          (truckFromSessionId ? truckMap[truckFromSessionId] ?? null : null)

        // Trailer: prefer assignment-level trailer, then session-level trailer fallback
        const trailerFromAssignmentId = assignment.user_trailer_id ? String(assignment.user_trailer_id) : null
        const trailerFromSessionId = s.user_trailer_id ? String(s.user_trailer_id) : null

        const trailer =
          (trailerFromAssignmentId ? trailerMap[trailerFromAssignmentId] ?? null : null) ??
          (trailerFromSessionId ? trailerMap[trailerFromSessionId] ?? null : null)

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
      // IMPORTANT: exclude raw "assigned" (accepted but not started) from Staging Active.
      .filter((row: any) => {
        const phaseRaw = row.phase ?? row.job_assignment?.status ?? ''
        const normalized = String(phaseRaw).trim().toLowerCase().replace(/[\s-]/g, '_')
        if (!normalized) return false
        if (normalized === 'assigned') return false
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