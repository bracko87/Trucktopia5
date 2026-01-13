/**
 * useTruckOverallCondition.tsx
 *
 * React hook that computes the live "overall condition" for a truck by averaging
 * the condition_score of all related user_truck_components rows.
 *
 * Behavior:
 * - Fetches components via Supabase REST (/rest/v1/user_truck_components?select=condition_score&user_truck_id=eq...).
 * - Normalizes component scores to integers (Math.round).
 * - Returns numeric average (one decimal precision when needed), string display, loading, error and refresh().
 * - Defaults to 0 when there are no components.
 * - Listens to a global CustomEvent 'truck-components-updated' to refresh when other parts of the app signal component changes.
 */

import { useCallback, useEffect, useState } from 'react'
import { supabaseFetch } from '../lib/supabase'

/**
 * UseTruckOverallConditionResult
 *
 * Shape returned by the hook.
 */
export interface UseTruckOverallConditionResult {
  /** numeric value (rounded to one decimal when needed) */
  value: number
  /** display string (integer or one decimal) */
  display: string
  loading: boolean
  error: string | null
  /** refresh() - re-fetch and recalc */
  refresh: () => Promise<void>
}

/**
 * useTruckOverallCondition
 *
 * Hook to compute live average condition for a truck (by user_truck_id).
 *
 * @param truckId - user_trucks.id
 * @returns UseTruckOverallConditionResult
 */
export function useTruckOverallCondition(truckId?: string | null): UseTruckOverallConditionResult {
  const [value, setValue] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * fetchAndCompute
   *
   * Fetch component rows and compute average of their integer-normalized scores.
   */
  const fetchAndCompute = useCallback(async () => {
    if (!truckId) {
      setValue(0)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const path = `/rest/v1/user_truck_components?select=condition_score&user_truck_id=eq.${encodeURIComponent(
        truckId
      )}`
      const res: any = await supabaseFetch(path)
      const rows = Array.isArray(res?.data) ? res.data : []

      // Extract and normalize integer scores
      const scores: number[] = rows
        .map((r: any) => {
          const raw = r?.condition_score
          if (raw == null) return NaN
          // Normalize: prefer numbers; otherwise parse and round
          const n = typeof raw === 'number' ? raw : Number(String(raw))
          if (!Number.isFinite(n)) return NaN
          return Math.round(n)
        })
        .filter((n) => !Number.isNaN(n))

      if (scores.length === 0) {
        setValue(0)
      } else {
        const sum = scores.reduce((s, v) => s + v, 0)
        const avg = sum / scores.length
        // Keep one decimal when fractional, otherwise integer
        const rounded = Math.round(avg * 10) / 10
        setValue(rounded)
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('useTruckOverallCondition fetch error', err)
      setError(err?.message ?? String(err))
      setValue(0)
    } finally {
      setLoading(false)
    }
  }, [truckId])

  useEffect(() => {
    void fetchAndCompute()
  }, [fetchAndCompute])

  useEffect(() => {
    // Listen to global notifications so other parts can trigger refresh:
    // window.dispatchEvent(new CustomEvent('truck-components-updated', { detail: { truckId } }))
    const handler = (ev: Event) => {
      try {
        const custom = ev as CustomEvent
        // If detail is omitted, refresh all; if detail includes truckId only refresh matching id.
        const detail = (custom && (custom as any).detail) ?? null
        if (!detail) {
          void fetchAndCompute()
          return
        }
        const evtTruckId = detail.truckId ?? detail
        if (!evtTruckId || evtTruckId === truckId) {
          void fetchAndCompute()
        }
      } catch {
        void fetchAndCompute()
      }
    }
    window.addEventListener('truck-components-updated', handler as EventListener)
    return () => window.removeEventListener('truck-components-updated', handler as EventListener)
  }, [fetchAndCompute, truckId])

  const display = Number.isInteger(value) ? String(value) : value.toFixed(1)

  return {
    value,
    display,
    loading,
    error,
    refresh: fetchAndCompute,
  }
}

export default useTruckOverallCondition