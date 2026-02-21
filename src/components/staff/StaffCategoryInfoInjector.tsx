/**
 * StaffCategoryInfoInjector.tsx
 *
 * Non-invasive injector that mounts a per-category info panel on the Staff
 * (and HiredStaff) pages. The injector watches for navigation and DOM
 * mutations and inserts the panel right after the category buttons row.
 *
 * This file intentionally avoids touching existing layout styles and only
 * mounts when the current route looks like the Staff pages.
 */

import React, { useEffect, useState } from 'react'
import { createRoot, Root } from 'react-dom/client'
import StaffCategoryInfo from './StaffCategoryInfo'

/**
 * Known staff category names used to detect category buttons in the DOM.
 */
const CATEGORY_NAMES = ['drivers', 'mechanics', 'dispatchers', 'managers', 'directors']

/**
 * findCategoryButtonContainer
 *
 * Try to locate the DOM element that contains the category buttons.
 *
 * @returns Element or null
 */
function findCategoryButtonContainer(): Element | null {
  // Look for a container that has several buttons and at least two that look like categories.
  const candidates = Array.from(document.querySelectorAll('div, nav, section'))
  for (const el of candidates) {
    try {
      const btns = Array.from(el.querySelectorAll('button'))
      if (btns.length < 2) continue
      const matches = btns.filter((b) => {
        const t = (b.textContent || '').toLowerCase()
        // strip counts like "Drivers (5)" by checking prefixes
        const cleaned = t.split('(')[0].trim()
        return CATEGORY_NAMES.some((cn) => cleaned.includes(cn))
      })
      if (matches.length >= 2) return el
    } catch {
      // ignore potential cross-origin or read errors
    }
  }

  // Fallback: any direct div with many buttons
  const divs = Array.from(document.querySelectorAll('div'))
  for (const d of divs) {
    try {
      const btns = Array.from(d.querySelectorAll('button'))
      if (btns.length >= 3) {
        const matches = btns.filter((b) => {
          const t = (b.textContent || '').toLowerCase()
          const cleaned = t.split('(')[0].trim()
          return CATEGORY_NAMES.some((cn) => cleaned.includes(cn))
        })
        if (matches.length >= 2) return d
      }
    } catch {
      // ignore
    }
  }

  return null
}

/**
 * readActiveCategoryFromButtons
 *
 * Inspect buttons to determine the currently active category.
 *
 * @param parent parent element containing the buttons
 * @returns active category key (e.g. 'drivers')
 */
function readActiveCategoryFromButtons(parent: Element): string {
  const btns = Array.from(parent.querySelectorAll('button'))
  if (btns.length === 0) return 'drivers'
  const active =
    btns.find((b) => b.getAttribute('aria-pressed') === 'true') ||
    btns.find((b) => (b.className || '').includes('bg-slate-900')) ||
    btns.find((b) => (b.className || '').includes('active')) ||
    btns[0]

  const txt = active && active.textContent ? active.textContent.split('(')[0].trim() : 'Drivers'
  return txt.toLowerCase()
}

/**
 * MountedPanel
 *
 * Internal component rendered into the injected node. Listens for clicks &
 * mutations on the original button parent and updates shown category.
 *
 * @param props.parentElement DOM element that contains the category buttons
 * @param props.initialCategory initial category to render
 */
function MountedPanel({ parentElement, initialCategory }: { parentElement: Element; initialCategory: string }) {
  const [category, setCategory] = useState(initialCategory)

  useEffect(() => {
    /**
     * handleClick
     *
     * Update category when a button inside the parentElement is clicked.
     */
    function handleClick(e: Event) {
      const target = e.target as HTMLElement | null
      if (!target) return
      const btn = target.closest('button')
      if (btn && parentElement.contains(btn)) {
        const text = (btn.textContent || '').split('(')[0].trim()
        if (text) setCategory(text.toLowerCase())
      } else {
        const newCat = readActiveCategoryFromButtons(parentElement)
        if (newCat && newCat !== category) setCategory(newCat)
      }
    }

    const mo = new MutationObserver(() => {
      const newCat = readActiveCategoryFromButtons(parentElement)
      if (newCat && newCat !== category) setCategory(newCat)
    })

    parentElement.addEventListener('click', handleClick, true)
    mo.observe(parentElement, { attributes: true, subtree: true, childList: true })

    return () => {
      parentElement.removeEventListener('click', handleClick, true)
      mo.disconnect()
    }
  }, [parentElement, category])

  return (
    <div style={{ pointerEvents: 'auto' }}>
      <StaffCategoryInfo category={category} />
    </div>
  )
}

/**
 * StaffCategoryInfoInjector
 *
 * Mounts a StaffCategoryInfo into an injected DOM node placed after the
 * category button container. Only attempts to mount when the current route
 * looks like Staff screens (hash includes '/staff' or '/hired-staff').
 *
 * Returns null for render inside React tree.
 */
export default function StaffCategoryInfoInjector(): JSX.Element | null {
  useEffect(() => {
    let root: Root | null = null
    let containerEl: HTMLElement | null = null
    let observer: MutationObserver | null = null
    let retryInterval: number | null = null
    let mounted = false

    /**
     * shouldMountOnThisRoute
     *
     * Decide whether injector should attempt mounting based on current URL.
     *
     * @returns boolean
     */
    function shouldMountOnThisRoute(): boolean {
      const hash = (window.location.hash || '').toLowerCase()
      const path = (window.location.pathname || '').toLowerCase()
      return hash.includes('/staff') || hash.includes('/hired-staff') || path.endsWith('/staff') || path.includes('/hired-staff')
    }

    /**
     * attemptMount
     *
     * Try to find the button container and mount the panel. Returns true if
     * mounting succeeded.
     */
    function attemptMount(): boolean {
      if (!shouldMountOnThisRoute()) return false

      const parent = findCategoryButtonContainer()
      if (!parent) return false

      try {
        containerEl = document.createElement('div')
        containerEl.setAttribute('data-staff-category-info', '1')
        // keep spacing consistent with surrounding content
        containerEl.className = 'mt-4'
        parent.parentElement?.insertBefore(containerEl, parent.nextSibling ?? null)
        root = createRoot(containerEl)

        const initial = readActiveCategoryFromButtons(parent)
        root.render(<MountedPanel parentElement={parent} initialCategory={initial} />)
        mounted = true
        return true
      } catch (err) {
        // mount failed
        return false
      }
    }

    // Try immediate mount, otherwise watch for changes
    if (!attemptMount()) {
      // Observe DOM changes and hash navigation to retry mount when appropriate
      observer = new MutationObserver(() => {
        if (!mounted) attemptMount()
      })
      observer.observe(document.body, { childList: true, subtree: true })

      window.addEventListener('hashchange', () => {
        if (!mounted) attemptMount()
      })

      // Also perform a few periodic retries for slower renderers
      retryInterval = window.setInterval(() => {
        if (mounted) {
          if (retryInterval) {
            clearInterval(retryInterval)
            retryInterval = null
          }
        } else {
          attemptMount()
        }
      }, 300)
    }

    // cleanup
    return () => {
      try {
        if (root) root.unmount()
      } catch {
        // ignore
      }
      if (containerEl && containerEl.parentElement) containerEl.parentElement.removeChild(containerEl)
      if (observer) observer.disconnect()
      if (retryInterval) clearInterval(retryInterval)
    }
  }, [])

  return null
}