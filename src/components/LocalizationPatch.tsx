/**
 * LocalizationPatch.tsx
 *
 * Small runtime patch component that searches the DOM for an exact UI string
 * "Next maintenance (km)" and replaces it with the requested wording:
 * "Next maintenance check in (km)".
 *
 * This avoids editing every component that may contain the old text by applying
 * a safe, idempotent DOM replacement and observing future changes so the new
 * wording stays applied for dynamic updates.
 */

import React, { useEffect } from 'react'

/**
 * LocalizationPatch
 *
 * A component that performs a one-time and live DOM text replacement for a
 * specific phrase. It uses a MutationObserver to keep the replacement in sync
 * with dynamic updates.
 *
 * Note: This is intentionally lightweight and targeted (single exact string).
 */
export default function LocalizationPatch(): JSX.Element | null {
  useEffect(() => {
    let raf = 0
    let observer: MutationObserver | null = null
    const TARGET = 'Next maintenance (km)'
    const REPLACEMENT = 'Next maintenance check in (km)'

    /**
     * replaceInNode
     *
     * Replace exact text content in matching elements. Only replaces when the
     * trimmed textContent exactly matches the target to avoid accidental edits.
     *
     * @param root - root element to search under
     */
    function replaceInNode(root: ParentNode = document) {
      // Use a breadth-first search of element nodes to minimize matches to visible elements
      const els = (root as Element).querySelectorAll ? (root as Element).querySelectorAll('*') : []
      for (let i = 0; i < els.length; i++) {
        const el = els[i] as Element
        // Only operate on elements whose textContent is a simple exact match
        const txt = el.textContent?.trim()
        if (txt === TARGET) {
          // Replace the visible text while preserving element attributes
          // Use textContent to avoid injecting HTML
          el.textContent = REPLACEMENT
        }
      }
    }

    /**
     * scheduledReplace
     *
     * Debounced replace to run inside RAF to avoid layout thrashing during heavy mutations.
     */
    function scheduledReplace(root?: ParentNode) {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        replaceInNode(root ?? document)
      })
    }

    // Initial pass
    scheduledReplace(document)

    // Observe for dynamic changes in the page and re-apply replacement when needed
    observer = new MutationObserver((mutations) => {
      // If any mutation could have introduced the target text, run a replacement.
      // To keep work minimal, only run when text nodes or added nodes appear.
      for (const m of mutations) {
        if (m.type === 'characterData' || m.type === 'childList' || m.type === 'subtree') {
          scheduledReplace(m.target as ParentNode || document)
          break
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => {
      if (observer) observer.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // This component renders nothing visible.
  return null
}
