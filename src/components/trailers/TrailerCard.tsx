/**
 * TrailerCard.tsx
 *
 * Presentational trailer card aligned to the HiredStaff card grid structure.
 *
 * - Uses a 3-column grid to match HiredStaffCard visuals:
 *   [Identity] [Stats] [Meta / actions]
 * - Keeps existing editable-name persistence using supabaseFetch.
 * - Adds image resolution logic that mirrors the staff card behaviour.
 */

import React, { useEffect, useState } from 'react'
import type { TrailerCardRow } from '../../lib/api/trailersApi'
import { Gauge, Menu, Truck } from 'lucide-react'
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
    trailer.image_url,
    trailer.imageUrl,
    trailer.avatar_url,
    trailer.photo_url,
    trailer.image,
    trailer.avatar,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim()
  }
  return undefined
}

/**
 * statusClass
 *
 * Returns Tailwind classes for status badge visuals.
 *
 * @param s - optional status string
 * @returns tailwind classes
 */
function statusClass(s?: string | null) {
  switch ((s ?? '').toLowerCase()) {
    case 'available':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    case 'assigned':
      return 'bg-amber-50 text-amber-700 ring-amber-100'
    case 'maintenance':
      return 'bg-rose-50 text-rose-700 ring-rose-100'
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
  return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ring-1 ${className}`}>{children}</span>
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
        <img
          src={image}
          alt="Trailer"
          className="w-full h-full object-cover"
          onError={onError}
        />
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
  const resolvedImage = resolveImageUrl(trailer)
  const imageToShow = !imageError ? resolvedImage : undefined

  useEffect(() => {
    // Reset image error when trailer changes
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
      await supabaseFetch(
        `/rest/v1/user_trailers?id=eq.${encodeURIComponent(trailer.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: newName }),
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
        }
      )
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed saving trailer name', e)
    }
  }

  return (
    <article className="bg-white rounded-xl shadow w-full border border-gray-100 overflow-hidden" role="article">
      {/* Top row converted to 3-column grid to match HiredStaff visual */}
      <div className="grid grid-cols-1 md:grid-cols-3 w-full divide-y md:divide-y-0 md:divide-x divide-slate-100">
        {/* Column 1 - Identity */}
        <div className="p-4 flex items-center">
          <div className="flex items-center gap-3 w-full">
            <Avatar image={imageToShow} onError={() => setImageError(true)} />

            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">{modelDisplay}</div>

              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <span className="font-medium">Trailer Name:</span>
                <EditableTrailerName initialName={displayName} onSave={saveName} />
              </div>

              {/* MOVED: Cargo type under the editable name (Column 1) */}
              <div className="text-xs text-slate-500 mt-1">
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
                <StatPill className={statusClass(trailer.status)}>{trailer.status ?? 'unknown'}</StatPill>
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
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* details - unchanged (expandable) */}
      <div className={`px-4 transition-all duration-200 overflow-hidden ${expanded ? 'max-h-64 py-4' : 'max-h-0 py-0'}`}>
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
              <div className="text-sm font-medium">{model?.max_load_kg ? `${Number(model.max_load_kg).toLocaleString()} kg` : trailer.payloadKg ? `${trailer.payloadKg.toLocaleString()} kg` : '—'}</div>
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
          </div>
        </div>
      </div>
    </article>
  )
}