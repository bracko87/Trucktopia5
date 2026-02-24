/**
 * assignmentService.ts
 *
 * Client-side finalization flow for job assignments.
 *
 * Client-side helper that finalises an assignment by updating an existing
 * job_assignments row, creating a driving session (if missing), updating
 * truck/trailer statuses and marking only the selected drivers as assigned.
 *
 * This prevents duplicate-insert unique-constraint errors (ux_job_offer_active_assignment)
 * and avoids mass-updating all free staff in a company.
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
 * 1) Find an existing assignment for the job_offer that is in an active/assignable state.
 * 2) If found, update the assignment with truck/user and move it to an active status.
 * 2b) For multi-run load cargo jobs, create/update a follow-up assigned row with remaining payload.
 * 2c) Keep job_offers.remaining_payload in sync with the computed remainder.
 * 3) Insert a driving_sessions row (phase = 'TO_PICKUP') linked to the updated assignment
 *    only if no driving session already exists for that assignment.
 * 4) Update user_trucks / user_trailers statuses to 'PICKING_LOAD' when provided.
 * 5) Update only the selected hired_staff rows (by id) to activity_id = 'assigned'.
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

  // Prepare minimal update payload for the assignment
  const updatePayload: any = {
    user_truck_id: userTruckId ?? null,
    user_id: userId ?? null,
    accepted_at: acceptedAt,
    // Use consistent enum casing to match truck status updates and DB expectations.
    status: 'PICKING_LOAD',
  }

  // Step 1 — Find an existing assignment for this job_offer
  const jobOfferKey = jobOfferId ?? previewData?.job_offer?.id ?? assignment?.job_offer_id ?? null
  if (!jobOfferKey) {
    // eslint-disable-next-line no-console
    console.error('finalizeAssignmentDirect: missing jobOfferId')
    throw new Error('Missing jobOfferId')
  }

  const { data: existingAssignment, error: findErr } = await supabase
    .from('job_assignments')
    .select('*')
    .eq('job_offer_id', jobOfferKey)
    .in('status', ['assigned', 'picking_load', 'in_progress', 'delivering'])
    .limit(1)
    .maybeSingle()

  if (findErr) {
    // eslint-disable-next-line no-console
    console.error('finalizeAssignmentDirect: failed to find existing job_assignments', findErr)
    throw findErr
  }

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

  const truckCapacity =
    Number(
      assignment?.truck?._raw?.model_max_load_kg ??
        assignment?.truck?._raw?.master_truck_id?.max_load_kg ??
        assignment?.truck?._raw?.master_truck_id?.payload_kg ??
        previewData?.truck_capacity_kg ??
        0
    ) || 0

  const assignedPayload = Math.max(
    0,
    Math.min(sourcePayload, truckCapacity > 0 ? truckCapacity : sourcePayload)
  )
  const remainingPayload = Math.max(0, sourcePayload - assignedPayload)

  // Step 2 — Update the existing assignment (do NOT insert)
  const { data: assignmentRow, error: updateErr } = await supabase
    .from('job_assignments')
    .update({
      user_truck_id: updatePayload.user_truck_id,
      user_id: updatePayload.user_id,
      accepted_at: updatePayload.accepted_at,
      status: updatePayload.status,
      assigned_payload_kg: assignedPayload,
      payload_remaining_kg: remainingPayload,
    })
    .eq('id', existingAssignment.id)
    .select()
    .single()

  if (updateErr) {
    // eslint-disable-next-line no-console
    console.error('finalizeAssignmentDirect: failed to update job_assignments', updateErr)
    throw updateErr
  }

  // Step 2b — For multi-run load cargo, create follow-up waiting assignment with remaining payload.
  if (String(jobOfferRow?.transport_mode ?? '').toLowerCase() === 'load_cargo' && remainingPayload > 0) {
    const { data: existingFollowUp } = await supabase
      .from('job_assignments')
      .select('id')
      .eq('job_offer_id', jobOfferKey)
      .eq('status', 'assigned')
      .neq('id', assignmentRow.id)
      .limit(1)
      .maybeSingle()

    let followUpErr: any = null

    if (existingFollowUp?.id) {
      const res = await supabase
        .from('job_assignments')
        .update({
          carrier_company_id: resolvedCarrierCompanyId,
          user_id: userId ?? null,
          user_truck_id: null,
          user_trailer_id: null,
          accepted_at: acceptedAt,
          assigned_payload_kg: 0,
          payload_remaining_kg: remainingPayload,
        })
        .eq('id', existingFollowUp.id)
      followUpErr = res.error
    } else {
      const res = await supabase.from('job_assignments').insert({
        job_offer_id: jobOfferKey,
        carrier_company_id: resolvedCarrierCompanyId,
        user_id: userId ?? null,
        user_truck_id: null,
        user_trailer_id: null,
        status: 'assigned',
        accepted_at: acceptedAt,
        assigned_payload_kg: 0,
        payload_remaining_kg: remainingPayload,
      })
      followUpErr = res.error
    }

    if (followUpErr) {
      // eslint-disable-next-line no-console
      console.error('finalizeAssignmentDirect: failed to create follow-up assigned row', followUpErr)
      throw followUpErr
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
    console.error('finalizeAssignmentDirect: job_offers remaining_payload update exception', e)
  }

  // Step 3 — Insert driving_sessions (best-effort; do not block the flow on failure)
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
      const { error: drivingErr } = await supabase
        .from('driving_sessions')
        .insert(drivingPayload)
        .select()
        .single()

      if (drivingErr) {
        // eslint-disable-next-line no-console
        console.error('finalizeAssignmentDirect: failed to insert driving_sessions', drivingErr)
        // Continue — driving session failure should not leave assignment duplicated (we already updated)
      }
    } else {
      // eslint-disable-next-line no-console
      console.debug('finalizeAssignmentDirect: driving session already exists for assignment', {
        assignmentId: assignmentRow.id,
      })
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('finalizeAssignmentDirect: driving_sessions insert exception', e)
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

  // Step 6 — Update only selected hired_staff rows (mark selected drivers as 'assigned').
  try {
    // Extract driver ids from the passed assignment object (UI-provided).
    const driverIds: string[] =
      (assignment?.drivers?.map((d: any) => String(d?.id)).filter(Boolean) as string[]) ?? []

    if (driverIds.length > 0) {
      // Update only the drivers involved in this assignment.
      const { error: staffErr } = await supabase
        .from('hired_staff')
        .update({ activity_id: 'assigned' })
        .in('id', driverIds)

      if (staffErr) {
        // eslint-disable-next-line no-console
        console.error('finalizeAssignmentDirect: failed to update hired_staff by id', staffErr)
      }
    } else {
      // No drivers selected in the assignment — do not mass-update company staff.
      // eslint-disable-next-line no-console
      console.debug('finalizeAssignmentDirect: no drivers provided in assignment; skipping hired_staff update')
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('finalizeAssignmentDirect: hired_staff update exception', e)
  }

  return { assignment: assignmentRow }
}