/**
 * HideQuickCreateButton.tsx
 *
 * Runtime DOM patcher that hides any "Quick Create" button while preserving layout.
 *
 * The component searches the document for buttons / role="button" elements whose
 * visible text equals "Quick Create" (or starts with "Quick Create ") and applies
 * visibility:hidden so layout is preserved. A MutationObserver ensures dynamically
 * injected buttons are also handled.
 */

import React, { useEffect } from 'react'

/**
 * isQuickCreateButton
 *
 * Determine if the given element appears to be the "Quick Create" button.
 *
 * @param el - DOM element to test
 * @returns boolean true when the element appears to be the target button
 */
function isQuickCreateButton(el: Element): boolean {
  try {
    const text = (el.textContent || '').trim()
    if (!text) return false

    // Exact "Quick Create" or starts with "Quick Create " (covers sentences like "Quick Create >")
    if (text === 'Quick Create' || text.startsWith('Quick Create ')) return true

    // aria-label check
    const aria = (el as HTMLElement).getAttribute?.('aria-label') || ''
    if (aria.trim() === 'Quick Create') return true

    // Heuristic: common styling for the site uses yellow buttons for primary actions.
    // If the element contains the token and is a button-like element, hide it.
    if (el instanceof HTMLButtonElement || (el as HTMLElement).role === 'button') {
      const classes = Array.from(el.classList || [])
      if (classes.some((c) => c.includes('yellow') || c.includes('bg-yellow'))) {
        if (/quick\s*create/i.test(text)) return true
      }
    }

    return false
  } catch {
    return false
  }
}

/**
 * hideButtonsOnce
 *
 * Finds matching elements and applies visibility:hidden + pointerEvents:none + aria-hidden.
 * Marks handled elements with a data attribute to avoid reapplying.
 *
 * @returns void
 */
function hideButtonsOnce(): void {
  // Query both <button> and any element with role="button"
  const candidates = Array.from(document.querySelectorAll('button, [role="button"]'))
  candidates.forEach((el) => {
    if (!isQuickCreateButton(el)) return

    const node = el as HTMLElement
    if ((node.dataset as any)?.hiddenByHideQuickCreate === '1') return

    // Preserve layout by using visibility:hidden
    node.style.visibility = 'hidden'
    node.style.pointerEvents = 'none'
    node.setAttribute('aria-hidden', 'true')
    ;(node.dataset as any).hiddenByHideQuickCreate = '1'
  })
}

/**
 * HideQuickCreateButton
 *
 * React component mounted at app root. Runs an initial pass and observes DOM
 * mutations to hide subsequently inserted "Quick Create" buttons.
 *
 * @returns null
 */
export default function HideQuickCreateButton(): JSX.Element | null {
  useEffect(() => {
    // Initial pass
    hideButtonsOnce()

    // Observe the body for additions so dynamically created buttons are also hidden
    const observer = new MutationObserver((mutations) => {
      let found = false
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          found = true
          break
        }
      }
      if (found) {
        // Slight debounce to let the DOM settle
        setTimeout(hideButtonsOnce, 50)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
    }
  }, [])

  return null
}