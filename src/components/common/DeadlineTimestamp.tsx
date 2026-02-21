/**
 * DeadlineTimestamp.tsx
 *
 * Small presentational utility that renders a deadline timestamp.
 *
 * - Renders the timestamp in a neutral (black) color by default.
 * - When the remaining time to deadline is <= 25% of the total window
 *   between pickup and deadline (or when the deadline is in the past),
 *   renders the timestamp in red to indicate urgency.
 *
 * The component intentionally keeps layout and markup minimal so it can be
 * used in lists and modals without altering page composition.
 */

import React from 'react'
import { getTimeStatus } from '../../lib/timeStatus'

/**
 * DeadlineTimestampProps
 *
 * @property date - Deadline date/time (string | number | Date)
 * @property pickupDate - Optional pickup date/time used to compute the time window
 * @property className - Optional additional classes for the outer span
 */
interface DeadlineTimestampProps {
  date: string | number | Date
  pickupDate?: string | number | Date | null
  className?: string
}

/**
 * parseToMs
 *
 * Try to parse common date formats into milliseconds. Prefers ISO. Also supports
 * `DD/MM/YYYY HH:mm:ss` and `DD/MM/YYYY` which are used in some parts of the app.
 *
 * @param v value to parse
 * @returns ms timestamp or null when parsing fails
 */
function parseToMs(v: string | number | Date | undefined | null): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.getTime()

  const s = String(v).trim()
  if (!s) return null

  // Try native parse (ISO friendly)
  const iso = Date.parse(s)
  if (!isNaN(iso)) return iso

  // Try DD/MM/YYYY [HH:mm:ss]
  const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
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

  // Last resort: attempt Date constructor
  try {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.getTime()
  } catch {
    return null
  }
}

/**
 * DeadlineTimestamp
 *
 * Renders formatted timestamp with colour based on urgency.
 *
 * @param props DeadlineTimestampProps
 * @returns JSX.Element
 */
export default function DeadlineTimestamp({ date, pickupDate, className = '' }: DeadlineTimestampProps): JSX.Element {
  const deadlineMs = parseToMs(date)
  const pickupMs = parseToMs(pickupDate ?? undefined)

  // Default to neutral when parsing failed.
  let cls = 'font-semibold text-slate-800'

  try {
    if (deadlineMs != null) {
      const status = getTimeStatus(pickupMs ?? undefined, deadlineMs, Date.now())
      // timeStatus.delivery expected values: 'ok'|'urgent'|'past' (lib may vary)
      if (status?.delivery === 'urgent' || status?.delivery === 'past') {
        cls = 'font-semibold text-rose-600'
      } else {
        cls = 'font-semibold text-slate-800'
      }
    }
  } catch {
    // keep default class when getTimeStatus throws
    cls = 'font-semibold text-slate-800'
  }

  const formatted = (() => {
    try {
      if (deadlineMs == null) return String(date)
      return new Date(deadlineMs).toLocaleDateString() + ' ' + new Date(deadlineMs).toLocaleTimeString()
    } catch {
      return String(date)
    }
  })()

  return <span className={`${cls} ${className}`.trim()}>{formatted}</span>
}
