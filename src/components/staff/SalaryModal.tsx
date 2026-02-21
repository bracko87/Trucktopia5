/**
 * SalaryModal.tsx
 *
 * Modal dialog to adjust a hired staff member's salary.
 *
 * - Displays an input for the salary in major currency units (USD).
 * - Validates non-negative numeric values.
 * - Calls onSave with the new value (number) or null to clear.
 * - Uses ModalShell for consistent modal styling when available.
 */

import React from 'react'
import ModalShell from '../common/ModalShell'

/**
 * SalaryModalProps
 *
 * Props for the SalaryModal component.
 */
export interface SalaryModalProps {
  /** Whether the modal is visible */
  open: boolean
  /** Called when the modal should be closed without saving */
  onClose: () => void
  /**
   * Initial salary in major currency units (e.g. 1200 for $1,200).
   * If undefined/null, field starts empty.
   */
  initialSalary?: number | null
  /**
   * Called when the user saves. Receives numeric value in major units or null
   * when user clears the salary.
   */
  onSave: (value: number | null) => void | Promise<void>
}

/**
 * SalaryModal
 *
 * Render a small centered modal with a numeric input and Save/Cancel actions.
 */
export default function SalaryModal({ open, onClose, initialSalary, onSave }: SalaryModalProps) {
  const [value, setValue] = React.useState<string>(initialSalary != null ? String(initialSalary) : '')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setValue(initialSalary != null ? String(initialSalary) : '')
    setError(null)
  }, [initialSalary, open])

  /**
   * validateAndSave
   *
   * Validate input and call onSave with a number or null.
   */
  async function validateAndSave() {
    setError(null)
    const trimmed = value.trim()
    if (trimmed === '') {
      // treat empty as clearing salary
      setSaving(true)
      try {
        await onSave(null)
        onClose()
      } finally {
        setSaving(false)
      }
      return
    }
    const parsed = Number(trimmed)
    if (Number.isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid non-negative number')
      return
    }
    setSaving(true)
    try {
      await onSave(parsed)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} title="Adjust Salary">
      <div className="py-2">
        <label className="block text-sm font-medium text-slate-700">Salary (USD)</label>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-slate-700">$</span>
          <input
            type="number"
            inputMode="decimal"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 1200"
            min={0}
          />
        </div>
        {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="text-sm px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="text-sm px-3 py-1 rounded-md bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={validateAndSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}