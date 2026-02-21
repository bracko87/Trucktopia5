/**
 * ImageUrlField.tsx
 *
 * Small reusable component that allows editing an image URL for a hired staff member,
 * copying the URL to clipboard and previewing it in a modal. This version will fetch
 * the current image_url from the hired_staff table on mount (if not provided) and
 * persist updates to the DB so the value remains after page reload.
 */

import React from 'react'
import ModalShell from '../common/ModalShell'
import { supabase } from '@/lib/supabase'

/**
 * ImageUrlFieldProps
 *
 * Props for the ImageUrlField component.
 */
export interface ImageUrlFieldProps {
  /** The hired staff member row (only id and current image field are required) */
  member: { id: string; image_url?: string | null }
  /** Optional callback called after a successful update (parent can reload) */
  onUpdated?: () => void
}

/**
 * ImageUrlField
 *
 * Renders a compact input for an image URL, a Save button, Copy and Preview controls
 * and a small preview modal. On mount it will fetch the current image_url from the
 * hired_staff table (when member.image_url is not provided) so it always reflects the
 * persisted value. Saving writes the value to the DB and calls onUpdated on success.
 *
 * @param props ImageUrlFieldProps
 * @returns JSX.Element
 */
export default function ImageUrlField({ member, onUpdated }: ImageUrlFieldProps): JSX.Element {
  const [url, setUrl] = React.useState<string>(member.image_url ?? '')
  const [saving, setSaving] = React.useState(false)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    let mounted = true

    /**
     * loadImageUrl
     *
     * If the parent didn't provide an image_url, fetch the current persisted value
     * from the hired_staff table so the input reflects DB state.
     */
    async function loadImageUrl() {
      // If the parent passed an explicit value (even empty string), we prefer that.
      if (member.image_url !== undefined && member.image_url !== null) {
        setUrl(member.image_url)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const { data, error } = await supabase.from('hired_staff').select('image_url').eq('id', member.id).single()
        if (error) {
          // Non-fatal: show a message but do not break UI
          if (mounted) setError(error.message ?? 'Failed to load image URL')
        } else if (mounted) {
          setUrl((data && (data as any).image_url) ?? '')
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
  }, [member.id, member.image_url])

  /**
   * saveUrl
   *
   * Persist the image_url to the hired_staff row. Handles DB errors gracefully
   * and ensures onUpdated is called when the save succeeds.
   */
  async function saveUrl() {
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.from('hired_staff').update({ image_url: url || null }).eq('id', member.id)
      if (error) {
        setError(error.message ?? 'Failed to save image URL')
        return
      }
      // Optionally re-fetch to ensure canonical persisted value is loaded (keeps UI consistent)
      try {
        const { data, error: refetchError } = await supabase.from('hired_staff').select('image_url').eq('id', member.id).single()
        if (!refetchError && data) {
          setUrl((data as any).image_url ?? '')
        }
      } catch {
        // ignore refetch errors
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
          placeholder={loading ? 'Loading…' : 'Image URL'}
          className="text-sm px-2 py-1 rounded border border-slate-200 w-60 bg-white"
          aria-label="Staff image URL"
          disabled={loading}
        />
        <button
          type="button"
          className="text-sm px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          onClick={saveUrl}
          disabled={saving || loading}
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
            // image must be displayed with constrained size and object-contain
            // to avoid breaking layout.
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
