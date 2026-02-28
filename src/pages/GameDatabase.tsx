/**
 * src/pages/GameDatabase.tsx
 *
 * Game Database page styled to match the Facilities page layout and interface.
 */

import React from 'react'
import Layout from '../components/Layout'

/**
 * TrucksPanel
 *
 * Placeholder listing for truck models.
 */
function TrucksPanel(): JSX.Element {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-black">Trucks</h2>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded border border-black/10 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-black">Isuzu F-Series</div>
          <div className="mt-1 text-xs text-black/60">Payload: 12,000 kg</div>
        </div>

        <div className="rounded border border-black/10 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-black">Volvo VNL</div>
          <div className="mt-1 text-xs text-black/60">Payload: 18,000 kg</div>
        </div>
      </div>
    </div>
  )
}

/**
 * CargoTypesPanel
 *
 * Placeholder listing for cargo types.
 */
function CargoTypesPanel(): JSX.Element {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-black">Cargo Types</h2>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded border border-black/10 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-black">Dry Goods</div>
          <div className="mt-1 text-xs text-black/60">Typical: pallets, boxes</div>
        </div>

        <div className="rounded border border-black/10 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-black">Liquid - Food Grade</div>
          <div className="mt-1 text-xs text-black/60">Requires tankers</div>
        </div>
      </div>
    </div>
  )
}

/**
 * DBTabs
 *
 * Minimal tab control for the Game Database page.
 */
function DBTabs(): JSX.Element {
  const [tab, setTab] = React.useState<'trucks' | 'cargo'>('trucks')

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-black/10 px-6 pt-4">
        <button
          onClick={() => setTab('trucks')}
          className={`py-2 px-3 -mb-px text-sm font-medium ${
            tab === 'trucks'
              ? 'border-b-2 border-black text-black'
              : 'text-black/60 hover:text-black'
          }`}
        >
          Trucks
        </button>

        <button
          onClick={() => setTab('cargo')}
          className={`py-2 px-3 -mb-px text-sm font-medium ${
            tab === 'cargo'
              ? 'border-b-2 border-black text-black'
              : 'text-black/60 hover:text-black'
          }`}
        >
          Cargo Types
        </button>
      </div>

      <div>{tab === 'trucks' ? <TrucksPanel /> : <CargoTypesPanel />}</div>
    </div>
  )
}

/**
 * GameDatabasePage
 *
 * Game Database page with the same layout structure as Facilities.
 */
export default function GameDatabasePage(): JSX.Element {
  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Game Database</h1>
          <p className="text-sm text-black/70">Browse in-game models and cargo types.</p>
        </header>

        <section className="bg-white rounded shadow">
          <DBTabs />
        </section>
      </div>
    </Layout>
  )
}