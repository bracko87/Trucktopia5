/**
 * Composer.tsx
 *
 * Right column: composer UI for Settings -> Inbox.
 *
 * Presents a textarea and single Send button. Draft list and quick actions
 * were removed to keep the composer minimal (keeps the component API so callers
 * are not broken).
 */

import React from 'react'

/**
 * ComposerProps
 *
 * Props for the Composer component.
 */
export interface ComposerProps {
  selectedThread: string | null
  composerText: string
  setComposerText: (s: string) => void
  onSend: () => void
  onSaveDraft: () => void
  onClearDraft: (threadId: string) => void
  drafts: Record<string, string>
  threadsIndex: { [id: string]: string } // id->display name map
  onLoadDraftToComposer: (threadId: string) => void
  onNewConversation: () => void
}

/**
 * Composer
 *
 * Renders the message textarea and a single Send button aligned to the right.
 *
 * @param props - ComposerProps
 */
export default function Composer({
  selectedThread,
  composerText,
  setComposerText,
  onSend,
  // keep other handlers in props to avoid breaking callers, they are unused here
  onSaveDraft,
  onClearDraft,
  drafts,
  threadsIndex,
  onLoadDraftToComposer,
  onNewConversation,
}: ComposerProps) {
  return (
    <div className="col-span-3 border rounded p-3 bg-white/80 flex flex-col">
      <div className="mb-2">
        <div className="font-medium">Compose</div>
        <div className="text-xs text-slate-500">Write a message to the selected conversation or start a new one.</div>
      </div>

      <div className="flex-1">
        <textarea
          placeholder={selectedThread ? 'Write a message...' : 'Select a thread or create a new conversation'}
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          className="w-full h-40 border rounded px-2 py-2 text-black resize-none"
          disabled={!selectedThread}
        />

        <div className="mt-2 flex items-center gap-2">
          {/* Only Send button kept per request */}
          <div className="ml-auto">
            <button
              onClick={onSend}
              className="px-3 py-1 rounded bg-emerald-600 text-white"
              disabled={!selectedThread || !composerText.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}