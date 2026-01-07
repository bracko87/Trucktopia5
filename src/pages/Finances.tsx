/**
 * Finances.tsx
 *
 * Page displaying company finances: balance, transactions, income/expense graphs.
 */

import React from 'react'
import Layout from '../components/Layout'

/**
 * FinancesPage
 *
 * Placeholder for financial dashboard. Graphs and transaction tables will be
 * implemented later and wired to the financial APIs.
 */
export default function FinancesPage() {
  return (
    <Layout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Finances</h1>
          <p className="text-sm text-black/70">Balance, transactions and reports</p>
        </header>

        <section className="bg-white p-6 rounded shadow">
          <div className="text-sm text-black/70">Financial overview will be displayed here.</div>
        </section>
      </div>
    </Layout>
  )
}
