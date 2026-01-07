/**
 * Map.tsx
 *
 * Page showing an interactive live map with positions of all user trucks.
 *
 * Note: Map functionality (map provider, live positions) will be added later.
 */

import React from 'react'
import Layout from '../components/Layout'

/**
 * MapPage
 *
 * Placeholder map page; integrates with map provider later.
 */
export default function MapPage() {
  return (
    <Layout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Map</h1>
          <p className="text-sm text-black/70">Live positions of your fleet</p>
        </header>

        <section className="bg-white p-6 rounded shadow">
          <div className="text-sm text-black/70">Interactive map will be initialized here.</div>
        </section>
      </div>
    </Layout>
  )
}
