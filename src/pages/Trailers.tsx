/**
 * Trailers.tsx
 *
 * Page showing all trailers in the user's possession.
 */

import React from 'react'
import Layout from '../components/Layout'

/**
 * TrailersPage
 *
 * Placeholder page for trailers owned/managed by the user's company.
 */
export default function TrailersPage() {
  return (
    <Layout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Trailers</h1>
          <p className="text-sm text-black/70">Manage trailers owned or leased by your company</p>
        </header>

        <section className="bg-white p-6 rounded shadow">
          <div className="text-sm text-black/70">Trailer inventory will load here.</div>
        </section>
      </div>
    </Layout>
  )
}
