/**
 * src/lib/formatPhase.ts
 *
 * Centralized phase formatting helper.
 *
 * Provides a single source of truth for translating technical DB phase/enums
 * into user-friendly display labels. Reuse this across UI components to keep
 * phase presentation consistent.
 */

/**
 * formatPhase
 *
 * Convert a DB phase value (e.g. "TO_PICKUP", "to_delivery", "unloading")
 * into a human-friendly short label suitable for badges or compact UI:
 * - TO_PICKUP -> "Picking up"
 * - LOADING -> "Loading"
 * - TO_DELIVERY -> "Delivering"
 * - UNLOADING -> "Unloading"
 * - COMPLETED -> "Completed"
 *
 * Falls back to a cleaned-up string if unknown (replace underscores, capitalize).
 *
 * @param phase raw phase value from DB or runtime
 * @returns user-friendly short label
 */
export function formatPhase(phase?: string | null): string {
  if (!phase) return ''

  const key = String(phase).toUpperCase()

  const map: Record<string, string> = {
    TO_PICKUP: 'Picking up',
    LOADING: 'Loading',
    TO_DELIVERY: 'Delivering',
    UNLOADING: 'Unloading',
    COMPLETED: 'Completed',
  }

  if (map[key]) return map[key]

  // Fallback: tidy unknown values (e.g. "to_pickup" or "toDelivery")
  const cleaned = String(phase)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, (_m, a, b) => `${a} ${b}`) // split camelCase
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return cleaned
}