/**
 * FooterCta.tsx
 *
 * Bottom call-to-action bar for the landing page.
 */

import React from 'react'

/**
 * FooterCtaProps
 */
interface FooterCtaProps {
  onStart: () => void
}

/**
 * FooterCta
 *
 * A persistent CTA strip inviting users to create an account.
 */
export default function FooterCta({ onStart }: FooterCtaProps) {
  return (
    <div className="mt-16 bg-black text-yellow-400 py-6">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-lg">Ready to build your trucking empire?</div>
          <div className="text-sm text-yellow-200/80">Create your company and start playing now — Tracktopia</div>
        </div>
        <div>
          <button
            onClick={onStart}
            className="px-6 py-3 bg-yellow-400 text-black rounded font-semibold shadow"
          >
            Start Playing
          </button>
        </div>
      </div>
    </div>
  )
}
