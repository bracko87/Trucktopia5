/**
 * FAQItem.tsx
 *
 * Reusable FAQ item used in Help/FAQ lists. Click to expand/collapse.
 */

import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

/**
 * FAQItemProps
 *
 * Props for the FAQItem component.
 */
export interface FAQItemProps {
  question: string
  answer: React.ReactNode
}

/**
 * FAQItem
 *
 * Small accordion-like item for displaying a Q/A pair.
 *
 * @param props - FAQItemProps
 */
export const FAQItem: React.FC<FAQItemProps> = ({ question, answer }) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="border rounded bg-white shadow-sm">
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
        aria-expanded={open}
        aria-controls={`faq-${question.slice(0, 16).replace(/\s+/g, '-')}`}
      >
        <div>
          <div className="font-medium text-slate-800">{question}</div>
        </div>
        <div className="text-slate-500">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {open ? (
        <div id={`faq-${question.slice(0, 16).replace(/\s+/g, '-')}`} className="px-4 pb-4 text-sm text-slate-700">
          {answer}
        </div>
      ) : null}
    </div>
  )
}

export default FAQItem