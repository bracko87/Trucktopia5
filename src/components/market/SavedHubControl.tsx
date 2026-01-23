/**
 * SavedHubControl.tsx
 *
 * Control to allow saving the current Country+City filter selection for the Market page.
 *
 * This server-backed variant persists the saved hub to public.saved_hubs using helpers
 * in src/lib/savedHubs.ts so the selection is available across devices and browsers.
 *
 * Important:
 * - The component keeps the same UI and props contract so page design/layout is unchanged.
 * - Uses authenticated requests (via existing supabase helpers). If the user is not logged in
 *   operations will silently fail and a brief status message is shown.
 */

import React from 'react'
import { useAuth } from '../../context/AuthContext'
import { fetchSavedHub, upsertSavedHub, deleteSavedHub, SavedHubRow } from '../../lib/savedHubs'

/**
 * Props for SavedHubControl component.
 */
interface SavedHubControlProps {
  /**
   * Currently selected country code (lowercase) or empty string.
   */
  selectedCountry?: string | null
  /**
   * Currently selected city name or empty string.
   */
  selectedCity?: string | null
  /**
   * Called when the user requests to apply a saved hub (country, city).
   */
  onApply: (country?: string | null, city?: string | null) => void
}

/**
 * SavedHubControl
 *
 * Renders Save / Clear buttons and manages a persisted saved hub row in the database.
 *
 * Behavior:
 * - Reads existing saved hub for the current user/company on mount and surfaces it.
 * - Save: creates or updates saved_hubs row using upsertSavedHub.
 * - Clear: deletes the saved_hubs row if present.
 *
 * @param props - SavedHubControlProps
 */
export default function SavedHubControl({ selectedCountry, selectedCity, onApply }: SavedHubControlProps) {
  const { user } = useAuth()
  const STORAGE_KEY = 'market_saved_hub' // kept for compatibility fallback if needed
  const [saved, setSaved] = React.useState<SavedHubRow | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  /**
   * resolveOwner
   *
   * Decide whether to use company_id (preferred) or user_id when interacting with saved_hubs.
   *
   * @returns object for fetch/upsert calls
   */
  function resolveOwner() {
    const companyId = (user as any)?.company_id ?? null
    const userId = (user as any)?.id ?? null
    if (companyId) return { companyId, userId: undefined }
    if (userId) return { userId, companyId: undefined }
    return { userId: undefined, companyId: undefined }
  }

  /**
   * loadSavedFromServer
   *
   * Try to load saved_hub for current user/company and apply it.
   */
  React.useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setStatus(null)
      try {
        const owner = resolveOwner()
        if (!owner.userId && !owner.companyId) {
          setSaved(null)
          return
        }
        try {
          const fetched = await fetchSavedHub(owner as any)
          if (!mounted) return
          setSaved(fetched)
          if (fetched && (fetched.country || fetched.city)) {
            onApply(fetched.country ?? null, fetched.city ?? null)
          }
        } catch (err) {
          // If fetch fails (e.g. not authenticated) fall back to localStorage if available
          try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) {
              const parsed = JSON.parse(raw)
              const country = parsed?.country ? String(parsed.country).trim().toLowerCase() : null
              const city = parsed?.city ? String(parsed.city).trim() : null
              setSaved(country || city ? { id: 'local', country, city } as any : null)
              if (country || city) onApply(country, city)
            }
          } catch {
            // ignore
          }
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  /**
   * saveCurrent
   *
   * Save the currently selected country+city to the server and apply it.
   * Validates that at least one of country/city is provided.
   */
  async function saveCurrent() {
    try {
      const country = selectedCountry && String(selectedCountry).trim().length > 0 ? String(selectedCountry).trim().toLowerCase() : null
      const city = selectedCity && String(selectedCity).trim().length > 0 ? String(selectedCity).trim() : null

      // Validation: do not save an empty selection
      if (!country && !city) {
        setStatus('Select country or city before saving')
        setTimeout(() => setStatus(null), 2000)
        return
      }

      const owner = resolveOwner()
      // If no authenticated owner, fallback to localStorage and inform user
      if (!owner.userId && !owner.companyId) {
        try {
          const payload = { country, city }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
          setSaved({ id: 'local', country, city } as any)
          onApply(country, city)
          setStatus('Saved locally (log in to save to server)')
          setTimeout(() => setStatus(null), 2000)
          return
        } catch {
          setStatus('Save failed')
          setTimeout(() => setStatus(null), 2000)
          return
        }
      }

      // If we already have a saved row id -> update, otherwise create
      if (saved && saved.id && saved.id !== 'local') {
        await upsertSavedHub({ id: saved.id, country, city })
        const updated = await fetchSavedHub(owner as any)
        setSaved(updated)
      } else {
        const payload: any = {
          user_id: owner.userId ?? null,
          company_id: owner.companyId ?? null,
          country,
          city,
        }
        const created = await upsertSavedHub(payload)
        setSaved(created)
      }

      // Notify parent so filters apply immediately
      onApply(country, city)
      // Also dispatch a global event for any other listeners
      try {
        window.dispatchEvent(new CustomEvent('market_saved_hub', { detail: { country, city } }))
      } catch {
        // ignore
      }

      setStatus('Saved')
      setTimeout(() => setStatus(null), 1500)
    } catch (err) {
      setStatus('Save failed')
      setTimeout(() => setStatus(null), 2000)
    }
  }

  /**
   * clearSaved
   *
   * Remove the saved hub on the server (or local fallback) and notify parent to clear applied values.
   */
  async function clearSaved() {
    try {
      // If saved row exists on server -> delete it
      if (saved && saved.id && saved.id !== 'local') {
        await deleteSavedHub(saved.id)
        setSaved(null)
      } else {
        // local fallback
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          // ignore
        }
        setSaved(null)
      }

      setStatus('Cleared')
      // Notify parent to clear applied filters
      onApply(null, null)
      try {
        window.dispatchEvent(new CustomEvent('market_saved_hub', { detail: { country: null, city: null } }))
      } catch {
        // ignore
      }
      setTimeout(() => setStatus(null), 1500)
    } catch {
      setStatus('Clear failed')
      setTimeout(() => setStatus(null), 2000)
    }
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="flex-1 text-sm text-slate-600">
        <div>
          <strong>Saved hub:</strong>{' '}
          {saved?.country || saved?.city ? (
            <span className="font-medium">
              {saved?.city ? `${saved.city}` : ''}{saved?.city && saved?.country ? ', ' : ''}{saved?.country ? saved.country.toUpperCase() : ''}
            </span>
          ) : (
            <span className="text-slate-400">none</span>
          )}
        </div>
        {loading && <div className="text-xs text-slate-400 mt-1">Loading saved hub…</div>}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={saveCurrent}
          className="px-3 py-1 bg-sky-600 text-white rounded text-sm"
          aria-label="Save hub selection"
        >
          Save selection
        </button>

        <button
          type="button"
          onClick={clearSaved}
          className="px-3 py-1 bg-slate-100 rounded text-sm"
          aria-label="Clear saved hub"
        >
          Clear
        </button>
      </div>

      {status && <div className="ml-3 text-sm text-slate-500">{status}</div>}
    </div>
  )
}