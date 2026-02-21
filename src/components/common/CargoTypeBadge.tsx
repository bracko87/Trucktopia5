/**
 * CargoTypeBadge.tsx
 *
 * Small reusable badge component that renders a cargo type name with
 * consistent color styling from src/lib/cargoTypeColors.ts.
 *
 * This keeps presentation centralized and allows replacing plain text
 * usages with an accessible, visually distinctive badge without changing layout.
 */

import React from 'react'
import { getCargoTypeStyle } from '../../lib/cargoTypeColors'

/**
 * Props for CargoTypeBadge component.
 */
export interface CargoTypeBadgeProps {
  /** Human readable cargo type name */
  name?: string | null
  /** Optional additional className to merge (keeps small footprint) */
  className?: string
  /** Optional aria-label override */
  ariaLabel?: string
}

/**
 * CargoTypeBadge
 *
 * Renders a small bordered pill with background + text color determined by cargo type.
 *
 * The component aims not to change layout: it renders an inline-block element
 * with text-xs font sizing matching existing compact UIs.
 */
export default function CargoTypeBadge({ name, className = '', ariaLabel }: CargoTypeBadgeProps) {
  const style = getCargoTypeStyle(String(name ?? ''))
  const label = name ?? '—'

  return (
    <div
      role="status"
      aria-label={ariaLabel ?? `Cargo type ${label}`}
      className={`inline-block px-3 py-1 text-xs rounded border font-medium ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      {label}
    </div>
  )
}