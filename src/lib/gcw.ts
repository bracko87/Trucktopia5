/**
 * gcw.ts
 *
 * Small utilities to canonicalize and rank GCW representations across the app.
 * Many places in the codebase store GCW as numbers (1/2/3) or letters (A/B/C).
 * These helpers normalize values and provide a stable numeric rank for comparisons.
 */

/**
 * normalizeGcwLetter
 *
 * Normalize various GCW inputs into canonical letters "A" | "B" | "C" or null.
 *
 * Accepts numbers (1/2/3), numeric-strings ('1'), letters ('a','A'), or other
 * representations. Returns uppercase letter or null when unknown.
 *
 * @param input - any GCW-like input
 * @returns "A" | "B" | "C" | null
 */
export function normalizeGcwLetter(input: any): 'A' | 'B' | 'C' | null {
  if (input === null || input === undefined) return null

  // Numeric (1/2/3) or numeric string => letters
  if (typeof input === 'number' || /^[0-9]+$/.test(String(input))) {
    const n = Number(input)
    if (n === 1) return 'A'
    if (n === 2) return 'B'
    if (n === 3) return 'C'
  }

  // String letters A/B/C (case-insensitive)
  if (typeof input === 'string') {
    const s = input.trim().toUpperCase()
    if (s === 'A' || s === 'B' || s === 'C') return s as 'A' | 'B' | 'C'
    // Accept single-char reliability like '1','2','3' already handled above
  }

  return null
}

/**
 * gcwRank
 *
 * Map canonical GCW letter to numeric rank (A -> 1, B -> 2, C -> 3).
 * Unknown / null => 0.
 *
 * @param letter - GCW letter or nullable input
 * @returns number rank: 0..3
 */
export function gcwRank(letter: string | null | undefined): number {
  const normalized = normalizeGcwLetter(letter)
  if (!normalized) return 0
  if (normalized === 'A') return 1
  if (normalized === 'B') return 2
  if (normalized === 'C') return 3
  return 0
}