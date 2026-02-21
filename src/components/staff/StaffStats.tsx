import React from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface StaffCounts {
  total: number
  drivers: number
  mechanics: number
  dispatchers: number
  managers: number
  directors: number
}

export interface StaffStatsProps {
  mode: 'company' | 'market'
}

export default function StaffStats({ mode }: StaffStatsProps) {
  const { user } = useAuth()
  const companyId = (user as any)?.company_id ?? null

  const [counts, setCounts] = React.useState<StaffCounts>({
    total: 0,
    drivers: 0,
    mechanics: 0,
    dispatchers: 0,
    managers: 0,
    directors: 0,
  })

  const table =
    mode === 'company' ? 'hired_staff' : 'unemployed_staff'

  React.useEffect(() => {
    let mounted = true

    /* 🔒 HARD GUARD
       If this is the Staff page and companyId is missing,
       DO NOT QUERY ANYTHING.
    */
    if (mode === 'company' && !companyId) {
      setCounts({
        total: 0,
        drivers: 0,
        mechanics: 0,
        dispatchers: 0,
        managers: 0,
        directors: 0,
      })
      return
    }

    async function fetchCount(category?: string) {
      if (mode === 'company' && !companyId) return 0

      let q = supabase
        .from(table)
        .select('id', { count: 'exact' })

      if (category) q = q.eq('job_category', category)
      if (mode === 'company') q = q.eq('company_id', companyId)

      const res = await q
      return res.error ? 0 : res.count ?? 0
    }

    async function load() {
      const [
        total,
        drivers,
        mechanics,
        dispatchers,
        managers,
        directors,
      ] = await Promise.all([
        fetchCount(),
        fetchCount('drivers'),
        fetchCount('mechanics'),
        fetchCount('dispatchers'),
        fetchCount('managers'),
        fetchCount('directors'),
      ])

      if (!mounted) return

      setCounts({
        total,
        drivers,
        mechanics,
        dispatchers,
        managers,
        directors,
      })
    }

    load()
    return () => {
      mounted = false
    }
  }, [mode, companyId])

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <div className="text-sm text-slate-500">
          {mode === 'company' ? 'Total staff' : 'Available staff'}
        </div>
        <div className="mt-1 text-2xl font-bold text-slate-900">
          {counts.total}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <RoleChip label="Drivers" count={counts.drivers} />
        <RoleChip label="Mechanics" count={counts.mechanics} />
        <RoleChip label="Dispatchers" count={counts.dispatchers} />
        <RoleChip label="Managers" count={counts.managers} />
        <RoleChip label="Directors" count={counts.directors} />
      </div>
    </div>
  )
}

function RoleChip({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-3 py-1 rounded-full text-sm font-medium bg-white text-black border border-black/10">
      <span className="font-semibold">{count}</span> {label}
    </div>
  )
}
