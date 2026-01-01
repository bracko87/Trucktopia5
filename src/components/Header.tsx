/**
 * Header.tsx
 *
 * Top header component used inside authenticated layout.
 */

import React from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Header
 *
 * Displays app brand and small user area.
 */
export default function Header() {
  const { user, signOut } = useAuth()
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
            <div className="text-sm">{user.email}</div>
            <button
              onClick={() => signOut()}
              className="px-3 py-1 rounded bg-yellow-400 text-black font-medium"
            >
              Sign out
            </button>
          </>
        ) : (
          <div className="text-sm">Guest</div>
        )}
      </div>
    </header>
  )
}
