/**
 * Composer.tsx
 *
 * Simple message composer with autosize textarea and send button.
 */

import React, { useRef, useEffect } from 'react'
import { Send, Paperclip } from 'lucide-react'

/**
 * ComposerProps
 *
 * Props for composer component.
 */
export interface ComposerProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled?: boolean
}

/**
 * Composer
 *
 * Renders textarea and send UI. Automatically grows height with content.
 *
 * @param props - ComposerProps
 */
export default function Composer(props: ComposerProps) {
  const { value, onChange, onSend, disabled } = props
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!taRef.current) return
    taRef.current.style.height = '0px'
    taRef.current.style.height = `${Math.min(240, taRef.current.scrollHeight)}px`
  }, [value])

  return (
    <div>
      <div className="relative">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border rounded text-black resize-none min-h-[64px]"
          placeholder="Write a message..."
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          <button
            title="Attach"
            className="p-1 rounded hover:bg-slate-100 text-slate-600"
            type="button"
          >
            <Paperclip size={16} />
          </button>

          <button
            onClick={() => onSend()}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-emerald-600 text-white"
            type="button"
          >
            <Send size={14} />
            Send
          </button>
        </div>
      </div>
    </div>
  )
}