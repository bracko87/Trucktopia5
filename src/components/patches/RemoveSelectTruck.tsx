/**
 * RemoveSelectTruck.tsx
 *
 * Runtime DOM patch that removes any "Select truck" form control inserted by legacy UI.
 *
 * This component is intentionally non-invasive: it only removes the specific
 * container element that contains a label with text matching "Select truck" and
 * its associated <select>. It watches the document with a MutationObserver so
 * dynamically-inserted instances are also removed.
 *
 * Notes:
 * - Keeps layout intact by removing only the small block that contains the
 *   truck select. Other UI is unaffected.
 * - Uses conservative matching (label text contains "Select truck") to avoid
 *   false positives.
 */

import React, { useEffect } from 'react'

/**
 * RemoveSelectTruck
 *
 * React component mounting a MutationObserver to remove truck select blocks.
 *
 * @returns null (no visible UI)
 */
export default function RemoveSelectTruck(): JSX.Element | null {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    /**
     * removeMatchingSelects
     *
     * Find label nodes whose text includes "Select truck" (case-sensitive as in UI)
     * then remove their closest block container if it contains a <select>.
     */
    function removeMatchingSelects() {
      try {
        const labels = Array.from(document.querySelectorAll('label'))
        for (const lbl of labels) {
          const txt = (lbl.textContent || '').trim()
          if (!txt) continue
          if (txt === 'Select truck' || txt.includes('Select truck')) {
            const wrapper = lbl.closest('div')
            if (!wrapper) continue
            // confirm the wrapper contains a select to avoid removing unrelated blocks
            if (wrapper.querySelector('select')) {
              // remove element from DOM
              wrapper.remove()
            }
          }
        }
      } catch (e) {
        // swallow any errors to avoid breaking the host app
        // eslint-disable-next-line no-console
        console.warn('RemoveSelectTruck: removal error', e)
      }
    }

    // Run once immediately
    removeMatchingSelects()

    // Observe DOM changes and re-run removal for dynamically inserted content
    const observer = new (window as any).MutationObserver((mutations: MutationRecord[]) => {
      // quick heuristic: if nodes were added, try removal
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          removeMatchingSelects()
          break
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    // cleanup on unmount
    return () => {
      try {
        observer.disconnect()
      } catch {}
    }
  }, [])

  return null
}