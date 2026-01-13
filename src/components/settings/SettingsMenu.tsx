/**
 * settings/SettingsMenu.tsx
 *
 * Duplicate of top-level SettingsMenu to satisfy different import paths.
 *
 * Some headers import from src/components/SettingsMenu.tsx while others may
 * import from src/components/settings/SettingsMenu.tsx. Creating both ensures
 * the header uses the navigation-only menu and pages are opened inside the
 * main Layout (header/sidebar/footer remain visible).
 */

import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { User, Mail, Image, ExternalLink, Sliders, LifeBuoy, FileText, Users, Sparkles } from 'lucide-react'

/**
 * SettingsMenu
 *
 * Renders a compact settings dropdown that navigates to dedicated pages.
 *
 * @returns JSX.Element
 */
export default function SettingsMenu(): JSX.Element {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  /**
   * handleClickOutside
   *
   * Closes the menu when clicking outside.
   *
   * @param e - MouseEvent
   */
  function handleClickOutside(e: MouseEvent) {
    if (!rootRef.current) return
    if (!rootRef.current.contains(e.target as Node)) setOpen(false)
  }

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /**
   * navigateTo
   *
   * Navigate to a target path and close the dropdown.
   *
   * @param path - settings path to navigate to
   */
  function navigateTo(path: string) {
    setOpen(false)
    nav(path)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className="p-2 rounded hover:bg-white/5 flex items-center gap-2"
        title="Settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-settings"
          aria-hidden="true"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded shadow-lg z-50 text-black">
          <ul className="divide-y">
            <li>
              <button
                onClick={() => navigateTo('/settings/profile')}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50"
              >
                <User size={16} /> My Profile
              </button>
            </li>
            <li>
              <button
                onClick={() => navigateTo('/settings/inbox')}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50"
              >
                <Mail size={16} /> Inbox
              </button>
            </li>
            <li>
              <button
                onClick={() => navigateTo('/settings/customize')}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50"
              >
                <Image size={16} /> Customize Company
              </button>
            </li>
            <li>
              <a
                className="w-full block px-3 py-2 flex items-center gap-2 hover:bg-slate-50"
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  window.open('https://discord.gg', '_blank')
                  setOpen(false)
                }}
              >
                <ExternalLink size={16} /> Forum (Discord)
              </a>
            </li>
            <li>
              <button
                onClick={() => navigateTo('/settings/preferences')}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50"
              >
                <Sliders size={16} /> Preferences
              </button>
            </li>
            <li>
              <button
                onClick={() => navigateTo('/settings/help')}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50"
              >
                <LifeBuoy size={16} /> Help
              </button>
            </li>
            <li>
              <button
                onClick={() => navigateTo('/settings/contact')}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50"
              >
                <FileText size={16} /> Contact us
              </button>
            </li>
            <li>
              <button
                onClick={() => navigateTo('/settings/invite')}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50"
              >
                <Users size={16} /> Invite Friends
              </button>
            </li>
            <li>
              <button
                onClick={() => navigateTo('/settings/pro')}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50"
              >
                <Sparkles size={16} /> Pro Package
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}