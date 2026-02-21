/**
 * startStaffSkillTraining.ts
 *
 * Thin wrapper around the start_staff_skill_training RPC that normalizes
 * the RPC response into a stable shape the frontend expects.
 *
 * This prevents UI breakage when the RPC returns fields like:
 *   { skill_id, cost, duration_days, until_time }
 *
 * The wrapper throws on RPC error and returns either a normalized object or
 * an array of normalized objects depending on the RPC result.
 */

import { supabase } from '@/lib/supabase'

/**
 * NormalizedTrainingResult
 *
 * Stable shape returned to callers:
 * - skill_id: string | null
 * - cost: number | null
 * - days: number | null
 * - until: string | null
 * - raw: original row (for debugging)
 */
export interface NormalizedTrainingResult {
  skill_id: string | null
  cost: number | null
  days: number | null
  until: string | null
  raw?: any
}

/**
 * startStaffSkillTraining
 *
 * Calls the start_staff_skill_training RPC with the expected parameters.
 * Throws if the RPC returns an error and returns normalized data on success.
 *
 * @param staffId - id of the staff being trained
 * @param skillId - id of the skill to train
 * @returns RPC data (normalized) when successful
 * @throws Error when RPC returns an error
 */
export async function startStaffSkillTraining(
  staffId: string,
  skillId: string
): Promise<NormalizedTrainingResult | NormalizedTrainingResult[]> {
  const { data, error } = await supabase.rpc('start_staff_skill_training', {
    p_staff_id: staffId,
    p_skill_id: skillId,
  })

  if (error) {
    throw error
  }

  /**
   * normalizeRow
   *
   * Map a backend row to the stable shape expected by the frontend.
   * Backend may return: skill_id, cost, duration_days, until_time
   * Older frontends sometimes expect: cost, days, until
   */
  function normalizeRow(row: any): NormalizedTrainingResult {
    return {
      skill_id: row?.skill_id ?? row?.training_skill_id ?? null,
      cost:
        row?.cost ??
        (typeof row?.cost_cents === 'number' ? row.cost_cents / 100 : null) ??
        null,
      days: row?.duration_days ?? row?.days ?? null,
      until: row?.until_time ?? row?.until ?? null,
      raw: row,
    }
  }

  if (Array.isArray(data)) {
    return data.map(normalizeRow)
  } else {
    return normalizeRow(data)
  }
}