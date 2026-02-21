/**
 * useHiredStaff.ts
 *
 * Hook that manages loading state and lifecycle for hired staff data.
 * Ensures current_location_id is preserved so UI cards can resolve city names.
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { HiredStaffMember } from '@/components/staff/HiredStaffCard'

/**
 * mapRowToHiredStaffMember
 *
 * Normalize a raw DB row into the HiredStaffMember UI shape.
 *
 * @param r raw row from Supabase
 * @returns HiredStaffMember
 */
function mapRowToHiredStaffMember(r: any): HiredStaffMember {
  return {
    id: r.id,
    name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
    role: r.job_category ?? r.role ?? null,
    job_category: r.job_category ?? null,
    country_code: r.country_code ?? null,
    hired_at: r.hired_at ?? r.created_at ?? null,
    created_at: r.created_at ?? null,
    experience: r.experience != null ? Number(r.experience) : r.experience_years ?? null,
    experience_years: r.experience_years ?? null,
    age: typeof r.age === 'number' ? r.age : null,
    birth_date: r.birth_date ?? r.dob ?? null,
    activity_id: r.activity_id ?? null,
    activity_until: r.activity_until ?? null,
    activity: r.activity ?? null,
    monthly_salary: (r.salary != null ? Number(r.salary) : r.monthly_salary) ?? null,
    monthly_salary_cents: typeof r.monthly_salary_cents === 'number' ? r.monthly_salary_cents : null,
    fatigue: r.fatigue != null ? Number(r.fatigue) : null,
    happiness: r.happiness != null ? Number(r.happiness) : null,
    available_at: r.available_at ?? null,
    company_id: r.company_id ?? null,
    image_url: (r.image_url ?? r.imageUrl ?? r.avatar_url ?? r.photo_url ?? r.image ?? r.avatar) ?? null,
    position_id: r.position_id ?? null,
    /** Current hired driver city reference (maps to cities.id) */
    current_location_id: r.current_location_id ?? null,
    position: r.position ? { id: r.position.id, code: r.position.code ?? null, name: r.position.name ?? null } : (r.position ?? null),
    skills: r.skills ?? r.skill1 ?? r.skill_list ?? null,
  }
}

/**
 * useHiredStaff
 *
 * Fetches hired staff on mount and exposes loading/error state.
 * The query includes a join to staff_positions_master aliased as `position`.
 */
export function useHiredStaff() {
  const [data, setData] = useState<HiredStaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const { data: rows, error: err } = await supabase
          .from('hired_staff')
          .select(`
            *,
            position:staff_positions_master (
              id,
              code,
              name
            )
          `)
          .order('hired_at', { ascending: false })

        if (!alive) return

        if (err) {
          setError(err.message ?? 'Failed to load hired staff')
          setData([])
        } else {
          const mapped = Array.isArray(rows) ? rows.map(mapRowToHiredStaffMember) : []
          setData(mapped)
        }
      } catch (e: any) {
        if (!alive) return
        setError(e?.message ?? 'Unknown error')
        setData([])
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  return { data, loading, error }
}