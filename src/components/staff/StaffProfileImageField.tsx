/**
 * StaffProfileImageField.tsx
 *
 * Small reusable component that allows editing an image URL for a staff_profiles record,
 * copying the URL to clipboard and previewing it in a modal. Intended for owner/founder
 * cards where the canonical photo is stored in staff_profiles.
 */

import React from 'react'
import ModalShell from '../common/ModalShell'
import { supabase } from '@/lib/supabase'

/**
 * StaffProfileImageFieldProps
 *
 * Props for the StaffProfileImageField component.
 */
export interface StaffProfileImageFieldProps {
  /** The staff_profiles row id (may be null) */
  staffProfileId?: string | null | undefined
  /** Optional company id to lookup a staff_profiles row when staffProfileId is not provided */
  companyId?: string | null | undefined
  /** Optional initial URL to avoid an immediate fetch */
  initialUrl?: string | null
  /** Optional callback called after a successful update (parent can reload) */
  onUpdated?: () => void
}

/**
 * StaffProfileImageField
 *
 * Renders a compact input for an image URL, a Save button, Copy and Preview controls
 * and a small preview modal. Works against the staff_profiles table. If staffProfileId
 * is not provided the component will try to resolve a profile by companyId (first match).
 *
 * @param props StaffProfileImageFieldProps
 * @returns JSX.Element
 */
export default function StaffProfileImageField({
  staffProfileId,
  companyId,
  initialUrl,
  onUpdated,
}: StaffProfileImageFieldProps): JSX.Element {
  const [url, setUrl] = React.useState<string>(initialUrl ?? '')
  const [currentProfileId, setCurrentProfileId] = React.useState<string | null | undefined>(staffProfileId ?? null)
  const [saving, setSaving] = React.useState(false)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    let mounted = true

    /**
     * resolveProfileByCompany
     *
     * Find a staff_profiles row by company_id (first created) when no explicit id was provided.
     */
    async function resolveProfileByCompany(cId: string) {
      try {
        const res = await supabase
          .from('staff_profiles')
          .select('id,image_url')
          .eq('company_id', cId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (res && (res as any).data) {
          return (res as any).data
        }
      } catch {
        // ignore
      }
      return null
    }

    /**
     * loadImageUrl
     *
     * If the parent provided an initialUrl, use it. Otherwise try to fetch the persisted
     * image_url for the provided staffProfileId or, if missing, resolve one via companyId.
     */
    async function loadImageUrl() {
      if (initialUrl !== undefined && initialUrl !== null) {
        setUrl(initialUrl)
        return
      }

      setLoading(true)
      setError(null)

      try {
        let pid = staffProfileId ?? null

        if (!pid && companyId) {
          const found = await resolveProfileByCompany(companyId)
          if (found && found.id) {
            pid = String(found.id)
            if (mounted) setCurrentProfileId(pid)
            if (mounted) setUrl((found as any).image_url ?? '')
            setLoading(false)
            return
          }
        }

        if (!pid) {
          // nothing to load
          setUrl('')
          setLoading(false)
          return
        }

        const { data, error } = await supabase.from('staff_profiles').select('image_url').eq('id', pid).maybeSingle()
        if (error) {
          if (mounted) setError(error.message ?? 'Failed to load image URL')
        } else if (mounted) {
          const resolved = (data as any)?.image_url ?? ''
          setUrl(resolved)
          setCurrentProfileId(pid)
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Failed to load image URL')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadImageUrl()

    return () => {
      mounted = false
    }
  }, [staffProfileId, companyId, initialUrl])

  /**
   * saveUrl
   *
   * Persist the image_url to the staff_profiles row. If we don't yet have a profile id
   * try to resolve one by companyId. If none exists return an error.
   */
  async function saveUrl() {
    setSaving(true)
    setError(null)

    try {
      let pid = currentProfileId ?? null

      if (!pid && companyId) {
        // attempt to resolve
        try {
          const res = await supabase
            .from('staff_profiles')
            .select('id')
            .eq('company_id', companyId)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          if (res && (res as any).data && (res as any).data.id) {
            pid = String((res as any).data.id)
            setCurrentProfileId(pid)
          }
        } catch {
          // ignore
        }
      }

      if (!pid) {
        setError('No staff_profiles row found to save to (provide staffProfileId or companyId).')
        return
      }

      const { error: updError } = await supabase.from('staff_profiles').update({ image_url: url || null }).eq('id', pid)
      if (updError) {
        setError(updError.message ?? 'Failed to save image URL')
        return
      }

      // re-fetch canonical persisted value for UI consistency
      try {
        const { data, error: refetchError } = await supabase.from('staff_profiles').select('image_url').eq('id', pid).maybeSingle()
        if (!refetchError && data) {
          setUrl((data as any).image_url ?? '')
        }
      } catch {
        // ignore
      }

      if (typeof onUpdated === 'function') {
        try {
          await onUpdated()
        } catch {
          // ignore parent errors
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  /**
   * copyToClipboard
   *
   * Copy current URL to clipboard; silently ignore failures.
   */
  async function copyToClipboard() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={loading ? 'Loading…' : !currentProfileId ? 'No staff profile' : 'Image URL'}
          className="text-sm px-2 py-1 rounded border border-slate-200 w-60 bg-white"
          aria-label="Staff profile image URL"
          disabled={loading || !currentProfileId}
        />
        <button
          type="button"
          className="text-sm px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          onClick={saveUrl}
          disabled={saving || loading || !companyId && !currentProfileId}
          aria-label="Save image URL"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button
          type="button"
          onClick={copyToClipboard}
          className="text-sm px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          aria-label="Copy image URL"
        >
          Copy
        </button>

        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={!url}
          className={`text-sm px-2 py-1 rounded-md border ${url ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
          aria-label="Preview image"
        >
          Preview
        </button>
      </div>

      {error ? <div className="text-xs text-rose-700 ml-2">{error}</div> : null}

      <ModalShell open={previewOpen} onClose={() => setPreviewOpen(false)} title="Image preview" size="sm">
        <div className="flex items-center justify-center p-2">
          {url ? (
            // eslint-disable-next-line jsx-a11y/img-redundant-alt
            <img src={url} alt="Staff image" className="max-w-full max-h-[320px] object-contain rounded" />
          ) : (
            <div className="text-sm text-slate-500">No URL provided</div>
          )}
        </div>
      </ModalShell>
    </div>
  )
}
