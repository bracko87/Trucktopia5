/**
 * NotificationBell.tsx
 *
 * Small reusable notification icon button used in headers and compact user areas.
 */

import React from 'react'
import { Bell } from 'lucide-react'

/**
 * NotificationBellProps
 *
 * Props for the notification bell button.
 */
interface NotificationBellProps {
  className?: string
  /**
   * Optional click handler for the button.
   */
  onClick?: () => void
}

/**
 * NotificationBell
 *
 * Renders a simple accessible bell icon button. Styling is intentionally
 * minimal so it integrates with existing header layouts.
 */
export default function NotificationBell({ className = '', onClick }: NotificationBellProps) {
  return (
    <button
      type="button"
      aria-label="Notifications"
      title="Notifications"
      onClick={onClick}
      className={`p-1 rounded-md hover:bg-white/10 ${className}`}
    >
      <Bell className="w-5 h-5 text-white" />
    </button>
  )
}
