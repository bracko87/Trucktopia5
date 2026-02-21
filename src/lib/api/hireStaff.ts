/**
 * hireStaff.ts
 *
 * Small helper that performs the frontend RPC call to hire an unemployed staff member.
 * This mirrors the existing style used for salary updates and other RPC helper wrappers.
 */

import { supabase } from '@/lib/supabase'

/**
 * hireStaff
 *
 * Calls the database RPC that converts an unemployed_staff row into a hired_staff row
 * (server-side logic). The RPC name and parameter names are taken from the backend.
 *
 * @param unemployedId string - id of the unemployed_staff row to hire
 * @param companyId string - id of the company that hires the staff
 * @returns Promise<any> - supabase rpc response (use .error/.data to inspect)
 */
export async function hireStaff(unemployedId: string, companyId: string) {
  return await supabase.rpc('hire_staff', {
    p_unemployed_id: unemployedId,
    p_company_id: companyId,
  })
}