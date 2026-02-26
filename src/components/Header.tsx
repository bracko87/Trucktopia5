/**
 * Header.tsx
 *
 * Application header. Shows brand, company balance and user controls such as
 * notifications and settings.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import SettingsMenu from './settings/SettingsMenu'
import CompanyBalance from './common/CompanyBalance'
import NotificationBell from './common/NotificationBell'
import { supabase } from '../lib/supabase'
import { getNotificationAction, getNotificationTypeConfig } from '../lib/notificationTypes'

interface AppNotification {
  id: string
  user_id?: string | null
  type?: string | null
  entity_id?: string | null
  message?: string | null
  created_at?: string | null
  read_at?: string | null
}

/**
 * resolvePublicUserId
 *
 * Resolves the public.users row id from the authenticated auth uid.
 */
async function resolvePublicUserId(authUserId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .limit(1)
      .maybeSingle()

    if (!error && data?.id) return String(data.id)
  } catch {
    // ignore
  }

  return null
}

/**
 * resolveNotificationUserIds
 *
 * Resolves ids used by notifications.user_id.
 * Prefers the public user id, with auth uid fallback for mixed/legacy data.
 */
async function resolveNotificationUserIds(authUserId: string): Promise<string[]> {
  const ids = new Set<string>()

  const publicUserId = await resolvePublicUserId(authUserId)
  if (publicUserId) {
    ids.add(String(publicUserId))
  }

  // Fallback for environments where notifications may still reference auth uid.
  if (ids.size === 0 && authUserId) {
    ids.add(String(authUserId))
  }

  return Array.from(ids)
}

async function countUnreadNotifications(userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0

  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .in('user_id', userIds)
      .is('read_at', null)

    if (error) return 0
    return typeof count === 'number' ? count : 0
  } catch {
    return 0
  }
}

async function fetchNotificationsByReadState(
  userIds: string[],
  isRead: boolean,
  limitCount = 20
): Promise<AppNotification[]> {
  if (userIds.length === 0) return []

  try {
    let query = supabase
      .from('notifications')
      .select('id,user_id,type,entity_id,message,created_at,read_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(limitCount)

    query = isRead ? query.not('read_at', 'is', null) : query.is('read_at', null)

    const { data, error } = await query
    if (error) return []

    return Array.isArray(data)
      ? data.map((row: any) => ({
          id: String(row.id),
          user_id: row.user_id ?? null,
          type: row.type ?? null,
          entity_id: row.entity_id ?? null,
          message: row.message ?? null,
          created_at: row.created_at ?? null,
          read_at: row.read_at ?? null,
        }))
      : []
  } catch {
    return []
  }
}

async function markNotificationRead(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null)

    return !error
  } catch {
    return false
  }
}

async function markAllNotificationsRead(userIds: string[]): Promise<boolean> {
  if (userIds.length === 0) return false

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('user_id', userIds)
      .is('read_at', null)

    return !error
  } catch {
    return false
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'

  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)

  return d.toLocaleString()
}

/**
 * Header
 *
 * Renders the top application header. Also preloads company balance and
 * manages unread notifications count (best-effort).
 *
 * - Loads company balance and dispatches finances:summary for consumers.
 * - Loads unread notifications count and displays it on the bell.
 * - Subscribes to realtime notifications for resolved notification user ids.
 * - Clicking the bell opens an inline dropdown notifications panel.
 *
 * @returns JSX.Element
 */
export default function Header(): JSX.Element {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [userIds, setUserIds] = useState<string[]>([])
  const [openPanel, setOpenPanel] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread')
  const [unreadItems, setUnreadItems] = useState<AppNotification[]>([])
  const [readItems, setReadItems] = useState<AppNotification[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  /**
   * loadBalance
   *
   * Fetches company balance for the authenticated user and broadcasts it via
   * a window event used elsewhere in the app.
   */
  useEffect(() => {
    if (!user) return

    async function loadBalance() {
      try {
        const { data: company } = await supabase
          .from('companies')
          .select('balance, balance_cents')
          .eq('owner_auth_user_id', user.id)
          .maybeSingle()

        if (!company) return

        let val: number | null = null

        if (typeof company.balance === 'number') {
          val = company.balance
        } else if (typeof company.balance_cents === 'number') {
          val = company.balance_cents / 100
        }

        if (typeof val === 'number') {
          window.dispatchEvent(
            new CustomEvent('finances:summary', {
              detail: { balance: val },
            })
          )
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Balance preload failed', err)
      }
    }

    void loadBalance()
  }, [user])

  async function reloadNotifications(ids: string[]) {
    if (ids.length === 0) {
      setUnreadCount(0)
      setUnreadItems([])
      setReadItems([])
      return
    }

    setLoadingNotifications(true)
    try {
      const [count, unread, read] = await Promise.all([
        countUnreadNotifications(ids),
        fetchNotificationsByReadState(ids, false, 20),
        fetchNotificationsByReadState(ids, true, 20),
      ])

      setUnreadCount(count)
      setUnreadItems(unread)
      setReadItems(read)
    } finally {
      setLoadingNotifications(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return

    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const ids = await resolveNotificationUserIds(user.id)
      if (!mounted) return

      setUserIds(ids)
      await reloadNotifications(ids)

      if (ids.length === 0) return

      channel = supabase
        .channel(`notifications-live-${ids.join('-')}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=in.(${ids.join(',')})`,
          },
          () => {
            void reloadNotifications(ids)
          }
        )
        .subscribe()
    }

    void init()

    return () => {
      mounted = false
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch {
          // ignore
        }
      }
    }
  }, [user?.id])

  useEffect(() => {
    if (!openPanel) return

    function onDocClick(event: MouseEvent) {
      if (!panelRef.current) return
      const target = event.target as Node | null
      if (!target) return
      if (!panelRef.current.contains(target)) {
        setOpenPanel(false)
      }
    }

    document.addEventListener('mousedown', onDocClick)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
    }
  }, [openPanel])

  async function handleMarkOneAsRead(id: string) {
    if (!userIds.length) return
    const ok = await markNotificationRead(id)
    if (!ok) return
    await reloadNotifications(userIds)
  }

  async function handleMarkAllAsRead() {
    if (!userIds.length) return
    const ok = await markAllNotificationsRead(userIds)
    if (!ok) return
    await reloadNotifications(userIds)
  }

  const currentItems = useMemo(
    () => (activeTab === 'unread' ? unreadItems : readItems),
    [activeTab, readItems, unreadItems]
  )

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-black text-white">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-yellow-400 flex items-center justify-center font-bold text-black">
          TT
        </div>
        <div>
          <div className="text-lg font-semibold">Tracktopia</div>
          <div className="text-xs text-yellow-300">Truck Manager Simulator</div>
        </div>
      </div>

      <div className="flex items-center gap-4 relative" ref={panelRef}>
        {user ? (
          <>
            <CompanyBalance className="text-sm font-medium text-white" noCents />

            <NotificationBell
              unreadCount={unreadCount}
              onClick={() => setOpenPanel((prev) => !prev)}
            />

            {openPanel ? (
              <div className="absolute right-10 top-10 z-50 w-[380px] max-h-[70vh] bg-white text-slate-900 rounded-lg border border-slate-200 shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="font-semibold">Notifications</div>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                    onClick={() => void handleMarkAllAsRead()}
                    disabled={unreadItems.length === 0}
                  >
                    Mark all read
                  </button>
                </div>

                <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('unread')}
                    className={`text-xs px-2 py-1 rounded ${
                      activeTab === 'unread'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Unread ({unreadItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('read')}
                    className={`text-xs px-2 py-1 rounded ${
                      activeTab === 'read'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Read ({readItems.length})
                  </button>
                </div>

                <div className="overflow-y-auto max-h-[52vh]">
                  {loadingNotifications ? (
                    <div className="p-4 text-sm text-slate-500">Loading notifications…</div>
                  ) : currentItems.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">
                      No {activeTab} notifications.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-200">
                      {currentItems.map((item) => {
                        const typeConfig = getNotificationTypeConfig(item.type)
                        const action = getNotificationAction(item.type, item.entity_id)

                        return (
                          <li key={item.id} className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      typeConfig.category === 'admin'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {typeConfig.category === 'admin' ? 'Admin' : 'Game'}
                                  </span>
                                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                    {typeConfig.label}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-900">{item.message ?? 'No message'}</p>

                                <p className="text-[10px] text-slate-500 mt-1">
                                  {formatDateTime(item.created_at)}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                {action ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigate(action.path)
                                      setOpenPanel(false)
                                    }}
                                    className="text-[10px] px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                                  >
                                    {action.label}
                                  </button>
                                ) : null}
                                {activeTab === 'unread' ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleMarkOneAsRead(item.id)}
                                    className="text-[10px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 whitespace-nowrap"
                                  >
                                    Mark read
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}

            <SettingsMenu />
          </>
        ) : (
          <div className="text-sm">Guest</div>
        )}
      </div>
    </header>
  )
}