/**
 * Sidebar.tsx
 *
 * Left navigation for authenticated pages.
 */

import React from 'react'
import { Home, Truck, Users, Settings, FileText } from 'lucide-react'
import { useNavigate } from 'react-router'

/**
 * Sidebar
 *
 * Renders navigation links.
 */
export default function Sidebar() {
  const nav = useNavigate()
  const items = [
    { label: 'Dashboard', icon: <Home size={16} />, to: '/dashboard' },
    { label: 'Company', icon: <Users size={16} />, to: '/dashboard' },
    { label: 'Trucks', icon: <Truck size={16} />, to: '/dashboard' },
    { label: 'Jobs', icon: <FileText size={16} />, to: '/dashboard' },
    { label: 'Settings', icon: <Settings size={16} />, to: '/dashboard' },
  ]
  return (
    <aside className="w-64 bg-black text-white flex-shrink-0">
      <nav className="p-4 space-y-1">
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => nav(it.to)}
            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded hover:bg-yellow-400 hover:text-black transition"
          >
            <span>{it.icon}</span>
            <span className="font-medium">{it.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
