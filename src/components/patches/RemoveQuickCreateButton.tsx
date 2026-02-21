/**
 * src/components/patches/RemoveQuickCreateButton.tsx
 *
 * Runtime patch to remove any stray "Quick Create" button inserted by the UI.
 * This keeps the original page layout and behaviour intact while removing the
 * unwanted button element from the DOM.
 *
 * Rationale:
 * - Some legacy/header implementations render a "Quick Create" button that
 *   should not be visible. Removing it at runtime avoids changing header code
 *   and keeps the patch non-invasive.
 */

import React, { useEffect } from 'react'

/**
 * RemoveQuickCreateButton
 *
 * Mounts a MutationObserver that watches for added nodes and removes any
 * button whose visible text equals "Quick Create".
 *
 * Returning null because this component does not render UI.
 *
 * @returns JSX.Element | null
 */
export default function RemoveQuickCreateButton(): JSX.Element | null {
  useEffect(() => {
    /**
     * matchesQuickCreate
     *
     * Determine whether an element is the unwanted Quick Create button.
     *
     * @param el DOM element to evaluate
     * @returns boolean
     */
    function matchesQuickCreate(el: Element) {
      try {
        if (!(el instanceof HTMLButtonElement)) return false
        const txt = (el.textContent ?? '').trim()
        if (txt === 'Quick Create') return true

        // Additional safety: match by distinctive class set if present
        const cls = el.className ?? ''
        if (cls.includes('bg-yellow-400') && cls.includes('hidden') && cls.includes('md:inline-flex')) {
          return true
        }
      } catch {
        // ignore
      }
      return false
    }

    /**
     * scanAndRemove
     *
     * Scans the document for matching buttons and removes them.
     */
    function scanAndRemove() {
      try {
        const buttons = Array.from(document.querySelectorAll('button'))
        for (const b of buttons) {
          if (matchesQuickCreate(b)) {
            b.remove()
          }
        }
      } catch {
        // ignore DOM access errors
      }
    }

    // Initial pass
    scanAndRemove()

    // Observe for future insertions (covers dynamic/header re-renders)
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          scanAndRemove()
          break
        }
      }
    })

    mo.observe(document.body, { childList: true, subtree: true })

    return () => mo.disconnect()
  }, [])

  return null
}
