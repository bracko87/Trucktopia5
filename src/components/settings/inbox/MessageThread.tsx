/**
 * MessageThread.tsx
 *
 * Presentational component for a single conversation view.
 *
 * Responsibilities:
 * - Render the conversation header using the provided threadName (other participant).
 * - Render the chronological message list.
 * - Offer a delete button (delegated) to remove the conversation.
 *
 * Notes:
 * - Deletion is delegated via onDelete callback so the page can handle backend logic,
 *   refresh thread lists and update selection.
 */

import React from 'react'
import { Trash2 } from 'lucide-react'

/**
 * ThreadMessage
 *
 * Minimal message model used by the Inbox UI.
 */
export interface ThreadMessage {
  id: string
  threadId: string
  sender: string
  body: string
  createdAt: string
  isDraft?: boolean
}

/**
 * MessageThreadProps
 *
 * Props for the MessageThread component.
 */
interface MessageThreadProps {
  /** thread uuid (used for delete) */
  threadId?: string | null
  /** display name for the thread (other participant) */
  threadName?: string | null
  /** messages to render */
  messages: ThreadMessage[]
  /** display name for current user (e.g. "You") */
  currentUserName: string
  /** delete callback - receives threadId */
  onDelete?: (threadId: string) => Promise<void> | void
}

/**
 * MessageThread
 *
 * Presentational component that shows the conversation header and messages.
 *
 * @param props - MessageThreadProps
 * @returns JSX.Element
 */
export default function MessageThread({
  threadId,
  threadName,
  messages,
  currentUserName,
  onDelete,
}: MessageThreadProps): JSX.Element {
  /**
   * handleDelete
   *
   * Called when the delete button is pressed. Delegates to onDelete if provided.
   */
  async function handleDelete() {
    if (!threadId) return
    if (!confirm('Delete this conversation? This cannot be undone.')) return
    try {
      await onDelete?.(threadId)
    } catch (err) {
      // Delegate error handling to caller; also log for debug
      console.error('Error deleting thread:', err)
      alert('Failed to delete conversation.')
    }
  }

  return (
    <div className="col-span-6 bg-white border rounded shadow-sm flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
            {threadName ? threadName.charAt(0).toUpperCase() : 'C'}
          </div>
          <div>
            <div className="font-medium text-sm">{threadName || 'Conversation'}</div>
            <div className="text-xs text-slate-500">{messages.length} messages</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {threadId && (
            <button
              className="text-sm px-2 py-1 rounded border text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={handleDelete}
              title="Delete conversation"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      <div id="thread-messages" className="p-4 overflow-auto h-96 space-y-3">
        {messages.length === 0 && <div className="text-sm text-slate-500">No messages</div>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] p-3 rounded-lg ${m.sender === currentUserName ? 'ml-auto bg-sky-600 text-white' : 'bg-slate-100 text-slate-900'}`}
          >
            <div className="text-xs font-medium mb-1">{m.sender}</div>
            <div className="text-sm whitespace-pre-wrap">{m.body}</div>
            <div className="text-xs text-slate-400 mt-1">{new Date(m.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}