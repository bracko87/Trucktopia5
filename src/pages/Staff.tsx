/**
 * Staff.tsx
 *
 * Page listing company staff with quick stats and role-based tabs.
 *
 * This file contains the data loading logic and exposes a reload function
 * that can be passed down to child components so they can trigger a fresh
 * fetch after performing updates (salary changes, etc).
 */

import React from 'react'
import { useNavigate } from 'react-router'
import Layout from '../components/Layout'
import StaffStats from '../components/staff/StaffStats'
import StaffTabs from '../components/staff/StaffTabs'
import StaffEffectsOverview from '../components/staff/StaffEffectsOverview'
import { fetchHiredStaff, StaffMember, FetchHiredStaffResult } from '../lib/staffApi'
import { fetchUserCompanyId } from '../lib/userApi'
import { UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useHiredStaffChangedListener } from '../lib/hiredStaffEvents'

/**
 * StaffPage
 *
 * Renders the staff listing page with stats and role tabs. Provides a
 * reloadStaff callback that children can call after mutating data so the
 * parent always performs the authoritative refetch.
 *
 * @returns JSX.Element
 */
export default function StaffPage(): JSX.Element {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [staff, setStaff] = React.useState<StaffMember[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const isMounted = React.useRef(true)
  React.useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  /**
   * load
   *
   * Fetch company id and hired staff rows. Uses isMounted guard to avoid
   * setting state on unmounted components.
   */
  const load = React.useCallback(async () => {
    if (!isMounted.current) return
    setLoading(true)
    setError(null)

    try {
      if (!user?.id) {
        if (isMounted.current) setStaff([])
        return
      }

      const companyId = await fetchUserCompanyId(user.id)
      if (!companyId) {
        if (isMounted.current) setStaff([])
        return
      }

      const result: FetchHiredStaffResult = await fetchHiredStaff(companyId)
      if (result.error) throw result.error

      if (isMounted.current) {
        setStaff(Array.isArray(result.rows) ? result.rows : [])
      }
    } catch (e: any) {
      if (isMounted.current) {
        setError(e?.message ?? 'Failed to load staff')
        setStaff([])
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [user?.id])

  React.useEffect(() => {
    load()
  }, [load])

  /**
   * Listen for global hired_staff:changed events and reload staff when fired.
   * When the event includes a detail payload we apply a local optimistic update
   * so the list reflects the change instantly without waiting for the server.
   */
  React.useEffect(() => {
    const cleanup = useHiredStaffChangedListener((detail) => {
      if (!isMounted.current) return

      // If no detail provided, just trigger a full reload
      if (!detail || !detail.staffId) {
        load()
        return
      }

      // Apply optimistic update to the local staff list so UI updates immediately.
      // Cast to any for flexible object keys; authoritative reload will happen shortly.
      setStaff((prev) =>
        prev.map((s: any) =>
          s.id === detail.staffId
            ? {
                ...s,
                training_skill_id: detail.trainingSkillId ?? s.training_skill_id,
                activity_id: detail.isTraining ? 'training' : s.activity_id,
                activity_until: detail.until ? detail.until : s.activity_until,
              }
            : s
        )
      )

      // Schedule an authoritative refresh shortly to pick up DB truth.
      // Small delay gives the backend time to persist the change.
      setTimeout(() => {
        if (isMounted.current) load()
      }, 1500)
    })
    return cleanup
  }, [load])

  /**
   * reloadStaff
   *
   * Exposed to children so they can request a fresh fetch after performing
   * server-side updates (e.g. salary change).
   */
  const reloadStaff = React.useCallback(() => {
    load()
  }, [load])


  return (
    <Layout fullWidth>
      <div className="px-4 overflow-x-hidden">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Staff</h1>
            <p className="text-sm text-slate-600">Administration and drivers — overview</p>
          </div>

          <button
            onClick={() => navigate('/staff-market')}
            className="inline-flex items-center gap-2 px-3 py-2 bg-sky-600 text-white rounded shadow-sm hover:bg-sky-700"
          >
            <UserPlus size={16} />
            <span className="text-sm font-medium">Hire Staff</span>
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <StaffStats mode="company" />

          {loading ? (
            <div className="p-6 bg-white rounded shadow-sm text-center text-slate-500">Loading staff…</div>
          ) : (
            <>
              <StaffTabs staff={staff} onSalaryUpdated={reloadStaff} />
              {/* Re-enable the Staff Skills & Position Effects overview (keeps original layout) */}
              <StaffEffectsOverview />
            </>
          )}

          {error && (
            <div className="p-3 text-sm text-rose-700 bg-rose-50 rounded">
              {error}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}