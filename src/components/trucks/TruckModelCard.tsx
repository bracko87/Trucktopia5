/**
 * TruckModelCard.tsx
 *
 * Read-only card for a truck model used on New Trucks Market.
 * Shows a compact set of model fields sourced only from the truck_models table.
 * Includes cargo type icon, Lease Rate and List Price pills and expandable details.
 *
 * This variant hides actions that shouldn't be available for new/unowned trucks:
 * - Logs, Insurance, Maintenance, Sell
 * are hidden for new trucks (activated only after purchase/lease).
 */

import React, { useEffect, useState } from 'react'
import { useCompany } from '../../context/CompanyContext'
import { Gauge, Menu, Truck, Columns } from 'lucide-react'
import StatChip from './StatChip'
import { getTable } from '../../lib/supabase'
import LogModal from './LogModal'
import TruckSpecModal from './TruckSpecModal'
import TruckComponentsModal from './TruckComponentsModal'
import SellTruckModal from './SellTruckModal'
import InsuranceModal from './InsuranceModal'
import MaintenanceModal from './MaintenanceModal'
import TruckCompareModal from './TruckCompareModal'
import LeaseConfirmModal from '../leases/LeaseConfirmModal'

interface ModelInfo {
  id?: string
  make?: string | null
  model?: string | null
  country?: string | null
  class?: string | null
  year?: number | null
  cargo_type_id?: string | null
  cargo_type_id_secondary?: string | null
  cargo_type_name?: string | null
  cargo_type_secondary_name?: string | null
  availability_days?: number | null
  gcw?: number | null
  lease_rate?: number | null
  list_price?: number | null
  price?: number | null
  max_load_kg?: number | null
  fuel_tank_capacity_l?: number | null
  fuel_type?: string | null
  image_url?: string | null
  created_at?: string | null
  condition_score?: number | null
  [k: string]: any
}

interface PurchaseClickPayload {
  id?: string
  master_truck_id?: string | null
  name?: string | null
  make?: string | null
  model?: string | null
  list_price?: number | null
  price?: number | null
  availability_days?: number | null
  [k: string]: any
}

/**
 * Props for TruckModelCard
 */
interface TruckModelCardProps {
  truck: any
  modelInfo?: ModelInfo | null
  defaultRegistration?: string
  isMarket?: boolean
  onPurchaseClick?: (payload: PurchaseClickPayload) => void
}

async function fetchModelById(id?: string | null): Promise<ModelInfo | null> {
  if (!id) return null
  try {
    const q = `?select=*&id=eq.${encodeURIComponent(String(id))}&limit=1`
    const res: any = await getTable('truck_models', q)
    const rows = Array.isArray(res?.data) ? res.data : []
    if (rows.length === 0) return null
    return rows[0] as ModelInfo
  } catch (err) {
    console.debug('TruckModelCard: fetchModelById error', err)
    return null
  }
}

function prettyValue(value: any): React.ReactNode {
  if (value == null || value === '') return <span className="text-slate-500">Not specified</span>
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function formatCurrency(value?: number | null): string | null {
  if (value == null || Number.isNaN(Number(value))) return null
  const n = Number(value)
  const opts =
    Number.isInteger(n) && Math.abs(n) >= 1
      ? { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }
      : { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }
  try {
    return new Intl.NumberFormat('en-US', opts as Intl.NumberFormatOptions).format(n)
  } catch {
    return `$${n.toLocaleString()}`
  }
}

function PricePill({ label, value, color }: { label: string; value?: number | string | null; color?: 'green' | 'sky' | 'amber' }) {
  const classes =
    color === 'green'
      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
      : color === 'amber'
      ? 'bg-amber-50 border border-amber-200 text-amber-700'
      : 'bg-sky-50 border border-sky-200 text-sky-700'

  const content =
    value == null || value === '' ? (
      <span className="text-slate-500">Not specified</span>
    ) : typeof value === 'number' ? (
      <span className="font-medium">{formatCurrency(value) ?? String(value)}</span>
    ) : (
      <span className="font-medium">{String(value)}</span>
    )

  return (
    <div className="flex flex-col text-center min-w-[92px]">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-sm px-2 py-1 rounded ${classes} inline-block`}>{content}</div>
    </div>
  )
}

export default function TruckModelCard({
  truck,
  modelInfo,
  defaultRegistration,
  isMarket = false,
  onPurchaseClick,
}: TruckModelCardProps) {
  const id = truck?.id ?? ''
  const rawModelId = (truck as any)?.master_truck_id ?? null

  const [resolvedModel, setResolvedModel] = useState<ModelInfo | null>(modelInfo ?? null)
  const [cargoName, setCargoName] = useState<string | null>(modelInfo?.cargo_type_name ?? null)
  const [cargoNameSecondary, setCargoNameSecondary] = useState<string | null>(modelInfo?.cargo_type_secondary_name ?? null)

  const [cargoIconUrl, setCargoIconUrl] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<boolean>(false)
  const [showLogs, setShowLogs] = useState<boolean>(false)
  const [showSpecs, setShowSpecs] = useState<boolean>(false)
  const [showComponents, setShowComponents] = useState<boolean>(false)
  const [showSell, setShowSell] = useState<boolean>(false)
  const [showInsurance, setShowInsurance] = useState<boolean>(false)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [showCompare, setShowCompare] = useState<boolean>(false)

  const [showLeaseModal, setShowLeaseModal] = useState<boolean>(false)
  const { company } = useCompany()

  useEffect(() => {
    let mounted = true

    if (!modelInfo && rawModelId) {
      void (async () => {
        const fetched = await fetchModelById(String(rawModelId))
        if (!mounted) return
        setResolvedModel(fetched)
        if (fetched?.cargo_type_name) setCargoName(fetched.cargo_type_name)
        if (fetched?.cargo_type_secondary_name) setCargoNameSecondary(fetched.cargo_type_secondary_name)
      })()
    } else {
      setResolvedModel(modelInfo ?? null)
      if (modelInfo) {
        if (modelInfo.cargo_type_name) setCargoName(modelInfo.cargo_type_name)
        if (modelInfo.cargo_type_secondary_name) setCargoNameSecondary(modelInfo.cargo_type_secondary_name)
      }
    }

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawModelId, modelInfo])

  useEffect(() => {
    let mounted = true

    async function loadIcon(cargoTypeId?: string | null) {
      if (!cargoTypeId) {
        setCargoIconUrl(null)
        return
      }
      try {
        const q = `?select=icon_url,name&id=eq.${encodeURIComponent(String(cargoTypeId))}&limit=1`
        const res: any = await getTable('cargo_types', q)
        const rows = Array.isArray(res?.data) ? res.data : []
        if (!mounted) return
        if (rows.length > 0) {
          const r = rows[0]
          setCargoIconUrl(r?.icon_url ?? null)
          if (!cargoName && r?.name) setCargoName(r.name)
        } else {
          setCargoIconUrl(null)
        }
      } catch (err) {
        console.debug('TruckModelCard: cargo type icon fetch failed', err)
        setCargoIconUrl(null)
      }
    }

    const ctId = resolvedModel?.cargo_type_id ?? null
    void loadIcon(ctId)

    return () => {
      mounted = false
    }
  }, [resolvedModel]) // eslint-disable-line

  const modelMake = resolvedModel?.make ?? (truck?.make ?? '')
  const modelName = resolvedModel?.model ?? (truck?.model ?? '')
  const primaryTitle = [modelMake, modelName].filter(Boolean).join(' ') || 'Unnamed model'

  const conditionScore = (truck?.condition_score as unknown as number) ?? resolvedModel?.condition_score ?? 0

  function handleToggleExpand() {
    setExpanded((s) => !s)
  }

  function buildFields(): Array<{ label: string; key: string; value: any }> {
    const out: Array<{ label: string; key: string; value: any }> = []
    const row: Record<string, any> = { ...(resolvedModel ?? {}) }

    if (cargoName) row.cargo_type_name = cargoName
    if (cargoNameSecondary) row.cargo_type_secondary_name = cargoNameSecondary
    row.condition_score = conditionScore

    if (row.gcw !== undefined && row.gcw !== null) {
      const num = Number(row.gcw)
      const map: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' }
      if (!Number.isNaN(num) && map[num]) {
        row.gcw = map[num]
      } else {
        const alt = (resolvedModel as any)?.cgw ?? null
        if (alt != null && !Number.isNaN(Number(alt)) && map[Number(alt)]) {
          row.gcw = map[Number(alt)]
        }
      }
    } else if ((resolvedModel as any)?.cgw !== undefined && (resolvedModel as any)?.cgw !== null) {
      const num = Number((resolvedModel as any).cgw)
      const map: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' }
      if (!Number.isNaN(num) && map[num]) {
        row.gcw = map[num]
      }
    }

    row.lease_rate = row.lease_rate ?? (truck?.lease_rate ?? null)
    row.list_price = row.list_price ?? row.price ?? (truck?.list_price ?? truck?.price ?? null)

    const fieldsOrder = [
      'make',
      'model',
      'country',
      'class',
      'year',
      'cargo_type_name',
      'cargo_type_secondary_name',
      'availability_days',
      'condition_score',
      'gcw',
      'lease_rate',
      'list_price',
    ]

    const labelFor: Record<string, string> = {
      make: 'Brand',
      model: 'Model',
      country: 'Country',
      class: 'Class',
      year: 'Year',
      cargo_type_name: 'Cargo Type Name',
      cargo_type_secondary_name: 'Cargo Type Secondary Name',
      availability_days: 'Availability Days',
      condition_score: 'Condition',
      gcw: 'GCW',
      lease_rate: 'Lease',
      list_price: 'Price',
    }

    fieldsOrder.forEach((k) => {
      out.push({ label: labelFor[k] ?? k, key: k, value: row[k] })
    })

    return out
  }

  const fields = buildFields()

  const leaseValue =
    typeof resolvedModel?.lease_rate === 'number'
      ? resolvedModel.lease_rate
      : typeof truck?.lease_rate === 'number'
      ? truck.lease_rate
      : resolvedModel?.lease_rate
      ? Number(resolvedModel.lease_rate)
      : null

  const listPriceValue =
    typeof resolvedModel?.list_price === 'number'
      ? resolvedModel.list_price
      : typeof resolvedModel?.price === 'number'
      ? resolvedModel.price
      : typeof truck?.list_price === 'number'
      ? truck.list_price
      : resolvedModel?.list_price
      ? Number(resolvedModel.list_price)
      : null

  const mileage = typeof truck?.mileage_km === 'number' ? truck.mileage_km : 0

  const isUnowned = !truck?.owner_user_id && !truck?.owner_company_id
  const componentsDisabled = Boolean(isMarket || (isUnowned && mileage === 0))
  const showLifecycleActions = !componentsDisabled

  return (
    <div
      className={`modern-card relative w-full rounded-lg bg-white overflow-visible border border-gray-200`}
      data-asset-model-id={rawModelId ?? resolvedModel?.id ?? truck?.id ?? undefined}
      role="article"
      aria-label={`Truck model card ${primaryTitle}`}
    >
      <div className="flex items-center gap-4 p-3 w-full">
        <div className="h-12 w-1 rounded-full bg-gradient-to-b from-sky-400 to-emerald-400" />

        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">Truck model:</div>
            <div className="text-sm font-medium truncate flex items-center gap-2">
              <span className="truncate">{primaryTitle}</span>
              {cargoNameSecondary ? (
                <span className="inline-block text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{cargoNameSecondary}</span>
              ) : null}
            </div>
          </div>

          <div className="ml-auto flex-shrink-0">
            {cargoIconUrl ? <img src={cargoIconUrl} alt={cargoName ?? 'Cargo type'} className="h-6 w-6 rounded-md object-cover" /> : <Truck className="w-6 h-6 text-slate-400" />}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-6 flex-shrink-0">
          <StatChip icon={<Gauge className="w-4 h-4 text-slate-400" />} label="Condition" value={`${conditionScore}`} className="min-w-[88px]" />

          <div className="hidden sm:flex flex-col text-center min-w-[72px]">
            <div className="text-xs text-slate-500">Class</div>
            <div className="text-sm font-medium text-slate-800 truncate">{resolvedModel?.class ?? <span className="text-slate-500">Not specified</span>}</div>
          </div>

          <div className="hidden sm:flex flex-col text-center min-w-[56px]">
            <div className="text-xs text-slate-500">Year</div>
            <div className="text-sm font-medium text-slate-800 truncate">{resolvedModel?.year ?? <span className="text-slate-500">Not specified</span>}</div>
          </div>

          <div className="flex flex-col text-center min-w-[96px]">
            <div className="text-xs text-slate-500">Available in (days)</div>
            <div className="text-sm font-medium text-slate-800 truncate">{resolvedModel?.availability_days != null ? `${resolvedModel.availability_days}` : <span className="text-slate-500">Not specified</span>}</div>
          </div>

          <div className="flex items-center gap-3">
            <PricePill label="Lease Rate" value={leaseValue ?? null} color="green" />
            <PricePill label="List Price" value={listPriceValue ?? null} color="sky" />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="relative">
            <button type="button" aria-haspopup="true" aria-expanded={expanded} aria-label={expanded ? 'Close truck details' : 'Open truck details'} onClick={handleToggleExpand} className="p-2 rounded-md hover:bg-gray-100 text-slate-600">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className={`px-4 overflow-hidden transition-all duration-200 ${expanded ? 'max-h-[800px] py-4' : 'max-h-0 py-0'}`} aria-hidden={!expanded}>
        <div className="bg-slate-50 border border-slate-100 rounded-md p-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {fields.map((f) => {
              return (
                <div key={f.key}>
                  <div className="text-xs text-slate-500">{f.label}</div>
                  <div className="text-sm font-medium text-slate-800">
                    {f.key === 'condition_score'
                      ? String(f.value ?? '0')
                      : f.key === 'lease_rate' || f.key === 'list_price'
                      ? (formatCurrency(typeof f.value === 'number' ? f.value : Number(f.value)) ?? (
                          <span className="text-slate-500">Not specified</span>
                        ))
                      : prettyValue(f.value)}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-3 flex items-center gap-3 justify-end">
            <div className="mr-auto flex items-center gap-2">
              <div className="text-xs text-slate-500 hidden sm:block">Mileage in (km)</div>
              <div className="text-sm text-slate-500">{`${mileage ?? 0} km`}</div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCompare(true)
              }}
              aria-label="Compare Trucks"
              aria-haspopup="dialog"
              aria-controls={`truck-compare-${id}`}
              aria-expanded={String(showCompare)}
              title="Compare this truck model with another model"
              className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded flex items-center"
            >
              <Columns className="w-4 h-4 mr-2 text-slate-500" />
              <span>Compare Trucks</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!componentsDisabled) setShowComponents(true)
              }}
              disabled={componentsDisabled}
              aria-disabled={componentsDisabled}
              title={componentsDisabled ? 'Components are assigned after purchase or lease' : 'Open truck components'}
              className={`px-3 py-1 text-sm rounded ${componentsDisabled ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white hover:bg-slate-100 border border-slate-200'}`}
            >
              Truck Components
            </button>

            <button type="button" onClick={() => setShowSpecs(true)} className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded">
              Specifications
            </button>

            <button
              type="button"
              onClick={() => setShowLeaseModal(true)}
              className="px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 rounded text-white"
              aria-label="Lease Truck"
            >
              Lease Truck
            </button>

            <button
              type="button"
              onClick={() => {
                const payload: PurchaseClickPayload = {
                  ...truck,
                  id,
                  master_truck_id: rawModelId ?? resolvedModel?.id ?? truck?.id ?? null,
                  name: primaryTitle,
                  make: resolvedModel?.make ?? truck?.make ?? null,
                  model: resolvedModel?.model ?? truck?.model ?? null,
                  list_price:
                    typeof listPriceValue === 'number'
                      ? listPriceValue
                      : listPriceValue != null
                      ? Number(listPriceValue)
                      : null,
                  price:
                    typeof listPriceValue === 'number'
                      ? listPriceValue
                      : listPriceValue != null
                      ? Number(listPriceValue)
                      : null,
                  availability_days:
                    resolvedModel?.availability_days != null
                      ? Number(resolvedModel.availability_days)
                      : (truck?.availability_days != null ? Number(truck.availability_days) : 0),
                }

                if (onPurchaseClick) {
                  onPurchaseClick(payload)
                } else {
                  console.debug('Purchase Truck clicked (no handler provided)', payload)
                }
              }}
              className="px-3 py-1 text-sm bg-sky-600 hover:bg-sky-700 border border-sky-600 rounded text-white"
              aria-label="Purchase Truck"
            >
              Purchase Truck
            </button>

            {showLifecycleActions && (
              <>
                <button type="button" onClick={() => setShowLogs(true)} className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded">
                  View logs
                </button>

                <button type="button" onClick={() => setShowInsurance(true)} className="px-3 py-1 text-sm bg-white hover:bg-slate-100 border border-slate-200 rounded">
                  Insurance
                </button>

                <button type="button" onClick={() => setMaintenanceModalOpen(true)} className="px-3 py-1 text-sm bg-amber-600 hover:bg-amber-700 border border-amber-600 rounded text-white">
                  Maintenance check
                </button>

                <button type="button" onClick={() => setShowSell(true)} className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 border border-red-600 rounded text-white">
                  Sell Truck
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <LogModal truckId={id} open={showLogs} onClose={() => setShowLogs(false)} />
      <TruckSpecModal modelId={rawModelId} open={showSpecs} onClose={() => setShowSpecs(false)} />
      <TruckComponentsModal truckId={id} open={showComponents} onClose={() => setShowComponents(false)} />
      <InsuranceModal truckId={id} condition={(truck?.condition_score as number) ?? 0} open={showInsurance} onClose={() => setShowInsurance(false)} />
      <SellTruckModal truckId={id} condition={(truck?.condition_score as number) ?? 0} open={showSell} onClose={() => setShowSell(false)} />
      <MaintenanceModal truckId={id} open={maintenanceModalOpen} onClose={() => setMaintenanceModalOpen(false)} onDone={() => {}} />

      <LeaseConfirmModal
        open={showLeaseModal}
        onClose={() => setShowLeaseModal(false)}
        assetModelId={resolvedModel?.id ?? rawModelId}
        companyId={company?.id ?? null}
        onSuccess={() => {
          setShowLeaseModal(false)
        }}
      />

      <TruckCompareModal id={`truck-compare-${id}`} open={showCompare} onClose={() => setShowCompare(false)} currentModel={resolvedModel} currentTruck={truck} />
    </div>
  )
}