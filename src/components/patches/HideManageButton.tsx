/**
 * HideManageButton.tsx
 *
 * Runtime DOM patcher that hides "Manage" buttons while preserving layout.
 *
 * The component searches the document for buttons whose visible text equals
 * "Manage" or starts with "Manage " and sets style.visibility = 'hidden' so the
 * page layout and spacing remain unchanged. A MutationObserver keeps the patch
 * effective for dynamically inserted buttons.
 */

import React, { useEffect } from 'react'

/**
 * isManageButton
 *
 * Determine if a given element is a "Manage" button we should hide.
 *
 * @param el - DOM element to test
 * @returns boolean true when the element appears to be the target button
 */
function isManageButton(el: Element): boolean {
  try {
    if (!(el instanceof HTMLButtonElement)) return false

    // Use trimmed visible text as primary heuristic
    const text = (el.textContent || '').trim()

    // Exact "Manage" or starts with "Manage " (handles "Manage trucks", etc.)
    if (text === 'Manage' || text.startsWith('Manage ')) {
      return true
    }

    // Additional heuristic: class contains Tailwind yellow background used in UI
    // (keeps checks inexpensive)
    if (el.classList.contains('bg-yellow-400') && text.length > 0 && /manage/i.test(text)) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * hideButtonsOnce
 *
 * Finds target buttons and applies visibility:hidden + aria-hidden attribute.
 * Idempotent for elements already handled.
 *
 * @returns void
 */
function hideButtonsOnce(): void {
  const buttons = Array.from(document.querySelectorAll('button'))
  buttons.forEach((b) => {
    if (!isManageButton(b)) return
    const btn = b as HTMLButtonElement
    // Avoid reapplying repeatedly
    if ((btn.dataset as any)?.hiddenByHideManage === '1') return

    // Preserve layout by using visibility:hidden (keeps element size)
    btn.style.visibility = 'hidden'
    // Prevent pointer events just in case
    btn.style.pointerEvents = 'none'
    btn.setAttribute('aria-hidden', 'true')
    // Mark as handled
    ;(btn.dataset as any).hiddenByHideManage = '1'
  })
}

/**
 * HideManageButton
 *
 * React component mounted at app root. Runs a one-time pass and observes DOM
 * mutations to hide any subsequently injected "Manage" buttons without
 * affecting layout or spacing.
 *
 * @returns null
 */
export default function HideManageButton(): JSX.Element | null {
  useEffect(() => {
    // Initial pass
    hideButtonsOnce()

    // Observe DOM for additions so dynamically created buttons are also hidden
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