/**
 * StaffMarket.tsx
 *
 * Staff Market page - lists available candidates and provides filters/pagination.
 *
 * This file contains minimal layout safety tweaks (min-w-0 guards) to avoid
 * horizontal overflow when the page is rendered full-width inside the app layout.
 */

import React from 'react'
import Layout from '../components/Layout'
import StaffStats, { StaffCounts } from '../components/staff/StaffStats'
import StaffFilters from '../components/staff/StaffFilters'
import StaffCard from '../components/staff/StaffCard'
import StaffPagination from '../components/staff/StaffPagination'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

/**
 * StaffMember
 *
 * Represents a normalized staff candidate row used by the UI.
 */
export interface StaffMember {
  id: string
  name?: string | null
  role?: string | null
  country?: string | null
  expected_salary?: number | null
  expected_salary_cents?: number | null
  experience_years?: number | null
  bio?: string | null
  skills?: string[] | null
  generated_at?: string | null
  availability?: string | null
  country_code?: string | null
}

type RoleFilter =
  | 'all'
  | 'driver'
  | 'mechanic'
  | 'dispatcher'
  | 'manager'
  | 'director'

/**
 * normalizeRow
 *
 * Convert a raw DB row into a StaffMember for consistent rendering.
 *
 * @param row raw database row
 * @returns StaffMember
 */
function normalizeRow(row: any): StaffMember {
  const id = row.id ?? String(Math.random())
  const name =
    row.first_name || row.last_name
      ? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
      : null

  return {
    id,
    name,
    role: row.job_category ?? null,
    country: row.country_code ?? null,
    country_code: row.country_code ?? null,
    expected_salary: row.salary != null ? Number(row.salary) : null,
    expected_salary_cents:
      row.salary != null ? Math.round(Number(row.salary) * 100) : null,
    experience_years:
      row.experience != null ? Number(row.experience) : null,
    bio: null,
    skills: [row.skill1_id, row.skill2_id, row.skill3_id]
      .filter(Boolean)
      .map(String),
    generated_at: row.generated_at ?? null,
    availability: row.availability ?? null,
  }
}

/**
 * StaffMarket
 *
 * Page component that displays the staff marketplace.
 *
 * Minimal layout safety tweaks:
 * - outer wrappers have min-w-0
 * - section and grids include min-w-0 to prevent child overflow from breaking layout
 */
export default function StaffMarket(): JSX.Element {
  const [rows, setRows] = React.useState<StaffMember[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [page, setPage] = React.useState(1)
  const [pageCount, setPageCount] = React.useState(1)

  const [roleFilter, setRoleFilter] =
    React.useState<RoleFilter>('all')
  const [skillsFilter, setSkillsFilter] =
    React.useState<string>('all')
  const [salaryMode, setSalaryMode] =
    React.useState<'any' | 'below' | 'above'>('any')
  const [salaryValue, setSalaryValue] = React.useState('')
  const [countryFilter, setCountryFilter] =
    React.useState<string>('all')

  const pageSize = 20

  React.useEffect(() => {
    setPage(1)
  }, [
    roleFilter,
    skillsFilter,
    salaryMode,
    salaryValue,
    countryFilter,
  ])

  React.useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        let query: any = supabase
          .from('unemployed_staff')
          .select('*', { count: 'exact' })
          .order('generated_at', { ascending: false })
          .range(from, to)

        if (roleFilter !== 'all')
          query = query.eq('job_category', roleFilter)

        if (skillsFilter !== 'all' && skillsFilter.trim()) {
          const skill = skillsFilter.replace(/\\"/g, '')
          const pattern = `%${skill}%`

          query = query
            .ilike('skill1_id', pattern)
            .or(`skill2_id.ilike.${pattern}`)
            .or(`skill3_id.ilike.${pattern}`)
        }

        if (salaryMode !== 'any' && salaryValue) {
          const v = Number(salaryValue)
          if (!Number.isNaN(v)) {
            if (salaryMode === 'below')
              query = query.lte('salary', v)
            if (salaryMode === 'above')
              query = query.gte('salary', v)
          }
        }

        if (countryFilter && countryFilter !== 'all') {
          query = query.eq('country_code', countryFilter)
        }

        const { data, count, error: sbError } =
          await query

        if (!mounted) return

        if (sbError) {
          setError(sbError.message || 'Failed to load staff')
          setRows([])
          setPageCount(1)
          return
        }

        const items = Array.isArray(data) ? data : []
        setRows(items.map(normalizeRow))
        setPageCount(
          Math.max(1, Math.ceil((count ?? 0) / pageSize))
        )
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Failed to load staff')
        setRows([])
        setPageCount(1)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [
    page,
    roleFilter,
    skillsFilter,
    salaryMode,
    salaryValue,
    countryFilter,
  ])

  const stats: StaffCounts = React.useMemo(() => {
    const c: StaffCounts = {
      total: rows.length,
      drivers: 0,
      mechanics: 0,
      dispatchers: 0,
      managers: 0,
      directors: 0,
    }

    rows.forEach((r) => {
      const role = (r.role || '').toLowerCase()
      if (role.includes('driver')) c.drivers++
      else if (role.includes('mechanic')) c.mechanics++
      else if (role.includes('dispatcher')) c.dispatchers++
      else if (role.includes('manager')) c.managers++
      else if (role.includes('director')) c.directors++
    })

    return c
  }, [rows])

  return (
    <Layout fullWidth>
      <div className="space-y-6 min-w-0">
        <header className="min-w-0">
          <h1 className="text-2xl font-bold">
            Staff Market
          </h1>

          <div className="flex items-start justify-between min-w-0">
            <p className="text-sm text-slate-500">
              Browse available candidates and hire drivers,
              mechanics, dispatchers, managers and directors.
            </p>

            <a
              href="#/staff"
              className="text-sm text-sky-600 hover:underline"
            >
              Back to Staff
            </a>
          </div>

          <div className="mt-4 mb-6">
            <StaffStats
              counts={stats}
              source="unemployed"
            />
          </div>

          <StaffFilters
            roleFilter={roleFilter}
            onRoleFilterChange={(v) =>
              setRoleFilter(v as RoleFilter)
            }
            skillsFilter={skillsFilter}
            onSkillsFilterChange={setSkillsFilter}
            salaryMode={salaryMode}
            onSalaryModeChange={setSalaryMode}
            salaryValue={salaryValue}
            onSalaryValueChange={setSalaryValue}
            countryFilter={countryFilter}
            onCountryFilterChange={setCountryFilter}
          />
        </header>

        <section className="bg-white p-6 rounded-lg shadow-sm w-full min-w-0 overflow-x-hidden">
          {loading && (
            <div className="text-sm text-slate-500">
              Loading candidates…
            </div>
          )}

          {error && (
            <div className="text-sm text-rose-600">
              {error}
            </div>
          )}

          {!loading &&
            !error &&
            rows.length === 0 && (
              <div className="text-sm text-slate-500">
                No candidates available.
              </div>
            )}

          {rows.length > 0 && (
            <>
              <div className="grid gap-3 min-w-0">
                {rows.map((c) => (
                  <StaffCard
                    key={c.id}
                    candidate={c}
                    onHire={(candidateId) => {
                      setRows((prev) =>
                        prev.filter(
                          (r) => r.id !== candidateId
                        )
                      )
                      toast.success(
                        'Candidate moved to hired staff'
                      )
                    }}
                  />
                ))}
              </div>

              <div className="mt-4">
                <StaffPagination
                  currentPage={page}
                  pageCount={pageCount}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </Layout>
  )
}