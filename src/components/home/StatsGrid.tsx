/**
 * StatsGrid.tsx
 *
 * Small stats grid showing live counts: Active Users, Active Trucks, Total Jobs, Total Cities.
 */

import React, { useEffect, useState } from 'react'
import { Users, Truck, Briefcase, MapPin } from 'lucide-react'
import { getTable } from '../../lib/supabase'

/**
 * Stats
 *
 * Basic stats shape.
 */
interface Stats {
  activeUsers: number
  activeTrucks: number
  totalJobs: number
  totalCities: number
}

/**
 * StatsGridProps
 */
interface StatsGridProps {
  stats: Stats
}

/**
 * StatCard
 *
 * Small card to display a single stat.
 */
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow flex items-center gap-4">
      <div className="w-12 h-12 rounded-md bg-yellow-400 text-black flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xs text-black/70">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </div>
  )
}

/**
 * StatsGrid
 *
 * Renders four stat cards in a responsive grid.
 *
 * Notes:
 * - Uses a single read-only DB view `public.stats_counts` (created server-side) which returns
 *   the authoritative counts. This avoids 401s caused by selecting protected tables directly.
 * - Fallback to the `stats` prop if the view is not available or returns errors.
 */
export default function StatsGrid({ stats }: StatsGridProps) {
  const [anim, setAnim] = useState<Stats>(stats)
  const [fetchedActiveUsers, setFetchedActiveUsers] = useState<number | null>(null)
  const [fetchedActiveTrucks, setFetchedActiveTrucks] = useState<number | null>(null)
  const [fetchedTotalJobs, setFetchedTotalJobs] = useState<number | null>(null)
  const [fetchedTotalCities, setFetchedTotalCities] = useState<number | null>(null)

  /**
   * fetchCountsFromView
   *
   * Query the single read-only view `stats_counts` that returns aggregated counts.
   */
  async function fetchCountsFromView() {
    try {
      const res = await getTable('stats_counts', '?select=*')
      if (Array.isArray(res?.data) && res.data.length > 0) {
        const row = res.data[0] as Record<string, any>
        setFetchedActiveUsers(Number(row.users_count) || 0)
        setFetchedActiveTrucks(Number(row.trucks_count) || 0)
        setFetchedTotalJobs(Number(row.jobs_count) || 0)
        setFetchedTotalCities(Number(row.cities_count) || 0)
        return
      }
    } catch (err) {
      // ignore and fall back to legacy per-table fetches below
    }

    // Legacy fallbacks (try selecting minimal id lists) in case the view isn't present
    await Promise.all([fetchUsersCount(), fetchTrucksCount(), fetchCitiesCount()])
  }

  /**
   * fetchUsersCount
   *
   * Load the total number of rows in public.users and store in state.
   */
  async function fetchUsersCount() {
    try {
      const res = await getTable('users', '?select=id')
      const count = Array.isArray(res?.data) ? res.data.length : 0
      setFetchedActiveUsers(count)
    } catch (err) {
      // Keep null on error - fall back to provided stats
    }
  }

  /**
   * fetchTrucksCount
   *
   * Load the total number of rows in public.user_trucks and store in state.
   */
  async function fetchTrucksCount() {
    try {
      // alias 'trucks' maps to user_trucks in the helper; select id only to minimize payload
      const res = await getTable('trucks', '?select=id')
      const count = Array.isArray(res?.data) ? res.data.length : 0
      setFetchedActiveTrucks(count)
    } catch (err) {
      // Keep null on error - fall back to provided stats
    }
  }

  /**
   * fetchCitiesCount
   *
   * Load the total number of rows in public.cities and store in state.
   */
  async function fetchCitiesCount() {
    try {
      const res = await getTable('cities', '?select=id')
      const count = Array.isArray(res?.data) ? res.data.length : 0
      setFetchedTotalCities(count)
    } catch (err) {
      // Keep null on error - fall back to provided stats
    }
  }

  useEffect(() => {
    fetchCountsFromView()
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Merge authoritative sources: fetched values (if available) else props
    const targetStats: Stats = {
      activeUsers: fetchedActiveUsers ?? stats.activeUsers,
      activeTrucks: fetchedActiveTrucks ?? stats.activeTrucks,
      totalJobs: fetchedTotalJobs ?? stats.totalJobs,
      totalCities: fetchedTotalCities ?? stats.totalCities,
    }

    // simple smooth update animation for numbers
    const step = 6
    const keys: (keyof Stats)[] = ['activeUsers', 'activeTrucks', 'totalJobs', 'totalCities']
    const interval = setInterval(() => {
      let done = true
      const next = { ...anim }
      keys.forEach((k) => {
        const target = targetStats[k]
        if (next[k] < target) {
          next[k] = Math.min(target, next[k] + Math.max(1, Math.floor((target - next[k]) / step)))
          done = false
        } else if (next[k] > target) {
          next[k] = Math.max(target, next[k] - Math.max(1, Math.floor((next[k] - target) / step)))
          done = false
        }
      })
      setAnim(next)
      if (done) clearInterval(interval)
    }, 40)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, fetchedActiveUsers, fetchedActiveTrucks, fetchedTotalJobs, fetchedTotalCities])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={<Users size={20} />} label="Active Users" value={anim.activeUsers} />
      <StatCard icon={<Truck size={20} />} label="Active Trucks" value={anim.activeTrucks} />
      <StatCard icon={<Briefcase size={20} />} label="Total Jobs" value={anim.totalJobs} />
      <StatCard icon={<MapPin size={20} />} label="In-game Cities" value={anim.totalCities} />
    </div>
  )
}
