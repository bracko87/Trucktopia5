/**
 * jobsService.ts
 *
 * Small service helpers around job/assignment operations.
 *
 * Provides a typed wrapper to call the server-side RPC that aborts an assignment
 * and makes the truck return to hub.
 */

import { supabase } from '../lib/supabase'

/**
 * abortAssignment
 *
 * Call the existing DB RPC `abort_assignment_and_return` with the provided
 * assignment id. Throws on missing id or RPC error.
 *
 * @param assignmentId UUID of the assignment to abort
 * @returns true on success
 */
export async function abortAssignment(assignmentId: string): Promise<boolean> {
  if (!assignmentId) {
    throw new Error('Missing assignment id')
  }

  const { error } = await supabase.rpc('abort_assignment_and_return', {
    p_assignment_id: assignmentId,
  })

  if (error) {
    throw new Error(error.message ?? 'Abort failed')
  }

  return true
}