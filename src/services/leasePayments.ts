/**
 * leasePayments.ts
 *
 * Service helpers to create lease-related financial transactions.
 *
 * Transactions must store the single installment amount (lease_rate / term)
 * rather than the total lease_rate. This module centralizes that logic.
 */

import { supabase } from '../lib/supabase'
import { computeInstallment } from '../lib/finance'

/**
 * createLeasePaymentTransaction
 *
 * Insert a lease payment transaction that stores the installment (not the total lease).
 *
 * @param params.leaseId Lease id for reference metadata
 * @param params.leaseRate Total lease contract value
 * @param params.accountId Financial account id (required by schema)
 * @param params.term Number of installments (defaults to 60)
 * @param params.currency Currency code (defaults to 'USD')
 * @param params.metadata Additional metadata to attach to the transaction
 * @returns supabase insert result plus computed installment
 */
export async function createLeasePaymentTransaction(params: {
  leaseId: string
  leaseRate: number
  accountId: string
  term?: number
  currency?: string
  metadata?: Record<string, any>
}) {
  const { leaseId, leaseRate, accountId, term = 60, currency = 'USD', metadata = {} } = params

  // compute single installment (lease_rate / term)
  const installment = computeInstallment(leaseRate, term)

  // Insert transaction (amount is installment, must be non-negative per DB)
  const { data, error } = await supabase
    .from('financial_transactions')
    .insert({
      account_id: accountId,
      amount: installment,
      currency,
      created_at: new Date().toISOString(),
      metadata: { ...metadata, reference_type: 'lease', reference_id: leaseId },
      kind: 'lease_payment',
    })
    .select('id')
    .single()

  return { data, error, installment }
}
