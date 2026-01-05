/**
 * companies.ts
 *
 * Company-related helpers that interoperate with trucks helpers.
 */

import { syncCompanyTruckCount as trucksSyncCount } from './trucks'

/**
 * updateCompanyTruckCount
 *
 * Convenience wrapper to sync the companies.trucks counter for a company.
 *
 * @param companyId - company UUID
 */
export async function updateCompanyTruckCount(companyId: string) {
  return trucksSyncCount(companyId)
}