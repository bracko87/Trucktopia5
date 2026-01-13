/**
 * Pro.tsx
 *
 * Full page for Pro package marketing (Settings -> Pro Package).
 */

import React from 'react'
import { useNavigate } from 'react-router'
import Layout from '../../components/Layout'

/**
 * ProPage
 *
 * Placeholder for Pro package details and purchase flow.
 * Wrapped with Layout so the app chrome remains visible.
 */
export default function ProPage(): JSX.Element {
  const nav = useNavigate()
  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Pro Package</h2>
          <button onClick={() => nav(-1)} className="px-3 py-1 rounded border text-black">Back</button>
        </div>

        <div className="bg-white p-6 rounded shadow space-y-4">
          <p className="text-sm text-slate-700">Pro unlocks advanced features, priority support and community perks. Purchase flow will be added later.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => nav(-1)} className="px-3 py-1 rounded border text-black">Close</button>
            <button onClick={() => alert('Learn more (placeholder)')} className="px-3 py-1 rounded bg-sky-600 text-white">Learn more</button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
