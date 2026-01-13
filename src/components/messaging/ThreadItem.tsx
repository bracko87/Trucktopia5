/**
 * ThreadItem.tsx
 *
 * Small list item representing a single thread inside the thread list.
 */

import React from 'react'

/**
 * ThreadListItemProps
 *
 * Props for ThreadItem component.
 */
export interface ThreadListItemProps {
  id: string
  subject?: string | null
  snippet?: string | null
  time?: string | null
  unread?: number
  selected?: boolean
  onClick?: (id: string) => void
}

/**
 * ThreadItem
 *
 * Renders basic thread row with avatar, subject, snippet, time and unread badge.
 *
 * @param props - ThreadListItemProps
 */
export default function ThreadItem(props: ThreadListItemProps) {
  const { id, subject, snippet, time, unread = 0, selected, onClick } = props

  const initials = (subject && subject.trim().slice(0, 2).toUpperCase()) || 'T'

  return (
    <button
      onClick={() => onClick && onClick(id)}
      className={`w-full text-left flex items-start gap-3 p-3 rounded transition ${
        selected ? 'bg-slate-50' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex-none">
        <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-semibold">
          {initials}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="text-sm font-medium truncate">{subject || 'Untitled'}</div>
          <div className="text-xs text-slate-400 ml-2">{time ? new Date(time).toLocaleString() : ''}</div>
        </div>
        <div className="text-xs text-slate-500 truncate mt-1">{snippet || ''}</div>
      </div>

      {unread > 0 && (
        <div className="flex-none ml-2">
          <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded bg-emerald-600 text-white">
            {unread}
          </span>
        </div>
      )}
    </button>
  )
}