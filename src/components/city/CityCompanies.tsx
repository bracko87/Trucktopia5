/**
 * CityCompanies.tsx
 *
 * Fetch and render usernames of companies that have a hub in a given city.
 * Uses the DB view `companies_with_users_by_city` for a single, efficient query.
 */

import React, { useEffect, useState } from 'react'
import { getTable } from '../../lib/supabase'

/**
 * Props for CityCompanies
 */
export interface CityCompaniesProps {
  /** Partial or full city name used for ilike search (case-insensitive) */
  cityName: string
}

/**
 * CompanyUserRow
 *
 * Row returned by companies_with_users_by_city view.
 */
interface CompanyUserRow {
  /** Company id */
  company_id: string
  /** Company display name */
  company_name?: string | null
  /** Owner username */
  username?: string | null
  /** City */
  city?: string | null
}

/**
 * CityCompanies
 *
 * Fetches usernames for companies located in the provided city using the
 * `companies_with_users_by_city` view and renders them.
 *
 * @param props - CityCompaniesProps
 */
export default function CityCompanies({ cityName }: CityCompaniesProps): JSX.Element {
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [usernames, setUsernames] = useState<string[]>([])

  useEffect(() => {
    let mounted = true

    /**
     * fetchUsernamesForCity
     *
     * Calls the view:
     * /rest/v1/companies_with_users_by_city
     * ?select=username&city=ilike.%<cityName>%
     *
     * @param city - city name
     */
    async function fetchUsernamesForCity(city: string) {
      setLoading(true)
      setError(null)
      setUsernames([])

      try {
        const query = `?select=username&limit=1000&city=ilike.%${city}%`
        const res = await getTable('companies_with_users_by_city', query)

        if (!res || res.status >= 400 || !Array.isArray(res.data)) {
          throw new Error('Failed to load companies_with_users_by_city')
        }

        const names = res.data
          .map((r: any) => (r && r.username ? String(r.username).trim() : ''))
          .filter((n: string) => n.length > 0)

        if (mounted) setUsernames(names)
      } catch (err: any) {
        if (mounted) setError(err?.message ?? 'Unknown error')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (cityName && cityName.trim().length > 0) {
      fetchUsernamesForCity(cityName.trim())
    } else {
      setUsernames([])
    }

    return () => {
      mounted = false
    }
  }, [cityName])

  return (
    <div>
      <div className="text-xs text-slate-500">Companies</div>
      <div className="mt-2 space-y-1 max-h-[220px] overflow-auto">
        {loading ? (
          <div className="text-sm text-slate-600">Loading companies…</div>
        ) : error ? (
          <div className="text-sm text-rose-700">Error: {error}</div>
        ) : usernames.length === 0 ? (
          <div className="text-sm text-slate-500">No companies found</div>
        ) : (
          usernames.map((name, idx) => (
            <div key={`${name}-${idx}`} className="text-sm text-slate-700">
              {name}
            </div>
          ))
        )}
      </div>
    </div>
  )
}