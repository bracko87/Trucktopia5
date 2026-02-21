/**
 * Finances.tsx
 *
 * Page wrapper for the Finances area. Mounts the tabbed finances UI.
 */

import React from 'react'
import Layout from '../components/Layout'
import FinancesTabs from '../components/finances/FinancesTabs'

/**
 * FinancesPage
 *
 * Main page component for company finances.
 * Matches layout spacing used across the app (e.g. Trailers page).
 */
export default function FinancesPage(): JSX.Element {
  return (
    <Layout fullWidth>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Finances</h1>
          <p className="text-sm text-black/70">
            Balance, transactions and financial reports
          </p>
        </header>

        <FinancesTabs />
      </div>
    </Layout>
  )
}
