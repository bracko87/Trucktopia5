/**
 * src/lib/timeStatus.ts
 *
 * Shared helper for computing time-based status for job offers:
 * - pickup: whether the pickup is in the future (cargo not ready).
 * - delivery: normal | urgent (<=25% time left) | past (deadline passed).
 *
 * This centralizes the logic so all UI renders the same colors/semantics.
 */

/**
 * TimeStatus
 *
 * Pickup and delivery status returned by getTimeStatus.
 */
export type TimeStatus = {
  /** 'future' means pickup_time > now (cargo not ready) */
  pickup: 'future' | 'normal'
  /** delivery urgency: 'normal' | 'urgent' | 'past' */
  delivery: 'normal' | 'urgent' | 'past'
}

/**
 * getTimeStatus
 *
 * Compute pickup/delivery status using pickup timestamp, delivery deadline and current time.
 *
 * Rules:
 * 1) If pickup > now => pickup: 'future', delivery: 'normal'
 * 2) If both pickup and deadline present:
 *    - total = deadline - pickup
 *    - remaining = deadline - now
 *    - if remaining <= 0 => delivery: 'past'
 *    - else if remaining <= total * 0.25 => delivery: 'urgent'
 *    - else delivery: 'normal'
 * 3) If pickup missing but deadline present:
 *    - if deadline passed => 'past', else 'normal' (cannot compute 25% without pickup anchor)
 *
 * @param pickupMs pickup_time in milliseconds or undefined/null
 * @param deadlineMs delivery_deadline in milliseconds or undefined/null
 * @param nowMs current time in milliseconds (default Date.now())
 * @returns TimeStatus
 */
export function getTimeStatus(
  pickupMs?: number | null,
  deadlineMs?: number | null,
  nowMs: number = Date.now(),
): TimeStatus {
  const pickup = typeof pickupMs === 'number' ? pickupMs : undefined
  const deadline = typeof deadlineMs === 'number' ? deadlineMs : undefined

  // Pickup in the future -> cargo not ready
  if (pickup !== undefined && pickup > nowMs) {
    return { pickup: 'future', delivery: 'normal' }
  }

  // If both pickup and deadline present, use the 25%-of-total rule
  if (pickup !== undefined && deadline !== undefined) {
    const total = deadline - pickup
    const remaining = deadline - nowMs

    if (remaining <= 0) {
      return { pickup: 'normal', delivery: 'past' }
    }

    // Protect against zero/negative total
    if (total <= 0) {
      // No meaningful window; only check if already past
      return { pickup: 'normal', delivery: remaining <= 0 ? 'past' : 'normal' }
    }

    if (remaining <= total * 0.25) {
      return { pickup: 'normal', delivery: 'urgent' }
    }

    return { pickup: 'normal', delivery: 'normal' }
  }

  // If only deadline present (no pickup anchor), mark past if passed, otherwise normal
  if (deadline !== undefined) {
    const remaining = deadline - nowMs
    if (remaining <= 0) {
      return { pickup: 'normal', delivery: 'past' }
    }
    return { pickup: 'normal', delivery: 'normal' }
  }

  // Default fallback: no timing information
  return { pickup: 'normal', delivery: 'normal' }
}