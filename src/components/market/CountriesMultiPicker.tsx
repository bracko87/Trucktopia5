/**
 * CountriesMultiPicker.tsx
 *
 * Fetches available countries from public.countries (name + code) and presents a
 * searchable, checkable list for filtering. Preserves existing layout and behavior.
 *
 * - Controlled: value is an array of country codes (lowercase).
 * - If `options` prop is provided it will be merged with fetched countries.
 * - Uses sessionStorage caching to avoid repeated network calls during a session.
 */

import React from 'react'
import type { CountryOption } from './CountryCitySelect'

/**
 * CountriesMultiPickerProps
 *
 * Props for CountriesMultiPicker component.
 */
export interface CountriesMultiPickerProps {
  options?: CountryOption[]
  value: string[]
  onChange: (next: string[]) => void
  ariaLabel?: string
}

/**
 * normalizeCode
 *
 * Normalize a country code or string to a compact lowercase code.
 *
 * @param v - incoming code or name
 * @returns normalized lowercase string
 */
function normalizeCode(v: string | null | undefined) {
  return String(v ?? '').trim().toLowerCase()
}

/**
 * MARKET API constants (used to fetch public.countries).
 * NOTE: Uses the same public anon key as Market page for public reads.
 */
const MARKET_API_BASE = 'https://iiunrkztuhhbdgxzqqgq.supabase.co'
const MARKET_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdW5ya3p0dWhoYmRneHpxcWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTY5MDksImV4cCI6MjA4Mjg3MjkwOX0.PTzYmKHRE5A119E5JD9HKEUSg7NQZJlAn83ehKo5fiM'

/**
 * CountriesMultiPicker
 *
 * Controlled component that shows a search box and a list of countries with checkboxes.
 * If the `options` prop is empty, the component will fetch available countries from
 * public.countries and merge them with any provided options.
 *
 * @param props - CountriesMultiPickerProps
 */
export default function CountriesMultiPicker({
  options,
  value,
  onChange,
  ariaLabel = 'Countries',
}: CountriesMultiPickerProps) {
  const [query, setQuery] = React.useState('')
  const [custom, setCustom] = React.useState('')
  const [fetched, setFetched] = React.useState<CountryOption[]>([])
  const [fetching, setFetching] = React.useState(false)

  /**
   * loadCountries
   *
   * Fetch country rows from public.countries using Supabase REST.
   * Uses sessionStorage for simple caching during the browser session.
   */
  React.useEffect(() => {
    let mounted = true
    async function loadCountries() {
      setFetching(true)
      try {
        const cacheKey = 'public_countries_v1'
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && mounted) {
            setFetched(parsed)
            setFetching(false)
            return
          }
        }

        const url = `${MARKET_API_BASE}/rest/v1/countries?select=name,code&limit=1000`
        const res = await fetch(url, {
          headers: {
            apikey: MARKET_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${MARKET_SUPABASE_ANON_KEY}`,
          },
        })
        if (!res.ok) {
          if (mounted) setFetched([])
          return
        }
        const data = await res.json().catch(() => [])
        if (!mounted) return
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data
            .map((r: any) => ({
              code: normalizeCode(r.code ?? r.name ?? ''),
              name: String(r.name ?? r.code ?? '').trim(),
            }))
            .filter((r: any) => r.code)
          setFetched(mapped)
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(mapped))
          } catch {
            // ignore sessionStorage write errors
          }
        } else {
          setFetched([])
        }
      } catch {
        if (mounted) setFetched([])
      } finally {
        if (mounted) setFetching(false)
      }
    }

    loadCountries()
    return () => {
      mounted = false
    }
  }, [])

  /**
   * mergedOptions
   *
   * Merge provided options prop with fetched options, unique by code.
   */
  const mergedOptions = React.useMemo(() => {
    const map = new Map<string, { code: string; name: string }>()
    const push = (o: CountryOption | { code: string; name: string } | undefined) => {
      if (!o || !o.code) return
      const code = normalizeCode(o.code)
      const name = (o.name ?? code.toUpperCase()).trim()
      if (!map.has(code)) map.set(code, { code, name })
    }
    for (const o of fetched || []) push(o)
    for (const o of options || []) push(o)
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [options, fetched])

  /**
   * filtered
   *
   * Options filtered by the search query.
   */
  const filtered = React.useMemo(() => {
    const q = normalizeCode(query)
    if (!q) return mergedOptions
    return mergedOptions.filter((o) => o.code.includes(q) || o.name.toLowerCase().includes(q))
  }, [mergedOptions, query])

  const selectedSet = React.useMemo(() => new Set((value || []).map((v) => normalizeCode(v))), [value])

  /**
   * toggle
   *
   * Toggle a country code in the selected set.
   *
   * @param code - country code to toggle
   */
  function toggle(code: string) {
    const n = normalizeCode(code)
    const next = new Set(selectedSet)
    if (next.has(n)) next.delete(n)
    else next.add(n)
    onChange(Array.from(next))
  }

  /**
   * addCustom
   *
   * Add a custom country code (if not empty).
   */
  function addCustom() {
    const n = normalizeCode(custom)
    if (!n) return
    if (!selectedSet.has(n)) {
      onChange([...Array.from(selectedSet), n])
    }
    setCustom('')
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 min-w-max">{ariaLabel}</label>
        <input
          aria-label={`${ariaLabel} search`}
          className="px-2 py-1 border rounded text-sm flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries..."
        />
      </div>

      <div className="mt-2 max-h-48 overflow-auto border rounded p-2 bg-white">
        {fetching ? (
          <div className="text-sm text-slate-500">Loading countries…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-slate-500">No countries</div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((o) => (
              <li key={o.code} className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm w-full">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(o.code)}
                    onChange={() => toggle(o.code)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    {o.name} <span className="text-xs text-slate-400">({o.code})</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          className="px-2 py-1 border rounded text-sm flex-1"
          placeholder="Add code (e.g. rs)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button type="button" onClick={addCustom} className="px-3 py-1 bg-slate-100 rounded text-sm">
          Add
        </button>
      </div>
    </div>
  )
}