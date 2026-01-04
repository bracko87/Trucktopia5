/**
 * SupabaseDebug.tsx
 *
 * Small debug UI to run a set of Supabase REST checks and show full responses.
 */

import React, { useState } from 'react'
import { supabaseFetch, getTable } from '../../lib/supabase'

/**
 * EndpointResult
 *
 * Simple shape for capturing endpoint test results.
 */
interface EndpointResult {
  name: string
  ok: boolean
  status: number
  data: any
  error?: string
}

/**
 * SupabaseDebug
 *
 * Component that provides buttons to run quick REST tests (trucks, companies, jobs, users).
 */
export default function SupabaseDebug() {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<EndpointResult[]>([])

  /**
   * runChecks
   *
   * Execute a list of test requests against the Supabase REST endpoints.
   */
  async function runChecks() {
    setRunning(true)
    setResults([])

    const tests: Array<() => Promise<EndpointResult>> = [
      async () => {
        const res = await getTable('trucks', '?select=id&limit=1')
        return { name: 'GET /rest/v1/trucks', ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data, error: (res as any).error }
      },
      async () => {
        const res = await getTable('companies', '?select=*&limit=1')
        return { name: 'GET /rest/v1/companies', ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data, error: (res as any).error }
      },
      async () => {
        const res = await getTable('jobs', '?select=id&limit=1')
        return { name: 'GET /rest/v1/jobs', ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data, error: (res as any).error }
      },
      async () => {
        const res = await supabaseFetch('/rest/v1/users?select=*&limit=1')
        return { name: 'GET /rest/v1/users', ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data, error: (res as any).error }
      },
      async () => {
        // Test a deliberately malformed query so we can see how the server responds
        const res = await supabaseFetch('/rest/v1/companies?select=id:1')
        return { name: 'GET /rest/v1/companies?select=id:1 (malformed test)', ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data, error: (res as any).error }
      },
    ]

    const out: EndpointResult[] = []
    for (const t of tests) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const r = await t()
        out.push(r)
      } catch (err: any) {
        out.push({ name: 'unknown', ok: false, status: 0, data: null, error: err?.message || String(err) })
      }
      // small pause between requests to ease log ordering
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 150))
    }

    setResults(out)
    setRunning(false)
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-3">Supabase REST Debug</h3>

      <p className="text-sm text-muted-foreground mb-4">
        Run a set of test requests to inspect status codes and response bodies (useful for 400/404/401 debugging).
      </p>

      <div className="flex gap-2 mb-4">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={runChecks}
          disabled={running}
        >
          {running ? 'Running...' : 'Run checks'}
        </button>
      </div>

      <div className="space-y-3">
        {results.map((r) => (
          <div key={r.name} className="p-3 border rounded">
            <div className="flex items-center justify-between">
              <div className="font-medium">{r.name}</div>
              <div className={`text-sm font-medium ${r.ok ? 'text-green-600' : 'text-red-600'}`}>{r.status}</div>
            </div>
            <pre className="mt-2 text-xs max-h-56 overflow-auto bg-gray-50 p-2 rounded">
              {JSON.stringify({ data: r.data, error: r.error }, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}