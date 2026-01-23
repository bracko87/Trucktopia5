/**
 * CountdownTimer.tsx
 *
 * Reusable countdown timer component that counts down to a specified pickup time.
 * When the countdown reaches zero the component displays "Ready for pick up" by default.
 * Adds optional props to hide ready text or hide the entire component when empty.
 */

import React, { useEffect, useState } from 'react'

/**
 * CountdownTimerProps
 *
 * Props for the CountdownTimer component.
 */
export interface CountdownTimerProps {
  /** ISO date/time string for the pickup moment */
  pickupTime?: string | null
  /** Optional className for styling the wrapper */
  className?: string
  /**
   * When false, do not display the "Ready for pick up" text when countdown reaches zero.
   * Instead a subtle placeholder (—) is shown. Defaults to true.
   */
  showReadyText?: boolean
  /**
   * When true hide the entire component when no valid countdown exists
   * (missing pickupTime or countdown reached zero and showReadyText === false).
   * Defaults to false.
   */
  hideWhenEmpty?: boolean
}

/**
 * formatRemaining
 *
 * Format a number of remaining seconds into a compact human-friendly string.
 *
 * @param seconds - remaining seconds
 * @returns formatted string like "1d 02:03:04" or "02:03:04"
 */
function formatRemaining(seconds: number) {
  if (seconds <= 0) return '00:00:00'
  const days = Math.floor(seconds / 86400)
  seconds %= 86400
  const hours = Math.floor(seconds / 3600)
  seconds %= 3600
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  const hh = String(hours).padStart(2, '0')
  const mm = String(mins).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')

  if (days > 0) return `${days}d ${hh}:${mm}:${ss}`
  return `${hh}:${mm}:${ss}`
}

/**
 * CountdownTimer
 *
 * Renders a live-updating countdown to pickupTime. If pickupTime is missing
 * it renders a subtle placeholder (unless hideWhenEmpty is true).
 * When time is up it displays "Ready for pick up" unless showReadyText is false
 * (in which case it shows the placeholder or nothing if hideWhenEmpty is true).
 *
 * @param props - CountdownTimerProps
 * @returns JSX.Element | null
 */
export default function CountdownTimer({
  pickupTime,
  className = '',
  showReadyText = true,
  hideWhenEmpty = false,
}: CountdownTimerProps): JSX.Element | null {
  const [remainingSec, setRemainingSec] = useState<number | null>(null)

  useEffect(() => {
    if (!pickupTime) {
      setRemainingSec(null)
      return
    }

    const target = new Date(pickupTime).getTime()
    if (Number.isNaN(target)) {
      setRemainingSec(null)
      return
    }

    function update() {
      const now = Date.now()
      const diff = Math.max(0, Math.floor((target - now) / 1000))
      setRemainingSec(diff)
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [pickupTime])

  const baseClass = className ? `${className} ` : ''

  // No valid countdown -> either render placeholder or nothing if hideWhenEmpty
  if (!pickupTime || remainingSec === null) {
    if (hideWhenEmpty) return null
    return (
      <div className={baseClass + 'text-sm text-slate-500'} aria-live="polite">
        —
      </div>
    )
  }

  // Countdown reached zero
  if (remainingSec <= 0) {
    if (!showReadyText) {
      if (hideWhenEmpty) return null
      return (
        <div className={baseClass + 'text-sm text-slate-500'} aria-live="polite">
          —
        </div>
      )
    }
    return (
      <div className={baseClass + 'text-sm font-medium text-emerald-600'} aria-live="polite">
        Ready for pick up
      </div>
    )
  }

  // Active countdown
  return (
    <div className={baseClass + 'text-sm font-medium text-slate-700'} aria-live="polite">
      Pickup in {formatRemaining(remainingSec)}
    </div>
  )
}