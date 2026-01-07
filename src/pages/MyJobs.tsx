/**
 * MyJobs.tsx
 *
 * Page showing all jobs accepted by the user's company and currently in progress.
 */

import React from 'react'
import Layout from '../components/Layout'

/**
 * MyJobsPage
 *
 * Placeholder list of jobs the company is performing.
 */
export default function MyJobsPage() {
  return (
    <Layout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">My Jobs</h1>
          <p className="text-sm text-black/70">Jobs your company accepted and is performing</p>
        </header>

        <section className="bg-white p-6 rounded shadow">
          <div className="text-sm text-black/70">Active job list will load here.</div>
        </section>
      </div>
    </Layout>
  )
}
