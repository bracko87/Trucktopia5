/**
 * Dashboard.tsx
 *
 * Company dashboard: shows basic company info and management shortcuts.
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { getTable } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * CompanyRow
 *
 * Minimal company type aligned with public.companies schema.
 */
interface CompanyRow {
  id: string
  owner_id: string
  name: string | null
  hub_city: string | null
  hub_country: string | null
  balance?: number | null
  balance_cents?: number | null
  created_at?: string
}

/**
 * DashboardPage
 *
 * Fetches the user's company and displays simple management UI and stats.
 */
export default function DashboardPage() {
  const { user } = useAuth()
  const [company, setCompany] = useState<CompanyRow | null>(null)
  const [stats, setStats] = useState({ trucks: 0, jobs: 0, cities: 0 })

  /**
   * fetchCompany
   *
   * Load the company owned by the current user (owner_id = public.users.id).
   */
  async function fetchCompany() {
    if (!user) return
    const res = await getTable('companies', `?select=*&owner_id=eq.${user.id}`)
    const data = Array.isArray(res.data) ? res.data : []
    setCompany((data[0] as CompanyRow | undefined) || null)
  }

  /**
   * fetchStats
   *
   * Basic stats queries (global, not per-company).
   */
  async function fetchStats() {
    const [trucksRes, jobsRes, citiesRes] = await Promise.all([
      getTable('user_trucks', '?select=id'),
      getTable('job_offers', '?select=id'),
      getTable('cities', '?select=id'),
    ])
    setStats({
      trucks: Array.isArray(trucksRes.data) ? trucksRes.data.length : 0,
      jobs: Array.isArray(jobsRes.data) ? jobsRes.data.length : 0,
      cities: Array.isArray(citiesRes.data) ? citiesRes.data.length : 0,
    })
  }

  useEffect(() => {
    fetchCompany()
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const balanceValue =
    company && company.balance_cents != null
      ? company.balance_cents / 100
      : company && company.balance != null
      ? company.balance
      : 0

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <div className="text-sm text-black/70">Company management and overview</div>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2 bg-white p-6 rounded shadow">
            <h3 className="font-semibold mb-2">Company</h3>
            {company ? (
              <div>
                <div className="text-lg font-bold">{company.name || 'Unnamed company'}</div>
                <div className="text-sm text-black/70">
                  Hub: {company.hub_city || '—'}, {company.hub_country || '—'}
                </div>
                <div className="mt-2 text-sm">
                  Balance:{' '}
                  <span className="font-semibold">
                    ${balanceValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-4">
                  <button className="px-3 py-2 bg-black text-yellow-400 rounded">Manage Fleet</button>
                </div>
              </div>
            ) : (
              <div>No company found. Create one from the Create Company page.</div>
            )}
          </div>

          <aside className="bg-white p-6 rounded shadow">
            <h3 className="font-semibold mb-2">Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <div>Trucks (global)</div>
                <div className="font-bold">{stats.trucks}</div>
              </div>
              <div className="flex justify-between">
                <div>Jobs (global)</div>
                <div className="font-bold">{stats.jobs}</div>
              </div>
              <div className="flex justify-between">
                <div>In-game Cities</div>
                <div className="font-bold">{stats.cities}</div>
              </div>
            </div>
          </aside>
        </section>

        <section className="bg-white p-6 rounded shadow">
          <h3 className="font-semibold mb-2">Company Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 border rounded">
              <div className="font-semibold">Fleet</div>
              <div className="text-sm text-black/70">Manage your trucks and drivers</div>
            </div>
            <div className="p-3 border rounded">
              <div className="font-semibold">Jobs</div>
              <div className="text-sm text-black/70">Find and accept haul jobs</div>
            </div>
            <div className="p-3 border rounded">
              <div className="font-semibold">Finances</div>
              <div className="text-sm text-black/70">Track income and expenses</div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  )
}