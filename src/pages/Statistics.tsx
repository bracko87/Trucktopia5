/**
 * src/pages/Statistics.tsx
 *
 * Statistics page styled to match the Facilities page layout and interface.
 */

import React from 'react'
import Layout from '../components/Layout'

/**
 * StatsOverview
 *
 * Placeholder overview panel for high-level KPIs.
 */
function StatsOverview(): JSX.Element {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-black">Overview</h2>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded border border-black/10 bg-white p-4 shadow-sm">
          <div className="text-xs text-black/60">Balance</div>
          <div className="mt-1 text-2xl font-bold text-black">€12,345</div>
        </div>

        <div className="rounded border border-black/10 bg-white p-4 shadow-sm">
          <div className="text-xs text-black/60">Active Trucks</div>
          <div className="mt-1 text-2xl font-bold text-black">24</div>
        </div>

        <div className="rounded border border-black/10 bg-white p-4 shadow-sm">
          <div className="text-xs text-black/60">Open Jobs</div>
          <div className="mt-1 text-2xl font-bold text-black">48</div>
        </div>
      </div>
    </div>
  )
}

/**
 * StatsTrends
 *
 * Placeholder trends panel for charts and time series.
 */
function StatsTrends(): JSX.Element {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-black">Trends</h2>

      <div className="mt-4 rounded border border-black/10 bg-white p-6 shadow-sm">
        <p className="text-sm text-black/70">Trend charts would be shown here (placeholder).</p>
      </div>
    </div>
  )
}

/**
 * StatsTabs
 *
 * Small, focused tab switcher for the Statistics page.
 */
function StatsTabs(): JSX.Element {
  const [tab, setTab] = React.useState<'overview' | 'trends'>('overview')

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-black/10 px-6 pt-4">
        <button
          onClick={() => setTab('overview')}
          className={`py-2 px-3 -mb-px text-sm font-medium ${
            tab === 'overview'
              ? 'border-b-2 border-black text-black'
              : 'text-black/60 hover:text-black'
          }`}
        >
          Overview
        </button>

        <button
          onClick={() => setTab('trends')}
          className={`py-2 px-3 -mb-px text-sm font-medium ${
            tab === 'trends'
              ? 'border-b-2 border-black text-black'
              : 'text-black/60 hover:text-black'
          }`}
        >
          Trends
        </button>
      </div>

      <div>{tab === 'overview' ? <StatsOverview /> : <StatsTrends />}</div>
    </div>
  )
}

/**
 * StatisticsPage
 *
 * Statistics page with the same layout structure as Facilities.
 */
export default function StatisticsPage(): JSX.Element {
  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Statistics</h1>
          <p className="text-sm text-black/70">Key metrics and trends.</p>
        </header>

        <section className="bg-white rounded shadow">
          <StatsTabs />
        </section>
      </div>
    </Layout>
  )
}