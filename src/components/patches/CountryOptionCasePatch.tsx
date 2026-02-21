/**
 * CountryOptionCasePatch.tsx
 *
 * Small runtime DOM patch:
 * - Normalizes fully-uppercase country option labels (e.g. "SERBIA" → "Serbia").
 * - Removes duplicate country options after normalization, preferring the one
 *   that was already correctly cased (so the former ALL-CAPS entry is dropped).
 *
 * Layout and component structure are not changed; only <option> text and
 * duplicates are adjusted at runtime.
 */

import React, { useEffect } from 'react'

/**
 * titleCase
 *
 * Convert a string like "SAUDI ARABIA" or "serbia" to "Saudi Arabia" / "Serbia".
 * Keeps spaces and basic word boundaries; designed for country names.
 *
 * @param value - raw country label
 * @returns title-cased country label
 */
function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

/**
 * isCountrySelect
 *
 * Heuristic to decide if a <select> element is the country dropdown.
 * We only touch selects that clearly look like country pickers to avoid
 * altering unrelated lists.
 *
 * @param el - select element
 * @returns boolean
 */
function isCountrySelect(el: HTMLSelectElement): boolean {
  const labelish =
    (el.getAttribute('aria-label') || '') +
    ' ' +
    (el.name || '') +
    ' ' +
    (el.id || '')

  if (labelish.toLowerCase().includes('country')) {
    return true
  }

  const prev = el.previousElementSibling
  if (prev && prev.textContent && prev.textContent.toLowerCase().includes('country')) {
    return true
  }

  return false
}

/**
 * normaliseCountryOptions
 *
 * Performs two passes on each detected country <select>:
 * 1. Turn ALL-CAPS country labels into title case and mark them with
 *    data-was-allcaps="1".
 * 2. Remove duplicate options by label, preferring the option that was not
 *    originally ALL-CAPS. This ensures the old problematic "SERBIA" entry is
 *    removed if a normal "Serbia" already exists.
 *
 * @param root - document or container to search within
 */
function normaliseCountryOptions(root: Document | HTMLElement): void {
  const selects = root.querySelectorAll('select')

  selects.forEach((node) => {
    const select = node as HTMLSelectElement
    if (!isCountrySelect(select)) {
      return
    }

    const options = Array.from(select.querySelectorAll('option'))
    const seenByLabel = new Map<string, HTMLOptionElement>()
    const toRemove: HTMLOptionElement[] = []

    options.forEach((opt) => {
      const rawText = (opt.textContent || '').trim()
      if (!rawText) return

      const hasLowercase = /[a-z]/.test(rawText)
      const hasLetters = /[A-Za-z]/.test(rawText)

      const isAllCapsCountry =
        !hasLowercase && hasLetters && rawText.length >= 3

      if (isAllCapsCountry) {
        const normalized = titleCase(rawText)
        opt.textContent = normalized
        opt.setAttribute('data-was-allcaps', '1')
      }

      const finalText = (opt.textContent || '').trim()
      if (!finalText) return

      const existing = seenByLabel.get(finalText)
      if (!existing) {
        seenByLabel.set(finalText, opt)
        return
      }

      const existingWasAllCaps = existing.getAttribute('data-was-allcaps') === '1'
      const currentWasAllCaps = opt.getAttribute('data-was-allcaps') === '1'

      // Prefer the non-allcaps option when duplicates exist.
      if (existingWasAllCaps && !currentWasAllCaps) {
        toRemove.push(existing)
        seenByLabel.set(finalText, opt)
      } else {
        toRemove.push(opt)
      }
    })

    toRemove.forEach((opt) => {
      if (opt.parentElement === select) {
        select.removeChild(opt)
      }
    })
  })
}

/**
 * CountryOptionCasePatch
 *
 * React component that installs a MutationObserver and runs the normalization
 * whenever the DOM changes. It returns null and does not affect layout.
 *
 * @returns null
 */
export default function CountryOptionCasePatch(): JSX.Element | null {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    // Initial run once the component mounts.
    normaliseCountryOptions(document)

    const observer = new MutationObserver(() => {
      // Re-run normalization whenever new nodes (like dropdowns) are added.
      normaliseCountryOptions(document)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [])

  return null
}