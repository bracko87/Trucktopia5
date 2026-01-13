/**
 * Preferences.tsx
 *
 * Preferences page: Time zone, Language and Notifications (in-app only).
 * - Keeps original page layout and design.
 * - Notifications section reduced to a single "In-app" option with Save/Cancel controls.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'

/**
 * PreferencesShape
 *
 * Shape of saved preferences in localStorage.
 */
interface PreferencesShape {
  timeZone: string
  language: string
  notifications: {
    /** Show notifications inside the app */
    inApp: boolean
  }
}

/**
 * DEFAULT_PREFERENCES
 *
 * Default preference values.
 */
const DEFAULT_PREFERENCES: PreferencesShape = {
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  language: 'en',
  notifications: {
    inApp: true,
  },
}

/**
 * ToastItem
 *
 * Simple toast entry type.
 */
type ToastItem = {
  id: string
  text: string
  kind?: 'info' | 'success' | 'error'
}

/**
 * STORAGE_KEY
 *
 * LocalStorage key used for preferences.
 */
const STORAGE_KEY = 'app_preferences_v1'

/**
 * TIMEZONES
 *
 * Curated list of IANA time zones for the demo.
 */
const TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
]

/**
 * LANGUAGES
 *
 * Available UI/game language options.
 */
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'pt', label: 'Português' },
]

/**
 * loadPreferences
 *
 * Load preferences from localStorage or fallback to defaults.
 *
 * @returns PreferencesShape
 */
function loadPreferences(): PreferencesShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<PreferencesShape>) }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

/**
 * savePreferences
 *
 * Persist preferences to localStorage.
 *
 * @param p - preferences to save
 */
function savePreferences(p: PreferencesShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // ignore localStorage errors
  }
}

/**
 * PrefsToasts
 *
 * Toast container for non-blocking notifications.
 *
 * @param props - { toasts, onRemove }
 */
function PrefsToasts({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timers = toasts.map((t) =>
      setTimeout(() => {
        onRemove(t.id)
      }, 3500)
    )
    return () => timers.forEach((t) => clearTimeout(t))
  }, [toasts, onRemove])

  return (
    <div aria-live="polite" className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`max-w-sm w-full px-4 py-2 rounded shadow text-sm ${
            t.kind === 'success' ? 'bg-emerald-600 text-white' : t.kind === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'
          }`}
        >
          <div className="flex justify-between items-start gap-2">
            <div className="truncate">{t.text}</div>
            <button onClick={() => onRemove(t.id)} className="ml-2 text-xs opacity-80">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * PreferencesPage
 *
 * The page component with three sections:
 * - Time zone (select + live preview)
 * - Language (select)
 * - Notifications (in-app only, single toggle)
 *
 * Each section preserves the original spacing/layout and uses non-blocking toasts.
 */
export default function PreferencesPage(): JSX.Element {
  const { prefs, setPrefs, savePrefs } = useLocalPreferencesState()

  // Local edit states for per-section edits
  const [tz, setTz] = useState<string>(prefs.timeZone)
  const [lang, setLang] = useState<string>(prefs.language)
  const [notify, setNotify] = useState<PreferencesShape['notifications']>({ ...prefs.notifications })

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Live clock preview for chosen timezone
  const [nowPreview, setNowPreview] = useState<Date>(new Date())

  useEffect(() => {
    const id = setInterval(() => setNowPreview(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    // keep inputs in sync if external prefs change
    setTz(prefs.timeZone)
    setLang(prefs.language)
    setNotify({ ...prefs.notifications })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs])

  /**
   * pushToast
   *
   * Add a toast message that auto-dismisses after 3.5s.
   *
   * @param text - message text
   * @param kind - optional kind
   */
  function pushToast(text: string, kind: ToastItem['kind'] = 'info') {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((s) => [...s, { id, text, kind }])
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3500)
  }

  function removeToast(id: string) {
    setToasts((s) => s.filter((t) => t.id !== id))
  }

  /**
   * saveTimeZone
   *
   * Save only the time zone to preferences (local) and notify user.
   */
  function saveTimeZone() {
    const next: PreferencesShape = { ...prefs, timeZone: tz }
    savePrefs(next)
    pushToast('Time zone saved', 'success')
  }

  /**
   * saveLanguage
   *
   * Save only the language to preferences (local) and notify user.
   */
  function saveLanguage() {
    const next: PreferencesShape = { ...prefs, language: lang }
    savePrefs(next)
    pushToast('Language saved', 'success')
  }

  /**
   * saveNotifications
   *
   * Save only notification settings to preferences (local) and notify user.
   */
  function saveNotifications() {
    const next: PreferencesShape = { ...prefs, notifications: notify }
    savePrefs(next)
    pushToast('Notification preferences saved', 'success')
  }

  /**
   * tzPreview
   *
   * Render a formatted example of the current time in the selected timezone.
   */
  const tzPreview = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(nowPreview)
    } catch {
      return nowPreview.toISOString()
    }
  }, [nowPreview, tz])

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Preferences</h2>
          <button
            onClick={() => {
              window.history.back()
            }}
            className="px-3 py-1 rounded border text-black"
          >
            Back
          </button>
        </div>

        <div className="bg-white p-6 rounded shadow space-y-6">
          {/* Time zone section */}
          <section>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Time zone</div>
                <div className="text-xs text-slate-500">Show times in your preferred zone (live preview)</div>
              </div>
            </div>

            <div className="mt-3 flex flex-col md:flex-row md:items-center gap-3">
              <select
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                className="w-full md:w-2/3 px-3 py-2 border rounded text-black"
                aria-label="Time zone"
              >
                {TIMEZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>

              <div className="flex-1 text-sm text-slate-600">
                Now in {tz}:{' '}
                <span className="font-medium ml-2" aria-live="polite">
                  {tzPreview}
                </span>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button onClick={saveTimeZone} className="px-3 py-1 rounded bg-emerald-600 text-white">
                Save time zone
              </button>
            </div>
          </section>

          {/* Language section */}
          <section>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Language</div>
                <div className="text-xs text-slate-500">Select UI / in-game language</div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full md:w-1/2 px-3 py-2 border rounded text-black"
                aria-label="Language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>

              <div className="text-xs text-slate-500">This changes UI language where translations are available.</div>
            </div>

            <div className="mt-3 flex justify-end">
              <button onClick={saveLanguage} className="px-3 py-1 rounded bg-emerald-600 text-white">
                Save language
              </button>
            </div>
          </section>

          {/* Notifications section - single In-app toggle, same layout as other sections */}
          <section>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Notifications</div>
                <div className="text-xs text-slate-500">Control how you receive updates</div>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">In-app</div>
                  <div className="text-xs text-slate-500">Show notifications inside the app</div>
                </div>
                <input
                  type="checkbox"
                  checked={notify.inApp}
                  onChange={(e) => setNotify((n) => ({ ...n, inApp: e.target.checked }))}
                  aria-label="In-app notifications"
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  // Cancel: revert edits to saved prefs
                  setTz(prefs.timeZone)
                  setLang(prefs.language)
                  setNotify({ ...prefs.notifications })
                  pushToast('Edits reverted', 'info')
                }}
                className="px-3 py-1 rounded border text-black"
              >
                Cancel
              </button>

              <button onClick={saveNotifications} className="ml-2 px-3 py-1 rounded bg-emerald-600 text-white">
                Save notifications
              </button>
            </div>
          </section>
        </div>
      </div>

      <PrefsToasts toasts={toasts} onRemove={removeToast} />
    </Layout>
  )
}

/**
 * useLocalPreferencesState
 *
 * Hook to manage preferences state and persistence.
 *
 * @returns { prefs, setPrefs, savePrefs }
 */
function useLocalPreferencesState() {
  const [prefs, setPrefs] = useState<PreferencesShape>(() => loadPreferences())

  /**
   * savePrefs
   *
   * Persist preferences and update internal state.
   *
   * @param p - preferences to save
   */
  function savePrefs(p: PreferencesShape) {
    setPrefs(p)
    savePreferences(p)
  }

  return { prefs, setPrefs, savePrefs }
}
