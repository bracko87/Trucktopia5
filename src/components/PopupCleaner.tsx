/**
 * PopupCleaner.tsx
 *
 * Small global utility that hides any inline "Truck: <uuid>" lines when they
 * appear inside popup/modal containers. This uses a MutationObserver so the
 * text is hidden both at mount and if a popup is inserted later (eg. a
 * dynamically created debug popup).
 *
 * The component is intentionally conservative: it only hides elements when an
 * ancestor looks like a dialog (role="dialog" or aria-modal="true") or has
 * common modal-like characteristics. It marks hidden elements with a data-*
 * attribute so we don't repeatedly modify them.
 */

import React, { useEffect } from 'react'

/**
 * isElementInPopup
 *
 * Determine whether an element is inside a popup/modal by walking up the
 * ancestor chain and checking for dialog-like attributes or classes.
 *
 * @param el - Element to test
 * @returns boolean - true if the element appears to be inside a popup/modal
 */
function isElementInPopup(el: Element | null): boolean {
  let cur = el as Element | null
  while (cur) {
    if (!(cur instanceof HTMLElement)) {
      cur = cur.parentElement
      continue
    }

    // Explicit dialog signals
    if (cur.getAttribute('role') === 'dialog') return true
    if (cur.getAttribute('aria-modal') === 'true') return true

    // Common portal / modal container classes or attributes used by libraries
    const cls = (cur.className || '').toString()
    if (cls.includes('radix-portal') || cls.includes('portal') || cls.includes('modal') || cls.includes('dialog') || cls.includes('fixed')) {
      // fixed + overlay/centered modals typically indicate a popup
      return true
    }

    cur = cur.parentElement
  }
  return false
}

/**
 * findTruckTextNodes
 *
 * Find candidate elements whose visible text starts with "Truck:".
 *
 * @param root - root to search under
 * @returns HTMLElement[] - matching elements
 */
function findTruckTextNodes(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = []
  // narrow query to common small text containers to avoid heavy scans
  const candidates = Array.from(
    (root as HTMLElement).querySelectorAll('div, p, span')
  ) as HTMLElement[]

  for (const el of candidates) {
    try {
      const txt = (el.textContent || '').trim()
      if (!txt) continue
      // Check for the prefix "Truck:" (case sensitive as UI shows)
      if (txt.startsWith('Truck:')) {
        found.push(el)
      }
    } catch {
      // ignore any read errors
    }
  }
  return found
}

/**
 * PopupCleaner
 *
 * Mount this at the app root to hide "Truck: <id>" lines that appear inside
 * popup/modal containers. Uses a MutationObserver to catch dynamic insertions.
 *
 * @returns JSX.Element - null (no visual output)
 */
export default function PopupCleaner(): JSX.Element {
  useEffect(() => {
    let observer: MutationObserver | null = null

    /**
     * hideMatchingLines
     *
     * Hides any matching elements under `root` when they are inside a popup.
     *
     * @param root - Node to scan (defaults to document.body)
     */
    function hideMatchingLines(root: ParentNode = document.body) {
      const matches = findTruckTextNodes(root)
      for (const el of matches) {
        try {
          if (!isElementInPopup(el)) continue
          // Already hidden?
          if ((el as HTMLElement).dataset.__hiddenByPopupCleaner === '1') continue

          // Choose a sensible container to hide: prefer the element itself or a
          // nearby block-level ancestor so layout inside the popup stays tidy.
          let hideTarget: HTMLElement | null = el
          for (let i = 0; i < 4 && hideTarget; i++) {
            const style = window.getComputedStyle(hideTarget)
            if (style.display === 'block' || style.display === 'flex' || style.display === 'grid') break
            hideTarget = hideTarget.parentElement
          }
          if (!hideTarget) continue

          hideTarget.style.display = 'none'
          hideTarget.dataset.__hiddenByPopupCleaner = '1'
        } catch {
          // ignore per-element errors
        }
      }
    }

    // Initial pass
    hideMatchingLines(document.body)

    // Observe for new popups / nodes being inserted
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // fast path: if nodes were added, scan the added subtree
        if (m.addedNodes && m.addedNodes.length) {
          for (const n of Array.from(m.addedNodes)) {
            // scan the node itself and its subtree
            if (n instanceof HTMLElement) {
              hideMatchingLines(n)
            }
          }
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      if (observer) observer.disconnect()
      observer = null
    }
  }, [])

  // This component renders nothing into the DOM
  return <></>
}