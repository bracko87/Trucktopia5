/**
 * RegistrationInput.tsx
 *
 * Reusable registration input component that renders an inline badge (region)
 * and a small numeric input with an optional "Reg:" label. Designed to be placed
 * inline with other controls (e.g. hub dropdown) in a details row.
 */

import React from 'react'

/**
 * RegistrationInputProps
 *
 * Props for the RegistrationInput component.
 */
interface RegistrationInputProps {
  /** Current input value (controlled) */
  value: string
  /** Change handler for the input value */
  onChange: (v: string) => void
  /** Region/badge text shown to the left (default: 'ZR') */
  region?: string
  /** Label text shown before the input (default: 'Reg:') */
  label?: string
  /** Optional extra class names applied to the root container */
  className?: string
}

/**
 * RegistrationInput
 *
 * Renders a small inline registration input with a left badge and a mono-font
 * numeric field. Built for placing in a horizontal details row next to other
 * controls such as a hub dropdown.
 *
 * @param props - component props
 */
export default function RegistrationInput({
  value,
  onChange,
  region = 'ZR',
  label = 'Reg:',
  className = '',
}: RegistrationInputProps) {
  /**
   * handleChange
   *
   * Normalizes input to digits only and enforces the maxlength of 4 then calls
   * the external onChange callback.
   *
   * @param e - input change event
   */
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    // allow only digits and trim to 4 characters
    const normalized = raw.replace(/\D/g, '').slice(0, 4)
    onChange(normalized)
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Label preceding the badge/input */}
      <span className="text-sm text-slate-700 font-medium mr-1">{label}</span>

      {/* Badge + numeric input styled to match the provided snippet */}
      <div className="inline-flex items-center gap-0" style={{ pointerEvents: 'auto' }}>
        <span
          aria-hidden
          className="px-2 py-1 rounded-l-md bg-slate-100 text-xs font-mono text-slate-700 border border-r-0 border-slate-200"
          style={{ pointerEvents: 'auto' }}
        >
          {region}
        </span>
        <input
          aria-label="Registration digits"
          className="w-20 px-2 py-1 rounded-r-md border border-slate-200 text-sm font-mono"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={value}
          onChange={handleChange}
          style={{ pointerEvents: 'auto' }}
        />
      </div>
    </div>
  )
}