/**
 * RemoveAssemblerBox.tsx
 *
 * Small runtime DOM patcher that removes a specific "assembler" summary box injected
 * by legacy UI code. This avoids editing many components when a single unwanted
 * element must be removed quickly.
 */

import React, { useEffect } from 'react'

/**
 * RemoveAssemblerBox
 *
 * Searches the DOM for an <aside> element that contains the exact help text
 * "Drag rows from lists onto the assembler below to assign assets." and removes it.
 * Also installs a MutationObserver to remove the element if it is injected later.
 *
 * This component renders nothing visible.
 */
export default function RemoveAssemblerBox(): JSX.Element | null {
  useEffect(() => {
    /**
     * removeMatchingAsides
     *
     * Finds aside elements with the target text and removes them from the DOM.
     */
    function removeMatchingAsides() {
      const targetText = 'Drag rows from lists onto the assembler below to assign assets.'
      const asides = Array.from(document.querySelectorAll('aside'))
      asides.forEach((a) => {
        try {
          if (a.textContent && a.textContent.includes(targetText)) {
            a.remove()
          }
        } catch {
          // ignore DOM access errors
        }
      })
    }

    // Initial removal attempt
    removeMatchingAsides()

    // Observe the body for new nodes (handles later injections)
    const observer = new MutationObserver(() => {
      removeMatchingAsides()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
    }
  }, [])

  return null
}
