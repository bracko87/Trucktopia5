/**
 * finance.ts
 *
 * Small finance helpers used across the app.
 *
 * Provides a canonical computeInstallment function so the UI and backend
 * compute installments consistently: installment = lease_rate / term.
 */

/**
 * computeInstallment
 *
 * Compute a single installment amount given a total lease_rate and term.
 *
 * @param leaseRate Total contract value (may be number|string|null)
 * @param term Number of installments (must be > 0)
 * @returns installment as number (0 when invalid inputs)
 */
export function computeInstallment(leaseRate: any, term: number): number {
  const r = leaseRate === null || leaseRate === undefined ? 0 : Number(leaseRate)
  if (!r || !term || term <= 0) return 0
  return r / term
}

/**
 * formatUSD
 *
 * Format number as US dollar string "US$1,234.56".
 *
 * @param n number
 * @returns formatted string
 */
export function formatUSD(n: number): string {
  return `US$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
