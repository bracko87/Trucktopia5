/**
 * TruckCompareModal.tsx
 *
 * Modal used to compare specifications of two truck models.
 *
 * Responsibilities:
 * - Render two side-by-side detail cards (Current / Selected).
 * - Allow picking a model to compare against.
 * - Enrich model objects with human-friendly cargo type names so cargo_type_id
 *   displays a name instead of raw UUID.
 *
 * Notes:
 * - Small reusable units (FieldRow, TruckDetailCard) are used.
 * - Hidden fields: Make, Model, Year, Cargo Type, Condition Score, Price, Availability, Manufacture Year
 */

import React, { useEffect, useMemo, useState } from 'react'
import ModalShell from '../common/ModalShell'
import { getTable } from '../../lib/supabase'

/**
 * ModelInfo
 *
 * Partial shape for truck_models rows used in the compare modal.
 */
interface ModelInfo {
  id?: string
  make?: string | null
  model?: string | null
  year?: number | null
  class?: string | null
  lease_rate?: number | null
  list_price?: number | null
  price?: number | null
  condition_score?: number | null
  cargo_type_name?: string | null
  cargo_type_id?: string | null
  cargo_type_id_secondary?: string | null
  cargo_type_secondary_name?: string | null
  gcw?: number | null
  max_load_kg?: number | null
  fuel_tank_capacity_l?: number | null
  fuel_type?: string | null
  availability_days?: number | null
  country?: string | null
  durability?: number | null
  fuel_consumption_l_per_100km?: number | null
  in_production?: boolean | null
  maintenance_group?: number | null
  manufacture_year?: number | null
  reliability?: number | null
  speed_kmh?: number | null
  tonnage?: number | null
  [k: string]: any
}

/**
 * TruckCompareModalProps
 *
 * Props for the TruckCompareModal component.
 */
export interface TruckCompareModalProps {
  /** Optional id applied to the ModalShell for accessibility (aria-controls) */
  id?: string
  open: boolean
  onClose: () => void
  currentModel?: ModelInfo | null
  currentTruck?: any
}

/**
 * formatCurrency
 *
 * Format a numeric value into USD-like currency for display.
 *
 * @param value - numeric value
 */
function formatCurrency(value?: number | null): string | null {
  if (value == null || Number.isNaN(Number(value))) return null
  const n = Number(value)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: Math.abs(n) >= 1 && Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    } as Intl.NumberFormatOptions).format(n)
  } catch {
    return `$${n.toLocaleString()}`
  }
}

/**
 * fetchModels
 *
 * Retrieve a short list of truck model rows for the selector.
 *
 * @returns array of ModelInfo
 */
async function fetchModels(): Promise<ModelInfo[]> {
  try {
    const q = '?select=id,make,model,year,lease_rate,list_price,price,condition_score&limit=100'
    const res: any = await getTable('truck_models', q)
    return Array.isArray(res?.data) ? res.data : []
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug('TruckCompareModal: fetchModels failed', err)
    return []
  }
}

/**
 * fetchModelById
 *
 * Fetch one truck_model row by id and enrich it with cargo type names.
 *
 * @param id - model id
 * @returns ModelInfo | null
 */
async function fetchModelById(id?: string | null): Promise<ModelInfo | null> {
  if (!id) return null
  try {
    const q = `?select=*&id=eq.${encodeURIComponent(String(id))}&limit=1`
    const res: any = await getTable('truck_models', q)
    const rows = Array.isArray(res?.data) ? res.data : []
    const model = rows[0] ?? null
    if (!model) return null

    // Enrich cargo type names if ids present
    const cargoIds: string[] = []
    if (model.cargo_type_id) cargoIds.push(String(model.cargo_type_id))
    if (model.cargo_type_id_secondary) cargoIds.push(String(model.cargo_type_id_secondary))
    if (cargoIds.length > 0) {
      try {
        const encoded = cargoIds.map((c) => encodeURIComponent(c)).join(',')
        const ctRes: any = await getTable('cargo_types', `?select=id,name&id=in.(${encoded})&limit=50`)
        if (ctRes && Array.isArray(ctRes.data)) {
          const ctMap: Record<string, string> = {}
          ctRes.data.forEach((c: any) => {
            if (c && c.id) ctMap[String(c.id)] = c.name ?? ''
          })
          if (model.cargo_type_id) model.cargo_type_name = ctMap[String(model.cargo_type_id)] ?? null
          if (model.cargo_type_id_secondary) model.cargo_type_secondary_name = ctMap[String(model.cargo_type_id_secondary)] ?? null
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug('fetchModelById: cargo_types fetch failed', err)
      }
    }

    return model
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug('TruckCompareModal: fetchModelById error', err)
    return null
  }
}

/**
 * enrichModelWithCargoNames
 *
 * Given a ModelInfo object (possibly from props), fetch cargo type names when needed
 * and return a new enriched object.
 *
 * @param model - ModelInfo | null
 */
async function enrichModelWithCargoNames(model?: ModelInfo | null): Promise<ModelInfo | null> {
  if (!model) return null
  // If names already present, return as-is
  if (model.cargo_type_name || model.cargo_type_secondary_name) return model

  const cargoIds: string[] = []
  if (model.cargo_type_id) cargoIds.push(String(model.cargo_type_id))
  if (model.cargo_type_id_secondary) cargoIds.push(String(model.cargo_type_id_secondary))
  if (cargoIds.length === 0) return model

  try {
    const encoded = cargoIds.map((c) => encodeURIComponent(c)).join(',')
    const ctRes: any = await getTable('cargo_types', `?select=id,name&id=in.(${encoded})&limit=50`)
    if (ctRes && Array.isArray(ctRes.data)) {
      const ctMap: Record<string, string> = {}
      ctRes.data.forEach((c: any) => {
        if (c && c.id) ctMap[String(c.id)] = c.name ?? ''
      })
      const copy: ModelInfo = { ...model }
      if (copy.cargo_type_id) copy.cargo_type_name = ctMap[String(copy.cargo_type_id)] ?? null
      if (copy.cargo_type_id_secondary) copy.cargo_type_secondary_name = ctMap[String(copy.cargo_type_id_secondary)] ?? null
      return copy
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug('enrichModelWithCargoNames failed', err)
  }
  return model
}

/**
 * FieldRow
 *
 * Small reusable row that renders a field label and its value.
 *
 * @param props.label - display label
 * @param props.value - rendered value node
 */
function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm text-left">{value}</div>
    </div>
  )
}

/**
 * TruckDetailCard
 *
 * Reusable card that renders a title and a list of field key/value rows.
 *
 * @param props.title - card title (e.g. "Current" / "Selected")
 * @param props.name - main name line for the card
 * @param props.items - array of [key,label,value] to render
 */
function TruckDetailCard({
  title,
  name,
  items,
}: {
  title: string
  name: React.ReactNode
  items: Array<{ key: string; label: string; value: React.ReactNode }>
}) {
  return (
    <div className="bg-white border rounded p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-sm font-medium">{name}</div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        {items.map((it) => (
          <React.Fragment key={it.key}>
            <FieldRow label={it.label} value={it.value} />
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

/**
 * TruckCompareModal
 *
 * Presentational modal allowing the user to pick another model and
 * compare a short set of specification fields side-by-side.
 */
export default function TruckCompareModal({ id, open, onClose, currentModel, currentTruck }: TruckCompareModalProps) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null)
  const [enrichedCurrentModel, setEnrichedCurrentModel] = useState<ModelInfo | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingSelected, setLoadingSelected] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoadingList(true)
    void (async () => {
      const rows = await fetchModels()
      if (!mounted) return
      setModels(rows)
      setLoadingList(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Enrich currentModel (prop) with cargo type names when it changes
  useEffect(() => {
    let mounted = true
    void (async () => {
      const enriched = await enrichModelWithCargoNames(currentModel ?? null)
      if (!mounted) return
      setEnrichedCurrentModel(enriched)
    })()
    return () => {
      mounted = false
    }
  }, [currentModel])

  // When selectedId changes, fetch and enrich selected model
  useEffect(() => {
    let mounted = true
    if (!selectedId) {
      setSelectedModel(null)
      return
    }
    setLoadingSelected(true)
    void (async () => {
      const m = await fetchModelById(selectedId)
      const enriched = await enrichModelWithCargoNames(m)
      if (!mounted) return
      setSelectedModel(enriched)
      setLoadingSelected(false)
    })()
    return () => {
      mounted = false
    }
  }, [selectedId])

  // Build union of keys to display (preferred first)
  const allKeys = useMemo(() => {
    const left = (enrichedCurrentModel ?? {}) as ModelInfo
    const right = (selectedModel ?? {}) as ModelInfo
    const keys = new Set<string>()
    const preferred = [
      'class',
      'gcw',
      'max_load_kg',
      'fuel_tank_capacity_l',
      'fuel_type',
      'lease_rate',
      'list_price',
      'availability_days',
      'cargo_type_id',
      'cargo_type_id_secondary',
      'country',
      'durability',
      'fuel_consumption_l_per_100km',
      'in_production',
      'maintenance_group',
      'reliability',
      'speed_kmh',
      'tonnage',
    ]
    preferred.forEach((k) => keys.add(k))
    Object.keys(left).forEach((k) => keys.add(k))
    Object.keys(right).forEach((k) => keys.add(k))
    const rest = Array.from(keys).filter((k) => !preferred.includes(k)).sort()
    return preferred.concat(rest)
  }, [enrichedCurrentModel, selectedModel])

  /**
   * renderValue
   *
   * Render a row value, handling currency, booleans and missing values.
   *
   * Special-case: cargo_type_id and cargo_type_id_secondary render names when available.
   *
   * @param key - field key
   * @param v - value to render
   */
  function renderValue(key: string, v: any, modelSide?: ModelInfo) {
    if (v == null || v === '') return <span className="text-slate-500">Not specified</span>

    // Currency fields
    if (key === 'lease_rate' || key === 'list_price' || key === 'price') {
      return <span className="font-medium">{formatCurrency(Number(v)) ?? String(v)}</span>
    }

    // Cargo type ids: show human friendly name when available
    if (key === 'cargo_type_id') {
      const name = modelSide?.cargo_type_name ?? null
      return <span className="font-medium text-slate-800">{name ?? String(v)}</span>
    }
    if (key === 'cargo_type_id_secondary') {
      const name = modelSide?.cargo_type_secondary_name ?? null
      return <span className="font-medium text-slate-800">{name ?? String(v)}</span>
    }

    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    return <span className="font-medium text-slate-800">{String(v)}</span>
  }

  // Fields hidden from display (preserve layout/design)
  const hiddenKeys = new Set([
    'id',
    'created_at',
    'image_url',
    // Hidden per request:
    'make',
    'model',
    'year',
    'cargo_type_name',
    'condition_score',
    // Additional hides requested:
    'price',
    'availability',
    'manufacture_year',
    'manufactureYear',
    // Hide secondary cargo type human-readable name row as requested
    'cargo_type_secondary_name',
  ])

  // Build items arrays for left and right cards preserving order but skipping hidden keys
  const leftItems = useMemo(() => {
    return allKeys
      .filter((k) => !hiddenKeys.has(k))
      .map((k) => {
        // Friendly label
        let label =
          k === 'cargo_type_id'
            ? 'Cargo Type'
            : k === 'cargo_type_id_secondary'
            ? 'Cargo Type (secondary)'
            : k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

        // Source value: prefer enrichedCurrentModel then currentTruck
        const leftVal = enrichedCurrentModel ? (enrichedCurrentModel as any)[k] ?? (currentTruck ? (currentTruck as any)[k] : null) : null

        const valueNode = renderValue(k, leftVal, enrichedCurrentModel ?? undefined)
        return { key: `left-${k}`, label, value: valueNode }
      })
  }, [allKeys, enrichedCurrentModel, currentTruck])

  const rightItems = useMemo(() => {
    return allKeys
      .filter((k) => !hiddenKeys.has(k))
      .map((k) => {
        let label =
          k === 'cargo_type_id'
            ? 'Cargo Type'
            : k === 'cargo_type_id_secondary'
            ? 'Cargo Type (secondary)'
            : k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

        const rightVal = selectedModel ? (selectedModel as any)[k] : null
        const valueNode = renderValue(k, rightVal, selectedModel ?? undefined)
        return { key: `right-${k}`, label, value: valueNode }
      })
  }, [allKeys, selectedModel])

  return (
    <ModalShell
      id={id}
      open={open}
      onClose={onClose}
      title="Compare Trucks"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200">
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">Select model to compare with</div>
          <div>
            <select
              aria-label="Select model to compare"
              className="px-3 py-1 border rounded"
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value || null)}
            >
              <option value="">-- choose model --</option>
              {loadingList ? (
                <option>Loading...</option>
              ) : (
                models.map((m) => <option key={m.id} value={m.id}>{[m.make, m.model, m.year].filter(Boolean).join(' ')}</option>)
              )}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TruckDetailCard
            title="Current"
            name={enrichedCurrentModel ? [enrichedCurrentModel.make, enrichedCurrentModel.model].filter(Boolean).join(' ') : <span className="text-slate-500">Not available</span>}
            items={leftItems}
          />

          <TruckDetailCard
            title="Selected"
            name={selectedModel ? [selectedModel.make, selectedModel.model].filter(Boolean).join(' ') : <span className="text-slate-500">Choose a model</span>}
            items={rightItems}
          />
        </div>
      </div>
    </ModalShell>
  )
}
