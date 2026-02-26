/**
 * Notifications.tsx
 *
 * In-app notifications center page. Shows unread/read tabs, allows marking
 * a single notification as read, and marking all unread ones as read.
 *
 * Kept compatible with updated notification helper signatures that now
 * accept arrays of user IDs.
 *
 * Uses Layout and AuthContext provided by the application.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router'
import {
  AppNotification,
  fetchNotificationsByReadState,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationUserIds,
} from '../lib/notifications'
import { getNotificationAction, getNotificationTypeConfig } from '../lib/notificationTypes'

/**
 * formatDateTime
 *
 * Format an ISO timestamp into a readable local date/time string.
 * Falls back to the raw value if parsing fails.
 *
 * @param iso - ISO 8601 timestamp string.
 * @returns Human-readable date and time string.
 */
function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/**
 * NotificationsPage
 *
 * Main notifications center page component.
 *
 * @returns JSX.Element
 */
export default function NotificationsPage(): JSX.Element {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [userIds, setUserIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread')
  const [unreadItems, setUnreadItems] = useState<AppNotification[]>([])
  const [readItems, setReadItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  /**
   * loadLists
   *
   * Load both unread and read notifications for the target notification user IDs.
   *
   * @param targetUserIds - Array of eligible notification user ids.
   */
  async function loadLists(targetUserIds: string[]): Promise<void> {
    setLoading(true)
    try {
      const [unread, read] = await Promise.all([
        fetchNotificationsByReadState(targetUserIds, false, 100),
        fetchNotificationsByReadState(targetUserIds, true, 200),
      ])
      setUnreadItems(unread)
      setReadItems(read)
    } finally {
      setLoading(false)
    }
  }

  // Resolve all eligible notification user ids once we have an authenticated user,
  // then load the notification lists.
  useEffect(() => {
    let mounted = true

    async function init(): Promise<void> {
      if (!user?.id) {
        setLoading(false)
        return
      }

      const ids = await resolveNotificationUserIds(user.id)
      if (!mounted) return

      setUserIds(ids)
      if (ids.length === 0) {
        setLoading(false)
        return
      }

      await loadLists(ids)
    }

    void init()

    return () => {
      mounted = false
    }
  }, [user?.id])

  const currentItems = useMemo(
    () => (activeTab === 'unread' ? unreadItems : readItems),
    [activeTab, readItems, unreadItems]
  )

  /**
   * handleMarkOneAsRead
   *
   * Mark a single notification as read and refresh the lists.
   *
   * @param item - Notification to mark as read.
   */
  async function handleMarkOneAsRead(item: AppNotification): Promise<void> {
    const ok = await markNotificationRead(item.id)
    if (!ok || userIds.length === 0) return
    await loadLists(userIds)
  }

  /**
   * handleMarkAllAsRead
   *
   * Mark all unread notifications for the current user scope as read.
   */
  async function handleMarkAllAsRead(): Promise<void> {
    if (userIds.length === 0) return
    const ok = await markAllNotificationsRead(userIds)
    if (!ok) return
    await loadLists(userIds)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
            <p className="text-sm text-slate-600 mt-1">
              Game events and admin announcements in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleMarkAllAsRead()}
            className="px-3 py-2 rounded-md bg-slate-900 text-white text-sm disabled:opacity-50"
            disabled={userIds.length === 0 || unreadItems.length === 0}
          >
            Mark all as read
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm ${
              activeTab === 'unread'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-300 text-slate-700'
            }`}
            onClick={() => setActiveTab('unread')}
          >
            Unread ({unreadItems.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm ${
              activeTab === 'read'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-300 text-slate-700'
            }`}
            onClick={() => setActiveTab('read')}
          >
            Read ({readItems.length})
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-4 text-sm text-slate-600">Loading notifications…</div>
          ) : currentItems.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">No {activeTab} notifications.</div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {currentItems.map((item) => {
                const typeConfig = getNotificationTypeConfig(item.type)
                const action = getNotificationAction(item.type, item.entity_id)

                return (
                  <li
                    key={item.id}
                    className="p-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            typeConfig.category === 'admin'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {typeConfig.category === 'admin' ? 'Admin' : 'Game'}
                        </span>
                        <span className="text-xs text-slate-500 uppercase tracking-wide">
                          {typeConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-900">{item.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatDateTime(item.created_at)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {action ? (
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                          onClick={() => navigate(action.path)}
                        >
                          {action.label}
                        </button>
                      ) : null}
                      {activeTab === 'unread' ? (
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                          onClick={() => void handleMarkOneAsRead(item)}
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  )
}