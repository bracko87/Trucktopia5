/**
 * Market.tsx
 *
 * Page showing available jobs on the local market.
 */

import React from 'react'
import Layout from '../components/Layout'

/**
 * MarketPage
 *
 * Placeholder market view listing open job offers.
 */
export default function MarketPage() {
  return (
    <Layout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Market</h1>
          <p className="text-sm text-black/70">Available jobs on the market</p>
        </header>

        <section className="bg-white p-6 rounded shadow">
          <div className="text-sm text-black/70">Market job offers will appear here.</div>
        </section>
      </div>
    </Layout>
  )
}
