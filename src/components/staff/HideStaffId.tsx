/**
 * HideStaffId.tsx
 *
 * Global helper component that hides inline record-id UI nodes that match the
 * mono/truncate pattern (e.g. UUID shown in the staff card). This is intentionally
 * non-destructive: it hides only nodes that look like UUIDs to avoid affecting
 * other content.
 *
 * The component uses a MutationObserver so it works for server-rendered and
 * dynamically updated content.
 */

import React from 'react'

/**
 * isUuid
 *
 * Simple UUID v4-ish checker used to avoid hiding unrelated text.
 *
 * @param s text to test
 * @returns boolean whether text resembles a UUID
 */
function isUuid(s: string | null | undefined): boolean {
  if (!s) return false
  const trimmed = s.trim()
  // Basic pattern: 8-4-4-4-12 hex with hyphens (case-insensitive)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    trimmed
  )
}

/**
 * hideMatchingNodes
 *
 * Finds nodes using the common staff-id styles and hides their textual content
 * if it matches a UUID pattern.
 */
function hideMatchingNodes(root: ParentNode = document) {
  try {
    // Target the typical mono/truncate class used in the UI.
    const nodes = Array.from(
      (root as Document).querySelectorAll<
        HTMLElement
      >('.font-mono.truncate, .font-mono.truncate.max-w-[260px], .font-mono.truncate.max-w-\\[260px\\]')
    )
    nodes.forEach((el) => {
      if (isUuid(el.textContent)) {
        // hide text content but keep the element present so layout remains stable
        el.textContent = ''
        // also remove pointer events so it won't be interactable
        el.style.pointerEvents = 'none'
      }
    })
  } catch {
    // fail silently
  }
}

/**
 * HideStaffId
 *
 * Mounts a MutationObserver and performs an initial pass to hide UUID-like strings
 * inside elements that use the mono/truncate classes. Lightweight and safe.
 */
export default function HideStaffId(): JSX.Element | null {
  React.useEffect(() => {
    // Initial pass
    hideMatchingNodes(document)

    // Observe for dynamic updates
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes?.length) {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1) {
              hideMatchingNodes(n as ParentNode)
            }
          })
        }
        if (m.type === 'characterData') {
          hideMatchingNodes(document)
        }
      }
    })

    mo.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => mo.disconnect()
  }, [])

  return null
}