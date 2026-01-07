/**
 * EditableField.tsx
 *
 * Small reusable inline editable text field.
 *
 * - Shows a read-only value with an edit icon.
 * - When activated, shows a text input with Save / Cancel controls.
 * - Calls onSave with the new value when saved.
 */

import React, { useState, useEffect } from 'react'
import { Edit, Check, X } from 'lucide-react'

/**
 * EditableFieldProps
 *
 * Props for the EditableField component.
 */
interface EditableFieldProps {
  value: string
  placeholder?: string
  /**
   * Called when the user saves a new value.
   * Can return a promise if persistence is asynchronous.
   */
  onSave?: (newValue: string) => void | Promise<void>
  className?: string
}

/**
 * EditableField
 *
 * Inline editable field used for small text properties like name or registration.
 *
 * @param props - EditableFieldProps
 */
export default function EditableField({ value, placeholder = '—', onSave, className = '' }: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  /**
   * handleSave
   *
   * Persist the draft value by calling onSave prop, then exit edit mode.
   */
  async function handleSave() {
    if (onSave) {
      try {
        // Allow onSave to be async
        await onSave(draft)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('EditableField save error', e)
      }
    }
    setEditing(false)
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {editing ? (
        <>
          <input
            aria-label="Edit field"
            className="px-2 py-1 border border-gray-200 rounded-md text-sm w-48"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') {
                setDraft(value)
                setEditing(false)
              }
            }}
          />
          <button
            type="button"
            aria-label="Save"
            onClick={handleSave}
            className="p-1 rounded-md text-green-600 hover:bg-green-50"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => {
              setDraft(value)
              setEditing(false)
            }}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-50"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <span className="text-sm text-slate-800 truncate">{value || placeholder}</span>
          <button
            type="button"
            aria-label="Edit"
            onClick={() => setEditing(true)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          >
            <Edit className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  )
}