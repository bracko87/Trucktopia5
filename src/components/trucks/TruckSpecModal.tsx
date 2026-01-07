/**
 * TruckSpecModal.tsx
 *
 * Modal that fetches and displays full truck model specification from truck_models table.
 * Adds a compact legend below the specifications grid explaining each spec (small text).
 *
 * Note:
 * - Uses select=* to avoid PostgREST unknown-column (42703) issues across DB instances.
 */

import React, { useEffect, useState } from 'react'
import ModalShell from '../common/ModalShell'
import { supabaseFetch } from '../../lib/supabase'
import { formatReliability } from '../../lib/reliability'

/**
 * TruckModelRow
 *
 * Partial typed shape for truck_models row returned by REST.
 */
export interface TruckModelRow {
  id: string
  make?: string | null
  model?: string | null
  country?: string | null
  class?: string | null
  year?: number | null
  tonnage?: number | null
  max_payload?: number | null
  max_load_kg?: number | null
  fuel_tank_capacity_l?: number | null
  fuel_type?: string | null
  image_url?: string | null
  price?: number | null
  condition_score?: number | null
  lease_rate?: number | null
  durability?: number | null
  fuel_consumption_l_per_100km?: number | null
  availability_days?: number | null
  reliability?: number | null
  [key: string]: any
}

/**
 * TruckSpecModalProps
 *
 * @property modelId - truck_models.id to fetch
 * @property open - whether modal is visible
 * @property onClose - close handler
 */
export default function TruckSpecModal({
  modelId,
  open,
  onClose,
}: {
  modelId: string | null
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  const [model, setModel] = useState<TruckModelRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * loadModel
   *
   * Fetch full truck model row by id using select=* to avoid unknown-column errors.
   *
   * @param id - truck_models.id
   */
  async function loadModel(id: string) {
    setLoading(true)
    setError(null)
    try {
      const qs = `id=eq.${encodeURIComponent(id)}&select=*&limit=1`
      const res = await supabaseFetch(`/rest/v1/truck_models?${qs}`)
      if (res && Array.isArray(res.data) && res.data.length > 0) {
        setModel(res.data[0] as TruckModelRow)
      } else {
        setModel(null)
        setError('Model not found')
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('loadModel error', err)
      setError('Failed to load model')
      setModel(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && modelId) {
      loadModel(modelId)
    }
    if (!open) {
      setModel(null)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modelId])

  if (!open) return null

  const imageSrc =
    model?.image_url && typeof model.image_url === 'string' && model.image_url.length > 0
      ? model.image_url
      : 'https://pub-cdn.sider.ai/u/U0KAH9N4VLX/web-coder/6956ef545599fc8caeb3a137/resource/6cf6779c-cf33-42ff-82c2-c8d4257832d4.jpg'

  return (
    <ModalShell open={open} onClose={onClose} title="Truck specifications" size="lg">
      <div className="p-0">
        <div className="p-4">
          {loading ? (
            <div className="text-sm text-slate-500">Loading specifications…</div>
          ) : error ? (
            <div className="text-sm text-rose-600">{error}</div>
          ) : model ? (
            <div className="flex flex-col gap-6">
              {/* Model name left-aligned with flag */}
              <div className="text-left">
                <div className="text-lg font-semibold text-slate-800">
                  {model.make ?? '—'} {model.model ?? ''}
                </div>
                <div className="flex items-center justify-start gap-2 mt-1" style={{ pointerEvents: 'auto' }}>
                  <div className="text-xs text-slate-500">Produced in:</div>
                  <FlagIcon country={model.country} className="w-4 h-3 rounded-sm border" />
                  <div className="text-xs text-slate-500">{model.country ?? '—'}</div>
                </div>
              </div>

              {/* Image full-bleed across modal content */}
              <div className="w-full">
                <div className="w-full bg-slate-50 overflow-hidden h-64 relative -mx-4">
                  <img
                    src={imageSrc}
                    alt={`${model.make ?? ''} ${model.model ?? ''}`}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Specifications below image */}
              <div className="p-0">
                <div className="text-xs text-slate-500 mb-2">Specifications</div>

                {/* 3 columns on small+ screens */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SpecItem label="Make" value={model.make ?? '—'} />
                  <SpecItem label="Model" value={model.model ?? '—'} />
                  <SpecItem label="Year" value={model.year != null ? String(model.year) : '—'} />
                  <SpecItem label="Class" value={model.class ?? '—'} />
                  <SpecItem label="Tonnage in (t)" value={model.tonnage != null ? String(model.tonnage) : '—'} />
                  <SpecItem
                    label="Max load (kg)"
                    value={
                      model.max_load_kg != null
                        ? String(model.max_load_kg)
                        : model.max_payload != null
                        ? String(model.max_payload)
                        : '—'
                    }
                  />
                  <SpecItem label="Fuel tank (L)" value={model.fuel_tank_capacity_l != null ? String(model.fuel_tank_capacity_l) : '—'} />
                  <SpecItem label="Fuel type" value={model.fuel_type ?? '—'} />
                  <SpecItem
                    label="Fuel consumption (L/100km)"
                    value={model.fuel_consumption_l_per_100km != null ? String(model.fuel_consumption_l_per_100km) : '—'}
                  />
                  <SpecItem label="Durability" value={model.durability != null ? String(model.durability) : '—'} />
                  <SpecItem label="Price" value={model.price != null ? String(model.price) : '—'} />
                  <SpecItem label="Reliability" value={formatReliability(model.reliability)} />
                </div>

                {/* Legend box: small explanatory lines for each spec */}
                <LegendBox className="mt-4" />
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No specification available.</div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

/**
 * SpecItem
 *
 * Small presentational pair for spec label/value.
 *
 * @param props - { label, value }
 */
function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  )
}

/**
 * LegendBox
 *
 * Compact legend with small explanations for each spec line.
 *
 * Note: "Make" and "Model" entries are intentionally omitted from the legend.
 *
 * @param props.className - optional classes for outer container
 */
function LegendBox({ className }: { className?: string }) {
  const items: Array<{ key: string; text: string }> = [
    { key: 'Year', text: 'Production year of this model variant.' },
    { key: 'Class', text: 'Category describing vehicle size/usage.' },
    { key: 'Tonnage in (t)', text: 'Gross vehicle tonnage in tonnes.' },
    { key: 'Max load (kg)', text: 'Maximum recommended payload in kilograms.' },
    { key: 'Fuel tank (L)', text: 'Fuel tank capacity in litres.' },
    { key: 'Fuel type', text: 'Fuel the vehicle uses (e.g. Diesel, Petrol).' },
    { key: 'Fuel consumption (L/100km)', text: 'Average fuel consumption per 100 km.' },
    { key: 'Durability', text: 'Relative mechanical robustness (higher = better).' },
    { key: 'Price', text: 'Manufacturer suggested or recorded price.' },
    { key: 'Reliability', text: 'How reliable truck is, from A-C (A=best).' },
  ]

  return (
    <div className={className}>
      <div className="bg-slate-50 border border-slate-100 rounded-md p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((it) => (
            <div key={it.key} className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{it.key}:</span>{' '}
              <span className="text-xs text-slate-400">{it.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * getCountryCode
 *
 * Return ISO 3166-1 alpha-2 country code for a small set of country name variants.
 *
 * @param name - human-readable country name
 * @returns ISO2 code (lowercase) or null if unknown
 */
function getCountryCode(name?: string | null): string | null {
  if (!name) return null
  const map: Record<string, string> = {
    japan: 'jp',
    jpn: 'jp',
    'japan (jp)': 'jp',
    'united states': 'us',
    usa: 'us',
    'united kingdom': 'gb',
    uk: 'gb',
    'south korea': 'kr',
    korea: 'kr',
    china: 'cn',
    germany: 'de',
    france: 'fr',
    spain: 'es',
    italy: 'it',
    australia: 'au',
    'new zealand': 'nz',
    canada: 'ca',
    mexico: 'mx',
    thailand: 'th',
    vietnam: 'vn',
    indonesia: 'id',
    philippines: 'ph',
    malaysia: 'my',
    brazil: 'br',
    argentina: 'ar',
    chile: 'cl',
    poland: 'pl',
  }
  const key = name.trim().toLowerCase()
  return map[key] ?? null
}

/**
 * FlagIcon
 *
 * Small presentational flag image matching the provided country name.
 *
 * Uses FlagCDN (https://flagcdn.com) with a fallback to null when the country is unknown.
 *
 * @param props.country - country name to match
 * @param props.className - optional tailwind classes
 */
function FlagIcon({ country, className }: { country?: string | null; className?: string }) {
  const code = getCountryCode(country)
  if (!code) return null
  const src = `https://flagcdn.com/w20/${code}.png`
  return (
    // width/height attributes help layout stability
    <img src={src} alt={country ?? 'flag'} className={className ?? ''} width={20} height={14} loading="lazy" />
  )
}