/**
 * AdvancedCountriesPanel.tsx
 *
 * Panel that allows selecting available countries and a companion city dropdown
 * (city list shows cities for the currently focused country). Adds a compact
 * countries dropdown (full names) for quicker single-country selection.
 *
 * This component is controlled:
 * - `value` carries selected country codes (lowercase)
 * - `onChange` is called with the next array of selected codes
 *
 * Notes:
 * - Selecting a country from the new dropdown will replace the selection with
 *   that single country (quick filter).
 * - Checkboxes still allow multi-select.
 */

import React from 'react'

/**
 * CountryOption
 *
 * Represents an available country and its city list passed from the Market page.
 */
export interface CountryOption {
  code: string
  name: string
  cities: string[]
}

/**
 * AdvancedCountriesPanelProps
 *
 * Props for AdvancedCountriesPanel component.
 */
interface AdvancedCountriesPanelProps {
  options: CountryOption[]
  value: string[] // selected country codes (lowercase)
  onChange: (codes: string[]) => void
  /**
   * Optional currently selected city and change handler.
   * The Market page may choose to pass these to keep a single source of truth.
   */
  city?: string | null
  onCityChange?: (city: string | null) => void
}

/**
 * normalizeOptions
 *
 * Normalize options to unique lowercase codes preserving names and cities.
 *
 * @param options - incoming list
 * @returns normalized CountryOption[]
 */
function normalizeOptions(options: CountryOption[] | undefined): CountryOption[] {
  const map = new Map<string, CountryOption>()
  for (const o of options || []) {
    if (!o || !o.code) continue
    const code = String(o.code).trim().toLowerCase()
    const name = o.name ?? code.toUpperCase()
    const cities = Array.isArray(o.cities) ? o.cities : []
    if (!map.has(code)) map.set(code, { code, name, cities })
  }
  return Array.from(map.values())
}

/**
 * AdvancedCountriesPanel
 *
 * Renders a compact countries selection UI and a cities dropdown driven by the
 * focused country (first selected country or the first available option).
 * Also renders a single-select dropdown with full country names for quick
 * single-country selection.
 *
 * @param props - AdvancedCountriesPanelProps
 */
export default function AdvancedCountriesPanel({
  options,
  value,
  onChange,
  city,
  onCityChange,
}: AdvancedCountriesPanelProps) {
  const normalizedOptions = React.useMemo(() => normalizeOptions(options), [options])

  // Keep a focused country used to populate the city dropdown. Prefer the first
  // selected country, otherwise fallback to the first available option.
  const focusedCountry = React.useMemo(() => {
    const sel = Array.isArray(value) && value.length > 0 ? String(value[0] ?? '').trim().toLowerCase() : ''
    if (sel) return sel
    return normalizedOptions.length > 0 ? normalizedOptions[0].code : ''
  }, [value, normalizedOptions])

  /**
   * handleCityChange
   *
   * Forward city changes to parent if handler provided.
   */
  function handleCityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value || null
    if (onCityChange) onCityChange(v)
  }

  /**
   * toggleCountry
   *
   * Toggle a single country in the selected list.
   *
   * @param code - country code to toggle
   */
  function toggleCountry(code: string) {
    const norm = String(code ?? '').trim().toLowerCase()
    const prev = Array.isArray(value) ? value.map((c) => String(c ?? '').trim().toLowerCase()) : []
    const nextSet = new Set(prev)
    if (nextSet.has(norm)) nextSet.delete(norm)
    else nextSet.add(norm)
    onChange(Array.from(nextSet))
  }

  /**
   * selectAll
   *
   * Select all available country codes.
   */
  function selectAll() {
    onChange(normalizedOptions.map((o) => o.code))
  }

  /**
   * clearAll
   *
   * Clear selected countries.
   */
  function clearAll() {
    onChange([])
  }

  /**
   * handleQuickSelect
   *
   * Quick single-country selection from the full-names dropdown.
   * Replaces the selection with the chosen country for immediate filtering.
   *
   * @param e - select change event
   */
  function handleQuickSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = String(e.target.value || '').trim().toLowerCase()
    if (!code) return
    onChange([code])
    // Optionally reset city when switching country quickly
    if (onCityChange) onCityChange(null)
  }

  const currentCountryObj = normalizedOptions.find((o) => o.code === focusedCountry)

  return (
    <div className="bg-white p-4 rounded-md shadow-sm">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="text-sm font-semibold">Countries</h3>

        {/* Quick single-country select (full names) */}
        <div className="w-48">
          <label className="flex flex-col text-sm">
            <span className="text-xs text-slate-500 mb-1">Quick pick</span>
            <select
              aria-label="Quick pick country"
              onChange={handleQuickSelect}
              value={value && value.length > 0 ? value[0] : ''}
              className="px-2 py-1 border rounded text-sm w-full"
            >
              <option value="">— pick country —</option>
              {normalizedOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            {normalizedOptions.map((opt) => {
              const checked =
                Array.isArray(value) && value.map((c) => String(c ?? '').trim().toLowerCase()).includes(opt.code)
              return (
                <label
                  key={opt.code}
                  className="inline-flex items-center gap-2 px-2 py-1 bg-slate-50 border border-slate-100 rounded text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCountry(opt.code)}
                    className="w-4 h-4"
                    aria-label={`Toggle ${opt.name}`}
                  />
                  <span className="text-sm">{opt.name}</span>
                </label>
              )
            })}
            {normalizedOptions.length === 0 && <div className="text-sm text-slate-500">No countries available</div>}
          </div>

          <div className="mt-3 flex gap-2">
            <button type="button" onClick={selectAll} className="px-2 py-1 text-xs bg-slate-100 rounded">
              All
            </button>
            <button type="button" onClick={clearAll} className="px-2 py-1 text-xs bg-slate-100 rounded">
              Clear
            </button>
          </div>
        </div>

        <div className="w-full md:w-64">
          <label className="flex flex-col text-sm">
            <span className="text-xs text-slate-500 mb-1">Cities</span>
            <select
              aria-label="City select"
              value={city ?? ''}
              onChange={handleCityChange}
              disabled={!currentCountryObj || !currentCountryObj.cities || currentCountryObj.cities.length === 0}
              className="px-2 py-1 border rounded text-sm w-full"
            >
              <option value="">All cities</option>
              {currentCountryObj &&
                currentCountryObj.cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
            {!currentCountryObj && <div className="text-xs text-slate-500 mt-1">Select a country to pick cities</div>}
          </label>
        </div>
      </div>
    </div>
  )
}