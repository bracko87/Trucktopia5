/**
 * OpenAbortModalListener.tsx
 *
 * Document-level click delegator that listens for legacy "Return to Hub" buttons
 * (or similarly labelled buttons) and opens the AbortJobModal by dispatching the
 * global 'openAbortModal' event with a best-effort assignmentId.
 *
 * This keeps integration non-invasive for legacy UI elements that cannot be
 * changed directly.
 */

import React, { useEffect } from 'react'

/**
 * OpenAbortModalListener
 *
 * Adds a single delegated click handler on document to detect clicks on nodes
 * that look like a "Return to Hub" or "Abort Job" control and emits the
 * 'openAbortModal' CustomEvent with an optional assignmentId.
 *
 * @returns null (no DOM)
 */
export default function OpenAbortModalListener(): null {
  useEffect(() => {
    /**
     * findAssignmentId
     *
     * Try to resolve an assignment id from a clicked node by checking common
     * data- attributes on the element and its ancestors.
     *
     * @param el - starting HTMLElement
     * @returns string | null
     */
    function findAssignmentId(el: HTMLElement | null): string | null {
      while (el) {
        const attrs = ['data-assignment-id', 'data-assignment', 'data-id', 'data-assignmentid']
        for (const a of attrs) {
          const v = el.getAttribute?.(a)
          if (v) return v
        }
        el = el.parentElement
      }
      return null
    }

    /**
     * handler
     *
     * Delegated click handler. If the clicked element or its ancestor is a
     * button-like control whose trimmed text contains "Return to Hub" or
     * "Abort Job", dispatch the openAbortModal event.
     *
     * This intentionally uses text detection to support legacy markup.
     *
     * @param ev MouseEvent
     */
    function handler(ev: MouseEvent) {
      const target = ev.target as HTMLElement | null
      if (!target) return

      // Accept <button>, <a>, or any clickable element
      let el: HTMLElement | null = target.closest('button, a, [role="button"], .btn, .button') as HTMLElement | null
      if (!el) el = target as HTMLElement

      const text = (el.textContent || '').trim().toLowerCase()
      const triggers = ['return to hub', 'abort job', 'return to trucks', 'return to hub ›', 'return to hub >']
      const isTrigger = triggers.some((t) => text.includes(t))

      if (!isTrigger) return

      const assignmentId = findAssignmentId(el)
      try {
        window.dispatchEvent(
          new CustomEvent('openAbortModal', {
            detail: { assignmentId: assignmentId ?? null },
          }),
        )
      } catch {
        // ignore in non-browser or strict CSP contexts
      }
    }

    document.addEventListener('click', handler, true)
    return () => {
      document.removeEventListener('click', handler, true)
    }
  }, [])

  return null
}