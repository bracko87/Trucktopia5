/**
 * StatsGrid.tsx
 *
 * Small stats grid showing live counts: Active Users, Active Trucks, Total Jobs, Total Cities.
 * Includes a smooth number animation that correctly responds to updates from props.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Users, Truck, Briefcase, MapPin } from 'lucide-react'

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
 *
 * Props for the StatsGrid component.
 */
interface StatsGridProps {
  stats: Stats
}

/**
 * StatCard
 *
 * Small card to display a single stat.
 *
 * @param props.icon - icon node
 * @param props.label - label text
 * @param props.value - numeric value to show
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
 * Renders four stat cards in a responsive grid. Implements a number animation
 * that interpolates from the current animated values to the new target values
 * provided in props.stats. Uses a ref to avoid stale closure issues inside
 * the interval callback.
 *
 * @param props.stats - target stats to animate to
 */
export default function StatsGrid({ stats }: StatsGridProps) {
  const [anim, setAnim] = useState<Stats>(stats)

  /**
   * animRef
   *
   * Keeps the latest animated values available to the interval callback to
   * avoid stale closures. Updated whenever `anim` changes.
   */
  const animRef = useRef<Stats>(anim)

  useEffect(() => {
    animRef.current = anim
  }, [anim])

  useEffect(() => {
    // Smooth update animation for numbers (runs whenever incoming stats change)
    const step = 6
    const keys: (keyof Stats)[] = ['activeUsers', 'activeTrucks', 'totalJobs', 'totalCities']

    const interval = setInterval(() => {
      let done = true
      // Start from the most recent animated values
      const next: Stats = { ...animRef.current }

      keys.forEach((k) => {
        const target = stats[k]
        if (next[k] < target) {
          next[k] = Math.min(target, next[k] + Math.max(1, Math.floor((target - next[k]) / step)))
          done = false
        } else if (next[k] > target) {
          next[k] = Math.max(target, next[k] - Math.max(1, Math.floor((next[k] - target) / step)))
          done = false
        }
      })

      // Apply the next animated frame and update the ref via the state update
      setAnim(next)

      if (done) clearInterval(interval)
    }, 40)

    return () => clearInterval(interval)
    // Only re-run when the incoming target stats change
  }, [stats])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={<Users size={20} />} label="Active Users" value={anim.activeUsers} />
      <StatCard icon={<Truck size={20} />} label="Active Trucks" value={anim.activeTrucks} />
      <StatCard icon={<Briefcase size={20} />} label="Total Jobs" value={anim.totalJobs} />
      <StatCard icon={<MapPin size={20} />} label="In-game Cities" value={anim.totalCities} />
    </div>
  )
}