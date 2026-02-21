/**
 * HideDriversPanel.tsx
 *
 * Runtime patcher that hides any card/panel whose header text is "Drivers".
 * This is intentionally non-invasive: it sets visibility:hidden on matching
 * elements so the page layout and spacing remain unchanged.
 *
 * The component watches the DOM for additions so it works with dynamically
 * rendered content (e.g. injected panels).
 */

import React, { useEffect } from 'react'

/**
 * isDriversPanel
 *
 * Check whether the given element contains an H3 whose trimmed text content
 * equals "Drivers".
 *
 * @param el DOM element to inspect
 * @returns boolean true if this looks like the Drivers panel
 */
function isDriversPanel(el: Element): boolean {
  try {
    const h3 = el.querySelector('h3')
    if (!h3) return false
    return (h3.textContent || '').trim() === 'Drivers'
  } catch {
    return false
  }
}

/**
 * hideMatchingNodes
 *
 * Find matching nodes in the document and apply non-destructive hiding.
 * We add a data attribute so the operation is idempotent and reversible.
 *
 * @returns array of modified elements
 */
function hideMatchingNodes(): Element[] {
  const modified: Element[] = []
  const candidates = Array.from(document.querySelectorAll('aside, div, section, article'))
  for (const el of candidates) {
    if (isDriversPanel(el) && !el.hasAttribute('data-hide-drivers-panel')) {
      el.setAttribute('data-hide-drivers-panel', '1')
      // non-invasive: hide visually but keep layout flow
      ;(el as HTMLElement).style.visibility = 'hidden'
      modified.push(el)
    }
  }
  return modified
}

/**
 * restoreNodes
 *
 * Revert the changes made by hideMatchingNodes.
 *
 * @param els elements previously modified
 */
function restoreNodes(els: Element[]) {
  for (const el of els) {
    try {
      if (el.getAttribute('data-hide-drivers-panel')) {
        el.removeAttribute('data-hide-drivers-panel')
        ;(el as HTMLElement).style.visibility = ''
      }
    } catch {
      // ignore
    }
  }
}

/**
 * HideDriversPanel
 *
 * React component that mounts a MutationObserver and hides any "Drivers" panel.
 * It performs an initial pass and continues watching for DOM changes.
 */
export default function HideDriversPanel(): JSX.Element | null {
  useEffect(() => {
    const modified = hideMatchingNodes()

    const mo = new MutationObserver(() => {
      hideMatchingNodes()
    })
    mo.observe(document.body, { childList: true, subtree: true })

    // also check on hashchange/navigation
    const onHash = () => {
      hideMatchingNodes()
    }
    window.addEventListener('hashchange', onHash)

    return () => {
      try {
        mo.disconnect()
      } catch {}
      window.removeEventListener('hashchange', onHash)
      restoreNodes(modified)
    }
  }, [])

  return null
}