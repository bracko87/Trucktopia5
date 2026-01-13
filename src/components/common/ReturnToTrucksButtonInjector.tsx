/**
 * ReturnToTrucksButtonInjector.tsx
 *
 * Runtime helper that locates any button whose visible text is "Filter options"
 * (robust against nested icons/elements) and:
 * - updates visible label to "Return to Trucks Page"
 * - sets aria-label for accessibility
 * - attaches a click handler that navigates to the trucks route using hash navigation
 *
 * The component is idempotent, marks processed buttons with a data attribute to avoid
 * duplicate listeners and observes DOM mutations to handle dynamically rendered buttons.
 */

import React, { useEffect } from 'react'

/**
 * ReturnToTrucksButtonInjector
 *
 * Finds buttons with visible label "Filter options" (case-insensitive) and:
 * - replaces that exact visible text with "Return to Trucks Page"
 * - sets aria-label and data marker
 * - attaches a click handler to navigate to "#/trucks"
 *
 * The component does not render DOM itself.
 *
 * @returns JSX.Element | null
 */
export default function ReturnToTrucksButtonInjector(): JSX.Element | null {
  useEffect(() => {
    const processedAttr = 'data-return-to-trucks'
    const handlers = new WeakMap<Element, EventListener>()

    /**
     * isFilterOptionsText
     *
     * Determine whether a node's visible text matches "Filter options".
     *
     * @param text - visible text to check
     * @returns boolean
     */
    function isFilterOptionsText(text?: string | null) {
      if (!text) return false
      const t = text.trim().toLowerCase()
      return t === 'filter options' || t === 'filter options' // exact match preserved for clarity
    }

    /**
     * replaceVisibleTextInButton
     *
     * Replace the first text node inside a button that matches "Filter options" while
     * preserving other child nodes (icons, wrappers).
     *
     * @param btn - target HTMLButtonElement
     * @returns boolean - true if replacement occurred
     */
    function replaceVisibleTextInButton(btn: HTMLButtonElement): boolean {
      // Try to find a direct text node to replace
      for (const node of Array.from(btn.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent ?? ''
          if (isFilterOptionsText(text)) {
            node.textContent = text.replace(/filter options/i, 'Return to Trucks Page')
            return true
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Also check element's innerText (for wrappers)
          const el = node as HTMLElement
          const txt = (el.innerText || '').trim()
          if (isFilterOptionsText(txt)) {
            // If wrapper only contains that text, replace its innerText
            el.innerText = el.innerText.replace(/filter options/i, 'Return to Trucks Page')
            return true
          }
        }
      }

      // Fallback: if no individual text node found but the button's innerText matches,
      // replace the whole visible text while preserving child elements by updating textContent.
      if (isFilterOptionsText(btn.innerText)) {
        // Remove existing child text nodes and append a single text node with new label.
        // This preserves element children order but may normalize spacing.
        btn.childNodes.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) n.textContent = ''
        })
        // Append a text node at the end (safe fallback)
        btn.appendChild(document.createTextNode('Return to Trucks Page'))
        return true
      }

      return false
    }

    /**
     * processButton
     *
     * If the provided element is a button with the expected label and not processed yet,
     * rename it and attach the navigation handler.
     *
     * @param el - Element to inspect
     */
    function processButton(el: Element) {
      if (!(el instanceof HTMLButtonElement)) return
      try {
        if (el.getAttribute(processedAttr) === '1') return

        const visible = (el.innerText || '').trim()
        if (!visible) return

        if (!/filter options/i.test(visible)) return

        // Replace visible text while preserving layout/icons
        replaceVisibleTextInButton(el)

        el.setAttribute('aria-label', 'Return to Trucks Page')
        el.setAttribute(processedAttr, '1')

        const handler = (e: Event) => {
          e.preventDefault()
          // HashRouter uses hash navigation; set hash to trucks route.
          // Using replaceState would not add history; we prefer simple navigation so user can go back.
          if (window.location.hash !== '#/trucks') {
            window.location.hash = '#/trucks'
          }
        }
        handlers.set(el, handler)
        el.addEventListener('click', handler)
      } catch {
        // ignore individual failures
      }
    }

    /**
     * scanExistingButtons
     *
     * Scan the current DOM for matching buttons and process them.
     */
    function scanExistingButtons() {
      const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      btns.forEach((b) => processButton(b))
    }

    // Initial scan
    scanExistingButtons()

    // Observe DOM mutations to catch buttons rendered after mount
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // handle added nodes
        if (m.addedNodes && m.addedNodes.length > 0) {
          m.addedNodes.forEach((n) => {
            if (n.nodeType !== Node.ELEMENT_NODE) return
            const el = n as Element
            // If the added node itself is a button, process it
            if (el.tagName.toLowerCase() === 'button') processButton(el)
            // Also find any buttons inside the added subtree
            const inner = Array.from(el.querySelectorAll('button'))
            inner.forEach((b) => processButton(b))
          })
        }
        // handle characterData changes (text node changes)
        if (m.type === 'characterData' && m.target && m.target.parentElement) {
          const parent = m.target.parentElement
          if (parent.tagName.toLowerCase() === 'button') processButton(parent)
        }
        // attributes changes might update text via aria-label etc - re-scan target
        if (m.type === 'attributes' && m.target && m.target instanceof Element) {
          const t = m.target as Element
          if (t.tagName.toLowerCase() === 'button') processButton(t)
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true })

    // Cleanup: remove listeners and disconnect observer
    return () => {
      try {
        // Remove attached handlers
        const btns = Array.from(document.querySelectorAll('[data-return-to-trucks="1"]'))
        btns.forEach((b) => {
          const h = handlers.get(b)
          if (h) b.removeEventListener('click', h)
          try {
            b.removeAttribute(processedAttr)
          } catch {
            // noop
          }
        })
      } catch {
        // noop
      }
      observer.disconnect()
    }
  }, [])

  // Do not render any DOM
  return null
}