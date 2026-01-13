/**
 * NewThreadForm.tsx
 *
 * Presentational new-thread form used in the left column.
 */

import React from 'react'

/**
 * NewThreadFormProps
 *
 * Props for new thread form.
 */
export interface NewThreadFormProps {
  subject: string
  participants: string
  onChangeSubject: (s: string) => void
  onChangeParticipants: (s: string) => void
  onCreate: () => void
  creating?: boolean
}

/**
 * NewThreadForm
 *
 * Compact form used to create a new thread.
 *
 * @param props - NewThreadFormProps
 */
export default function NewThreadForm(props: NewThreadFormProps) {
  const { subject, participants, onChangeSubject, onChangeParticipants, onCreate, creating } = props

  return (
    <div className="bg-white p-4 rounded shadow-sm">
      <label className="block text-xs text-slate-600">Subject</label>
      <input
        value={subject}
        onChange={(e) => onChangeSubject(e.target.value)}
        className="w-full px-3 py-2 border rounded text-black mb-3"
        placeholder="Thread subject"
      />

      <label className="block text-xs text-slate-600">Participants</label>
      <input
        value={participants}
        onChange={(e) => onChangeParticipants(e.target.value)}
        className="w-full px-3 py-2 border rounded text-black mb-3"
        placeholder="comma-separated emails"
      />

      <div className="flex justify-end">
        <button
          onClick={onCreate}
          disabled={creating}
          className="px-3 py-2 rounded bg-sky-600 text-white"
        >
          {creating ? 'Creating...' : 'Create thread'}
        </button>
      </div>
    </div>
  )
}