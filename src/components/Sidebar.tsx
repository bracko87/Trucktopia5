/**
 * Sidebar.tsx
 *
 * Collapsible main navigation sidebar used across authenticated pages.
 *
 * FIX:
 * - Logout should NOT reload the page (reload breaks in iframe/preview environments).
 * - Just call supabase.auth.signOut() and navigate to /login (replace).
 */

import React, { useEffect, useRef, useState } from 'react'
import {
  Home,
  Truck,
  Package,
  Users,
  FileText,
  DollarSign,
  ShoppingCart,
  MapPin,
  Warehouse,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'

interface SidebarItemProps {
  label: string
  subtitle?: string
  to: string
  icon: React.ReactNode
  collapsed: boolean
}

function SidebarItem({ label, subtitle, to, icon, collapsed }: SidebarItemProps) {
  const nav = useNavigate()

  function handleClick() {
    nav(to)
  }

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded hover:bg-yellow-400 hover:text-black transition text-white"
    >
      <span className="flex items-center justify-center w-6">{icon}</span>
      {!collapsed && (
        <span className="flex flex-col text-left">
          <span className="font-medium">{label}</span>
          {subtitle && <span className="text-xs text-white/60">{subtitle}</span>}
        </span>
      )}
    </button>
  )
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const nav = useNavigate()

  // Prevent setState after unmount (common during auth transitions)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const items: Array<{ label: string; subtitle?: string; to: string; icon: React.ReactNode }> = [
    { label: 'My Company', subtitle: 'Overview & settings', to: '/dashboard', icon: <Home size={18} className="text-white" /> },
    { label: 'Trucks', subtitle: 'Your fleet', to: '/trucks', icon: <Truck size={18} className="text-white" /> },
    { label: 'Trailers', subtitle: 'Trailer inventory', to: '/trailers', icon: <Package size={18} className="text-white" /> },
    { label: 'Staff', subtitle: 'Drivers & admin', to: '/staff', icon: <Users size={18} className="text-white" /> },
    { label: 'Market', subtitle: 'Find jobs', to: '/market', icon: <ShoppingCart size={18} className="text-white" /> },
    { label: 'My Jobs', subtitle: 'Accepted jobs', to: '/my-jobs', icon: <FileText size={18} className="text-white" /> },
    { label: 'Staging Area', subtitle: 'Assemble assets', to: '/staging', icon: <Warehouse size={18} className="text-white" /> },
    { label: 'Finances', subtitle: 'Balance & transactions', to: '/finances', icon: <DollarSign size={18} className="text-white" /> },
    { label: 'Map', subtitle: 'Fleet positions', to: '/map', icon: <MapPin size={18} className="text-white" /> },
  ]

  function toggleCollapsed() {
    setCollapsed((s) => !s)
  }

  /**
   * signOut
   *
   * Stable logout:
   * - Sign out with Supabase
   * - Navigate to /login (replace)
   * - NO window reload (previews/iframes often break on reload)
   */
  async function signOut() {
    if (signingOut) return
    setSigningOut(true)

    try {
      await supabase.auth.signOut()
    } catch (e) {
      // Best effort. Even if signOut fails, still go to login.
      // eslint-disable-next-line no-console
      console.warn('supabase.auth.signOut failed', e)
    } finally {
      // Route to login without reloading the app
      try {
        nav('/login', { replace: true })
      } catch {
        // If navigation fails for any reason, fall back to hash change (still no reload)
        try {
          window.location.hash = '#/login'
        } catch {
          // ignore
        }
      }

      if (mountedRef.current) setSigningOut(false)
    }
  }

  return (
    <aside className={`flex-shrink-0 bg-black text-white transition-all duration-200 ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-2 flex items-center justify-end">
          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleCollapsed}
            className="p-1 rounded hover:bg-yellow-400 hover:text-black transition text-white"
          >
            {collapsed ? <ChevronRight size={18} className="text-white" /> : <ChevronLeft size={18} className="text-white" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-2 mt-2 flex-1 overflow-y-auto space-y-1">
          {items.map((it) => (
            <SidebarItem key={it.label} label={it.label} subtitle={it.subtitle} to={it.to} icon={it.icon} collapsed={collapsed} />
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 mt-auto">
          <div className="flex flex-col gap-2">
            {!collapsed ? (
              <>
                <div className="text-xs text-white/60">© Trucktopia</div>

                <button
                  onClick={signOut}
                  disabled={signingOut}
                  className="w-full mt-2 px-3 py-2 rounded bg-yellow-400 text-black font-medium hover:bg-yellow-500 transition disabled:opacity-60"
                >
                  <div className="flex items-center gap-2 justify-center">
                    <LogOut size={16} />
                    <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
                  </div>
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="text-xs text-center text-white/60">©</div>

                <button
                  onClick={signOut}
                  disabled={signingOut}
                  aria-label="Sign out"
                  className="p-2 rounded bg-yellow-400 text-black hover:bg-yellow-500 transition disabled:opacity-60"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
