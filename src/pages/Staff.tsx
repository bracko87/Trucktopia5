/**
 * Staff.tsx
 *
 * Page listing company staff separated by administration and drivers.
 */

import React from 'react'
import Layout from '../components/Layout'

/**
 * StaffPage
 *
 * Shows administrative staff and drivers. Placeholder until API wiring is added.
 */
export default function StaffPage() {
  return (
    <Layout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-sm text-black/70">Administration and drivers</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded shadow">
            <h3 className="font-semibold mb-2">Administration</h3>
            <div className="text-sm text-black/70">Administration staff list.</div>
          </div>

          <div className="bg-white p-6 rounded shadow">
            <h3 className="font-semibold mb-2">Drivers</h3>
            <div className="text-sm text-black/70">Truck drivers list.</div>
          </div>
        </section>
      </div>
    </Layout>
  )
}
