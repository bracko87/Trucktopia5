/**
 * LiveStatsRpc.tsx
 *
 * Small live stats component that queries the security-definer RPC `get_stats_counts`
 * and renders four stat boxes. This component intentionally does not fall back to
 * fake numbers — unknown values are rendered as placeholders.
 */

import React, { useEffect, useState } from 'react'
import { Users, Truck, Briefcase, MapPin, RefreshCw } from 'lucide-react'
import { getStatsCounts } from '../../lib/supabase'

/**
 * StatsShape
 *
 * Nullable stats returned from the RPC. null indicates unknown / fetch failed.
 */
interface StatsShape {
  activeUsers: number | null
  activeTrucks: number | null
  totalJobs: number | null
  totalCities: number | null
}

/**
 * StatBoxProps
 *
 * Single stat card props.
 */
interface StatBoxProps {
  label: string
  icon: React.ReactNode
  value: number | null
  loading?: boolean
}

/**
 * StatBox
 *
 * Presentational small card to display a single stat. Shows placeholder when value is null.
 *
 * @param props - StatBoxProps
 */
function StatBox({ label, icon, value, loading }: StatBoxProps) {
  return (
    <div className="bg-white rounded-lg p-4 shadow flex items-center gap-4">
      <div className="w-12 h-12 rounded-md bg-yellow-400 text-black flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xs text-black/70">{label}</div>
        <div className="text-2xl font-bold">{loading ? '…' : value === null ? '—' : value}</div>
      </div>
    </div>
  )
}

/**
 * LiveStatsRpc
 *
 * Fetches the aggregated counts via the RPC `get_stats_counts` and renders stat cards.
 * The component provides a manual refresh control and keeps UI states minimal.
 */
export default function LiveStatsRpc() {
  const [stats, setStats] = useState<StatsShape>({
    activeUsers: null,
    activeTrucks: null,
    totalJobs: null,
    totalCities: null,
  })
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * fetchRpc
   *
   * Call getStatsCounts RPC. On any error keep values nullable so the UI shows placeholders.
   */
  async function fetchRpc() {
    setLoading(true)
    setError(null)
    try {
      const res = await getStatsCounts()
      if (res?.status && res.status >= 200 && res.status < 300 && Array.isArray(res.data) && res.data.length > 0) {
        const row = res.data[0] as Record<string, any>
        setStats({
          activeUsers: row.users_count !== null && row.users_count !== undefined ? Number(row.users_count) : null,
          activeTrucks: row.trucks_count !== null && row.trucks_count !== undefined ? Number(row.trucks_count) : null,
          totalJobs: row.jobs_count !== null && row.jobs_count !== undefined ? Number(row.jobs_count) : null,
          totalCities: row.cities_count !== null && row.cities_count !== undefined ? Number(row.cities_count) : null,
        })
      } else {
        // Keep nulls to indicate unknown counts
        setStats({
          activeUsers: null,
          activeTrucks: null,
          totalJobs: null,
          totalCities: null,
        })
        if (res?.status && res.status >= 400) setError(`RPC error ${res.status}`)
      }
    } catch (err: any) {
      setError(err?.message || 'Network error')
      // Leave stats as null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRpc()
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold">Live counts (RPC)</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRpc}
            title="Refresh"
            className="inline-flex items-center gap-2 text-sm text-black/70 hover:text-black"
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-600 mb-3">Failed to load live counts: {error}</div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox icon={<Users size={20} />} label="Active Users" value={stats.activeUsers} loading={loading} />
        <StatBox icon={<Truck size={20} />} label="Active Trucks" value={stats.activeTrucks} loading={loading} />
        <StatBox icon={<Briefcase size={20} />} label="Total Jobs" value={stats.totalJobs} loading={loading} />
        <StatBox icon={<MapPin size={20} />} label="In-game Cities" value={stats.totalCities} loading={loading} />
      </div>
    </div>
  )
}
