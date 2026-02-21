/**
 * Facilities.tsx
 *
 * Facilities management page: overview of depots, hubs, and service locations.
 */

import React from 'react'
import Layout from '../components/Layout'

/**
 * FacilitiesPage
 *
 * Simple placeholder page for managing company facilities.
 */
export default function FacilitiesPage(): JSX.Element {
  return (
    <Layout>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Facilities</h1>
          <p className="text-sm text-black/70">
            Manage your depots, hubs, and other company locations.
          </p>
        </header>

        <section className="bg-white p-6 rounded shadow">
          <p className="text-sm text-black/70">
            This is a placeholder Facilities page. Here you can later add lists of hubs, garages,
            and service centers.
          </p>
        </section>
      </div>
    </Layout>
  )
}
