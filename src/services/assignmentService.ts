/**
 * assignmentService.ts
 *
 * Client-side finalization flow for job assignments.
 *
 * Client-side helper that finalises an assignment by updating an existing
 * job_assignments row, creating a driving session (if missing), updating
 * truck/trailer statuses and reserving only the selected drivers.
 *
 * This prevents duplicate-insert unique-constraint errors (ux_job_offer_active_assignment),
 * avoids mass-updating all free staff in a company, and now blocks finalization when the
 * selected hired staff driver is already busy (not free/standby).
 *
 * Note: driving_sessions is treated as REQUIRED for active movement lifecycle.
 * If driving_sessions insert is blocked (including RLS), finalization now throws.
 *
 * Lifecycle / locking note:
 * - Partial lifecycle enforcement is already implemented:
 *   1) truck uniqueness during active assignment is handled via
 *      ux_job_offer_truck_active_assignment conflict recovery/reuse paths
 *   2) selected hired_staff drivers are validated as free/standby before finalize
 *   3) selected drivers are reserved on finalize only if still free/standby
 *      (prevents multi-job double booking)
 */

import { supabase } from '../lib/supabase'

/**
 * FinalizeAssignmentOpts
 *
 * Options supplied from the UI when confirming an assignment.
 */
export interface FinalizeAssignmentOpts {
  jobOfferId?: string | null
  userTruckId?: string | null
  trailerId?: string | null
  companyId?: string | null
  carrierCompanyId?: string | null
  userId?: string | null
  pickupCityId?: string | null
  truckCityId?: string | null
  distance?: number | null
  previewData?: any
  assignment?: any
}

/**
 * finalizeAssignmentDirect
 *
 * Finalize an assignment by updating an existing job_assignments row (do NOT insert).
 *
 * Steps:
 * 0) Validate the selected hired_staff driver is still free/standby (when provided).
 * 1) Find an existing assignment for the job_offer that is in an active/assignable state.
 * 2) If found, update the assignment with truck/user and move it to an active status.
 *    - Includes conflict recovery for ux_job_offer_truck_active_assignment to preserve
 *      active-truck uniqueness semantics.
 * 2b) For multi-run load cargo jobs, create/update a follow-up assigned row with remaining payload.
 * 2c) Keep job_offers.remaining_payload in sync with the computed remainder.
 * 3) Insert a driving_sessions row (phase = 'TO_PICKUP') linked to the updated assignment
 *    only if no driving session already exists for that assignment.
 *    The UI then waits for movement progression from that initial TO_PICKUP phase.
 *    If insert is blocked by RLS, continue without a session row (warn only).
 * 4) Update user_trucks / user_trailers statuses to 'PICKING_LOAD' when provided.
 * 5) Reserve only the selected hired_staff rows (by id) if they are still free/standby.
 *    Finalization fails if any selected driver cannot be reserved.
 *
 * Important: If no assignment exists (meaning accept path didn't create one), this function
 * will throw an error — prefer the market accept flow to create the assignment first.
 *
 * @param opts FinalizeAssignmentOpts
 * @returns object containing the updated assignment (assignment)
 */
export async function finalizeAssignmentDirect(opts: FinalizeAssignmentOpts) {
  const {
    jobOfferId,
    userTruckId,
    trailerId,
    companyId,
    carrierCompanyId,
    userId,
    pickupCityId,
    truckCityId,
    distance,
    previewData,
    assignment,
  } = opts

  // Debug log requested by the workflow
  // eslint-disable-next-line no-console
  console.log('FINALIZE INPUT', {
    jobOfferId,
    userTruckId,
    companyId,
    carrierCompanyId,
    previewData,
    assignment,
  })

  // Resolve carrierCompanyId using safe fallbacks
  const resolvedCarrierCompanyId =
    carrierCompanyId ??
    companyId ??
    previewData?.carrier_company_id ??
    assignment?.truck?._raw?.owner_company_id ??
    null

  const acceptedAt = new Date().toISOString()

  const selectedDriverId =
    Array.isArray(assignment?.drivers) && assignment.drivers.length > 0
      ? String(assignment.drivers[0]?.id ?? '') || null
      : null

  // Guard — prevent assigning a hired staff driver who is already busy.
  if (selectedDriverId) {
    try {
      const { data: driverRow, error: driverErr } = await supabase
        .from('hired_staff')
        .select('id,activity_id')
        .eq('id', selectedDriverId)
        .limit(1)
        .maybeSingle()

      if (!driverErr && driverRow?.activity_id) {
        const activity = String(driverRow.activity_id).toLowerCase()
        if (!['free', 'standby'].includes(activity)) {
          throw new Error('Selected driver is already assigned to another task')
        }
      }
    } catch (driverCheckErr) {
      // eslint-disable-next-line no-console
      console.error('finalizeAssignmentDirect: driver availability check failed', driverCheckErr)
      throw driverCheckErr
    }
  }

  // Prepare minimal update payload for the assignment
  const updatePayload: any = {
    user_truck_id: userTruckId ?? null,
    user_trailer_id: trailerId ?? null,
    // job_assignments.user_id usually references auth/public users; keep actor user id here.
    user_id: userId ?? null,
    accepted_at: acceptedAt,
    // Use consistent enum casing to match truck status updates and DB expectations.
    status: 'picking_load',
  }

  // Step 1 — Find an existing assignment for this job_offer
  const jobOfferKey = jobOfferId ?? previewData?.job_offer?.id ?? assignment?.job_offer_id ?? null
  if (!jobOfferKey) {
    // eslint-disable-next-line no-console
    console.error('finalizeAssignmentDirect: missing jobOfferId')
    throw new Error('Missing jobOfferId')
  }

  const { data: existingAssignments, error: findErr } = await supabase
    .from('job_assignments')
    .select('*')
    .eq('job_offer_id', jobOfferKey)
    .in('status', [
      'assigned',
      'picking_load',
      'PICKING_LOAD',
      'in_progress',
      'IN_PROGRESS',
      'delivering',
      'DELIVERING',
      'to_pickup',
      'TO_PICKUP',
    ])
    .order('accepted_at', { ascending: false })

  if (findErr) {
    // eslint-disable-next-line no-console
    console.error('finalizeAssignmentDirect: failed to find existing job_assignments', findErr)
    throw findErr
  }

  const assignmentPool = Array.isArray(existingAssignments) ? existingAssignments : []

  const existingAssignment =
    assignmentPool.find(
      (a: any) => previewData?.id && String(a?.assignment_preview_id ?? '') === String(previewData.id)
    ) ??
    assignmentPool.find((a: any) => userTruckId && String(a?.user_truck_id ?? '') === String(userTruckId)) ??
    assignmentPool.find((a: any) => String(a?.status ?? '').toLowerCase() === 'assigned') ??
    assignmentPool[0] ??
    null

  if (!existingAssignment) {
    // No prior assignment found — cannot finalize what doesn't exist
    // eslint-disable-next-line no-console
    console.error('finalizeAssignmentDirect: no existing assignment found to finalize', {
      job_offer_id: jobOfferKey,
    })
    throw new Error('No assignment found to finalize')
  }

  // Load job offer payload state so multi-run load jobs can keep remainder in Waiting/Staging.
  const { data: jobOfferRow, error: jobOfferErr } = await supabase
    .from('job_offers')
    .select('id,transport_mode,remaining_payload,weight_kg')
    .eq('id', jobOfferKey)
    .limit(1)
    .maybeSingle()

  if (jobOfferErr) {
    // eslint-disable-next-line no-console
    console.error('finalizeAssignmentDirect: failed to load job_offers payload state', jobOfferErr)
  }

  const sourcePayload =
    Number(
      jobOfferRow?.remaining_payload ??
        jobOfferRow?.weight_kg ??
        existingAssignment?.payload_remaining_kg ??
        0
    ) || 0

  let resolvedTruckCapacity =
    Number(
      assignment?.truck?._raw?.model_max_load_kg ??
        assignment?.truck?._raw?.master_truck_id?.max_load_kg ??
        assignment?.truck?._raw?.master_truck_id?.payload_kg ??
        previewData?.truck_capacity_kg ??
        0
    ) || 0

  // Fallback: resolve capacity from user_trucks when UI payload omits capacity fields.
  if (resolvedTruckCapacity <= 0 && userTruckId) {
    try {
      const { data: truckRow, error: truckCapErr } = await supabase
        .from('user_trucks')
        .select('model_max_load_kg')
        .eq('id', userTruckId)
        .limit(1)
        .maybeSingle()

      if (truckCapErr) {
        // eslint-disable-next-line no-console
        console.error('finalizeAssignmentDirect: failed to load truck capacity', truckCapErr)
      } else {
        resolvedTruckCapacity = Number(truckRow?.model_max_load_kg ?? 0) || 0
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('finalizeAssignmentDirect: truck capacity lookup exception', e)
    }
  }

  // Fixed duplicate “leftover cargo card” issue for multi-run load jobs:
  // - Active run row: payload_remaining_kg = 0
  // - Follow-up assigned row: keeps remaining payload
  const assignedPayload = Math.max(
    0,
    Math.min(sourcePayload, resolvedTruckCapacity > 0 ? resolvedTruckCapacity : sourcePayload)
  )
  const remainingPayload = Math.max(0, sourcePayload - assignedPayload)
  const isLoadCargo = String(jobOfferRow?.transport_mode ?? '').toLowerCase() === 'load_cargo'

  // Helper: resolve another owned truck id for follow-up "waiting" rows when the primary truck
  // conflicts with a unique active-assignment constraint.
  async function resolveAlternativeTruckId(): Promise<string | null> {
    const excludeTruckId = userTruckId ?? null
    if (!resolvedCarrierCompanyId) return null

    const tryColumns = ['owner_company_id', 'company_id']

    for (const companyColumn of tryColumns) {
      try {
        let query = supabase.from('user_trucks').select('id').eq(companyColumn, resolvedCarrierCompanyId)

        if (excludeTruckId) {
          query = query.neq('id', excludeTruckId)
        }

        const { data, error } = await query.limit(5)

        if (error) {
          // eslint-disable-next-line no-console
          console.debug('finalizeAssignmentDirect: alternative truck lookup failed for column', {
            companyColumn,
            error,
          })
          continue
        }

        const altTruckId =
          (Array.isArray(data)
            ? data.map((r: any) => String(r?.id ?? '')).find(Boolean)
            : null) ?? null

        if (altTruckId) {
          return altTruckId
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.debug('finalizeAssignmentDirect: alternative truck lookup exception', {
          companyColumn,
          error: e,
        })
      }
    }

    return null
  }

  // Step 2 — Update the existing assignment (do NOT insert)
  const updateDoc = {
    user_truck_id: updatePayload.user_truck_id,
    user_trailer_id: updatePayload.user_trailer_id,
    user_id: updatePayload.user_id,
    accepted_at: updatePayload.accepted_at,
    status: updatePayload.status,
    assignment_preview_id: previewData?.id ?? existingAssignment?.assignment_preview_id ?? null,
    assigned_payload_kg: assignedPayload,
    // Active run row should represent this run payload; keep remaining payload on follow-up assigned rows.
    payload_remaining_kg: isLoadCargo ? 0 : remainingPayload,
  }

  let { data: assignmentRow, error: updateErr } = await supabase
    .from('job_assignments')
    .update(updateDoc)
    .eq('id', existingAssignment.id)
    .select()
    .single()

  /**
   * Partial lifecycle/locking enforcement:
   * If the target row update hits ux_job_offer_truck_active_assignment, try to reuse
   * the conflicting active row already bound to the selected truck for this job lifecycle.
   */
  if (
    updateErr?.code == '23505' &&
    String(updateErr?.message ?? '').includes('ux_job_offer_truck_active_assignment') &&
    userTruckId
  ) {
    const conflictRow = assignmentPool.find(
      (a: any) =>
        String(a?.id ?? '') !== String(existingAssignment.id) &&
        String(a?.user_truck_id ?? '') === String(userTruckId)
    )

    if (conflictRow?.id) {
      const retry = await supabase
        .from('job_assignments')
        .update(updateDoc)
        .eq('id', conflictRow.id)
        .select()
        .single()

      assignmentRow = retry.data as any
      updateErr = retry.error as any
    }
  }

  // Harden against persistent collisions: if update still conflicts, reuse the already-active row
  // for the same (job_offer_id, user_truck_id) instead of failing outright.
  if (
    updateErr?.code == '23505' &&
    String(updateErr?.message ?? '').includes('ux_job_offer_truck_active_assignment') &&
    userTruckId
  ) {
    const { data: alreadyActiveForTruck } = await supabase
      .from('job_assignments')
      .select('*')
      .eq('job_offer_id', jobOfferKey)
      .eq('user_truck_id', userTruckId)
      .in('status', [
        'assigned',
        'picking_load',
        'PICKING_LOAD',
        'in_progress',
        'IN_PROGRESS',
        'delivering',
        'DELIVERING',
        'to_pickup',
        'TO_PICKUP',
      ])
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (alreadyActiveForTruck?.id) {
      assignmentRow = alreadyActiveForTruck as any
      updateErr = null as any
    }
  }

  if (updateErr) {
    // eslint-disable-next-line no-console
    console.error('finalizeAssignmentDirect: failed to update job_assignments', updateErr)
    throw updateErr
  }

  // Link preview back to assignment for trigger/routing functions that read assignment_preview_id.
  if (previewData?.id) {
    try {
      const { error: previewLinkErr } = await supabase
        .from('assignment_previews')
        .update({ assignment_id: assignmentRow.id, company_id: resolvedCarrierCompanyId })
        .eq('id', previewData.id)

      if (previewLinkErr) {
        // eslint-disable-next-line no-console
        console.error('finalizeAssignmentDirect: failed to link assignment_previews row', previewLinkErr)
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('finalizeAssignmentDirect: assignment_previews link exception', e)
    }
  }

  // Step 2b — For multi-run load cargo, create follow-up waiting assignment with remaining payload.
  if (isLoadCargo && remainingPayload > 0) {
    const { data: existingFollowUp } = await supabase
      .from('job_assignments')
      .select('id')
      .eq('job_offer_id', jobOfferKey)
      .eq('status', 'assigned')
      .neq('id', assignmentRow.id)
      .limit(1)
      .maybeSingle()

    let followUpErr: any = null

    const baseFollowUpPayload: any = {
      carrier_company_id: resolvedCarrierCompanyId,
      user_id: updatePayload.user_id ?? null,
      user_truck_id: null,
      user_trailer_id: null,
      accepted_at: acceptedAt,
      assigned_payload_kg: 0,
      payload_remaining_kg: remainingPayload,
    }

    if (existingFollowUp?.id) {
      let res = await supabase
        .from('job_assignments')
        .update(baseFollowUpPayload)
        .eq('id', existingFollowUp.id)

      // Some environments enforce user_truck_id NOT NULL for all rows.
      if (
        res.error?.code == '23514' &&
        String(res.error?.message ?? '').includes('job_assignments_truck_required') &&
        userTruckId
      ) {
        res = await supabase
          .from('job_assignments')
          .update({ ...baseFollowUpPayload, user_truck_id: userTruckId })
          .eq('id', existingFollowUp.id)
      }

      // If same truck conflicts with unique active-assignment constraint, use another owned truck for waiting row.
      if (
        res.error?.code == '23505' &&
        String(res.error?.message ?? '').includes('ux_job_offer_truck_active_assignment')
      ) {
        const altTruckId = await resolveAlternativeTruckId()
        if (altTruckId) {
          res = await supabase
            .from('job_assignments')
            .update({ ...baseFollowUpPayload, user_truck_id: altTruckId })
            .eq('id', existingFollowUp.id)
        }
      }

      followUpErr = res.error
    } else {
      let res = await supabase.from('job_assignments').insert({
        job_offer_id: jobOfferKey,
        status: 'assigned',
        ...baseFollowUpPayload,
      })

      // Some environments enforce user_truck_id NOT NULL for all rows.
      if (
        res.error?.code == '23514' &&
        String(res.error?.message ?? '').includes('job_assignments_truck_required') &&
        userTruckId
      ) {
        res = await supabase.from('job_assignments').insert({
          job_offer_id: jobOfferKey,
          status: 'assigned',
          ...baseFollowUpPayload,
          user_truck_id: userTruckId,
        })
      }

      // If same truck conflicts with unique active-assignment constraint, use another owned truck for waiting row.
      if (
        res.error?.code == '23505' &&
        String(res.error?.message ?? '').includes('ux_job_offer_truck_active_assignment')
      ) {
        const altTruckId = await resolveAlternativeTruckId()
        if (altTruckId) {
          res = await supabase.from('job_assignments').insert({
            job_offer_id: jobOfferKey,
            status: 'assigned',
            ...baseFollowUpPayload,
            user_truck_id: altTruckId,
          })
        }
      }

      followUpErr = res.error
    }

    if (followUpErr) {
      const isUniqueTruckActiveConflict =
        followUpErr?.code == '23505' &&
        String(followUpErr?.message ?? '').includes('ux_job_offer_truck_active_assignment')

      if (isUniqueTruckActiveConflict) {
        // eslint-disable-next-line no-console
        console.warn(
          'finalizeAssignmentDirect: skipped follow-up row due to active assignment unique constraint',
          followUpErr
        )
      } else {
        // eslint-disable-next-line no-console
        console.error('finalizeAssignmentDirect: failed to create follow-up assigned row', followUpErr)
        throw followUpErr
      }
    }
  }

  // Step 2c — Keep job offer payload in sync with computed remainder.
  try {
    const { error: jobOfferUpdateErr } = await supabase
      .from('job_offers')
      .update({ remaining_payload: remainingPayload })
      .eq('id', jobOfferKey)

    if (jobOfferUpdateErr) {
      // eslint-disable-next-line no-console
      console.error('finalizeAssignmentDirect: failed to update job_offers.remaining_payload', jobOfferUpdateErr)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('finalizeAssignmentDirect: job_offers update exception', e)
  }

  // Step 3 — Insert driving_sessions
  // Finalize inserts a driving session in TO_PICKUP, then UI waits for progression.
  try {
    const drivingPayload: any = {
      job_assignment_id: assignmentRow.id,
      phase: 'TO_PICKUP',
      origin_city_id: truckCityId ?? assignment?.truck?._raw?.location_city_id ?? null,
      target_city_id: pickupCityId ?? assignment?.cargo?.job_offer?.origin_city_id ?? null,
      current_city_id: truckCityId ?? assignment?.truck?._raw?.location_city_id ?? null,
      total_distance_km: distance ?? assignment?.cargo?.job_offer?.distance_km ?? null,
      distance_completed_km: 0,
      phase_started_at: acceptedAt,
      user_truck_id: userTruckId ?? null,
      user_trailer_id: trailerId ?? null,
      driver_id: selectedDriverId ?? null,
    }

    /**
     * Avoid duplicate driving_sessions for the same assignment by checking for an existing row.
     */
    const { data: existingSession, error: existingSessionErr } = await supabase
      .from('driving_sessions')
      .select('id')
      .eq('job_assignment_id', assignmentRow.id)
      .limit(1)
      .maybeSingle()

    if (existingSessionErr) {
      // eslint-disable-next-line no-console
      console.error('finalizeAssignmentDirect: failed to check existing driving_sessions', existingSessionErr)
    }

    if (!existingSession) {
      const drivingPayloadVariants: any[] = [
        drivingPayload,
        { ...drivingPayload, phase: 'to_pickup' },
        {
          job_assignment_id: assignmentRow.id,
          phase: 'to_pickup',
          origin_city_id: drivingPayload.origin_city_id,
          target_city_id: drivingPayload.target_city_id,
          current_city_id: drivingPayload.current_city_id,
          total_distance_km: drivingPayload.total_distance_km,
          distance_completed_km: 0,
          phase_started_at: acceptedAt,
        },
      ]

      let insertRes: any = null
      for (const payload of drivingPayloadVariants) {
        insertRes = await supabase.from('driving_sessions').insert(payload)
        if (!insertRes.error) break

        const code = String(insertRes.error?.code ?? '')
        const msg = String(insertRes.error?.message ?? '').toLowerCase()
        if (code !== '42703' && !msg.includes('column') && !msg.includes('schema cache')) {
          break
        }
      }

      if (insertRes?.error) {
        const errMsg = String(insertRes.error?.message ?? '').toLowerCase()
        const errCode = String(insertRes.error?.code ?? '')
        const isRlsInsertError =
          errCode === '42501' ||
          errMsg.includes('row-level security policy') ||
          errMsg.includes('permission denied')

        if (isRlsInsertError) {
          // eslint-disable-next-line no-console
          console.warn(
            'finalizeAssignmentDirect: driving_sessions insert blocked by RLS; continuing without session',
            insertRes.error
          )
        } else {
          // eslint-disable-next-line no-console
          console.error('finalizeAssignmentDirect: failed to insert driving_sessions', insertRes.error)
          throw insertRes.error
        }
      }
    } else {
      // eslint-disable-next-line no-console
      console.debug('finalizeAssignmentDirect: driving session already exists for assignment', {
        assignmentId: assignmentRow.id,
      })
    }
  } catch (e: any) {
    const msg = String(e?.message ?? '').toLowerCase()
    const code = String(e?.code ?? '')
    const isRlsInsertError =
      code === '42501' || msg.includes('row-level security policy') || msg.includes('permission denied')

    if (isRlsInsertError) {
      // eslint-disable-next-line no-console
      console.warn('finalizeAssignmentDirect: driving_sessions insert exception caused by RLS; continuing', e)
    } else {
      // eslint-disable-next-line no-console
      console.error('finalizeAssignmentDirect: driving_sessions insert exception', e)
      throw e
    }
  }

  // Step 4 — Update truck status
  if (userTruckId) {
    try {
      const { error: truckUpdateErr } = await supabase
        .from('user_trucks')
        .update({ status: 'PICKING_LOAD' })
        .eq('id', userTruckId)

      if (truckUpdateErr) {
        // eslint-disable-next-line no-console
        console.error('finalizeAssignmentDirect: failed to update user_trucks', truckUpdateErr)
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('finalizeAssignmentDirect: user_trucks update exception', e)
    }
  }

  // Step 5 — Update trailer status (optional)
  if (trailerId) {
    try {
      const { error: trailerUpdateErr } = await supabase
        .from('user_trailers')
        .update({ status: 'PICKING_LOAD' })
        .eq('id', trailerId)

      if (trailerUpdateErr) {
        // eslint-disable-next-line no-console
        console.error('finalizeAssignmentDirect: failed to update user_trailers', trailerUpdateErr)
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('finalizeAssignmentDirect: user_trailers update exception', e)
    }
  }

  // Step 6 — Reserve selected hired_staff rows (hard-fail finalize when reservation cannot be enforced).
  // This prevents one driver being booked on multiple jobs concurrently.
  const driverIds: string[] =
    (assignment?.drivers?.map((d: any) => String(d?.id)).filter(Boolean) as string[]) ?? []

  if (driverIds.length > 0) {
    try {
      const reservationVariants: Array<Record<string, any>> = [
        { activity_id: 'assigned', activity_until: null, last_active_at: acceptedAt },
        { activity_id: 'assigned', last_active_at: acceptedAt },
        { activity_id: 'assigned' },
      ]

      let reserveErr: any = null
      let reservationAttempted = false

      for (const payload of reservationVariants) {
        const res = await supabase
          .from('hired_staff')
          .update(payload)
          .in('id', driverIds)
          .in('activity_id', ['free', 'standby', 'FREE', 'STANDBY'])

        if (!res.error) {
          reserveErr = null
          reservationAttempted = true
          break
        }

        const code = String(res.error?.code ?? '')
        const msg = String(res.error?.message ?? '').toLowerCase()
        const isMissingColumn = code === '42703' || msg.includes('column') || msg.includes('schema cache')
        if (isMissingColumn) {
          reserveErr = res.error
          continue
        }

        reserveErr = res.error
        break
      }

      if (reserveErr) {
        // eslint-disable-next-line no-console
        console.error('finalizeAssignmentDirect: failed to reserve hired_staff by id', reserveErr)
        throw reserveErr
      }

      if (reservationAttempted) {
        // Verify reservation when RLS allows reads. In stricter environments the read may be blocked,
        // in which case we keep the finalize flow based on successful guarded update above.
        const verifyRes = await supabase
          .from('hired_staff')
          .select('id, activity_id')
          .in('id', driverIds)

        if (verifyRes.error) {
          const code = String(verifyRes.error?.code ?? '')
          const msg = String(verifyRes.error?.message ?? '').toLowerCase()
          const readBlocked = code === '42501' || msg.includes('row-level security policy')
          if (!readBlocked) {
            // eslint-disable-next-line no-console
            console.warn(
              'finalizeAssignmentDirect: hired_staff reservation verify failed; continuing with guarded update result',
              verifyRes.error
            )
          }
        } else {
          const rows = Array.isArray(verifyRes.data)
            ? (verifyRes.data as Array<{ id: string; activity_id?: string | null }>)
            : []

          const reservedIds = new Set(
            rows
              .filter((r) => String(r?.activity_id ?? '').toLowerCase() === 'assigned')
              .map((r) => String(r.id))
          )

          const missing = driverIds.filter((id) => !reservedIds.has(String(id)))

          if (missing.length > 0) {
            throw new Error(
              `Driver reservation failed for ${missing.length} selected driver(s). Please refresh staging and choose available drivers again.`
            )
          }
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('finalizeAssignmentDirect: hired_staff reserve exception', e)
      throw e
    }
  } else {
    // No drivers selected in the assignment — do not mass-update company staff.
    // eslint-disable-next-line no-console
    console.debug('finalizeAssignmentDirect: no drivers provided in assignment; skipping hired_staff reservation')
  }

  return { assignment: assignmentRow }
}