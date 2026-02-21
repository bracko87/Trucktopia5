/**
 * DeadlineColorPatch.tsx
 *
 * Runtime DOM patch that normalises legacy green timestamp spans across the app.
 *
 * Purpose:
 * - Some legacy code emits timestamps with the class "text-green-600".
 * - This patch observes DOM mutations and updates such elements to use the
 *   same urgency rules used by DeadlineTimestamp:
 *     - Default: neutral black (text-slate-800)
 *     - When time left <= 25% of window (or past): red (text-rose-600)
 *
 * The patch tries to parse common date formats (ISO and DD/MM/YYYY) and will
 * skip elements it cannot parse.
 *
 * This is intentionally conservative: it only updates nodes that have the
 * 'text-green-600' class and contain a parseable date string.
 */

import React, { useEffect } from 'react'
import { getTimeStatus } from '../../lib/timeStatus'

/**
 * parseDateFromString
 *
 * Attempt to parse ISO or DD/MM/YYYY[ HH:mm:ss] formats into ms.
 *
 * @param s input string
 * @returns ms timestamp or null
 */
function parseDateFromString(s: string): number | null {
  if (!s) return null
  const trimmed = s.trim()

  // Quick ISO attempt
  const iso = Date.parse(trimmed)
  if (!isNaN(iso)) return iso

  // DD/MM/YYYY [HH:mm:ss]
  const dm = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (dm) {
    const day = Number(dm[1])
    const month = Number(dm[2]) - 1
    const year = Number(dm[3])
    const hour = Number(dm[4] ?? 0)
    const minute = Number(dm[5] ?? 0)
    const second = Number(dm[6] ?? 0)
    const d = new Date(year, month, day, hour, minute, second)
    return isNaN(d.getTime()) ? null : d.getTime()
  }

  return null
}

/**
 * updateElementColor
 *
 * Given an element whose text holds a timestamp, update its classes according
 * to urgency rules.
 *
 * @param el HTMLElement
 */
function updateElementColor(el: HTMLElement) {
  try {
    const text = el.textContent ?? ''
    const ms = parseDateFromString(text)
    if (ms == null) {
      // Replace green with neutral for safety when parsing fails
      el.classList.remove('text-green-600')
      if (!el.classList.contains('text-slate-800') && !el.classList.contains('text-rose-600')) {
        el.classList.add('text-slate-800')
      }
      return
    }

    // Use delivery-only status (no pickup)
    const status = getTimeStatus(undefined, ms, Date.now())
    if (status?.delivery === 'urgent' || status?.delivery === 'past') {
      el.classList.remove('text-green-600', 'text-slate-800')
      el.classList.add('text-rose-600')
    } else {
      el.classList.remove('text-green-600', 'text-rose-600')
      el.classList.add('text-slate-800')
    }
  } catch {
    // Best-effort; do nothing on errors
  }
}

/**
 * scanAndFix
 *
 * Find candidate nodes with text-green-600 and try to update them.
 */
function scanAndFix(root: Document | Element = document) {
  try {
    const els = Array.from(root.querySelectorAll('.text-green-600')) as HTMLElement[]
    els.forEach((el) => {
      // Only handle simple inline spans / elements
      if (el.children.length > 0) return
      updateElementColor(el)
    })
  } catch {
    // ignore
  }
}

/**
 * DeadlineColorPatch
 *
 * Mounts a MutationObserver that scans for newly added nodes matching the
 * legacy class and normalises them immediately.
 */
export default function DeadlineColorPatch(): JSX.Element | null {
  useEffect(() => {
    // Initial scan
    scanAndFix(document)

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach((n) => {
            if (!(n instanceof Element)) return
            // Direct candidates
            if (n.classList && n.classList.contains('text-green-600')) {
              updateElementColor(n as HTMLElement)
            }
            // Descendents
            scanAndFix(n)
          })
        } else if (m.type === 'attributes' && m.target instanceof Element) {
          const el = m.target as Element
          if (el.classList.contains('text-green-600')) {
            updateElementColor(el as HTMLElement)
          }
        }
      }
    })

    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: false,
    })

    return () => mo.disconnect()
  }, [])

  return null
}
