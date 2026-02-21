/**
 * SkillsMasterGrid.tsx
 *
 * Fetches and displays skills from skills_master in a compact two-column "Name / Effects" layout.
 *
 * This version includes defensive rendering to avoid passing raw objects to React children
 * (prevents "Objects are not valid as a React child" runtime errors). If a cell contains
 * an object it will be rendered as a small, readable key/value list instead of being
 * injected directly into JSX.
 */

import React from 'react'
import { supabase } from '../../lib/supabase'

/**
 * SkillRow
 *
 * Interface representing a single skills_master row used by the UI.
 */
interface SkillRow {
  id: string
  name: string | null
  effects?: string | null | Record<string, any>
  description?: string | null | Record<string, any>
}

/**
 * renderCellContent
 *
 * Safely render a potentially unknown value into a React node.
 * - strings/numbers/booleans are rendered directly
 * - null/undefined becomes an em dash
 * - arrays are joined with commas
 * - objects are rendered as compact key/value rows to avoid React child object errors
 *
 * @param v Any value that needs to be rendered inside a table cell
 * @returns React.ReactNode
 */
function renderCellContent(v: any): React.ReactNode {
  if (v === null || typeof v === 'undefined') return <span className="text-slate-400 italic">No effects listed</span>
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') {
    // Render object properties in a compact, readable form.
    return (
      <div className="text-sm text-slate-700 space-y-1">
        {Object.entries(v).map(([k, val]) => (
          <div key={k} className="flex gap-2">
            <div className="font-medium text-slate-800">{k}:</div>
            <div className="truncate">{Array.isArray(val) ? val.join(', ') : String(val)}</div>
          </div>
        ))}
      </div>
    )
  }
  return String(v)
}

/**
 * SkillRowItem
 *
 * Small presentational component that renders a single skill row.
 *
 * @param props.row SkillRow to render
 */
function SkillRowItem({ row }: { row: SkillRow }) {
  return (
    <tr className="odd:bg-white even:bg-slate-50">
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-slate-800">{row.name ?? '—'}</div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        {/* Prefer explicit effects column, fallback to description. Use safe renderer. */}
        {row.effects ? (
          <div>{renderCellContent(row.effects)}</div>
        ) : row.description ? (
          <div>{renderCellContent(row.description)}</div>
        ) : (
          <div className="text-slate-400 italic">No effects listed</div>
        )}
      </td>
    </tr>
  )
}

/**
 * SkillsMasterGrid
 *
 * Fetches skills_master rows and displays them in a responsive, accessible table with two columns:
 * - Name
 * - Effects (or description if effects column is not present)
 *
 * Visual notes:
 * - Matches the surrounding UI style (rounded white surface, light borders)
 * - Compact typography and alternating row backgrounds for readability
 *
 * @returns JSX.Element
 */
export default function SkillsMasterGrid(): JSX.Element {
  const [rows, setRows] = React.useState<SkillRow[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Request common columns. Some schemas might use 'effects' or 'description'.
        const { data, error: sbError } = await supabase
          .from('skills_master')
          .select('id,name,effects,description')
          .order('name', { ascending: true })
          .limit(1000)

        if (!mounted) return

        if (sbError) {
          setError(sbError.message || 'Failed to load skills')
          setRows([])
          return
        }

        const arr = Array.isArray(data)
          ? data.map((r: any) => ({
              id: String(r.id ?? Math.random()),
              name: r.name ?? null,
              effects: r.effects ?? null,
              description: r.description ?? null,
            }))
          : []

        setRows(arr)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Failed to load skills')
        setRows([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="bg-white border border-slate-100 rounded-md p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-700 w-1/3">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">Effects</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-sm text-slate-500">
                  Loading skills…
                </td>
              </tr>
            )}

            {error && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-sm text-rose-600">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-sm text-slate-500">
                  No skills found.
                </td>
              </tr>
            )}

            {!loading && !error && rows.map((r) => <SkillRowItem key={r.id} row={r} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
