import React from 'react'
import Layout from '../components/Layout'
import StagingTabs from '../components/staging/StagingTabs'

export default function StagingAreaPage(): JSX.Element {
  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Staging Area</h1>
          <p className="text-sm text-slate-500">
            Manage available trucks, trailers, drivers and cargo assignments.
          </p>
        </header>

        <section className="bg-white p-6 rounded-lg shadow-sm w-full">
          <StagingTabs />
        </section>
      </div>
    </Layout>
  )
}