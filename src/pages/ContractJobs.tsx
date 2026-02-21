/**
 * ContractJobs.tsx
 *
 * Contract jobs page: overview of long-term or recurring contract work.
 */

import React from 'react'
import Layout from '../components/Layout'

/**
 * ContractJobsPage
 *
 * Simple placeholder page for managing contract-based jobs.
 */
export default function ContractJobsPage(): JSX.Element {
  return (
    <Layout>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Contract Jobs</h1>
          <p className="text-sm text-black/70">
            Track and manage your long-term and recurring freight contracts.
          </p>
        </header>

        <section className="bg-white p-6 rounded shadow">
          <p className="text-sm text-black/70">
            This is a placeholder Contract Jobs page. In the future, you can show active contracts,
            progress, and earnings here.
          </p>
        </section>
      </div>
    </Layout>
  )
}
