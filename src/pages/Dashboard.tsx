/**
 * Dashboard.tsx
 *
 * Company dashboard: landing-style overview with source-linked sections,
 * clearer hierarchy, and improved visual polish.
 */

import React, { useCallback, useEffect, useState } from 'react'
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
  company_image_url?: string | null
  trucks?: number | null
  trailers?: number | null
  employees?: number | null
  is_bankrupt?: boolean
}

interface DashboardStats {
  trucks: number
  jobs: number
  cities: number
}

interface AssignmentRow {
  id: string
  title?: string | null
  job_title?: string | null
  origin_city?: string | null
  pickup_city?: string | null
  destination_city?: string | null
  delivery_city?: string | null
  status?: string | null
  updated_at?: string | null
  created_at?: string | null
  payout?: number | null
  reward?: number | null
}

interface NotificationRow {
  id: string
  title?: string | null
  message?: string | null
  body?: string | null
  is_read?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

interface GameNewsRow {
  id: string
  title?: string | null
  summary?: string | null
  content?: string | null
  url?: string | null
  created_at?: string | null
  updated_at?: string | null
  published_at?: string | null
}

/**
 * DashboardPage
 *
 * Fetches the user's company and renders a company landing / command center view.
 */
export default function DashboardPage() {
  const { user } = useAuth()

  const [company, setCompany] = useState<CompanyRow | null>(null)
  const [stats, setStats] = useState<DashboardStats>({ trucks: 0, jobs: 0, cities: 0 })
  const [activeAssignments, setActiveAssignments] = useState<AssignmentRow[]>([])
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [gameNews, setGameNews] = useState<GameNewsRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [logoLoadFailed, setLogoLoadFailed] = useState(false)

  /**
   * fetchCompany
   *
   * Load the company owned by the current user (owner_id = public.users.id).
   */
  const fetchCompany = useCallback(async (): Promise<CompanyRow | null> => {
    if (!user) return null

    const res = await getTable('companies', `?select=*&owner_id=eq.${user.id}`)
    const data = Array.isArray(res.data) ? res.data : []

    return (data[0] as CompanyRow | undefined) || null
  }, [user])

  /**
   * fetchStats
   *
   * Still uses mostly global counts because the current code does not show
   * company-specific filters on these tables yet.
   */
  const fetchStats = useCallback(async (): Promise<DashboardStats> => {
    const [trucksRes, jobsRes, citiesRes] = await Promise.all([
      getTable('user_trucks', '?select=id'),
      getTable('job_offers', '?select=id'),
      getTable('cities', '?select=id'),
    ])

    return {
      trucks: Array.isArray(trucksRes.data) ? trucksRes.data.length : 0,
      jobs: Array.isArray(jobsRes.data) ? jobsRes.data.length : 0,
      cities: Array.isArray(citiesRes.data) ? citiesRes.data.length : 0,
    }
  }, [])

  /**
   * fetchActiveAssignments
   *
   * Expects a table named public.job_assignments with company_id + status.
   * If your real table name differs, update only this query.
   */
  const fetchActiveAssignments = useCallback(
    async (companyId: string): Promise<AssignmentRow[]> => {
      try {
        const res = await getTable(
          'job_assignments',
          `?select=*&company_id=eq.${companyId}&status=eq.active&limit=5`,
        )

        const data = Array.isArray(res.data) ? (res.data as AssignmentRow[]) : []
        return data
      } catch {
        return []
      }
    },
    [],
  )

  /**
   * fetchNotifications
   *
   * Expects a table named public.notifications with user_id.
   * If your real table name differs, update only this query.
   */
  const fetchNotifications = useCallback(async (): Promise<NotificationRow[]> => {
    if (!user) return []

    try {
      const res = await getTable('notifications', `?select=*&user_id=eq.${user.id}&limit=5`)
      const data = Array.isArray(res.data) ? (res.data as NotificationRow[]) : []
      return data
    } catch {
      return []
    }
  }, [user])

  /**
   * fetchGameNews
   *
   * Expects a table named public.game_news.
   * If your real table name differs, update only this query.
   */
  const fetchGameNews = useCallback(async (): Promise<GameNewsRow[]> => {
    try {
      const res = await getTable('game_news', '?select=*&limit=5')
      const data = Array.isArray(res.data) ? (res.data as GameNewsRow[]) : []
      return data
    } catch {
      return []
    }
  }, [])

  /**
   * refreshDashboard
   *
   * Refresh all visible dashboard data.
   */
  const refreshDashboard = useCallback(async () => {
    if (!user) {
      setCompany(null)
      setStats({ trucks: 0, jobs: 0, cities: 0 })
      setActiveAssignments([])
      setNotifications([])
      setGameNews([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const nextCompany = await fetchCompany()

      const [nextStats, nextNotifications, nextGameNews, nextAssignments] = await Promise.all([
        fetchStats(),
        fetchNotifications(),
        fetchGameNews(),
        nextCompany ? fetchActiveAssignments(nextCompany.id) : Promise.resolve([]),
      ])

      setCompany(nextCompany)
      setStats(nextStats)
      setNotifications(sortByNewest(nextNotifications))
      setGameNews(sortByNewest(nextGameNews))
      setActiveAssignments(sortByNewest(nextAssignments))
      setLastUpdated(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard right now.')
    } finally {
      setIsLoading(false)
    }
  }, [fetchActiveAssignments, fetchCompany, fetchGameNews, fetchNotifications, fetchStats, user])

  useEffect(() => {
    void refreshDashboard()
  }, [refreshDashboard])

  useEffect(() => {
    setLogoLoadFailed(false)
  }, [company?.company_image_url])

  const balanceValue =
    company && company.balance_cents != null
      ? company.balance_cents / 100
      : company && company.balance != null
      ? company.balance
      : 0

  const companyStatus = getCompanyStatus(company, balanceValue)
  const createdLabel = formatDate(company?.created_at, { dateStyle: 'medium' })
  const updatedLabel = formatDate(lastUpdated, { dateStyle: 'medium', timeStyle: 'short' })

  const companyTruckCount = company?.trucks ?? stats.trucks
  const companyTrailerCount = company?.trailers ?? 0
  const unreadNotificationsCount = notifications.filter((item) => item.is_read === false).length

  const isInitialLoading = isLoading && !lastUpdated && !error && !company

  if (isInitialLoading) {
    return <LoadingDashboard />
  }

  const overviewItems = [
    {
      title: 'Company status',
      description: company
        ? `${companyStatus.helperText} Hub operations are centered in ${company.hub_city || '—'}, ${company.hub_country || '—'}.`
        : 'No company profile is connected yet. Create a company to unlock fleet, finance, and activity tracking in one place.',
      sourceLabel: 'Source: public.companies',
      sourceHref: '#company-profile',
      updated: updatedLabel,
    },
    {
      title: 'Active assignments',
      description:
        activeAssignments.length > 0
          ? `${activeAssignments.length} active assignment${activeAssignments.length === 1 ? '' : 's'} currently visible for this company.`
          : 'No active assignments are currently visible in the dashboard dataset.',
      sourceLabel: 'Source: public.job_assignments',
      sourceHref: '#active-assignments',
      updated: updatedLabel,
    },
    {
      title: 'Notifications',
      description:
        notifications.length > 0
          ? `${notifications.length} notification${notifications.length === 1 ? '' : 's'} loaded, including ${unreadNotificationsCount} unread.`
          : 'No notifications are currently visible for this account.',
      sourceLabel: 'Source: public.notifications',
      sourceHref: '#notifications',
      updated: updatedLabel,
    },
    {
      title: 'Market activity',
      description: `${stats.jobs.toLocaleString()} open jobs and ${stats.cities.toLocaleString()} available cities are currently indexed for planning.`,
      sourceLabel: 'Source: public.job_offers + public.cities',
      sourceHref: '#network-stats',
      updated: updatedLabel,
    },
  ]

  const activityItems = [
    {
      title: company ? 'Company profile loaded' : 'Company setup pending',
      description: company
        ? `${company.name || 'Unnamed company'} is ready for review and management actions.`
        : 'Create your company first to populate this dashboard with live company data.',
      sourceHref: '#company-profile',
      sourceLabel: 'public.companies',
    },
    {
      title: 'Branding asset checked',
      description:
        company?.company_image_url && !logoLoadFailed
          ? 'A company image is available and is being used in the hero panel.'
          : 'No company image is available yet. Add a company image URL to personalize this page.',
      sourceHref: '#company-hero',
      sourceLabel: 'company image',
    },
    {
      title: 'Feeds refreshed',
      description: `${activeAssignments.length} assignments, ${notifications.length} notifications, and ${gameNews.length} news items are currently visible.`,
      sourceHref: '#active-assignments',
      sourceLabel: 'dashboard feeds',
    },
  ]

  const sourceItems = [
    {
      name: 'Company record',
      detail: 'Identity, hub, financial snapshot, and company image.',
      href: '#company-profile',
    },
    {
      name: 'Active assignments',
      detail: 'Current visible assignment records for this company.',
      href: '#active-assignments',
    },
    {
      name: 'Notifications',
      detail: 'Latest user-facing notification records.',
      href: '#notifications',
    },
    {
      name: 'Game news',
      detail: 'Latest visible global game news entries.',
      href: '#game-news',
    },
  ]

  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-black/70">
              Central landing page for company health, key metrics, updates, and source-tracked
              information.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refreshDashboard()}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Refreshing…' : 'Refresh data'}
          </button>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section
          id="company-hero"
          className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="bg-gradient-to-r from-slate-50 via-white to-amber-50 px-6 py-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {company?.name || 'No company connected'}
                  </h2>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${companyStatus.className}`}
                  >
                    {companyStatus.label}
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-600">
                  {company
                    ? 'A single place to monitor company identity, operating status, finances, assignments, and current data signals.'
                    : 'Create or connect a company to turn this page into a live operational landing page.'}
                </p>

                <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <span className="font-medium text-slate-900">Hub:</span>{' '}
                    {company ? `${company.hub_city || '—'}, ${company.hub_country || '—'}` : '—'}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <span className="font-medium text-slate-900">Created:</span> {createdLabel}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <span className="font-medium text-slate-900">Last synced:</span> {updatedLabel}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Manage Fleet
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    View Jobs
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Finances
                  </button>
                </div>
              </div>

              <div className="min-w-[260px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-black/70">Company logo</div>

                <div className="mt-3 flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {company?.company_image_url && !logoLoadFailed ? (
                    <img
                      src={company.company_image_url}
                      alt={company.name ? `${company.name} logo` : 'Company logo'}
                      className="h-full w-full object-cover"
                      onError={() => setLogoLoadFailed(true)}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-bold text-white">
                      {getCompanyInitials(company?.name)}
                    </div>
                  )}
                </div>

                <div className="mt-3 text-sm text-black/70">
                  {company?.company_image_url && !logoLoadFailed
                    ? 'Loaded from public.companies.company_image_url.'
                    : 'No company image found yet. Add one to public.companies.company_image_url.'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="network-stats" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Company trucks"
            value={companyTruckCount.toLocaleString()}
            hint="Current fleet count for this company"
          />
          <MetricCard
            label="Company trailers"
            value={companyTrailerCount.toLocaleString()}
            hint="Attached trailer count for this company"
          />
          <MetricCard
            label="Open jobs"
            value={stats.jobs.toLocaleString()}
            hint="Active jobs in the current dataset"
          />
          <MetricCard
            label="Balance snapshot"
            value={company ? formatCurrency(balanceValue) : '—'}
            hint={company ? 'Visible balance for the active company' : 'No company linked yet'}
          />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <SectionCard
            id="active-assignments"
            title="Active assignments"
            subtitle="Current company jobs in progress."
          >
            <div className="space-y-3">
              {activeAssignments.length > 0 ? (
                activeAssignments.map((assignment) => {
                  const title = assignment.title || assignment.job_title || 'Assignment'
                  const from = assignment.origin_city || assignment.pickup_city || '—'
                  const to = assignment.destination_city || assignment.delivery_city || '—'
                  const payout = assignment.payout ?? assignment.reward ?? null
                  const updatedAt = assignment.updated_at || assignment.created_at

                  return (
                    <div
                      key={assignment.id}
                      className="rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{title}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            Route: {from} → {to}
                          </div>
                        </div>

                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {assignment.status || 'active'}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Updated: {formatDate(updatedAt, { dateStyle: 'medium' })}</span>
                        {payout != null ? <span>Payout: {formatCurrency(Number(payout))}</span> : null}
                      </div>
                    </div>
                  )
                })
              ) : (
                <EmptyState message="No active assignments found right now." />
              )}
            </div>
          </SectionCard>

          <SectionCard
            id="notifications"
            title="Notifications"
            subtitle="Latest alerts and system messages for this account."
          >
            <div className="space-y-3">
              {notifications.length > 0 ? (
                notifications.map((item) => {
                  const title = item.title || 'Notification'
                  const message = item.message || item.body || 'No details available.'
                  const timestamp = item.updated_at || item.created_at

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border p-4 transition hover:bg-slate-50 ${
                        item.is_read === false
                          ? 'border-amber-200 bg-amber-50/50'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{title}</div>
                        {item.is_read === false ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            Unread
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 text-sm text-slate-600">{message}</div>

                      <div className="mt-3 text-xs text-slate-500">
                        {formatDate(timestamp, { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>
                  )
                })
              ) : (
                <EmptyState message="No notifications found right now." />
              )}
            </div>
          </SectionCard>

          <SectionCard
            id="game-news"
            title="Game news"
            subtitle="Latest visible game updates and announcements."
          >
            <div className="space-y-3">
              {gameNews.length > 0 ? (
                gameNews.map((item) => {
                  const title = item.title || 'News update'
                  const summary = item.summary || item.content || 'No summary available.'
                  const publishedAt = item.published_at || item.updated_at || item.created_at

                  const content = (
                    <>
                      <div className="text-sm font-semibold text-slate-900">{title}</div>
                      <div className="mt-1 text-sm text-slate-600 line-clamp-3">{summary}</div>
                      <div className="mt-3 text-xs text-slate-500">
                        {formatDate(publishedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </>
                  )

                  return item.url ? (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                    >
                      {content}
                    </a>
                  ) : (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                    >
                      {content}
                    </div>
                  )
                })
              ) : (
                <EmptyState message="No game news found right now." />
              )}
            </div>
          </SectionCard>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <SectionCard
              id="overview-feed"
              title="Live overview"
              subtitle="High-signal information grouped in one place with visible sources."
            >
              <div className="space-y-4">
                {overviewItems.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                      </div>

                      <a
                        href={item.sourceHref}
                        className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        View source
                      </a>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>{item.sourceLabel}</span>
                      <span>Updated: {item.updated}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              id="activity-feed"
              title="Recent activity"
              subtitle="A simple timeline of what this dashboard is currently surfacing."
            >
              <div className="space-y-4">
                {activityItems.map((item) => (
                  <div
                    key={item.title}
                    className="flex gap-4 rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                          <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                        </div>

                        <a
                          href={item.sourceHref}
                          className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-700"
                        >
                          {item.sourceLabel}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title="Quick actions"
              subtitle="Your most-used management shortcuts, kept easy to reach."
            >
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 p-4 text-left transition hover:bg-slate-50"
                >
                  <div className="text-sm font-semibold text-slate-900">Fleet</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Manage trucks, assignments, and operational readiness.
                  </div>
                </button>

                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 p-4 text-left transition hover:bg-slate-50"
                >
                  <div className="text-sm font-semibold text-slate-900">Jobs</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Review open haul jobs and route opportunities.
                  </div>
                </button>

                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 p-4 text-left transition hover:bg-slate-50"
                >
                  <div className="text-sm font-semibold text-slate-900">Finances</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Track balance, cash flow, and future financial features.
                  </div>
                </button>
              </div>
            </SectionCard>

            <SectionCard
              id="company-profile"
              title="Company profile"
              subtitle="Reference details for the currently active company record."
            >
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Company</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {company?.name || 'Not available'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Hub</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {company ? `${company.hub_city || '—'}, ${company.hub_country || '—'}` : '—'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Owner ID</dt>
                  <dd className="max-w-[220px] truncate text-right font-medium text-slate-900">
                    {company?.owner_id || user?.id || '—'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Created</dt>
                  <dd className="text-right font-medium text-slate-900">{createdLabel}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Employees</dt>
                  <dd className="text-right font-medium text-slate-900">
                    {(company?.employees ?? 0).toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Record ID</dt>
                  <dd className="max-w-[220px] truncate text-right font-medium text-slate-900">
                    {company?.id || '—'}
                  </dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard
              title="Data sources"
              subtitle="These sections are linked to the source blocks shown on this page."
            >
              <div className="space-y-3">
                {sourceItems.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                  >
                    <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                    <div className="mt-1 text-sm text-slate-600">{item.detail}</div>
                  </a>
                ))}
              </div>
            </SectionCard>
          </div>
        </section>

        <SectionCard
          title="Management workspace"
          subtitle="This section keeps your core company areas organized and ready to expand."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ModuleCard
              title="Fleet"
              description="Track trucks, drivers, and maintenance from one module."
            />
            <ModuleCard
              title="Operations"
              description="Use this area for dispatch, planning, and route visibility."
            />
            <ModuleCard
              title="Jobs"
              description="Show contracts, open work, and accepted assignments here."
            />
            <ModuleCard
              title="Finance"
              description="Keep revenue, expenses, and balance trends in a dedicated space."
            />
          </div>
        </SectionCard>
      </div>
    </Layout>
  )
}

function SectionCard({
  id,
  title,
  subtitle,
  children,
}: {
  id?: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-600">{hint}</div>
    </div>
  )
}

function ModuleCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{description}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  )
}

function LoadingDashboard() {
  return (
    <Layout fullWidth>
      <div className="space-y-6 animate-pulse">
        <div className="h-16 rounded-3xl bg-slate-200" />
        <div className="h-48 rounded-3xl bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="h-32 rounded-3xl bg-slate-200" />
          <div className="h-32 rounded-3xl bg-slate-200" />
          <div className="h-32 rounded-3xl bg-slate-200" />
          <div className="h-32 rounded-3xl bg-slate-200" />
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="h-72 rounded-3xl bg-slate-200" />
          <div className="h-72 rounded-3xl bg-slate-200" />
          <div className="h-72 rounded-3xl bg-slate-200" />
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="h-72 rounded-3xl bg-slate-200 xl:col-span-2" />
          <div className="h-72 rounded-3xl bg-slate-200" />
        </div>
      </div>
    </Layout>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat(undefined, options).format(date)
}

function getCompanyInitials(name?: string | null) {
  if (!name) return 'CO'

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase()
}

function getNewestDateValue<T extends { updated_at?: string | null; created_at?: string | null; published_at?: string | null }>(
  item: T,
) {
  return item.updated_at || item.published_at || item.created_at || ''
}

function sortByNewest<T extends { updated_at?: string | null; created_at?: string | null; published_at?: string | null }>(
  items: T[],
) {
  return [...items].sort((a, b) => {
    const aTime = new Date(getNewestDateValue(a)).getTime()
    const bTime = new Date(getNewestDateValue(b)).getTime()

    const safeATime = Number.isNaN(aTime) ? 0 : aTime
    const safeBTime = Number.isNaN(bTime) ? 0 : bTime

    return safeBTime - safeATime
  })
}

function getCompanyStatus(company: CompanyRow | null, balanceValue: number) {
  if (!company) {
    return {
      label: 'Setup required',
      helperText: 'Connect a company record to activate this workspace.',
      className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    }
  }

  if (company.is_bankrupt) {
    return {
      label: 'Bankrupt',
      helperText: 'This company is currently marked as bankrupt.',
      className: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
    }
  }

  if (balanceValue <= 0) {
    return {
      label: 'Attention needed',
      helperText: 'Balance is at or below zero and may need review.',
      className: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
    }
  }

  if (balanceValue < 10000) {
    return {
      label: 'Watch balance',
      helperText: 'Operations are active, but liquidity is getting tighter.',
      className: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    }
  }

  return {
    label: 'Active',
    helperText: 'Company is in a healthy state based on the current snapshot.',
    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  }
}