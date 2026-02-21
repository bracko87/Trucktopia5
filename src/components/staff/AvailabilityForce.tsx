/**
 * AvailabilityForce.tsx
 *
 * Small global helper that ensures any UI fragments that render future
 * availability text (e.g. "Available in 1 week", "Available until ...")
 * are replaced with the consistent string "Available now".
 *
 * This file intentionally performs a non-visual DOM text replacement only.
 */

import React from 'react'

/**
 * AvailabilityForce
 *
 * Mount this component once at app root. It scans the DOM for nodes
 * that contain availability phrases and replaces them with "Available now".
 * It also observes DOM mutations so dynamically inserted nodes are fixed.
 *
 * @returns null (no UI)
 */
export default function AvailabilityForce(): JSX.Element {
  React.useEffect(() => {
    // Regexes to detect availability-like fragments we want to replace.
    const availabilityPattern = /\bAvailable(?:\s+(?:in|until))\b/i
    const weekPattern = /\b\d+\s*week/i

    /**
     * replaceIfAvailabilityText
     *
     * Inspect a node (element or text) and replace availability phrases
     * with the string "Available now".
     *
     * @param node Node to inspect
     */
    function replaceIfAvailabilityText(node: Node) {
      try {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.nodeValue?.trim()
          if (!t) return
          if (availabilityPattern.test(t) || weekPattern.test(t)) {
            node.nodeValue = 'Available now'
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element
          // narrow down to small inline text containers to avoid accidental replacements
          if (el.matches('span,div,p')) {
            const txt = el.textContent?.trim()
            if (txt && (availabilityPattern.test(txt) || weekPattern.test(txt))) {
              el.textContent = 'Available now'
              return
            }
          }
          // recurse children
          for (const child of Array.from(el.childNodes)) {
            replaceIfAvailabilityText(child)
          }
        }
      } catch {
        // ignore DOM exceptions
      }
    }

    // Initial pass
    replaceIfAvailabilityText(document.body)

    // Observe future changes and fix inserted/changed nodes
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target) {
          replaceIfAvailabilityText(m.target as Node)
        }
        if (m.addedNodes && m.addedNodes.length > 0) {
          for (const n of Array.from(m.addedNodes)) {
            replaceIfAvailabilityText(n)
          }
        }
      }
    })

    mo.observe(document.body, { subtree: true, childList: true, characterData: true })

    return () => {
      mo.disconnect()
    }
  }, [])

  // invisible component (no visual output)
  return <span style={{ display: 'none' }} aria-hidden />
}
