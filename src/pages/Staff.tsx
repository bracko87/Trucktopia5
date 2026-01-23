/**
 * Staff.tsx
 *
 * Page listing company staff with quick stats and role-based tabs.
 *
 * - Top-right "Hire Staff" button navigates to /staff-market (Staff Market page).
 * - Uses src/lib/staffApi.fetchHiredStaff to load data (server-backed).
 */

import React from 'react'
import { useNavigate } from 'react-router'
import StaffStats, { StaffCounts } from '../components/staff/StaffStats'
import StaffTabs from '../components/staff/StaffTabs'
import { fetchHiredStaff, StaffMember } from '../lib/staffApi'
import Layout from '../components/Layout'
import { UserPlus } from 'lucide-react'
import HiredStaffList from '../components/staff/HiredStaffList'
import { useAuth } from '../context/AuthContext'

/**
 * StaffPage
 *
 * Main page component.
 *
 * @returns JSX.Element
 */
export default function StaffPage(): JSX.Element {
  const navigate = useNavigate()
  const [staff, setStaff] = React.useState<StaffMember[]>([])
  const [loading, setLoading] = React.useState(false)

  /**
   * Load hired staff when the page mounts.
   * Uses the current user's company_id as the filter.
   */
  const { user } = useAuth()

  React.useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)

      try {
        const companyId = (user as any)?.company_id ?? null
        if (!companyId) {
          if (mounted) setStaff([])
          return
        }

        const data = await fetchHiredStaff(String(companyId))
        if (mounted) {
          setStaff(data)
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

  const counts: StaffCounts = {
    total: staff.length,
    drivers: staff.filter(s => (s.role || '').toLowerCase() === 'driver').length,
    mechanics: staff.filter(s => (s.role || '').toLowerCase() === 'mechanic').length,
    dispatchers: staff.filter(s => (s.role || '').toLowerCase() === 'dispatcher').length,
    managers: staff.filter(s => (s.role || '').toLowerCase() === 'manager').length,
    directors: staff.filter(s => (s.role || '').toLowerCase() === 'director').length,
  }

  return (
    <Layout fullWidth>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-sm text-slate-600">Administration and drivers — overview</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/staff-market')}
            className="inline-flex items-center gap-2 px-3 py-2 bg-sky-600 text-white rounded shadow-sm hover:bg-sky-700"
            aria-label="Hire Staff"
          >
            <UserPlus size={16} />
            <span className="text-sm font-medium">Hire Staff</span>
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {/* Hired staff section (read-only list) */}
        <HiredStaffList />

        <StaffStats counts={counts} />

        {loading ? (
          <div className="p-6 bg-white rounded shadow-sm text-center text-slate-500">
            Loading staff…
          </div>
        ) : (
          <StaffTabs staff={staff} />
        )}
      </div>
    </Layout>
  )
}