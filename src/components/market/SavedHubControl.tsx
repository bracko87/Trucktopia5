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
 * - It only writes to the database when the user explicitly clicks "Save selection".
 * - On mount it fetches the existing saved_hubs row for the authenticated owner (company preferred,
 *   otherwise user). If no owner is available the component falls back to localStorage for persistence.
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
 * - Save: creates or updates saved_hubs row using upsertSavedHub. (Only when Save clicked.)
 * - Clear: deletes the saved_hubs row if present (server-side) or clears local fallback.
 *
 * @param props - SavedHubControlProps
 */
export default function SavedHubControl({ selectedCountry, selectedCity, onApply }: SavedHubControlProps) {
  const { user } = useAuth()
  const STORAGE_KEY = 'market_saved_hub' // kept for local fallback compatibility
  const [saved, setSaved] = React.useState<SavedHubRow | null>(null)
  const [status, setStatus] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState<boolean>(false)

  /**
   * ownerInfo
   *
   * Decide whether to use company_id (preferred) or user_id when interacting with saved_hubs.
   *
   * @returns { userId?: string, companyId?: string } or null when not available
   */
  function ownerInfo(): { userId?: string; companyId?: string } | null {
    const companyId = (user as any)?.company_id ?? null
    const userId = (user as any)?.id ?? null
    if (companyId) return { companyId }
    if (userId) return { userId }
    return null
  }

  /**
   * loadSavedFromServer
   *
   * Load saved_hub for current owner (company or user). Apply it to parent via onApply only
   * when a saved row exists. This function does not perform any writes.
   */
  React.useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setStatus(null)
      try {
        const owner = ownerInfo()
        if (!owner) {
          // If unauthenticated, attempt local fallback (do not write to server).
          try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) {
              const parsed = JSON.parse(raw)
              const country = parsed?.country ? String(parsed.country).trim().toLowerCase() : null
              const city = parsed?.city ? String(parsed.city).trim() : null
              if (!mounted) return
              setSaved(country || city ? ({ id: 'local', country, city } as any) : null)
              if (country || city) onApply(country, city)
            } else {
              if (!mounted) return
              setSaved(null)
            }
          } catch {
            if (!mounted) return
            setSaved(null)
          }
          return
        }

        // Fetch from server for the resolved owner (company preferred).
        try {
          const fetched = await fetchSavedHub(owner as any)
          if (!mounted) return
          setSaved(fetched)
          if (fetched && (fetched.country || fetched.city)) {
            onApply(fetched.country ?? null, fetched.city ?? null)
          }
        } catch (err) {
          // If server fetch fails for any reason, keep UI functional and try local fallback.
          try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) {
              const parsed = JSON.parse(raw)
              const country = parsed?.country ? String(parsed.country).trim().toLowerCase() : null
              const city = parsed?.city ? String(parsed.city).trim() : null
              setSaved(country || city ? ({ id: 'local', country, city } as any) : null)
              if (country || city) onApply(country, city)
            } else {
              setSaved(null)
            }
          } catch {
            setSaved(null)
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
    // Intentionally only reload when authentication/owner changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.company_id, user?.id])

  /**
   * saveCurrent
   *
   * Save the currently selected country+city to the server and apply it.
   * Writes happen only when user clicks Save selection.
   */
  async function saveCurrent() {
    setLoading(true)
    setStatus(null)
    try {
      const country = selectedCountry && String(selectedCountry).trim().length > 0 ? String(selectedCountry).trim().toLowerCase() : null
      const city = selectedCity && String(selectedCity).trim().length > 0 ? String(selectedCity).trim() : null

      // Validation: do not save an empty selection
      if (!country && !city) {
        setStatus('Select country or city before saving')
        setTimeout(() => setStatus(null), 2000)
        return
      }

      const owner = ownerInfo()
      // If no authenticated owner, fallback to localStorage and inform user
      if (!owner) {
        try {
          const payload = { country, city }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
          setSaved({ id: 'local', country, city } as any)
          onApply(country, city)
          setStatus('Saved locally (log in to save to server)')
          setTimeout(() => setStatus(null), 2000)
          // emit event for other listeners
          try {
            window.dispatchEvent(new CustomEvent('market_saved_hub', { detail: { country, city } }))
          } catch {
            // ignore
          }
          return
        } catch {
          setStatus('Save failed')
          setTimeout(() => setStatus(null), 2000)
          return
        }
      }

      // Persist to server. If we have an existing server row -> patch, otherwise create.
      if (saved && saved.id && saved.id !== 'local') {
        // Patch existing row
        await upsertSavedHub({ id: saved.id, country, city })
      } else {
        // Create new row for owner
        const payload: any = {
          user_id: owner.userId ?? null,
          company_id: owner.companyId ?? null,
          country,
          city,
        }
        await upsertSavedHub(payload)
      }

      // Refresh saved row from server and notify parent
      const refreshed = await fetchSavedHub(owner as any)
      setSaved(refreshed)
      onApply(refreshed?.country ?? null, refreshed?.city ?? null)

      try {
        window.dispatchEvent(new CustomEvent('market_saved_hub', { detail: { country: refreshed?.country ?? null, city: refreshed?.city ?? null } }))
      } catch {
        // ignore
      }

      setStatus('Saved')
      setTimeout(() => setStatus(null), 1500)
    } catch (err) {
      setStatus('Save failed')
      setTimeout(() => setStatus(null), 2000)
    } finally {
      setLoading(false)
    }
  }

  /**
   * clearSaved
   *
   * Remove the saved hub on the server (or local fallback) and notify parent to clear applied values.
   */
  async function clearSaved() {
    setLoading(true)
    setStatus(null)
    try {
      const owner = ownerInfo()
      // If saved row exists on server -> delete it
      if (saved && saved.id && saved.id !== 'local' && owner) {
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
    } finally {
      setLoading(false)
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
          className={`px-3 py-1 rounded text-sm ${loading ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-sky-600 text-white'}`}
          aria-label="Save hub selection"
          disabled={loading}
        >
          Save selection
        </button>

        <button
          type="button"
          onClick={clearSaved}
          className={`px-3 py-1 rounded text-sm ${loading ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-800'}`}
          aria-label="Clear saved hub"
          disabled={loading}
        >
          Clear
        </button>
      </div>

      {status && <div className="ml-3 text-sm text-slate-500">{status}</div>}
    </div>
  )
}
