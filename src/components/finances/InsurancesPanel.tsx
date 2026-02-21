/**
 * InsurancesPanel.tsx
 *
 * Panel that displays three insurance category sections (stacked vertically)
 * and a consolidated insurance transactions chart below them.
 */

import React from 'react'
import InsuranceSection from './InsuranceSection'
import InsuranceChart from './InsuranceChart'

/**
 * InsurancesPanel
 *
 * Renders three InsuranceSection cards vertically (Cargo, Truck, Trailer)
 * followed by the InsuranceChart. Layout and visual styling match existing
 * finance panels; only the internal arrangement is adjusted to a vertical stack.
 *
 * @returns JSX.Element
 */
export default function InsurancesPanel(): JSX.Element {
  /**
   * handleRefresh
   *
   * Placeholder refresh handler for sections.
   *
   * @param section section key
   */
  function handleRefresh(section: string) {
    // noop for now - will be wired to API later
    // eslint-disable-next-line no-console
    console.info('Refresh', section)
  }

  /**
   * handleAdd
   *
   * Placeholder add handler for sections.
   *
   * @param section section key
   */
  function handleAdd(section: string) {
    // noop for now - will open "add policy" modal in future
    // eslint-disable-next-line no-console
    console.info('Add policy', section)
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <header className="mb-4">
        <h3 className="text-lg font-semibold">Insurances</h3>
        <p className="text-sm text-slate-500 mt-1">Manage insurance policies and claims for company assets.</p>
      </header>

      <div className="text-sm text-slate-600">
        {/* Vertically stacked sections - one per row */}
        <div className="flex flex-col gap-4 mb-4">
          <InsuranceSection
            title="Cargo Insurance"
            description="Coverage for cargo in transit and handled shipments."
            policiesCount={0}
            onRefresh={() => handleRefresh('cargo')}
            onAdd={() => handleAdd('cargo')}
          />

          <InsuranceSection
            title="Truck Insurance"
            description="Policies covering company-owned and leased trucks."
            policiesCount={0}
            onRefresh={() => handleRefresh('truck')}
            onAdd={() => handleAdd('truck')}
          />

          <InsuranceSection
            title="Trailer Insurance"
            description="Insurance for trailers and towed assets."
            policiesCount={0}
            onRefresh={() => handleRefresh('trailer')}
            onAdd={() => handleAdd('trailer')}
          />
        </div>

        {/* Consolidated chart below the sections */}
        <div>
          <InsuranceChart />
        </div>
      </div>
    </section>
  )
}