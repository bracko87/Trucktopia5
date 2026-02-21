/**
 * EditableTrailerName.tsx
 *
 * Inline editable trailer name component.
 * Shows a truncated display name and a pencil button to enter edit mode.
 * In edit mode the user can type, press Enter to save, or Esc / Cancel to abort.
 * Saves are reported to the parent via onSave callback.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'

/**
 * EditableTrailerNameProps
 *
 * Props for EditableTrailerName component.
 */
export interface EditableTrailerNameProps {
  /**
   * Initial displayed name.
   */
  initialName?: string
  /**
   * Called when the user saves a new name.
   * Parent may persist the change. If not provided, the component still updates UI locally.
   */
  onSave?: (newName: string) => void
  /**
   * Visually hidden label for accessibility if needed.
   */
  ariaLabel?: string
}

/**
 * EditableTrailerName
 *
 * Reusable inline editor for a trailer's display name.
 *
 * @param props EditableTrailerNameProps
 * @returns JSX.Element
 */
export default function EditableTrailerName({
  initialName = '',
  onSave,
  ariaLabel = 'Trailer name',
}: EditableTrailerNameProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialName ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  /**
   * Keep local value in sync if parent updates initialName.
   */
  useEffect(() => {
    setValue(initialName ?? '')
  }, [initialName])

  /**
   * Focus input when entering edit mode.
   */
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  /**
   * handleSave
   *
   * Notify parent and exit edit mode.
   */
  async function handleSave() {
    const trimmed = (value ?? '').trim()
    setSaving(true)
    try {
      onSave && onSave(trimmed)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  /**
   * handleKey
   *
   * Keyboard handlers: Enter = save, Escape = cancel.
   */
  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setValue(initialName ?? '')
      setEditing(false)
    }
  }

  return (
    <div className="flex items-center gap-3 min-w-0">
      {!editing ? (
        <>
          <div
            className="text-sm font-medium truncate"
            title={value || 'Unnamed trailer'}
            aria-label={ariaLabel}
          >
            {value && value.length > 0 ? value : 'Unnamed trailer'}
          </div>

          <button
            aria-label="Edit trailer name"
            onClick={() => setEditing(true)}
            className="p-1 rounded hover:bg-gray-100 text-slate-600"
            title="Edit trailer name"
            type="button"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2 w-full max-w-md">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            aria-label={ariaLabel}
          />

          <button
            aria-label="Save trailer name"
            onClick={handleSave}
            disabled={saving}
            className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            title="Save"
            type="button"
          >
            <Check className="w-4 h-4" />
          </button>

          <button
            aria-label="Cancel edit trailer name"
            onClick={() => {
              setValue(initialName ?? '')
              setEditing(false)
            }}
            className="p-1 rounded hover:bg-gray-100 text-slate-600"
            title="Cancel"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
