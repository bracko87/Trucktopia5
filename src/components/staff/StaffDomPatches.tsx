/**
 * StaffDomPatches.tsx
 *
 * Small global DOM patch to hide two stray UI fragments that appear inside
 * staff listing cards on the Staff page:
 *  - Inline span with exact text "Available now"
 *  - Muted price/fee summary div (text-xs text-slate-500) that contains both "Base:" and "Fee"
 *
 * This file intentionally performs a scoped DOM mutation (only hiding elements)
 * and uses a MutationObserver so dynamically-rendered cards are covered too.
 *
 * It is designed to be mounted once (for example in App.tsx) and does not modify
 * layout or underlying components.
 */

import React from 'react'

/**
 * StaffDomPatches
 *
 * Mount this component once (global scope). It will:
 *  - Hide any span whose trimmed textContent is exactly "Available now"
 *  - Hide any div.text-xs.text-slate-500 that contains both "Base:" and "Fee"
 *
 * @returns null (no visible UI)
 */
export default function StaffDomPatches(): JSX.Element | null {
  React.useEffect(() => {
    /**
     * hideMatches
     *
     * Scan the document for the two problematic fragments and hide them.
     * This is intentionally defensive and tolerant of DOM changes.
     */
    function hideMatches() {
      try {
        // Hide exact "Available now" spans (scoped by exact text)
        const spanEls = Array.from(document.querySelectorAll('span')) as HTMLSpanElement[]
        for (const el of spanEls) {
          try {
            if (el.textContent && el.textContent.trim() === 'Available now') {
              if ((el as HTMLElement).style.display !== 'none') {
                (el as HTMLElement).style.display = 'none'
                // ensure it does not capture pointer events if present
                (el as HTMLElement).style.pointerEvents = 'none'
              }
            }
          } catch {
            // ignore individual element errors
          }
        }

        // Hide small muted price/fee summary lines scoped by class and content
        const mutedDivs = Array.from(document.querySelectorAll('div.text-xs.text-slate-500')) as HTMLElement[]
        for (const d of mutedDivs) {
          try {
            const txt = (d.textContent || '').trim()
            if (txt.includes('Base:') && txt.includes('Fee')) {
              if (d.style.display !== 'none') {
                d.style.display = 'none'
                d.style.pointerEvents = 'none'
              }
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // global ignore - non-critical
      }
    }

    // Run immediately
    hideMatches()

    // Observe for changes and re-run hide logic when DOM updates (cards may be added dynamically)
    const observer = new MutationObserver(() => {
      hideMatches()
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
    }
  }, [])

  // No UI
  return null
}
