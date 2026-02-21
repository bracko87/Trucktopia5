/**
 * types.ts
 *
 * Shared finance-related types.
 */

/**
 * IncomeExpensePoint
 *
 * Represents an aggregated point used by charts (label + income + expenses).
 */
export interface IncomeExpensePoint {
  label: string
  income: number
  expenses: number
}