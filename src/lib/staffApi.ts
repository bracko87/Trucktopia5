/**
 * staffApi.ts
 *
 * Fetch + normalize hired staff rows.
 *
 * This file exports the StaffMember type and fetchHiredStaff function.
 */

import { supabase } from './supabase'

/**
 * StaffRole
 *
 * Used for founder / role-based logic.
 */
export interface StaffRole {
  key: 'CEO' | 'DRIVER'
  locked: boolean
}

/**
 * StaffMember
 *
 * Minimal shape for a staff row used by the UI.
 */
export interface StaffMember {
  id: string

  // 👇 used ONLY for founder
  staffProfileId?: string
  roles?: StaffRole[]

  // identity
  name: string
  first_name?: string | null
  last_name?: string | null
  country_code?: string | null

  // role / job (existing system)
  role?: string | null
  job_category?: string | null

  // stats
  age?: number | null
  experience?: number | null
  experience_years?: number | null

  // salary / mood
  salary?: number | null
  fatigue?: number | null
  happiness?: number | null

  // timestamps
  hired_at?: string | null

  // activity
  activity_id?: string | null
  activity_until?: string | null

  // skills
  skills?: Array<{
    title: string
    subtitle?: string
  }>

  // position fields
  position_id?: string | null
  position?: {
    id: string
    code?: string
    name?: string
  } | null
}

/**
 * FetchHiredStaffResult
 */
export interface FetchHiredStaffResult {
  raw: any[]
  rows: StaffMember[]
  error?: Error
}

/**
 * fetchHiredStaff
 *
 * Fetch hired_staff rows for a company and normalize them.
 * PLUS: append founder staff profile.
 */
export async function fetchHiredStaff(
  companyId: string
): Promise<FetchHiredStaffResult> {
  // --------------------------------------------------
  // 1️⃣ Fetch hired staff (UNCHANGED)
  // --------------------------------------------------
  // Include current_location_id so UI can resolve city name
  const { data, error } = await supabase
    .from('hired_staff')
    .select(`
      id,
      first_name,
      last_name,
      country_code,
      age,
      job_category,
      experience,
      salary,
      fatigue,
      happiness,
      hired_at,
      activity_id,
      activity_until,
      position_id,
      current_location_id,
      position:staff_positions_master (
        id,
        code,
        name
      ),
      skill1:skills_master!hired_staff_skill1_id_fkey ( name, description ),
      skill2:skills_master!hired_staff_skill2_id_fkey ( name, description ),
      skill3:skills_master!hired_staff_skill3_id_fkey ( name, description )
    `)
    .eq('company_id', companyId)
    .order('hired_at', { ascending: false })

  if (error) {
    return { raw: [], rows: [], error }
  }

  const raw = Array.isArray(data) ? data : []

  const hiredRows: StaffMember[] = raw.map((r) => {
    const pos = (r as any).position

    return {
      id: r.id,

      name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      first_name: r.first_name,
      last_name: r.last_name,
      country_code: r.country_code,

      role: r.job_category,
      job_category: r.job_category,

      age: typeof r.age === 'number' ? r.age : null,
      experience: r.experience != null ? Number(r.experience) : null,

      salary: r.salary != null ? Number(r.salary) : null,
      fatigue: r.fatigue != null ? Number(r.fatigue) : null,
      happiness: r.happiness != null ? Number(r.happiness) : null,

      hired_at: r.hired_at,
      activity_id: r.activity_id,
      activity_until: r.activity_until,

      /* Ensure we pass current_location_id through to the UI so cards can resolve city name */
      current_location_id: r.current_location_id ?? null,

      skills: [r.skill1, r.skill2, r.skill3]
        .filter(Boolean)
        .map((s: any) => ({
          title: s.name,
          subtitle: s.description,
        })),

      position_id: r.position_id ?? null,
      position: pos
        ? {
            id: String(pos.id),
            code: pos.code ? String(pos.code) : undefined,
            name: pos.name ? String(pos.name) : undefined,
          }
        : null,
    }
  })

  // --------------------------------------------------
  // 2️⃣ Fetch founder staff profile (FIXED)
  // --------------------------------------------------
  const { data: founderData } = await supabase.rpc(
    'fetch_founder_staff_profile',
    { p_company_id: companyId }
  )

  const founderRows: StaffMember[] = (founderData ?? []).map((f: any) => {
    let roles: StaffRole[] = []

    if (Array.isArray(f.roles)) {
      roles = f.roles
    } else if (typeof f.roles === 'string') {
      try {
        roles = JSON.parse(f.roles)
      } catch {
        roles = []
      }
    }

    return {
      id: `founder-${f.staff_profile_id}`,
      staffProfileId: f.staff_profile_id,

      name: `${f.first_name} ${f.last_name}`,
      first_name: f.first_name,
      last_name: f.last_name,

      roles,

      age: null,
      experience: null,
      salary: null,
      fatigue: null,
      happiness: null,
      skills: [],
    }
  })

  // --------------------------------------------------
  // 3️⃣ Merge founder + hired staff
  // --------------------------------------------------
  return {
    raw: [...raw, ...(founderData ?? [])],
    rows: [...founderRows, ...hiredRows],
  }
}
