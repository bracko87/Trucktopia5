/**
 * sellService.ts
 *
 * Utility functions for lease/sell payment calculations.
 *
 * Provides:
 * - weeksDiffInclusive: inclusive week count between two dates
 * - computePaymentInfo: compute total installments, paid installments (prefers counting transactions),
 *   remaining, installment amount and next payment date (weekly cadence).
 *
 * NOTE:
 * - This file is intentionally focused and preservative of UI layout/strings;
 *   it only changes internal payment math and transaction-aware counting.
 */

/**
 * ComputePaymentTransaction
 *
 * Minimal shape for a payment transaction used to count already-paid installments.
 */
export interface ComputePaymentTransaction {
  /** Transaction type code (e.g. 'LEASE_PAYMENT') */
  type?: string
  /** ISO timestamp or Date string when transaction occurred */
  created_at?: string | Date | null
  /** Numeric amount (optional, unused for counting but available) */
  amount?: number | null
}

/**
 * PaymentInfo
 *
 * Returned result from computePaymentInfo.
 */
export interface PaymentInfo {
  totalPayments: number
  installmentsPaid: number
  remainingPayments: number
  installmentAmount: number
  nextPaymentDate: Date | null
}

/**
 * weeksDiffInclusive
 *
 * Return inclusive week count between start and end.
 *
 * Rules:
 * - If end < start returns 0
 * - Inclusive: same-day => 1 week
 *
 * @param start - start date
 * @param end - end date
 * @returns number of weeks (>= 0)
 */
export function weeksDiffInclusive(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime()
  const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
  return Math.max(0, weeks + 1)
}

/**
 * toDateSafe
 *
 * Convert a Date | string to Date. If invalid returns null.
 *
 * @param v value
 * @returns Date | null
 */
function toDateSafe(v?: string | Date | null): Date | null {
  if (!v) return null
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null
    return v
  }
  const d = new Date(String(v))
  if (isNaN(d.getTime())) return null
  return d
}

/**
 * computePaymentInfo
 *
 * Compute lease/payment installment details.
 *
 * Behavior:
 * - totalPayments is computed as inclusive weeks between start and end.
 * - installmentsPaid prefers counting transactions of the provided paymentType.
 *   If transactions not provided or no matching transactions, falls back to weeksDiffInclusive(start, today).
 * - nextPaymentDate is computed by adding (installmentsPaid * 7 days) to start.
 *   If installmentsPaid >= totalPayments -> nextPaymentDate = null (no further payments).
 *
 * @param params.start required lease start date (Date|string)
 * @param params.end required lease end date (Date|string)
 * @param params.installmentAmount required single-installment amount (major units, e.g. dollars)
 * @param params.today optional reference date for "now" (defaults to new Date())
 * @param params.transactions optional array of transactions to count paid installments
 * @param params.paymentType optional transaction type to count (default 'LEASE_PAYMENT')
 * @returns PaymentInfo
 */
export function computePaymentInfo(params: {
  start: string | Date
  end: string | Date
  installmentAmount: number
  today?: Date
  transactions?: ComputePaymentTransaction[] | null
  paymentType?: string
}): PaymentInfo {
  const { start: sIn, end: eIn, installmentAmount, today: tIn, transactions, paymentType = 'LEASE_PAYMENT' } = params

  const start = toDateSafe(sIn)
  const end = toDateSafe(eIn)
  const today = tIn ? toDateSafe(tIn) : new Date()

  if (!start || !end) {
    // Defensive fallback: no valid dates -> zeroed result
    return {
      totalPayments: 0,
      installmentsPaid: 0,
      remainingPayments: 0,
      installmentAmount,
      nextPaymentDate: null,
    }
  }

  // total payments = inclusive weeks between start and end
  const totalPayments = weeksDiffInclusive(start, end)

  // Determine installmentsPaid:
  // - Prefer counting transactions of the requested type that occurred between start and min(today,end)
  // - If no transactions provided or no matches, fallback to weeksDiffInclusive(start, today)
  let installmentsPaid = 0
  const effectiveEnd = today && end ? (today.getTime() < end.getTime() ? today : end) : end

  if (Array.isArray(transactions) && transactions.length > 0) {
    try {
      const count = transactions.reduce((acc, tx) => {
        if (!tx) return acc
        if (tx.type && tx.type !== paymentType) return acc
        const d = toDateSafe(tx.created_at ?? null)
        if (!d) return acc
        if (d.getTime() < start.getTime()) return acc
        if (d.getTime() > effectiveEnd.getTime()) return acc
        return acc + 1
      }, 0)
      installmentsPaid = count
    } catch {
      installmentsPaid = 0
    }
  }

  // Fallback when transactions not used or count yielded zero but time-based payments exist
  if (!installmentsPaid) {
    installmentsPaid = Math.min(totalPayments, Math.max(0, weeksDiffInclusive(start, effectiveEnd)))
  } else {
    // clamp to totalPayments
    installmentsPaid = Math.min(totalPayments, Math.max(0, installmentsPaid))
  }

  const remainingPayments = Math.max(0, totalPayments - installmentsPaid)

  // nextPaymentDate: start + installmentsPaid * 7 days
  // If all payments done -> null
  let nextPaymentDate: Date | null = null
  if (installmentsPaid < totalPayments) {
    nextPaymentDate = new Date(start.getTime() + installmentsPaid * 7 * 24 * 60 * 60 * 1000)
  }

  return {
    totalPayments,
    installmentsPaid,
    remainingPayments,
    installmentAmount,
    nextPaymentDate,
  }
}