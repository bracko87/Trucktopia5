/**
 * LeaseConfirmModal.tsx
 *
 * Page-styled modal that confirms leasing an asset and creates both:
 *  - a user_trucks row (the actual truck placed into the user's fleet)
 *  - a user_leases row (the lease record)
 *
 * UI/layout preserved. Improvements:
 * - Uses computeInstallment(...) to compute and display installment = lease_rate / term
 * - Ensures inserted user_trucks and user_leases include owner_user_auth_id,
 *   owner_user_id and owner_company_id so DB triggers and UI work correctly.
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { computeInstallment, formatUSD } from '../../lib/finance'

/**
 * Props for LeaseConfirmModal
 */
interface LeaseConfirmModalProps {
  /** Whether modal is open */
  open: boolean
  /** Close callback */
  onClose: () => void
  /** Asset model id to lease */
  assetModelId?: string | null
  /** Company id from app context (preferred) */
  companyId?: string | null
  /** Optional override lease rate (if provided by caller) */
  leaseRateOverride?: number | null
  /** Optional callback invoked after successful lease creation */
  onSuccess?: (leaseId: string | null, truckId: string | null) => void
}

/**
 * addWeeks
 *
 * Add weeks to a date and return a new Date.
 *
 * @param d base date
 * @param weeks number of weeks to add
 * @returns Date
 */
function addWeeks(d: Date, weeks: number): Date {
  return new Date(d.getTime() + weeks * 7 * 24 * 60 * 60 * 1000)
}

/**
 * LeaseConfirmModal
 *
 * Renders the page-styled confirmation modal and performs two inserts when confirmed:
 *  1) user_trucks (master_truck_id -> actual truck)
 *  2) user_leases (lease record)
 *
 * The modal content (backdrop + panel) is rendered into document.body using a portal.
 *
 * NOTE: Frequency and Installments are forced to weekly and 60 respectively.
 *
 * @param props LeaseConfirmModalProps
 * @returns JSX.Element | null
 */
export default function LeaseConfirmModal({
  open,
  onClose,
  assetModelId,
  companyId = null,
  leaseRateOverride = null,
  onSuccess,
}: LeaseConfirmModalProps): JSX.Element | null {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [leaseRate, setLeaseRate] = React.useState<number | null>(null)
  const [modelName, setModelName] = React.useState<string | null>(null)
  const [resolvedModelId, setResolvedModelId] = React.useState<string | null>(null)

  // Forced, unchangeable terms
  const FIXED_FREQUENCY: 'weekly' = 'weekly'
  const FIXED_INSTALLMENTS = 60 // 60 weeks -> 420 days

  React.useEffect(() => {
    if (open && !assetModelId) {
      // eslint-disable-next-line no-console
      console.warn('LeaseConfirmModal opened without explicit assetModelId - attempting fallbacks')
    }
  }, [open, assetModelId])

  React.useEffect(() => {
    if (!open) return
    setError(null)
    setLoading(true)
    setModelName(null)
    setLeaseRate(null)

    let mounted = true

    async function loadModel() {
      try {
        const resolved = assetModelId ?? null
        if (!mounted) return
        setResolvedModelId(resolved)

        if (!resolved) {
          if (mounted) {
            setError('No truck model id available to load lease terms.')
            setLoading(false)
          }
          return
        }

        // honor caller override first
        if (leaseRateOverride !== null && leaseRateOverride !== undefined) {
          if (mounted) {
            setLeaseRate(Number(leaseRateOverride))
            setModelName(null)
            setLoading(false)
          }
          return
        }

        // Fetch truck model row using official client
        const { data, error: fetchErr } = await supabase
          .from('truck_models')
          .select('id, make, model, lease_rate, list_price')
          .eq('id', resolved)
          .maybeSingle()

        if (!mounted) return

        if (fetchErr) {
          setError('Failed to load model info')
          setLeaseRate(null)
        } else if (data) {
          setModelName([data.make, data.model].filter(Boolean).join(' '))
          const r = (data as any).lease_rate
          setLeaseRate(r !== null && r !== undefined ? Number(r) : null)
        } else {
          setError('Truck model not found')
          setLeaseRate(null)
        }
      } catch (e: any) {
        setError(e?.message ?? 'Unknown load error')
        setLeaseRate(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadModel()
    return () => {
      mounted = false
    }
  }, [open, assetModelId, leaseRateOverride])

  if (!open) return null

  // Use canonical helper: installment = lease_rate / FIXED_INSTALLMENTS
  const installmentAmount = computeInstallment(leaseRate, FIXED_INSTALLMENTS)

  /**
   * handleConfirm
   *
   * Create a user_trucks and a user_leases row using the provided company id and
   * selected terms. Uses owner_user_auth_id for auth-mapped rows.
   */
  async function handleConfirm() {
    setLoading(true)
    setError(null)

    try {
      if (!resolvedModelId) {
        setError('Model missing')
        setLoading(false)
        return
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Get local user row to resolve owner_user_id and owner_company_id
      const { data: localUser } = await supabase
        .from('users')
        .select('id, company_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      const ownerUserId = (localUser as any)?.id ?? null
      const ownerCompanyId = (localUser as any)?.company_id ?? null

      const start = new Date()
      const end = addWeeks(start, FIXED_INSTALLMENTS)

      /* --------------------------------------------------
         1. CREATE TRUCK (physical object, no lease dates/rates)
      -------------------------------------------------- */
      const { data: truckRow, error: truckErr } = await supabase
        .from('user_trucks')
        .insert({
          master_truck_id: resolvedModelId,
          owner_user_auth_id: user.id,
          owner_user_id: ownerUserId,
          owner_company_id: ownerCompanyId,
          acquisition_type: 'leased',
          mileage_km: 0,
          availability_days: 1,
          condition_score: 100,
          is_active: true,
        })
        .select('id')
        .single()

      if (truckErr) {
        setError(truckErr.message)
        setLoading(false)
        return
      }

      /* --------------------------------------------------
         2. CREATE LEASE (financial contract controls dates & payments)
      -------------------------------------------------- */
      const { data: leaseRow, error: leaseErr } = await supabase
        .from('user_leases')
        .insert({
          asset_model_id: resolvedModelId,
          asset_type: 'truck',
          owner_user_auth_id: user.id,
          owner_user_id: ownerUserId,
          owner_company_id: ownerCompanyId,
          lease_start: start.toISOString(),
          lease_end: end.toISOString(),
          lease_rate: leaseRate,
          acquisition_type: 'lease',
          status: 'active',
          is_active: true,
        })
        .select('id, lease_rate')
        .single()

      if (leaseErr) {
        setError(leaseErr.message)
        setLoading(false)
        return
      }

      setLoading(false)

      if (onSuccess) onSuccess((leaseRow as any).id, (truckRow as any).id)

      onClose()
    } catch (e: any) {
      setError(e?.message ?? 'Unexpected error')
      setLoading(false)
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!loading) onClose()
        }}
        aria-hidden
      />
      {/* Panel */}
      <div className="relative w-full max-w-5xl mx-4 bg-white rounded-lg shadow-2xl overflow-auto transform transition-all duration-200 ease-out scale-100">
        <div className="flex flex-col md:flex-row">
          {/* Left column: visual / heading */}
          <div className="md:w-1/3 px-8 py-10 bg-gradient-to-b from-emerald-50 to-white rounded-l-lg">
            <h3 className="text-xl font-semibold mb-3">Confirm lease</h3>
            <p className="text-sm text-slate-600 mb-6">
              You are about to lease this asset. Review the rate and terms below before confirming.
            </p>

            <div className="text-xs text-slate-500">Asset</div>
            <div className="text-lg font-medium mb-4">{loading ? 'Loading…' : modelName ?? (resolvedModelId ?? assetModelId) ?? 'Unknown model'}</div>

            <div className="text-xs text-slate-500">Lease rate</div>
            <div className="text-2xl font-semibold mb-4">
              {loading
                ? '—'
                : leaseRate !== null && leaseRate !== undefined
                ? formatUSD(Number(leaseRate))
                : '—'}
            </div>

            <div className="text-xs text-slate-500">Estimated installment</div>
            <div className="text-sm font-medium">
              {loading
                ? '—'
                : `${FIXED_INSTALLMENTS} installments left · ${formatUSD(installmentAmount)} each`}
            </div>

            {!loading && !leaseRate && !modelName && <div className="text-xs text-rose-600 mt-3">If this remains blank, ensure the caller passes a valid assetModelId prop.</div>}
          </div>

          {/* Right column: controls */}
          <div className="md:w-2/3 px-8 py-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h4 className="text-lg font-medium">Terms</h4>
                <p className="text-sm text-slate-500">60 week term is fixed and cannot be changed.</p>
              </div>
              <button
                onClick={() => {
                  if (!loading) onClose()
                }}
                className="text-slate-500 hover:text-slate-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Frequency</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm bg-slate-50 cursor-not-allowed" value={FIXED_FREQUENCY} disabled aria-disabled="true">
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Installments</label>
                <input type="number" min={1} step={1} className="w-full rounded-md border px-3 py-2 text-sm bg-slate-50 cursor-not-allowed" value={FIXED_INSTALLMENTS} readOnly aria-readonly="true" aria-disabled="true" />
                <div className="text-xs text-slate-400 mt-1">Total periods: {FIXED_INSTALLMENTS}</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs text-slate-500">Lease period</div>
              <div className="text-sm font-medium">
                {(() => {
                  const start = new Date()
                  let end = start
                  if (FIXED_FREQUENCY === 'weekly') {
                    end = addWeeks(start, FIXED_INSTALLMENTS)
                  } else {
                    end = addWeeks(start, FIXED_INSTALLMENTS)
                  }
                  return `${start.toLocaleDateString()} — ${end.toLocaleDateString()}`
                })()}
              </div>
            </div>

            {error && <div className="text-xs text-rose-600 mb-4">{error}</div>}

            <div className="flex items-center justify-end gap-3 mt-8">
              <button type="button" onClick={() => onClose()} disabled={loading} className="px-4 py-2 rounded-md text-sm bg-transparent border">
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading || !resolvedModelId}
                className="px-4 py-2 rounded-md text-sm bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 disabled:opacity-50"
              >
                {loading ? 'Processing…' : 'Confirm lease'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Render modal into document.body so backdrop/fixed positioning always works.
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}
