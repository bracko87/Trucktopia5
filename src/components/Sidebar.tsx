/**
 * Sidebar.tsx
 *
 * Collapsible main navigation sidebar used across authenticated pages.
 *
 * Responsibilities:
 * - Provide a retractable/collapsible sidebar preserving existing design (black bg,
 *   white icons/text).
 * - Stretch the navigation list to the footer to avoid white gaps.
 * - Render a small sub-headline under each menu headline for clarity.
 *
 * Notes:
 * - Keep single-responsibility components and clear TypeScript types.
 */

import React, { useState } from 'react'
import {
  Home,
  Truck,
  Package,
  Users,
  FileText,
  DollarSign,
  ShoppingCart,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useNavigate } from 'react-router'

/**
 * SidebarItemProps
 *
 * Props for individual sidebar items.
 */
interface SidebarItemProps {
  label: string
  subtitle?: string
  to: string
  icon: React.ReactNode
  collapsed: boolean
}

/**
 * SidebarItem
 *
 * Render a single navigation item with an optional subtitle. Hides text when collapsed.
 *
 * @param props - Sidebar item props
 */
function SidebarItem({ label, subtitle, to, icon, collapsed }: SidebarItemProps) {
  const nav = useNavigate()

  /**
   * Navigate to the route for this item.
   */
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

/**
 * Sidebar
 *
 * Collapsible sidebar component. Navigation area stretches to the footer.
 */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  const items: Array<{ label: string; subtitle?: string; to: string; icon: React.ReactNode }> = [
    { label: 'My Company', subtitle: 'Overview & settings', to: '/dashboard', icon: <Home size={18} className="text-white" /> },
    { label: 'Trucks', subtitle: 'Your fleet', to: '/trucks', icon: <Truck size={18} className="text-white" /> },
    { label: 'Trailers', subtitle: 'Trailer inventory', to: '/trailers', icon: <Package size={18} className="text-white" /> },
    { label: 'Staff', subtitle: 'Drivers & admin', to: '/staff', icon: <Users size={18} className="text-white" /> },
    { label: 'Market', subtitle: 'Find jobs', to: '/market', icon: <ShoppingCart size={18} className="text-white" /> },
    { label: 'My Jobs', subtitle: 'Accepted jobs', to: '/my-jobs', icon: <FileText size={18} className="text-white" /> },
    { label: 'Finances', subtitle: 'Balance & transactions', to: '/finances', icon: <DollarSign size={18} className="text-white" /> },
    { label: 'Map', subtitle: 'Fleet positions', to: '/map', icon: <MapPin size={18} className="text-white" /> },
  ]

  /**
   * Toggle collapsed state.
   */
  function toggleCollapsed() {
    setCollapsed((s) => !s)
  }

  return (
    <aside
      className={`flex-shrink-0 bg-black text-white transition-all duration-200 ${collapsed ? 'w-20' : 'w-64'}`}
    >
      <div className="flex flex-col h-full">
        {/* Header: collapse control only */}
        <div className="p-2 flex items-center justify-end">
          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleCollapsed}
            className="p-1 rounded hover:bg-yellow-400 hover:text-black transition text-white"
          >
            {collapsed ? (
              <ChevronRight size={18} className="text-white" />
            ) : (
              <ChevronLeft size={18} className="text-white" />
            )}
          </button>
        </div>

        {/* Navigation: stretches to fill available vertical space and scrolls if needed */}
        <nav className="px-2 mt-2 flex-1 overflow-y-auto space-y-1">
          {items.map((it) => (
            <SidebarItem
              key={it.label}
              label={it.label}
              subtitle={it.subtitle}
              to={it.to}
              icon={it.icon}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Footer: anchored to bottom to eliminate blank space */}
        <div className="p-3 mt-auto">
          {!collapsed ? (
            <div className="text-xs text-white/60">© Trucktopia</div>
          ) : (
            <div className="text-xs text-center text-white/60">©</div>
          )}
        </div>
      </div>
    </aside>
  )
}
