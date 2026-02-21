/**
 * drivingSessionsService.ts
 *
 * Service + React hook to fetch driving_sessions rows for a company where phase != 'Idle'.
 *
 * Purpose:
 * - Provide a standalone function fetchActiveDrivingSessionsForCompany(companyId?)
 *   that returns all driving_sessions rows with phase != 'Idle'.
 * - Provide a React hook useDrivingSessions(opts?) that resolves companyId from
 *   the passed opts or the current user and exposes { sessions, loading, error, refresh }.
 *
 * Notes:
 * - This file intentionally does not alter any page layout or UI components.
 * - All functions and the hook are fully typed and documented.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * DrivingSessionRow
 *
 * Minimal typed shape for driving_sessions rows used by the helpers.
 */
export interface DrivingSessionRow {
  id: string
  phase?: string | null
  started_at?: string | null
  ended_at?: string | null
  company_id?: string | null
  carrier_company_id?: string | null
  [key: string]: any
}

/**
 * fetchActiveDrivingSessionsForCompany
 *
 * Fetch driving_sessions rows for the supplied companyId where phase != 'Idle'.
 *
 * @param companyId - UUID of the company to query (required)
 * @returns Array of DrivingSessionRow (empty array on error or when companyId missing)
 */
export async function fetchActiveDrivingSessionsForCompany(
  companyId?: string
): Promise<DrivingSessionRow[]> {
  if (!companyId) return []
  try {
    // Build OR filter for common company columns so sessions related to either column are returned.
    const companyFilter = `company_id.eq.${encodeURIComponent(
      companyId
    )},carrier_company_id.eq.${encodeURIComponent(companyId)}`

    const { data, error } = await supabase
      .from('driving_sessions')
      .select('*')
      .neq('phase', 'Idle')
      .or(companyFilter)
      .order('started_at', { ascending: false })

    if (error) {
      // eslint-disable-next-line no-console
      console.error('fetchActiveDrivingSessionsForCompany error', error)
      return []
    }

    return Array.isArray(data) ? (data as DrivingSessionRow[]) : []
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('fetchActiveDrivingSessionsForCompany exception', err)
    return []
  }
}

/**
 * useDrivingSessions
 *
 * React hook that resolves companyId from provided opts or from current user
 * (useAuth) and returns active driving sessions (phase != 'Idle').
 *
 * @param opts.companyId - optional company UUID override
 * @returns { sessions, loading, error, refresh }
 */
export function useDrivingSessions(opts?: { companyId?: string }) {
  const { user } = useAuth()
  const resolvedCompanyId =
    opts?.companyId ?? ((user as any)?.company_id ?? (user as any)?.companyId ?? null)

  const [sessions, setSessions] = useState<DrivingSessionRow[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!resolvedCompanyId) {
        setSessions([])
        setLoading(false)
        return
      }
      const rows = await fetchActiveDrivingSessionsForCompany(resolvedCompanyId)
      setSessions(rows)
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('useDrivingSessions load error', err)
      setError(err?.message ?? String(err))
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [resolvedCompanyId])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  return {
    sessions,
    loading,
    error,
    refresh: load,
  }
}