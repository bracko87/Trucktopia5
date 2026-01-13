/**
 * HelpHeader.tsx
 *
 * Small reusable header for Help pages with title, subtitle and a back button.
 */

import React from 'react'
import { ArrowLeft } from 'lucide-react'

/**
 * HelpHeaderProps
 *
 * Props for the HelpHeader component.
 */
export interface HelpHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
}

/**
 * HelpHeader
 *
 * Renders a compact page header used by Help/FAQ/manual screens.
 *
 * @param props - HelpHeaderProps
 */
export const HelpHeader: React.FC<HelpHeaderProps> = ({ title, subtitle, onBack }) => {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {subtitle ? <div className="text-sm text-slate-600 mt-1">{subtitle}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => (onBack ? onBack() : window.history.back())}
            aria-label="Back"
            className="px-3 py-1 rounded border text-black inline-flex items-center gap-2"
          >
            <ArrowLeft size={14} />
            Back
          </button>
        </div>
      </div>
    </div>
  )
}

export default HelpHeader