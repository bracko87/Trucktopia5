/**
 * ThreadList.tsx
 *
 * Presentational list container for threads.
 */

import React from 'react'
import ThreadItem, { ThreadListItemProps } from './ThreadItem'

/**
 * ThreadListProps
 *
 * Props for the ThreadList component.
 */
export interface ThreadListProps {
  threads: Array<{
    id: string
    subject?: string | null
    snippet?: string | null
    time?: string | null
    unread?: number
  }>
  selectedId?: string | null
  onSelect?: (id: string) => void
}

/**
 * ThreadList
 *
 * Render a vertically scrollable list of threads.
 *
 * @param props - ThreadListProps
 */
export default function ThreadList(props: ThreadListProps) {
  const { threads, selectedId, onSelect } = props

  return (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh] pr-2">
      {threads.map((t) => (
        <ThreadItem
          key={t.id}
          id={t.id}
          subject={t.subject}
          snippet={t.snippet}
          time={t.time}
          unread={t.unread}
          selected={selectedId === t.id}
          onClick={onSelect}
        />
      ))}
    </div>
  )
}