/**
 * MessageBubble.tsx
 *
 * Single message bubble used in the thread view.
 */

import React from 'react'

/**
 * MessageProps
 *
 * Minimal message shape used by the UI.
 */
export interface MessageProps {
  id: string
  sender_user_id?: string | null
  body?: string | null
  created_at?: string | null
  is_own?: boolean
}

/**
 * MessageBubble
 *
 * Displays a message aligned left or right depending on ownership.
 *
 * @param props - MessageProps
 */
export default function MessageBubble(props: MessageProps) {
  const { id, sender_user_id, body, created_at, is_own } = props
  return (
    <div className={`mb-3 flex ${is_own ? 'justify-end' : 'justify-start'}`} key={id}>
      <div className={`max-w-[75%]`}>
        {!is_own && <div className="text-xs text-slate-500 mb-1">{sender_user_id}</div>}
        <div className={`${is_own ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-800'} p-3 rounded-lg`}>
          <div className="whitespace-pre-wrap break-words text-sm">{body}</div>
        </div>
        <div className="text-xs text-slate-400 mt-1 text-right">{created_at ? new Date(created_at).toLocaleString() : ''}</div>
      </div>
    </div>
  )
}