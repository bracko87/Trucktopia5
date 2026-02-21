/**
 * LoansPanel.tsx
 *
 * Loans panel for displaying company loans, schedule and actions.
 */

import React from 'react'

/**
 * LoansPanel
 *
 * Shows placeholder content for loans and quick actions.
 *
 * @returns JSX.Element
 */
export default function LoansPanel(): JSX.Element {
  return (
    <div className="space-y-4">
      <section className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">Loans</h2>
        <p className="text-sm text-black/70">
          Active loans, repayment schedule and interest rates will be shown here.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-slate-500">Active loans</div>
          <div className="text-lg font-medium mt-1">2</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-slate-500">Next payment</div>
          <div className="text-lg font-medium mt-1">$450.00</div>
        </div>
      </section>
    </div>
  )
}