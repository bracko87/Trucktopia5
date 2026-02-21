/**
 * TaxesPanel.tsx
 *
 * Taxes panel for showing tax liabilities and filings.
 */

import React from 'react'

/**
 * TaxesPanel
 *
 * Displays tax summary and next filing deadlines (placeholder).
 *
 * @returns JSX.Element
 */
export default function TaxesPanel(): JSX.Element {
  return (
    <div className="space-y-4">
      <section className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">Taxes</h2>
        <p className="text-sm text-black/70">
          Tax liabilities, last filings and upcoming deadlines will be available here.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-slate-500">Last filed</div>
          <div className="text-lg font-medium mt-1">Q4 • 2025</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-slate-500">Next due</div>
          <div className="text-lg font-medium mt-1">2026-04-15</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-xs text-slate-500">Estimated liability</div>
          <div className="text-lg font-medium mt-1">$2,300.00</div>
        </div>
      </section>
    </div>
  )
}