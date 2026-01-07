/**
 * trucksService.tsx
 *
 * Isolated service layer for fetching trucks related data from the backend.
 *
 * Purpose:
 * - Encapsulate auth resolution + backend REST calls used to obtain truck rows.
 * - Provide a small React hook returning { trucks, loading, error, refresh } so UI
 *   components can opt-in to this isolated data source.
 *
 * Notes:
 * - This file is additive and intentionally does not change existing pages/components.
 * - Future changes should prefer creating parallel files or importing from this service.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { supabaseFetch } from '../lib/supabase'
import { fetchTrucksForAuthUser } from '../lib/trucksApi'
import { fetchPublicTrucksForAuthUser } from '../lib/db/modules/publicTrucks'
import type { TruckCardRow } from '../lib/trucksApi'

/**
 * TrucksFetchMode
 *
 * Mode used when fetching trucks: private = trucks for auth user (via fetchTrucksForAuthUser),
 * public = public_trucks variant (via fetchPublicTrucksForAuthUser).
 */
export type TrucksFetchMode = 'private' | 'public'

/**
 * TrucksResult
 *
 * Shape returned by fetch helpers and by the hook.
 */
export interface TrucksResult {
  trucks: TruckCardRow[]
  loading: boolean
  error: string | null
}

/**
 * fetchTrucksForCurrentAuthUser
 *
 * Resolve current auth user via the auth REST endpoint then call the typed
 * helper fetchTrucksForAuthUser to return an array of TruckCardRow.
 *
 * @returns TruckCardRow[] (empty array on failure)
 */
export async function fetchTrucksForCurrentAuthUser(): Promise<TruckCardRow[]> {
  try {
    const authRes = await supabaseFetch('/auth/v1/user')
    const authUserId = authRes?.data?.id ?? null
    if (!authUserId) return []
    const rows = await fetchTrucksForAuthUser(authUserId)
    return Array.isArray(rows) ? rows : []
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchTrucksForCurrentAuthUser error', err)
    return []
  }
}

/**
 * fetchPublicTrucksForCurrentAuthUser
 *
 * Resolve current auth user then call fetchPublicTrucksForAuthUser (public listing).
 *
 * @returns TruckCardRow[] (empty array on failure)
 */
export async function fetchPublicTrucksForCurrentAuthUser(): Promise<TruckCardRow[]> {
  try {
    const authRes = await supabaseFetch('/auth/v1/user')
    const authUserId = authRes?.data?.id ?? null
    if (!authUserId) return []
    const rows = await fetchPublicTrucksForAuthUser(authUserId)
    return Array.isArray(rows) ? rows : []
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('fetchPublicTrucksForCurrentAuthUser error', err)
    return []
  }
}

/**
 * useTrucksService
 *
 * React hook that exposes trucks data, loading state, an error and a refresh function.
 *
 * Usage:
 *   const { trucks, loading, error, refresh } = useTrucksService({ mode: 'private' })
 *
 * @param opts.mode - 'private' (user/company trucks) or 'public' (public listings)
 * @returns TrucksResult + refresh(): Promise<void>
 */
export function useTrucksService(opts?: { mode?: TrucksFetchMode }) {
  const mode = opts?.mode ?? 'private'
  const [trucks, setTrucks] = useState<TruckCardRow[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * load
   *
   * Internal loader that selects the correct fetch method based on mode.
   */
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let rows: TruckCardRow[] = []
      if (mode === 'public') {
        rows = await fetchPublicTrucksForCurrentAuthUser()
      } else {
        rows = await fetchTrucksForCurrentAuthUser()
      }
      setTrucks(rows)
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('useTrucksService load error', err)
      setError(err?.message ?? String(err))
      setTrucks([])
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => {
    // Initial load
    void load()
    // We intentionally do not include load in deps beyond mode to keep behavior stable
  }, [load])

  return {
    trucks,
    loading,
    error,
    refresh: load,
  }
}