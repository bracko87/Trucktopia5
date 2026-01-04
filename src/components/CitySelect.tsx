/**
 * CitySelect.tsx
 *
 * Small reusable component that renders either a select populated with cities
 * for the chosen country or a manual text input when no cities exist.
 */

import React from 'react'
import type { CityRow } from '../lib/normalizeCities'

/**
 * CitySelectProps
 *
 * Props for the CitySelect component.
 */
export interface CitySelectProps {
  /** Array of normalized CityRow objects for the selected country */
  citiesForCountry: CityRow[]
  /** Current selected city value */
  selectedCity: string
  /** Setter for selected city */
  setSelectedCity: (v: string) => void
  /** Current manual city input value (used when no cities list) */
  manualCity: string
  /** Setter for manual city input */
  setManualCity: (v: string) => void
}

/**
 * CitySelect
 *
 * Renders a city dropdown when citiesForCountry has entries; otherwise renders
 * a text input for manual city entry. Styling matches surrounding form controls.
 */
export default function CitySelect({
  citiesForCountry,
  selectedCity,
  setSelectedCity,
  manualCity,
  setManualCity,
}: CitySelectProps): JSX.Element {
  if (citiesForCountry && citiesForCountry.length > 0) {
    return (
      <select
        value={selectedCity}
        onChange={(e) => setSelectedCity(e.target.value)}
        className="w-full border px-3 py-2 rounded"
      >
        {citiesForCountry.map((c) => (
          <option key={c.id} value={c.city}>
            {c.city}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      value={manualCity}
      onChange={(e) => setManualCity(e.target.value)}
      placeholder="Type your city (e.g. Colombo)"
      className="w-full border px-3 py-2 rounded"
    />
  )
}