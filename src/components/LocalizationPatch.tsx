/**
 * LocalizationPatch.tsx
 *
 * Runtime UI text replacer used to change small display strings without editing many files.
 *
 * This component scans visible text nodes and replaces exact matches of "Market"
 * with "Job Market". It avoids replacing text inside code/pre/script/style elements
 * and continues to watch the DOM for dynamic updates.
 */

import React, { useEffect } from 'react'

/**
 * isIgnorableNode
 *
 * Determine whether a node is inside an element where we should not modify text.
 *
 * @param node - DOM node to check
 * @returns boolean indicating if the node should be ignored
 */
function isIgnorableNode(node: Node | null): boolean {
  if (!node || !node.parentElement) return false
  const ignorableTags = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'])
  let el: HTMLElement | null = node.parentElement
  while (el) {
    if (ignorableTags.has(el.tagName)) return true
    el = el.parentElement
  }
  return false
}

/**
 * replaceExactTextNodes
 *
 * Walk the DOM subtree and replace text nodes whose trimmed content exactly
 * matches the source string. Replacement preserves surrounding whitespace.
 *
 * @param root - root node to scan
 * @param from - exact source text to match (trimmed)
 * @param to - replacement text
 */
function replaceExactTextNodes(root: Node, from: string, to: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  const matches: Text[] = []

  let n = walker.nextNode()
  while (n) {
    const textNode = n as Text
    const raw = textNode.nodeValue ?? ''
    // preserve leading/trailing whitespace while comparing trimmed content
    const leading = raw.match(/^\s*/)?.[0] ?? ''
    const trailing = raw.match(/\s*$/)?.[0] ?? ''
    const trimmed = raw.trim()
    if (trimmed === from && !isIgnorableNode(textNode)) {
      matches.push(textNode)
    }
    n = walker.nextNode()
  }

  for (const t of matches) {
    const raw = t.nodeValue ?? ''
    const leading = raw.match(/^\s*/)?.[0] ?? ''
    const trailing = raw.match(/\s*$/)?.[0] ?? ''
    t.nodeValue = `${leading}${to}${trailing}`
  }
}

/**
 * LocalizationPatch
 *
 * React component that performs a tiny runtime string replacement ("Market" -> "Job Market")
 * across visible text nodes and keeps observing the DOM for changes.
 *
 * Mount this once at app root.
 */
export default function LocalizationPatch(): JSX.Element | null {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const runReplace = () => {
      try {
        replaceExactTextNodes(document.body, 'Market', 'Job Market')
      } catch (err) {
        // swallow errors to avoid breaking the app UI
        // eslint-disable-next-line no-console
        console.error('LocalizationPatch error', err)
      }
    }

    // initial pass
    runReplace()

    // observe for dynamic updates
    const obs = new MutationObserver((mutations) => {
      // For small apps it's fine to re-run a full pass; keep simple and robust.
      runReplace()
    })

    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => obs.disconnect()
  }, [])

  return null
}