/**
 * Staff.tsx
 *
 * Page listing company staff with quick stats and role-based tabs.
 *
 * This version fixes the stats mismatch by deriving the top counters
 * from the same `staff` array that is passed into StaffTabs.
 */

import React from 'react'
import { useNavigate } from 'react-router'
import Layout from '../components/Layout'
import StaffTabs from '../components/staff/StaffTabs'
import StaffEffectsOverview from '../components/staff/StaffEffectsOverview'
import { fetchHiredStaff, StaffMember, FetchHiredStaffResult } from '../lib/staffApi'
import { fetchUserCompanyId } from '../lib/userApi'
import { UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useHiredStaffChangedListener } from '../lib/hiredStaffEvents'

type StaffRoleCounts = {
  drivers: number
  mechanics: number
  dispatchers: number
  managers: number
  directors: number
}

function createEmptyRoleCounts(): StaffRoleCounts {
  return {
    drivers: 0,
    mechanics: 0,
    dispatchers: 0,
    managers: 0,
    directors: 0,
  }
}

/**
 * Normalizes a staff member role into one of the tab buckets.
 * This checks a few common field names so it remains resilient
 * even if StaffMember uses a slightly different property shape.
 */
function getStaffRole(member: StaffMember): keyof StaffRoleCounts | null {
  const rawRole = [
    (member as any).role,
    (member as any).staff_type,
    (member as any).staffType,
    (member as any).position,
    (member as any).job_title,
    (member as any).jobTitle,
    (member as any).category,
    (member as any).type,
  ].find((value) => typeof value === 'string' && value.trim().length > 0)

  if (!rawRole) return null

  const value = String(rawRole).trim().toLowerCase()

  if (value.includes('driver')) return 'drivers'
  if (value.includes('mechanic')) return 'mechanics'
  if (value.includes('dispatch')) return 'dispatchers'
  if (value.includes('manager')) return 'managers'
  if (value.includes('director')) return 'directors'

  return null
}

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

  /**
   * Derive the top stats from the exact same `staff` array used by StaffTabs.
   * This guarantees the red block and green tabs stay in sync.
   */
  const roleCounts = React.useMemo<StaffRoleCounts>(() => {
    return staff.reduce<StaffRoleCounts>((acc, member) => {
      const role = getStaffRole(member)
      if (role) acc[role] += 1
      return acc
    }, createEmptyRoleCounts())
  }, [staff])

  const totalStaff = React.useMemo(() => staff.length, [staff])

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
          {/* Top stats now use the same loaded `staff` state as StaffTabs */}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-slate-500">Total staff</p>
                <p className="text-4xl font-bold text-slate-900">
                  {loading ? '0' : totalStaff}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                  {loading ? '0' : roleCounts.drivers} Drivers
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                  {loading ? '0' : roleCounts.mechanics} Mechanics
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                  {loading ? '0' : roleCounts.dispatchers} Dispatchers
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                  {loading ? '0' : roleCounts.managers} Managers
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                  {loading ? '0' : roleCounts.directors} Directors
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 bg-white rounded shadow-sm text-center text-slate-500">
              Loading staff…
            </div>
          ) : (
            <>
              <StaffTabs staff={staff} onSalaryUpdated={reloadStaff} />
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