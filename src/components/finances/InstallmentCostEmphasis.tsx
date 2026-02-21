/**
 * InstallmentCostEmphasis.tsx
 *
 * Global DOM patcher that finds UI lines mentioning "installments" with a USD amount
 * (e.g. "56 installments left • US$720.00 each") and emphasizes the monetary amount
 * by wrapping it with a bold, colored span. This component is intentionally non-UI
 * (returns null) and uses a MutationObserver for dynamic content.
 */

import React from 'react'

/**
 * Regex used to detect US dollar amounts like "US$720.00" or "US$ 1,234.56".
 * Accepts optional space, commas and decimals.
 */
const USD_REGEX = /US\$\s*\d{1,3}(?:[,\d]*)(?:\.\d+)?/i

/**
 * Data attribute used to mark already-emphasized spans to avoid double-wrapping.
 */
const MARKER_ATTR = 'data-installment-emphasized'

/**
 * InstallmentCostEmphasis
 *
 * A lightweight DOM patcher that emphasizes the installment cost text found in
 * existing DOM nodes. It scans nodes containing the word "installments" and a
 * USD amount, then replaces the matched text with a styled span.
 *
 * Visual effect: font-semibold + emerald color (Tailwind classes) so layout is unchanged.
 *
 * Note: This component performs DOM manipulations directly and should be mounted
 * once at the app root. It avoids touching nodes that already contain our marker.
 *
 * @returns null (no direct JSX rendered)
 */
export default function InstallmentCostEmphasis(): JSX.Element | null {
  React.useEffect(() => {
    if (typeof document === 'undefined') return

    /**
     * highlightInTextNode
     *
     * Replaces the first USD match in the provided Text node by inserting a span
     * with visual emphasis. Multiple matches in the same text node are not processed
     * in the same pass (safe enough for our UI lines).
     *
     * @param node Text node to process
     */
    function highlightInTextNode(node: Text) {
      const text = node.nodeValue
      if (!text) return

      const match = USD_REGEX.exec(text)
      if (!match) return

      const matchText = match[0]
      // Skip if already wrapped by our marker (parent node might contain it)
      if (node.parentElement?.querySelector(`[${MARKER_ATTR}]`)) return

      const before = text.slice(0, match.index)
      const after = text.slice(match.index + matchText.length)

      const frag = document.createDocumentFragment()
      if (before.length > 0) frag.appendChild(document.createTextNode(before))

      // Create emphasizing span (Tailwind classes — preinstalled)
      const span = document.createElement('span')
      span.setAttribute(MARKER_ATTR, '1')
      span.className = 'font-semibold text-emerald-600'
      span.textContent = matchText
      frag.appendChild(span)

      if (after.length > 0) frag.appendChild(document.createTextNode(after))

      node.parentNode?.replaceChild(frag, node)
    }

    /**
     * scanElementForInstallments
     *
     * Looks for leaf elements (no child elements) that contain the word "installments"
     * (to reduce false positives) and a USD amount, then processes their text nodes.
     *
     * @param root Root element to scan
     */
    function scanElementForInstallments(root: Element | Document = document) {
      try {
        const candidates = Array.from(root.querySelectorAll('*')).filter((el) => {
          // Only leaf-ish nodes (no element children) are targeted to reduce risk
          if (el.querySelector(':scope > *')) return false
          const txt = el.textContent || ''
          return /installments/i.test(txt) && USD_REGEX.test(txt)
        })

        for (const el of candidates) {
          // Walk text nodes inside the candidate element
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
          let t: Node | null = walker.nextNode()
          while (t) {
            highlightInTextNode(t as Text)
            t = walker.nextNode()
          }
        }
      } catch (e) {
        // Defensive: do not throw in production UI
        // eslint-disable-next-line no-console
        console.warn('InstallmentCostEmphasis scan error', e)
      }
    }

    // Initial scan
    scanElementForInstallments(document)

    // Debounced scanner for mutations
    let debounceTimer: number | null = null
    function debouncedScan() {
      if (debounceTimer) {
        window.clearTimeout(debounceTimer)
      }
      // small debounce to batch frequent mutations
      debounceTimer = window.setTimeout(() => {
        scanElementForInstallments(document)
        debounceTimer = null
      }, 120)
    }

    // Observe dynamic changes so the patch works for content inserted later
    const observer = new MutationObserver((mutations) => {
      // Quick heuristic: only trigger a scan when text/children change
      for (const m of mutations) {
        if (m.type === 'characterData' || m.type === 'childList' || m.type === 'subtree') {
          debouncedScan()
          break
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    // Cleanup on unmount
    return () => {
      observer.disconnect()
      if (debounceTimer) {
        window.clearTimeout(debounceTimer)
      }
    }
  }, [])

  // This component intentionally renders nothing — it patches existing DOM.
  return null
}
