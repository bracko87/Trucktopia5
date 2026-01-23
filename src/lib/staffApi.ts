/**
 * staffApi.ts
 *
 * Minimal staff API helper.
 *
 * Provides functions to fetch hired staff (public.hired_staff) and
 * unemployed candidates (public.unemployed_staff) for the UI.
 */

import { supabase } from './supabase'

/**
 * StaffMember
 *
 * Represents a minimal staff row for the UI.
 * Extra fields are optional to stay compatible with the current DB.
 */
export interface StaffMember {
  /** Primary key */
  id: string
  /** Full name of the person */
  name: string | null
  /** Role / position (driver, mechanic, dispatcher, manager, director, etc.) */
  role: string | null
  /** Contact email, if available */
  email?: string | null
  /** Contact phone, if available */
  phone?: string | null
  /** When the person was hired (for hired_staff only) */
  hired_at?: string | null

  /** Two-letter country code or full country name for filtering */
  country?: string | null
  /** Alternative country code field (if used by the table) */
  country_code?: string | null
  /** City or region name, if available */
  city?: string | null

  /** Expected / desired salary (numeric, e.g. per month) */
  expected_salary?: number | null
  /** Currency code for salary (e.g. EUR, USD) */
  currency?: string | null

  /** Years of experience, if tracked */
  experience_years?: number | null
  /** Main skill or specialization label */
  primary_skill?: string | null
  /** Free-form notes or description */
  notes?: string | null
}

/**
 * fetchHiredStaff
 *
 * Fetches hired_staff rows for a specific company.
 *
 * @param companyId - UUID of the company to fetch hired staff for
 * @returns Promise<StaffMember[]>
 */
export async function fetchHiredStaff(companyId: string): Promise<StaffMember[]> {
  try {
    const { data, error } = await supabase
      .from('hired_staff')
      .select('*')
      .eq('company_id', companyId)
      .order('hired_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('fetchHiredStaff error', error)
      return []
    }

    return (data ?? []) as StaffMember[]
  } catch (err) {
    console.error('fetchHiredStaff unexpected error', err)
    return []
  }
}

/**
 * fetchUnemployedStaff
 *
 * Fetches all rows from public.unemployed_staff.
 *
 * @returns Promise<StaffMember[]>
 */
export async function fetchUnemployedStaff(): Promise<StaffMember[]> {
  try {
    const { data, error } = await supabase.from('unemployed_staff').select('*')
    if (error) {
      console.error('fetchUnemployedStaff error', error)
      return []
    }
    return (data || []) as StaffMember[]
  } catch (err) {
    console.error('fetchUnemployedStaff unexpected error', err)
    return []
  }
}
