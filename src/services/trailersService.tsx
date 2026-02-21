/**
 * trailersService.tsx
 *
 * Small service + React hook wrapping fetchCompanyTrailers + mapping to
 * TrailerCardRow so UI can consume trailers similarly to trucksService.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { fetchCompanyTrailers, mapTrailerRow, type TrailerCardRow } from '../lib/api/trailersApi'

/**
 * TrailersResult
 *
 * Shape returned by the hook.
 */
export interface TrailersResult {
  trailers: TrailerCardRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * fetchAndMapCompanyTrailers
 *
 * Helper to fetch company trailers and map them to TrailerCardRow.
 *
 * @param companyId - company UUID
 * @returns TrailerCardRow[]
 */
export async function fetchAndMapCompanyTrailers(companyId: string): Promise<TrailerCardRow[]> {
  const rows = await fetchCompanyTrailers(companyId)
  return rows.map(mapTrailerRow)
}

/**
 * useTrailersService
 *
 * React hook exposing trailers, loading, error and refresh.
 *
 * @param companyId - active company id to fetch trailers for
 * @returns TrailersResult
 */
export function useTrailersService(companyId?: string): TrailersResult {
  const [trailers, setTrailers] = useState<TrailerCardRow[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!companyId) {
      setTrailers([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAndMapCompanyTrailers(companyId)
      setTrailers(rows)
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('useTrailersService load error', err)
      setError(err?.message ?? String(err))
      setTrailers([])
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void load()
  }, [load])

  return {
    trailers,
    loading,
    error,
    refresh: load,
  }
}