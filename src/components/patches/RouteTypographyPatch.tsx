/**
 * RouteTypographyPatch.tsx
 *
 * Runtime DOM patch that upgrades the visual presentation of small route rows.
 * It finds elements that match the older compact route row classes and upgrades
 * their typography and flag sizes to the recommended values.
 *
 * This is implemented as a non-invasive DOM patch so we don't need to edit many
 * scattered components where the route row is rendered.
 */

import React, { useEffect } from 'react'

/**
 * applyPatchToNode
 *
 * Update a single DOM node: swap text-sm -> text-base + font-medium and
 * increase any flag child classes from w-4/h-4 to w-5/h-5.
 *
 * @param node - Element to patch
 */
function applyPatchToNode(node: Element) {
  try {
    const el = node as HTMLElement

    // Only patch nodes that still have the compact class
    if (el.classList.contains('text-sm')) {
      el.classList.remove('text-sm')
      el.classList.add('text-base', 'font-medium')
    }

    // Adjust flag size classes on children (safe string replace)
    el.querySelectorAll('*').forEach((child) => {
      const c = child as HTMLElement
      if (!c.className) return
      // Replace w-4 -> w-5 and h-4 -> h-5 while preserving other classes
      let cn = c.className
      cn = cn.replace(/\bw-4\b/g, 'w-5')
      cn = cn.replace(/\bh-4\b/g, 'h-5')
      if (cn !== c.className) {
        c.className = cn
      }
    })
  } catch (err) {
    // Defensive: don't crash UI
    // eslint-disable-next-line no-console
    console.debug('[RouteTypographyPatch] patch error', err)
  }
}

/**
 * RouteTypographyPatch
 *
 * Mounts a MutationObserver that upgrades route rows matching the legacy
 * compact style to a slightly larger, more readable presentation.
 *
 * This keeps visual hierarchy consistent without modifying many source files.
 */
export default function RouteTypographyPatch(): JSX.Element | null {
  useEffect(() => {
    // Initial scan selector matches the pattern used across the codebase:
    // a compact inline row with flags and small text: 'flex items-center gap-2 text-sm'
    const selector = '.flex.items-center.gap-2.text-sm'

    // Patch currently present nodes
    document.querySelectorAll(selector).forEach((n) => applyPatchToNode(n))

    // Observe DOM changes to catch newly-mounted route rows
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (!m.addedNodes) continue
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return
          // If the added node itself matches, patch it
          if (node.matches && node.matches(selector)) {
            applyPatchToNode(node)
          }
          // Also patch any matching descendants
          node.querySelectorAll && node.querySelectorAll(selector).forEach((n) => applyPatchToNode(n))
        })
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
    }
  }, [])

  // This component has no visual output
  return null
}
