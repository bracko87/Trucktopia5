/**
 * autoCreateTruckLog.ts
 *
 * Application-level helper to create a "purchase" truck log for a user_trucks row.
 * This is an alternative to the DB trigger and can be called from server-side code
 * or bootstrap flows where you prefer to create the log from the application layer.
 */

import { insertTruckLog } from '../truckLogs'

/**
 * PurchaseLogPayload
 *
 * Minimal structured payload for a purchase log created by the app helper.
 */
export interface PurchaseLogPayload {
  price?: number | null
  currency?: string | null
  odometer?: number | null
  purchase_date?: string | null
  delivered_after_registration?: boolean | null
  owner_user_id?: string | null
  owner_company_id?: string | null
  vendor?: string | null
  invoice_id?: string | null
}

/**
 * createPurchaseLogForTruck
 *
 * Create a purchase-type truck_log via the REST helper.
 *
 * @param truckId - user_trucks.id
 * @param payload - structured payload (see PurchaseLogPayload)
 * @param message - short human-readable message
 * @param createdBy - users.id who creates the log (optional)
 * @returns Promise resolving to the insert response returned by insertTruckLog
 */
export async function createPurchaseLogForTruck(
  truckId: string,
  payload: PurchaseLogPayload = {},
  message = 'Truck purchased',
  createdBy?: string | null
) {
  if (!truckId) {
    return { status: 0, error: 'missing truckId' }
  }

  try {
    const log = {
      user_truck_id: truckId,
      event_type: 'purchase',
      message,
      payload,
      source: 'system',
      created_by_user_id: createdBy ?? null,
    }

    return await insertTruckLog(log)
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('createPurchaseLogForTruck error', err)
    return { status: 0, error: err?.message ?? String(err) }
  }
}