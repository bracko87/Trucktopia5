/**
 * TrailerCard.tsx
 *
 * Presentational trailer card aligned to the HiredStaff card grid structure.
 *
 * - Uses a 3-column grid to match HiredStaffCard visuals:
 *   [Identity] [Stats] [Meta / actions]
 * - Keeps existing editable-name persistence using supabaseFetch.
 * - Adds image resolution logic that mirrors staff card behaviour.
 * - Adds inline Image URL field (Save / Copy / Preview) for user_trailers.image_url
 *   similar to the hired staff card.
 * - Preview opens in-page modal popup (not new tab/window).
 *
 * UX upgrades:
 * - Adds hover/focus "pop" card effect similar to trucks page cards.
 * - Adds more granular status colors so different statuses are visually distinct.
 */

import React, { useEffect, useMemo, useState } from 'react'
import type { TrailerCardRow } from '../../lib/api/trailersApi'
import { Menu, Truck, X } from 'lucide-react'
import EditableTrailerName from './EditableTrailerName'
import { supabaseFetch } from '../../lib/supabase'

/**
 * TrailerCardProps
 *
 * Props expected by the TrailerCard component.
 */
export interface TrailerCardProps {
  trailer: TrailerCardRow
}

/**
 * resolveImageUrl
 *
 * Return the first available image URL from common fields (mirrors staff logic).
 *
 * @param trailer trailer row
 * @returns normalized image URL or undefined
 */
function resolveImageUrl(trailer: any): string | undefined {
  const candidates = [
    trailer?.image_url,
    trailer?.imageUrl,
    trailer?._raw?.image_url,
    trailer?._raw?.imageUrl,
    trailer?.avatar_url,
    trailer?.photo_url,
    trailer?.image,
    trailer?.avatar,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim()
  }
  return undefined
}

/**
 * formatStatusLabel
 *
 * Converts raw status values (e.g. "picking_up") into UI-friendly labels.
 */
function formatStatusLabel(s?: string | null) {
  const raw = String(s ?? 'unknown').trim()
  if (!raw) return 'unknown'
  return raw.replace(/_/g, ' ')
}

/**
 * statusClass
 *
 * Returns Tailwind classes for status badge visuals.
 * Expanded so common trailer statuses have distinct colors.
 *
 * @param s - optional status string
 * @returns tailwind classes
 */
function statusClass(s?: string | null) {
  switch ((s ?? '').toLowerCase()) {
    // Idle / available
    case 'available':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    case 'idle':
      return 'bg-sky-50 text-sky-700 ring-sky-100'

    // Assigned / planned / attached
    case 'assigned':
      return 'bg-amber-50 text-amber-700 ring-amber-100'
    case 'planned':
      return 'bg-yellow-50 text-yellow-700 ring-yellow-100'
    case 'attached':
      return 'bg-teal-50 text-teal-700 ring-teal-100'
    case 'detached':
      return 'bg-slate-50 text-slate-700 ring-slate-200'

    // Job progress (make these visually different from each other)
    case 'picking_up':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-100'
    case 'loading':
      return 'bg-blue-50 text-blue-700 ring-blue-100'
    case 'in_transit':
      return 'bg-cyan-50 text-cyan-700 ring-cyan-100'
    case 'delivering':
      return 'bg-violet-50 text-violet-700 ring-violet-100'
    case 'unloading':
      return 'bg-orange-50 text-orange-700 ring-orange-100'

    // Maintenance / blocked / problem states
    case 'maintenance':
      return 'bg-rose-50 text-rose-700 ring-rose-100'
    case 'in_repair':
      return 'bg-red-50 text-red-700 ring-red-100'
    case 'damaged':
      return 'bg-red-100 text-red-800 ring-red-200'
    case 'suspended':
      return 'bg-rose-600 text-white ring-rose-700'
    case 'inactive':
      return 'bg-gray-100 text-gray-700 ring-gray-200'

    default:
      return 'bg-gray-50 text-gray-700 ring-gray-100'
  }
}

/**
 * StatPill
 *
 * Compact pill used for small stat badges (status, condition number).
 *
 * @param props.children content
 * @param props.className additional classes
 */
function StatPill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ring-1 ${className}`}>
      {children}
    </span>
  )
}

/**
 * Avatar
 *
 * Small presentational avatar used in the identity column.
 *
 * @param props.image optional image URL
 */
function Avatar({ image, onError }: { image?: string; onError?: () => void }) {
  if (image) {
    return (
      <div className="w-12 h-12 rounded-full border border-slate-100 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
        {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
        <img src={image} alt="Trailer" className="w-full h-full object-cover" onError={onError} />
      </div>
    )
  }

  return (
    <div className="w-12 h-12 rounded-full border border-slate-100 bg-white flex items-center justify-center text-slate-400 flex-shrink-0">
      <Truck className="w-5 h-5" />
    </div>
  )
}

/**
 * TrailerImageUrlField
 *
 * Inline image URL editor for user_trailers.image_url.
 * Matches the HiredStaff image field UX (URL input + Save / Copy / Preview).
 * Preview opens as in-page modal popup.
 */
function TrailerImageUrlField({
  trailerId,
  initialUrl,
  onUpdated,
}: {
  trailerId: string
  initialUrl?: string | null
  onUpdated?: (url?: string) => void
}) {
  const [value, setValue] = useState(initialUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewImageError, setPreviewImageError] = useState(false)

  useEffect(() => {
    setValue(initialUrl ?? '')
  }, [initialUrl, trailerId])

  useEffect(() => {
    if (!previewOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreviewOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewOpen])

  const trimmed = value.trim()
  const previewUrl = trimmed.length > 0 ? trimmed : undefined

  async function save() {
    setSaving(true)
    setErrorMsg(null)
    try {
      await supabaseFetch(`/rest/v1/user_trailers?id=eq.${encodeURIComponent(trailerId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ image_url: trimmed || null }),
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
      })
      onUpdated?.(trimmed || undefined)
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('Failed saving trailer image_url', e)
      setErrorMsg(e?.message ?? 'Failed to save image URL')
    } finally {
      setSaving(false)
    }
  }

  async function copyToClipboard() {
    try {
      if (!trimmed) return
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(trimmed)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }
    } catch {
      // ignore clipboard errors silently
    }
  }

  function openPreview() {
    if (!previewUrl) return
    setPreviewImageError(false)
    setPreviewOpen(true)
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://example.com/trailer-image.jpg"
          className="min-w-0 flex-1 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button
          type="button"
          onClick={copyToClipboard}
          disabled={!trimmed}
          className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title="Copy image URL"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>

        <button
          type="button"
          onClick={openPreview}
          disabled={!previewUrl}
          className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title="Preview image"
        >
          Preview
        </button>
      </div>

      {errorMsg ? <div className="mt-1 text-xs text-red-600">{errorMsg}</div> : null}

      {/* In-page preview modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Trailer image preview"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] rounded-xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="text-sm font-medium text-slate-700 truncate pr-4">Image Preview</div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 border-b border-slate-200">
              <div className="text-xs text-slate-500 break-all">{previewUrl}</div>
            </div>

            <div className="flex items-center justify-center bg-slate-100 p-4 max-h-[70vh] overflow-auto">
              {!previewImageError && previewUrl ? (
                // eslint-disable-next-line jsx-a11y/img-redundant-alt
                <img
                  src={previewUrl}
                  alt="Trailer preview image"
                  className="max-w-full max-h-[66vh] object-contain rounded"
                  onError={() => setPreviewImageError(true)}
                />
              ) : (
                <div className="text-sm text-red-600 py-10">Failed to load image preview from this URL.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * TrailerCard
 *
 * Displays a trailer using the same 3-column visual pattern as HiredStaff cards:
 *  - Column 1: Identity (avatar, model, editable name)
 *  - Column 2: Condition & visual bar + small stats
 *  - Column 3: Status, mileage and action menu
 *
 * Preserves existing editable-name persistence using supabaseFetch.
 *
 * @param props - TrailerCardProps
 * @returns JSX.Element
 */
export default function TrailerCard({ trailer }: TrailerCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  /**
   * displayName
   *
   * Local display name state derived from DB row to allow optimistic updates.
   */
  const [displayName, setDisplayName] = useState<string>((trailer._raw as any)?.name ?? trailer.label ?? 'Unnamed trailer')

  const mileage = trailer.mileageKm ?? 0

  /**
   * locationDisplay
   *
   * Use the mapped locationCityName from the API when available.
   */
  const locationDisplay = trailer.locationCityName ?? '—'

  const condition = trailer.condition ?? 100
  const model = trailer.model ?? null

  // Always derive model display from model data — never from editable label
  const modelDisplay = model ? `${model.make ?? ''} ${model.model ?? ''}`.trim() : 'Unknown model'

  // Cargo type display (mapped from the API join)
  const cargoTypeDisplay = trailer.cargoTypeName ?? '—'

  const [imageError, setImageError] = useState(false)

  /**
   * persistedImageUrl
   *
   * Local source-of-truth for image_url after inline saves.
   * Falls back to initial trailer row image value.
   */
  const [persistedImageUrl, setPersistedImageUrl] = useState<string | undefined>(resolveImageUrl(trailer))

  useEffect(() => {
    setPersistedImageUrl(resolveImageUrl(trailer))
  }, [trailer.id, trailer])

  const resolvedImage = useMemo(() => {
    const localCandidate = (persistedImageUrl ?? '').trim()
    return localCandidate || resolveImageUrl(trailer)
  }, [persistedImageUrl, trailer])

  const imageToShow = !imageError ? resolvedImage : undefined

  useEffect(() => {
    // Reset image error when trailer / image changes
    setImageError(false)
  }, [resolvedImage, trailer.id])

  /**
   * saveName
   *
   * Persist the new name into user_trailers.name via supabaseFetch.
   * Optimistically updates UI; logs errors but does not rollback UI for simplicity.
   *
   * @param newName new trailer display name
   */
  async function saveName(newName: string) {
    setDisplayName(newName)

    try {
      await supabaseFetch(`/rest/v1/user_trailers?id=eq.${encodeURIComponent(trailer.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed saving trailer name', e)
    }
  }

  return (
    <article
      className={[
        'modern-card group relative w-full rounded-xl bg-white border border-gray-100 overflow-hidden',
        'shadow-sm transform-gpu transition-all duration-200 ease-out',
        'hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-200',
        'focus-within:-translate-y-0.5 focus-within:shadow-lg focus-within:border-slate-200',
      ].join(' ')}
      role="article"
    >
      {/* Top row converted to 3-column grid to match HiredStaff visual */}
      <div className="grid grid-cols-1 md:grid-cols-3 w-full divide-y md:divide-y-0 md:divide-x divide-slate-100">
        {/* Column 1 - Identity */}
        <div className="p-4 flex items-center">
          <div className="flex items-center gap-3 w-full min-w-0">
            <Avatar image={imageToShow} onError={() => setImageError(true)} />

            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">{modelDisplay}</div>

              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="font-medium">Trailer Name:</span>
                <EditableTrailerName initialName={displayName} onSave={saveName} />
              </div>

              {/* MOVED: Cargo type under the editable name (Column 1) */}
              <div className="text-xs text-slate-500 mt-1 truncate">
                <span className="font-medium">Cargo type:</span> {cargoTypeDisplay}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2 - Condition & stats */}
        <div className="p-4 flex items-center">
          <div className="w-full">
            <div className="text-sm text-slate-700 font-medium mb-2">Condition</div>

            <div className="flex items-center gap-3">
              <div className="text-sm font-medium">{condition}</div>

              <div className="w-36 h-2 bg-slate-200 rounded overflow-hidden">
                <div
                  style={{
                    width: `${Math.min(Math.max(Number(condition) || 0, 0), 100)}%`,
                    background: '#22c55e',
                    height: '100%',
                  }}
                />
              </div>

              <div className="text-xs text-slate-500 w-20">Health</div>
            </div>

            <div className="mt-3 text-sm text-slate-700 grid grid-cols-2 gap-4">
              <div>
                <span className="font-semibold">Payload:</span>{' '}
                {model?.max_load_kg
                  ? `${Number(model.max_load_kg).toLocaleString()} kg`
                  : trailer.payloadKg
                    ? `${trailer.payloadKg.toLocaleString()} kg`
                    : '—'}
              </div>

              {/* MOVED: Show GCW in Column 2 where Cargo Type used to be */}
              <div>
                <span className="font-semibold">GCW:</span>{' '}
                {model?.gcw ?? '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Column 3 - Status, mileage, actions */}
        <div className="p-4 flex items-start">
          <div className="flex items-start w-full">
            <div className="text-sm text-slate-700">
              <div className="mb-2">
                <span className="font-semibold">Status:</span>{' '}
                <StatPill className={statusClass(trailer.status)}>
                  <span className="capitalize">{formatStatusLabel(trailer.status)}</span>
                </StatPill>
              </div>

              <div>
                <span className="font-semibold">Mileage:</span>{' '}
                {Number(mileage).toLocaleString()} km
              </div>

              {/* ADDED: Current location displayed from mapped locationCityName */}
              <div className="mt-1">
                <span className="font-semibold">Current location:</span>{' '}
                {locationDisplay}
              </div>
            </div>

            <div className="ml-auto">
              <button
                onClick={() => setExpanded((s) => !s)}
                className="inline-flex items-center justify-center w-9 h-9 rounded border border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse trailer details' : 'Expand trailer details'}
                type="button"
              >
                {expanded ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* expandable section (now includes image URL field like staff card) */}
      <div
        className={`transition-[max-height] duration-200 ease-in-out overflow-hidden ${
          expanded ? 'max-h-[520px]' : 'max-h-0'
        }`}
        aria-hidden={!expanded}
      >
        <div className="pt-2 border-t border-slate-100 p-4 bg-white rounded-b-xl">
          {/* Image URL field row */}
          <div className="mb-4">
            <TrailerImageUrlField
              trailerId={trailer.id}
              initialUrl={persistedImageUrl}
              onUpdated={(nextUrl) => {
                setPersistedImageUrl(nextUrl)
                setImageError(false)
              }}
            />
          </div>

          {/* details panel */}
          <div className="bg-slate-50 border border-slate-100 rounded-md p-3 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-slate-500">Model</div>
                <div className="text-sm font-medium">{modelDisplay}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Year</div>
                <div className="text-sm font-medium">{model?.manufacture_year ?? '—'}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Payload</div>
                <div className="text-sm font-medium">
                  {model?.max_load_kg
                    ? `${Number(model.max_load_kg).toLocaleString()} kg`
                    : trailer.payloadKg
                      ? `${trailer.payloadKg.toLocaleString()} kg`
                      : '—'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Tonnage</div>
                <div className="text-sm font-medium">{model?.tonnage ?? '—'}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">GCW</div>
                <div className="text-sm font-medium">{model?.gcw ?? '—'}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Mileage</div>
                <div className="text-sm font-medium">{Number(mileage).toLocaleString()} km</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Condition</div>
                <div className="text-sm font-medium">{condition}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Cargo type</div>
                <div className="text-sm font-medium">{cargoTypeDisplay}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Current location</div>
                <div className="text-sm font-medium">{locationDisplay}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}