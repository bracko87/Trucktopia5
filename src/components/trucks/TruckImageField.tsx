/**
 * TruckImageField.tsx
 *
 * Small reusable component providing a compact truck image slot and an edit
 * modal. Ensures all reads and writes target the user_trucks table only
 * (never modifies truck_models).
 */

import React from 'react'
import ModalShell from '../common/ModalShell'
import { supabase } from '@/lib/supabase'
import { Upload } from 'lucide-react'

/**
 * Props for TruckImageField
 */
export interface TruckImageFieldProps {
  /** user_trucks.id */
  truckId: string
  /** optionally provide the initial URL (will be used only as a fallback) */
  initialUrl?: string | null
  /** optional className applied to the small preview box */
  className?: string
  /** callback after successful save */
  onUpdated?: () => void
}

/**
 * TruckImageField
 *
 * Renders a small preview square with an edit button that opens a modal to
 * update the truck image URL or upload a local file (saved as data:URL).
 *
 * This component strictly reads and writes image_url from the user_trucks
 * table only. It will never attempt to update truck_models.
 *
 * @param props TruckImageFieldProps
 */
export default function TruckImageField({
  truckId,
  initialUrl,
  className,
  onUpdated,
}: TruckImageFieldProps): JSX.Element {
  const [url, setUrl] = React.useState<string>(initialUrl ?? '')
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [previewOpen, setPreviewOpen] = React.useState(false)

  React.useEffect(() => {
    let mounted = true

    /**
     * loadFromUserTrucks
     *
     * Always attempt to read the persisted image_url from the user_trucks row.
     * If the row exists and has an image_url we use it. Only when the row has
     * no image do we fallback to the parent-provided initialUrl.
     */
    async function loadFromUserTrucks() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: fetchErr } = await supabase
          .from('user_trucks')
          .select('image_url')
          .eq('id', truckId)
          .maybeSingle()

        if (!mounted) return

        if (fetchErr) {
          setError(fetchErr.message ?? 'Failed to load image')
          // fallback to initialUrl if provided
          if (initialUrl) setUrl(initialUrl)
        } else if (data && (data as any).image_url) {
          setUrl(((data as any).image_url as string) ?? '')
        } else {
          // no persisted image found: fallback to parent-provided initialUrl if any
          if (initialUrl) setUrl(initialUrl)
        }
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message ?? 'Failed to load image')
        if (initialUrl) setUrl(initialUrl)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (truckId) loadFromUserTrucks()

    return () => {
      mounted = false
    }
  }, [truckId, initialUrl])

  /**
   * saveUrl
   *
   * Persist image_url to user_trucks.image_url. This function first verifies
   * that a user_trucks row exists for truckId and only updates that table.
   * Under no circumstances will this function attempt to update truck_models.
   * Calls onUpdated on success.
   */
  async function saveUrl() {
    setSaving(true)
    setError(null)

    try {
      // Confirm the user_trucks row exists (avoid accidentally touching other tables)
      const { data: existing, error: existErr } = await supabase
        .from('user_trucks')
        .select('id')
        .eq('id', truckId)
        .maybeSingle()

      if (existErr) {
        setError(existErr.message ?? 'Failed to verify truck')
        return
      }

      if (!existing) {
        setError('Truck record not found; cannot save image to user_trucks')
        return
      }

      // Update only the user_trucks table
      const { error: updateErr } = await supabase
        .from('user_trucks')
        .update({ image_url: url || null })
        .eq('id', truckId)

      if (updateErr) {
        setError(updateErr.message ?? 'Failed to save image')
        return
      }

      // Re-fetch persisted value to ensure canonical state
      try {
        const { data, error: refetchErr } = await supabase
          .from('user_trucks')
          .select('image_url')
          .eq('id', truckId)
          .maybeSingle()
        if (!refetchErr && data) {
          setUrl((data as any).image_url ?? '')
        }
      } catch {
        // ignore refetch errors
      }

      try {
        if (typeof onUpdated === 'function') await onUpdated()
      } catch {
        // ignore parent callback errors
      }

      setOpen(false)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  /**
   * handleFile
   *
   * Convert selected file to data:URL and set as current url (optimistic).
   *
   * @param f File
   */
  function handleFile(f?: File) {
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      setUrl(result)
    }
    reader.onerror = () => {
      setError('Failed to read file')
    }
    reader.readAsDataURL(f)
  }

  async function copyToClipboard() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // ignore
    }
  }

  const previewSmall = (
    <button
      type="button"
      onClick={() => {
        if (!loading && url) setPreviewOpen(true)
      }}
      disabled={loading || !url}
      className={`w-12 h-12 rounded-sm border border-slate-100 bg-white flex items-center justify-center overflow-hidden transition disabled:cursor-not-allowed enabled:hover:border-slate-300 enabled:hover:shadow-sm ${className ?? ''}`}
      style={{ minWidth: 48, minHeight: 48 }}
      aria-label={url ? 'Preview truck image' : 'No truck image available'}
      title={url ? 'Click to preview image' : 'No truck image available'}
    >
      {loading ? (
        <div className="text-xs text-slate-500">…</div>
      ) : url ? (
        // eslint-disable-next-line jsx-a11y/img-redundant-alt
        <img src={url} alt="Truck image" className="w-full h-full object-cover" />
      ) : (
        <div className="text-sm font-semibold text-slate-700">T</div>
      )}
    </button>
  )

  return (
    <>
      <div className="flex items-center gap-2">
        {previewSmall}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-1 rounded hover:bg-gray-100 text-slate-500"
          aria-label="Edit truck image"
        >
          <Upload className="w-4 h-4" />
        </button>
      </div>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title="Truck image"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 text-sm border rounded" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className="px-4 py-2 text-sm rounded bg-blue-600 text-white" onClick={saveUrl} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Image URL</label>
            <input
              className="w-full border rounded px-2 py-1"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/truck.jpg"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Or upload a file</label>
            <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files ? e.target.files[0] : undefined)} />
            <div className="text-xs text-slate-400 mt-1">Files are stored inline as data URLs in image_url (small files recommended).</div>
          </div>

          <div className="flex items-center gap-2">
            <button className="text-sm px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" onClick={copyToClipboard}>
              Copy
            </button>

            <button
              className={`text-sm px-3 py-1 rounded-md border ${url ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
              onClick={() => setPreviewOpen(true)}
              disabled={!url}
            >
              Preview
            </button>

            {error ? <div className="text-xs text-rose-700 ml-2">{error}</div> : null}
          </div>
        </div>
      </ModalShell>

      <ModalShell open={previewOpen} onClose={() => setPreviewOpen(false)} title="Image preview" size="sm">
        <div className="flex items-center justify-center p-2">
          {url ? (
            // eslint-disable-next-line jsx-a11y/img-redundant-alt
            <img src={url} alt="Truck image preview" className="max-w-full max-h-[320px] object-contain rounded" />
          ) : (
            <div className="text-sm text-slate-500">No URL provided</div>
          )}
        </div>
      </ModalShell>
    </>
  )
}