/**
 * StatsGrid.tsx
 *
 * Small stats grid showing live counts: Active Users, Active Trucks, Total Jobs, Total Cities.
 */

import React, { useEffect, useState } from 'react'
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
 */
export default function StatsGrid({ stats }: StatsGridProps) {
  const [anim, setAnim] = useState(stats)

  useEffect(() => {
    // simple smooth update animation for numbers
    const step = 6
    const keys: (keyof Stats)[] = ['activeUsers', 'activeTrucks', 'totalJobs', 'totalCities']
    const interval = setInterval(() => {
      let done = true
      const next = { ...anim }
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
      setAnim(next)
      if (done) clearInterval(interval)
    }, 40)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
