/**
 * MaintenanceModal.tsx
 *
 * Modal UI to perform a maintenance check for a single truck.
 *
 * Loads authoritative user_trucks values and optional latest maintenance snapshot,
 * computes cost estimates and allows creating a maintenance check.
 */

import React, { useEffect, useState } from 'react'
import ModalShell from '../common/ModalShell'
import { computeMaintenanceCost, createMaintenanceCheck, fetchMaintenanceChecks } from '../../services/maintenanceService'
import type { MaintenanceCheck } from '../../services/maintenanceService'
import { supabaseFetch } from '../../lib/supabase'
import ExpandableBreakdown from '../common/ExpandableBreakdown'

/**
 * MaintenanceModalProps
 *
 * Props for the MaintenanceModal component.
 */
export interface MaintenanceModalProps {
  truckId: string
  open: boolean
  onClose: () => void
  onDone?: () => void
  truckData?: any
}

/**
 * formatDateDDMMYYYY
 *
 * Format a Date or date string as DD/MM/YYYY
 *
 * @param v - date value
 */
function formatDateDDMMYYYY(v?: string | null) {
  if (!v) return '—'
  try {
    const d = new Date(v)
    if (isNaN(d.getTime())) return '—'
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch {
    return '—'
  }
}

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/**
 * MaintenanceModal
 *
 * Component presenting estimates, latest snapshot and history, and actions to create a maintenance check.
 *
 * Uses user_trucks as the single source-of-truth for:
 * - mileage_km
 * - last_maintenance_at
 * - next_maintenance_km
 * - model_year
 *
 * maintenance_checks may contain snapshots, but when creating a maintenance_check
 * we explicitly include these authoritative fields from user_trucks so the DB row
 * mirrors the source-of-truth.
 *
 * @param props - modal props
 */
export default function MaintenanceModal({ truckId, open, onClose, onDone, truckData }: MaintenanceModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [odometer, setOdometer] = useState<string>('')
  const [performedAt, setPerformedAt] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState<string>('')

  const [lastMaintenanceDate, setLastMaintenanceDate] = useState<string | null>(null)
  const [nextMaintenanceKm, setNextMaintenanceKm] = useState<number | null>(null)
  const [currentMileage, setCurrentMileage] = useState<number>(0)
  const [snapshotModelYear, setSnapshotModelYear] = useState<number | null>(null)

  const [estOwner, setEstOwner] = useState<any>(null)
  const [estCity, setEstCity] = useState<any>(null)
  const [estRemote, setEstRemote] = useState<any>(null)
  const [history, setHistory] = useState<MaintenanceCheck[]>([])

  /**
   * authoritativeRow
   *
   * Store the authoritative user_trucks row so other handlers (submit) can access
   * the single source-of-truth values.
   */
  const [authoritativeRow, setAuthoritativeRow] = useState<any>(null)

  useEffect(() => {
    let mounted = true

    /**
     * load
     *
     * Load authoritative user_trucks row first (mileage/model_year/next_maintenance_km)
     * then load maintenance_checks for history and optional snapshot values used for estimates.
     */
    async function load() {
      if (!open) return
      setLoading(true)
      setError(null)
      try {
        // 1) Fetch authoritative user_trucks row
        let row: any = null
        try {
          const tRes: any = await supabaseFetch(
            `/rest/v1/user_trucks?id=eq.${encodeURIComponent(truckId)}&select=mileage_km,last_maintenance_at,next_maintenance_km,purchase_date,created_at,master_truck_id,model_class,model,model_year`
          )
          row = Array.isArray(tRes?.data) && tRes.data.length > 0 ? tRes.data[0] : null
        } catch (err) {
          row = null
        }

        if (!mounted) return

        // Persist authoritative row for handlers
        setAuthoritativeRow(row)

        // 2) Load latest maintenance_checks snapshot (if any)
        let snapshot: any = null
        try {
          const sRes: any = await supabaseFetch(
            `/rest/v1/maintenance_checks?user_truck_id=eq.${encodeURIComponent(truckId)}&order=performed_at.desc,created_at.desc&limit=1&select=odometer_km,mileage_km,performed_at,next_maintenance_km,model_year`
          )
          if (Array.isArray(sRes?.data) && sRes.data.length > 0) snapshot = sRes.data[0]
        } catch {
          snapshot = null
        }

        // Populate UI fields: use user_trucks row as single-source-of-truth when available.
        if (row) {
          const authoritativeMileage = Number(row.mileage_km ?? snapshot?.mileage_km ?? snapshot?.odometer_km ?? truckData?.mileage_km ?? 0)
          setCurrentMileage(authoritativeMileage)
          setLastMaintenanceDate(row.last_maintenance_at ?? snapshot?.performed_at ?? null)
          setNextMaintenanceKm(row.next_maintenance_km !== undefined && row.next_maintenance_km !== null ? Number(row.next_maintenance_km) : snapshot?.next_maintenance_km ?? null)
          setOdometer(String(Number(row.mileage_km ?? snapshot?.mileage_km ?? snapshot?.odometer_km ?? truckData?.mileage_km ?? '')))
          setSnapshotModelYear(row.model_year ?? snapshot?.model_year ?? truckData?.model_year ?? null)
        } else if (snapshot) {
          const snapMileage = Number(snapshot.mileage_km ?? snapshot.odometer_km ?? 0)
          setCurrentMileage(snapMileage)
          setLastMaintenanceDate(snapshot.performed_at ?? null)
          setNextMaintenanceKm(snapshot.next_maintenance_km ? Number(snapshot.next_maintenance_km) : null)
          setOdometer(String(snapMileage))
          setSnapshotModelYear(snapshot.model_year ?? null)
        } else {
          setCurrentMileage(0)
          setOdometer('')
          setLastMaintenanceDate(null)
          setNextMaintenanceKm(null)
          setSnapshotModelYear(null)
        }

        // Build stub truck for estimate calculations - prefer authoritative row for mileage/model_year
        const stubTruckForCalc: any = {
          id: truckId,
          mileage_km: row?.mileage_km ?? snapshot?.mileage_km ?? truckData?.mileage_km ?? 0,
          model_year: row?.model_year ?? snapshot?.model_year ?? truckData?.model_year ?? null,
          model: truckData?.model ?? (row ? row.model : undefined) ?? snapshot?.model,
          class: truckData?.model_class ?? (row ? row.model_class : undefined),
        }

        // Compute estimates
        const [owner, city, remote] = await Promise.all([
          computeMaintenanceCost(stubTruckForCalc as any, 'owner_hub'),
          computeMaintenanceCost(stubTruckForCalc as any, 'city'),
          computeMaintenanceCost(stubTruckForCalc as any, 'remote'),
        ])
        if (!mounted) return
        setEstOwner(owner)
        setEstCity(city)
        setEstRemote(remote)

        // Load history
        try {
          const hist = await fetchMaintenanceChecks(truckId)
          if (!mounted) return
          setHistory(hist.slice(0, 10))
        } catch {
          if (!mounted) return
          setHistory([])
        }
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message ?? String(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, truckId])

  /**
   * handleSubmit
   *
   * Create maintenance check with selected garage type and then update user_trucks
   *
   * We explicitly include authoritative fields from user_trucks so maintenance_checks
   * contains a snapshot of the single source-of-truth values.
   */
  async function handleSubmit(garageType: 'owner_hub' | 'city' | 'remote') {
    setLoading(true)
    setError(null)
    try {
      const od = Number(odometer)
      if (Number.isNaN(od) || od < 0) {
        setError('Please enter a valid odometer value')
        setLoading(false)
        return
      }

      // Build payload and include authoritative values when available
      const payload: any = {
        user_truck_id: truckId,
        performed_at: performedAt,
        odometer_km: od,
        garage_type: garageType,
        notes,
      }

      // Attach single-source-of-truth fields from authoritativeRow if present
      if (authoritativeRow) {
        if (authoritativeRow.mileage_km !== undefined) payload.mileage_km = authoritativeRow.mileage_km
        if (authoritativeRow.model_year !== undefined) payload.model_year = authoritativeRow.model_year
        if (authoritativeRow.next_maintenance_km !== undefined) payload.next_maintenance_km = authoritativeRow.next_maintenance_km
        if (authoritativeRow.last_maintenance_at !== undefined) payload.last_maintenance_at = authoritativeRow.last_maintenance_at
      } else {
        // Fallback to UI state if authoritativeRow is missing
        payload.mileage_km = currentMileage
        if (snapshotModelYear !== null) payload.model_year = snapshotModelYear
        if (nextMaintenanceKm !== null) payload.next_maintenance_km = nextMaintenanceKm
        if (lastMaintenanceDate !== null) payload.last_maintenance_at = lastMaintenanceDate
      }

      const res = await createMaintenanceCheck(payload)
      if (res && res.success) {
        if (onDone) onDone()
        onClose()
      } else {
        setError(res?.error ?? 'Failed to schedule maintenance')
      }
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  // remaining km to next maintenance derived from authoritative nextMaintenanceKm
  const nextDiff =
    nextMaintenanceKm !== null && nextMaintenanceKm !== undefined ? Number(nextMaintenanceKm) - Number(currentMileage ?? 0) : null
  const remainingKm = nextDiff !== null ? Math.round(nextDiff) : null

  const nextTextClass = nextDiff === null ? 'text-slate-700' : nextDiff > 0 ? 'text-slate-800' : nextDiff > -3000 ? 'text-amber-700' : 'text-rose-700'

  return (
    <ModalShell open={open} onClose={onClose} title="Maintenance" size="md" footer={null}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-500">Last maintenance</div>
            <div className="text-sm font-medium text-slate-800">{formatDateDDMMYYYY(lastMaintenanceDate)}</div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Next maintenance check in (km)</div>
            <div className={`text-sm font-medium ${nextTextClass}`}>{nextMaintenanceKm === null ? '—' : `${Number(nextMaintenanceKm).toLocaleString()} km`}</div>
            <div className="text-xs text-slate-500 mt-1">{remainingKm === null ? '—' : `${Math.max(-9999999, remainingKm).toLocaleString()} km remaining`}</div>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Odometer (km)</div>
          <input
            value={odometer}
            onChange={(e) => setOdometer(e.target.value.replace(/[^0-9.]/g, ''))}
            className="text-sm px-2 py-1 border border-slate-200 rounded w-full"
            aria-label="Odometer"
          />
        </div>

        <div>
          <div className="text-xs text-slate-500">Notes (optional)</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm px-2 py-1 border border-slate-200 rounded w-full" rows={3} />
        </div>

        <div className="text-sm text-slate-600">
          Info:
          <ul className="list-disc list-inside ml-4 mt-1">
            <li>Owner Repair Garage: 50% cost, 50% faster (12 hours). Mechanics bonuses apply.</li>
            <li>City Repair Garage: standard cost & duration (24 hours).</li>
            <li>Remote Repair Garage: 3× cost, 48 hours duration when truck is away from company hub.</li>
            <li>If any components have condition &lt; 20% they will be auto-replaced and charged.</li>
          </ul>

          {estCity ? <div className="mt-3"><ExpandableBreakdown breakdown={estCity.breakdown} currentMileage={currentMileage} /></div> : null}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div className="p-3 rounded border bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Send to Company Repair Garage</div>
                <div className="text-xs text-slate-500">Faster and cheaper in your hub</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-900">{estOwner ? `${money.format(estOwner.serviceCostCents / 100)}` : '—'}</div>
                <div className="text-xs text-slate-500">{estOwner ? `${estOwner.durationHours} hours` : '—'}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={() => handleSubmit('owner_hub')} disabled={loading} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded">
                Send to Company Garage
              </button>
            </div>
            {estOwner ? <div className="text-xs text-slate-500 mt-2">Breakdown: {estOwner.breakdown ? `${money.format(estOwner.breakdown.totalBeforeGarage / 100)} + ${money.format(estOwner.breakdown.mileageCost / 100)} mileage` : '—'}</div> : null}
          </div>

          <div className="p-3 rounded border bg-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Send to City Repair Garage</div>
                <div className="text-xs text-slate-500">Standard cost & duration (or remote if outside hub)</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-900">{estCity ? `${money.format(estCity.serviceCostCents / 100)}` : '—'}</div>
                <div className="text-xs text-slate-500">{estCity ? `${estCity.durationHours} hours` : '—'}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={() => handleSubmit('city')} disabled={loading} className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded">
                Send to City Garage
              </button>
            </div>
            {estCity ? <div className="text-xs text-slate-500 mt-2">Breakdown: {estCity.breakdown ? `${money.format(estCity.breakdown.totalBeforeGarage / 100)} + ${money.format(estCity.breakdown.mileageCost / 100)} mileage` : '—'}</div> : null}
          </div>

          <div className="text-xs text-slate-500">Recent maintenance checks</div>
          <div className="max-h-40 overflow-auto space-y-2">
            {history.length === 0 ? (
              <div className="text-sm text-slate-500">No maintenance history</div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="text-sm p-2 border rounded bg-white">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{formatDateDDMMYYYY(h.performed_at)}</div>
                    <div className="text-slate-600">{`${h.mileage_km?.toLocaleString?.() ?? h.odometer_km} km`}</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {h.garage_type} {h.total_cost_cents ? `• ${money.format((h.total_cost_cents ?? 0) / 100)}` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {error ? <div className="text-sm text-rose-600">{error}</div> : null}

        <div className="flex justify-end">
          <button onClick={onClose} className="px-3 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-sm">
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
