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
 * Header
 *
 * Renders the top application header. Also preloads company balance and
 * manages unread notifications count (best-effort).
 *
 * - Loads company balance and dispatches finances:summary for consumers.
 * - Loads unread notifications count and displays it on the bell.
 * - Subscribes to realtime notifications for the resolved public user id so the bell updates instantly.
 * - Clicking the bell opens the notifications page.
 *
 * @returns JSX.Element
 */
export default function Header(): JSX.Element {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState<number>(0)

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

  /**
   * Subscribe and load unread count
   *
   * - Resolves the public user id from auth uid.
   * - Loads initial unread count filtered by public user id.
   * - Subscribes to Postgres changes on notifications for that public user id.
   */
  useEffect(() => {
    if (!user?.id) return

    let mounted = true
    let currentPublicUserId: string | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function loadUnread() {
      if (!currentPublicUserId) return

      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentPublicUserId)
          .is('read_at', null)

        if (error || !mounted) return

        setUnreadCount(typeof count === 'number' ? count : 0)
      } catch {
        // ignore
      }
    }

    async function initNotifications() {
      currentPublicUserId = await resolvePublicUserId(user.id)
      if (!mounted || !currentPublicUserId) return

      await loadUnread()

      channel = supabase
        .channel(`notifications-live-${currentPublicUserId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentPublicUserId}`,
          },
          () => {
            void loadUnread()
          }
        )
        .subscribe()
    }

    void initNotifications()

    return () => {
      mounted = false
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch {
          // ignore removal errors
        }
      }
    }
  }, [user?.id])

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
                window.location.href = '/notifications'
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