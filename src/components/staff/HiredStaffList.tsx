/**
 * HiredStaffList.tsx
 *
 * Fetch and display hired_staff rows for the current user's company.
 *
 * Notes:
 * - Uses schema-correct query: filters by company_id and orders by hired_at.
 * - No fallback to owner_user_id, no use of created_at, no userId logic.
 */

import React from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import HiredStaffCard, { HiredStaffMember } from './HiredStaffCard'

/**
 * HiredStaffList
 *
 * Fetches and renders hired_staff for the current user's company.
 *
 * - If user or company_id is missing, returns an empty list.
 * - Strictly company-centric (no user fallback).
 *
 * @returns JSX.Element
 */
export default function HiredStaffList(): JSX.Element {
  const { user } = useAuth()
  const [items, setItems] = React.useState<HiredStaffMember[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        if (!user) {
          if (mounted) setItems([])
          return
        }

        const companyId = (user as any).company_id
        if (!companyId) {
          if (mounted) setItems([])
          return
        }

        const { data, error } = await supabase
          .from('hired_staff')
          .select('*')
          .eq('company_id', companyId)
          .order('hired_at', { ascending: false })
          .limit(200)

        if (!mounted) return

        if (error) {
          setError(error.message)
          setItems([])
        } else {
          setItems(data ?? [])
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.message ?? 'Failed to load hired staff')
          setItems([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [user])

  return (
    <div className="mt-4">
      <h2 className="text-lg font-semibold mb-3">Hired Staff</h2>

      {loading ? (
        <div className="p-6 bg-white rounded shadow-sm text-sm text-slate-500">
          Loading hired staff…
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-100 rounded text-rose-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="p-6 bg-white rounded shadow-sm text-sm text-slate-500">
          No hired staff found for this company.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((m) => (
            <HiredStaffCard key={m.id} member={m} />
          ))}
        </div>
      )}
    </div>
  )
}