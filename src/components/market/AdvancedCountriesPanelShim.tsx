/**
 * AdvancedCountriesPanelShim.tsx
 *
 * Provide a lightweight shim component for AdvancedCountriesPanel to prevent
 * runtime ReferenceError when other modules reference it without importing.
 *
 * This file exports a compatible default component and also attaches the
 * component to window.AdvancedCountriesPanel as a fallback for code that
 * expects a global symbol (legacy bundles / incorrect imports).
 */

import React from 'react'

/**
 * AdvancedCountriesPanelShimProps
 *
 * Generic props accepted by the shim. Real implementation accepts typed props,
 * but the shim is permissive to avoid type friction where used.
 */
export interface AdvancedCountriesPanelShimProps {
  options?: any
  value?: any
  onChange?: (codes: string[]) => void
  city?: string | null
  onCityChange?: (city: string | null) => void
}

/**
 * AdvancedCountriesPanelShim
 *
 * Minimal visual placeholder shown when the full AdvancedCountriesPanel is
 * unavailable. Keeps the UI stable and prevents the "AdvancedCountriesPanel
 * is not defined" runtime error by providing a defined symbol.
 *
 * @param props - incoming props from parent components
 * @returns JSX.Element
 */
export default function AdvancedCountriesPanelShim(props: AdvancedCountriesPanelShimProps): JSX.Element {
  const { options } = props
  const count = Array.isArray(options) ? options.length : 0

  return (
    <div className="bg-slate-50 border border-slate-100 rounded p-3 text-sm text-slate-700">
      <div className="font-medium mb-1">Countries (removed)</div>
      <div className="text-xs text-slate-500">
        Advanced countries panel is not available in this preview. Showing a compact placeholder. Available countries: {count}
      </div>
    </div>
  )
}

/**
 * Expose a named export and attach to window as a last-resort global shim.
 * Some compiled bundles or incorrect imports may expect a global identifier.
 */
export const AdvancedCountriesPanel = AdvancedCountriesPanelShim

/* istanbul ignore next - runtime global fallback for legacy bundles */
if (typeof window !== 'undefined' && !(window as any).AdvancedCountriesPanel) {
  ;(window as any).AdvancedCountriesPanel = AdvancedCountriesPanelShim
}