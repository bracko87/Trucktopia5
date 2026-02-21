/**
 * Header.tsx
 *
 * Application header. Shows brand, company balance and user controls such as
 * notifications and settings.
 */

import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import SettingsMenu from './settings/SettingsMenu'
import CompanyBalance from './common/CompanyBalance'
import NotificationBell from './common/NotificationBell'
import { supabase } from '../lib/supabase'

/**
 * Header
 *
 * Renders the top application header. Also preloads company balance and
 * manages unread notifications count (best-effort).
 *
 * - Loads company balance and dispatches finances:summary for consumers.
 * - Loads unread notifications count and displays it on the bell.
 * - Subscribes to realtime notifications for the current user so the bell updates instantly.
 * - Marks notifications as read when the bell is clicked (so the counter clears).
 *
 * @returns JSX.Element
 */
export default function Header(): JSX.Element {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [markingRead, setMarkingRead] = useState<boolean>(false)

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

    loadBalance()
  }, [user])

  /**
   * Subscribe and load unread count
   *
   * - Loads initial unread count filtered by user_id.
   * - Subscribes to Postgres changes on notifications for this user and reloads count on events.
   */
  useEffect(() => {
    if (!user?.id) return

    let mounted = true

    async function loadUnread() {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('read_at', null)

        if (error) {
          // eslint-disable-next-line no-console
          console.debug('loadUnread error', error)
          return
        }

        if (!mounted) return

        setUnreadCount(typeof count === 'number' ? count : 0)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug('loadUnread failed', err)
      }
    }

    loadUnread()

    // Subscribe to realtime notifications for the current user
    const channel = supabase
      .channel('notifications-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // When notifications INSERT/UPDATE/DELETE occur, reload count.
          // Optionally you can inspect payload.eventType to show a toast on INSERT.
          void loadUnread()
        }
      )
      .subscribe()

    return () => {
      mounted = false
      // Remove subscription on cleanup
      // supabase.removeChannel is available in this SDK; if using a different SDK version, adjust accordingly.
      try {
        supabase.removeChannel(channel)
      } catch {
        // ignore removal errors
      }
    }
    // Re-subscribe when user id changes
  }, [user?.id])

  /**
   * markNotificationsRead
   *
   * Marks all unread notifications as read (sets read_at) and refreshes the
   * local unread counter. This is called when the user opens the notification
   * list; server-side validation of race-conditions is expected.
   */
  async function markNotificationsRead() {
    if (!user || markingRead) return
    setMarkingRead(true)
    try {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)

      // Clear local counter optimistically
      setUnreadCount(0)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('markNotificationsRead failed', err)
      // On error, attempt to reload exact count (best-effort)
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .is('read_at', null)
        if (!error) {
          setUnreadCount(typeof count === 'number' ? count : 0)
        }
      } catch {
        // ignore
      }
    } finally {
      setMarkingRead(false)
    }
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-black text-white">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-yellow-400 flex items-center justify-center font-bold text-black">
          TT
        </div>
        <div>
          <div className="text-lg font-semibold">Tracktopia</div>
          <div className="text-xs text-yellow-300">
            Truck Manager Simulator
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <CompanyBalance
              className="text-sm font-medium text-white"
              noCents
            />
            <NotificationBell
              unreadCount={unreadCount}
              onClick={() => {
                // Mark notifications read when the bell is clicked.
                // If you have a notification panel, open it here and call markNotificationsRead()
                void markNotificationsRead()
              }}
            />
            <SettingsMenu />
          </>
        ) : (
          <div className="text-sm">Guest</div>
        )}
      </div>
    </header>
  )
}
