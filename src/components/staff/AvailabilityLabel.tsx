/**
 * AvailabilityLabel.tsx
 *
 * Presentational availability label used across staff UI.
 *
 * This variant always displays "Available now" for every staff member.
 * It replaces the previous behavior that hid the "Available now" text to
 * avoid duplicate fragments. The UI design / layout remains unchanged.
 */

import React from 'react'

/**
 * AvailabilityLabelProps
 *
 * Props for AvailabilityLabel component.
 */
export interface AvailabilityLabelProps {
  /** ISO timestamp when staff becomes available (nullable). Kept for API compatibility. */
  availableAt?: string | null
  /** Optional additional className to apply. */
  className?: string
}

/**
 * AvailabilityLabel
 *
 * Always render "Available now". The component intentionally ignores
 * relative durations like "in 1 week" so the UI consistently shows
 * availability as immediate for all staff listings.
 *
 * @param props AvailabilityLabelProps
 * @returns JSX.Element
 */
export default function AvailabilityLabel({ availableAt, className }: AvailabilityLabelProps): JSX.Element {
  // We intentionally ignore availableAt and always show the immediate label.
  // Keep the same small text styling as other badges and allow callers to
  // add extra classes via className.
  return (
    <span className={`text-xs text-emerald-700 font-medium ml-2 ${className ?? ''}`}>
      Available now
    </span>
  )
}
