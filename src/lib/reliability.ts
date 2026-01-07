/**
 * reliability.ts
 *
 * Utilities to map numeric reliability values stored in the DB (1..3)
 * to human-friendly labels (A/B/C) and vice-versa.
 *
 * Storing numbers in DB and mapping in code keeps sorting/comparisons fast
 * and is future-proof for additional groups.
 */

/**
 * ReliabilityNumber
 *
 * Numeric values stored in DB (1..3).
 */
export type ReliabilityNumber = 1 | 2 | 3

/**
 * ReliabilityLabel
 *
 * Human-facing labels mapped from numbers.
 */
export type ReliabilityLabel = 'A' | 'B' | 'C'

/**
 * numberToLabelMap
 *
 * Maps stored numeric values to labels.
 */
const numberToLabelMap: Record<number, ReliabilityLabel> = {
  3: 'A',
  2: 'B',
  1: 'C',
}

/**
 * labelToNumberMap
 *
 * Maps labels to stored numeric values.
 */
const labelToNumberMap: Record<ReliabilityLabel, ReliabilityNumber> = {
  A: 3,
  B: 2,
  C: 1,
}

/**
 * numberToLabel
 *
 * Convert numeric DB value to label.
 *
 * @param n - numeric reliability (may be null/undefined)
 * @returns 'A' | 'B' | 'C' or '—' when unknown
 */
export function numberToLabel(n?: number | null): ReliabilityLabel | '—' {
  if (n == null) return '—'
  return numberToLabelMap[n] ?? '—'
}

/**
 * labelToNumber
 *
 * Convert label to numeric DB value.
 *
 * @param label - 'A'|'B'|'C' (case-insensitive)
 * @returns 3|2|1 or null when unknown
 */
export function labelToNumber(label?: string | null): ReliabilityNumber | null {
  if (!label) return null
  const key = (label as string).toUpperCase() as ReliabilityLabel
  return labelToNumberMap[key] ?? null
}

/**
 * formatReliability
 *
 * Friendly string representation for UI.
 *
 * @param n - numeric reliability
 * @returns string label or '—' when unknown
 */
export function formatReliability(n?: number | null): string {
  return numberToLabel(n)
}