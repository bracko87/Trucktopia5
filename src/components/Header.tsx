/**
 * Header.tsx
 *
 * Top header component used inside authenticated layout.
 *
 * Shows the app brand and a compact settings menu in the top-right.
 * Replaces the email display with the Company's balance (CompanyBalance)
 * while preserving the existing header layout and spacing. Also adds
 * a small notification icon next to the balance.
 */

import React from 'react'
import { useAuth } from '../context/AuthContext'
import SettingsMenu from './settings/SettingsMenu'
import CompanyBalance from './common/CompanyBalance'
import NotificationBell from './common/NotificationBell'

/**
 * Header
 *
 * Displays app brand and small user area with the settings menu.
 *
 * Replaces showing user.email with CompanyBalance (reads companies.balance_cents).
 *
 * @returns JSX.Element
 */
export default function Header(): JSX.Element {
  const { user } = useAuth()

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

      <div className="flex items-center gap-4">
        {user ? (
          <>
            {/*
              CompanyBalance fetches the visible company via RLS and displays
              companies[0].balance_cents formatted in USD without cents.
              We set text classes so the visual layout remains identical to the
              previous email text but in white as requested.
            */}
            <CompanyBalance className="text-sm font-medium text-white" noCents compact={false} />
            {/* Small notification icon inserted without changing header spacing */}
            <NotificationBell />
            <SettingsMenu />
          </>
        ) : (
          <div className="text-sm">Guest</div>
        )}
      </div>
    </header>
  )
}
