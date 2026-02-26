import React from 'react'
import { Bell } from 'lucide-react'

export interface NotificationBellProps {
  unreadCount?: number
  onClick?: () => void
}

export default function NotificationBell({
  unreadCount = 0,
  onClick,
}: NotificationBellProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label="Notifications"
      title="Notifications"
      className="relative p-1 rounded-md hover:bg-white/10"
      onClick={onClick}
    >
      <Bell className="w-5 h-5 text-white" aria-hidden="true" />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium leading-none text-white bg-red-500 rounded-full"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </button>
  )
}