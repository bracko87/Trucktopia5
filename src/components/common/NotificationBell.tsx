/**
 * NotificationBell.tsx
 *
 * Renders the notification bell button and opens a small popup window with the
 * app's inbox when clicked.
 *
 * Behavior:
 * - Calls onClick (if provided) so callers can mark notifications read.
 * - Opens a centered popup pointing to the SPA inbox route (#/settings/inbox).
 * - Falls back to in-window navigation if popup is blocked.
 */

import React from 'react'
import { Bell } from 'lucide-react'

/**
 * NotificationBellProps
 *
 * Props for NotificationBell component.
 */
export interface NotificationBellProps {
  /** Number of unread notifications (display only) */
  unreadCount?: number
  /** Optional click handler (e.g. mark as read) */
  onClick?: () => void
}

/**
 * centerPopup
 *
 * Open a centered popup window with the provided URL and features.
 *
 * @param url window URL to open
 * @param name popup name
 * @param width popup width in px
 * @param height popup height in px
 * @returns Window | null reference to opened window
 */
function centerPopup(url: string, name = 'notifications', width = 420, height = 720): Window | null {
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2)
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2)
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    'toolbar=no',
    'menubar=no',
    'location=no',
    'status=no',
    'scrollbars=yes',
    'resizable=yes',
  ].join(',')

  try {
    const win = window.open(url, name, features)
    if (win) {
      win.focus?.()
    }
    return win
  } catch (err) {
    // popup blocked or other error
    return null
  }
}

/**
 * NotificationBell
 *
 * Button that opens the notifications inbox as a popup window.
 *
 * @param props NotificationBellProps
 * @returns JSX.Element
 */
export default function NotificationBell({ unreadCount = 0, onClick }: NotificationBellProps): JSX.Element {
  /**
   * handleOpenNotifications
   *
   * Call external onClick first (to mark as read), then open popup to SPA inbox.
   * If popup is blocked, navigate the current window to the inbox route.
   */
  function handleOpenNotifications() {
    try {
      onClick?.()
    } catch (err) {
      // ignore handler errors; continue opening popup
      // eslint-disable-next-line no-console
      console.error('NotificationBell onClick error', err)
    }

    // Build URL to app inbox (HashRouter used in app)
    const base = window.location.origin + window.location.pathname
    const inboxUrl = `${base}#/settings/inbox`

    const popup = centerPopup(inboxUrl, 'app_notifications', 480, 720)
    if (!popup) {
      // Popup blocked — navigate current window so user still sees inbox
      window.location.hash = '/settings/inbox'
    }
  }

  return (
    <button
      type="button"
      aria-label="Notifications"
      title="Notifications"
      className="relative p-1 rounded-md hover:bg-white/10"
      onClick={handleOpenNotifications}
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