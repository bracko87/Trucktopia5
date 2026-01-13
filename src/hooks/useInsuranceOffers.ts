/**
 * useInsuranceOffers.ts
 *
 * Hook to compute insurance offers for a given user_truck id.
 *
 * Responsibilities:
 * - Compute offer values (percent, premium amount) for a set of plan codes
 *   using computePremiumForTruck helper (keeps parity with DB logic).
 * - Expose loading / error / refresh capability.
 * - Provide developer debug information to help diagnose missing plans / failures.
 */

import { useEffect, useState, useCallback } from 'react'
import { computePremiumForTruck, InsurancePlan, ComputeResult, getInsurancePlans } from '../lib/insurance'

/**
 * InsuranceOffer
 *
 * Simplified offer shape returned by the hook for UI consumption.
 */
export interface InsuranceOffer {
  /** plan code used to compute (e.g. 'basic'|'standard'|'premium') */
  code: string
  /** human title (from insurance_plans.name or code) */
  title: string
  /** applied percent used to compute premium */
  percent: number
  /** premium amount in same currency as plan/list_price */
  premiumAmount: number
  /** coverage percent from plan metadata (optional) */
  coveragePercent?: number | null
  /** underlying list price used for computation */
  listPrice?: number | null
  /** interpreted truck age in years */
  ageYears?: number | null
  /** raw compute result for advanced UI if needed */
  raw?: ComputeResult | null
}

/**
 * Debug information returned by the hook to aid diagnosing failures.
 */
export interface InsuranceOffersDebug {
  /** Raw plan metadata fetched from DB */
  planMeta: InsurancePlan[]
  /** Map of plan code -> InsurancePlan (by code lowercased) */
  metaByCode: Record<string, InsurancePlan>
  /** Plan codes attempted */
  planCodesAttempted: string[]
  /** Detailed results for each computed plan */
  computeResults: Array<
    | { ok: true; code: string; offer: InsuranceOffer }
    | { ok: false; code: string; err: string }
  >
}

/**
 * useInsuranceOffers
 *
 * Load and compute offers for provided userTruckId.
 *
 * @param userTruckId - user_trucks.id
 * @param planCodes - list of plan codes to request (defaults to commonly used variants)
 * @returns { loading, offers, error, refresh, debug }
 */
export default function useInsuranceOffers(
  userTruckId: string | null,
  planCodes: string[] = ['basic', 'plus', 'premium']
) {
  const [loading, setLoading] = useState<boolean>(false)
  const [offers, setOffers] = useState<InsuranceOffer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [force, setForce] = useState<number>(0)
  const [debug, setDebug] = useState<InsuranceOffersDebug | null>(null)

  const refresh = useCallback(() => setForce((f) => f + 1), [])

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!userTruckId) {
        setOffers([])
        setError(null)
        setLoading(false)
        setDebug(null)
        return
      }
      setLoading(true)
      setError(null)
      setDebug(null)
      try {
        // Resolve plan metadata (names / coverage) to show friendly titles
        const planMeta = await getInsurancePlans()
        const metaByCode: Record<string, InsurancePlan> = {}
        for (const p of planMeta || []) {
          if (p && p.code) metaByCode[(p.code || '').toLowerCase()] = p
        }

        // Compute offers in parallel using computePremiumForTruck to ensure parity
        const promises = planCodes.map(async (code) => {
          try {
            const computed = await computePremiumForTruck(userTruckId, code)
            const planCodeLower = (computed.plan?.code ?? code).toLowerCase()
            const meta = metaByCode[planCodeLower] || computed.plan || null
            const offer: InsuranceOffer = {
              code: planCodeLower,
              title: meta?.name ?? meta?.code ?? code,
              percent: computed.percent ?? 0,
              premiumAmount: Number(computed.premium_amount ?? 0),
              coveragePercent: computed.plan?.coverage_percent ?? undefined,
              listPrice: computed.list_price ?? null,
              ageYears: computed.age_years ?? null,
              raw: computed,
            }
            return { ok: true as const, offer, code: planCodeLower }
          } catch (err: any) {
            return { ok: false as const, err: err?.message ?? String(err), code }
          }
        })

        const results = await Promise.all(promises)
        if (!mounted) return

        const successful: InsuranceOffer[] = []
        const computeResults: InsuranceOffersDebug['computeResults'] = []
        for (const r of results) {
          if (r.ok) {
            successful.push(r.offer)
            computeResults.push({ ok: true, code: r.code, offer: r.offer })
          } else {
            computeResults.push({ ok: false, code: r.code, err: r.err })
          }
        }

        // Persist debug info for developer UI
        setDebug({
          planMeta: planMeta || [],
          metaByCode,
          planCodesAttempted: planCodes,
          computeResults,
        })

        if (successful.length === 0) {
          setError('No insurance offers available for this truck.')
          setOffers([])
        } else {
          setOffers(successful)
        }
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message ?? 'Failed to load insurance offers')
        setOffers([])
        setDebug((d) => ({
          planMeta: (d && d.planMeta) || [],
          metaByCode: (d && d.metaByCode) || {},
          planCodesAttempted: planCodes,
          computeResults: [{ ok: false, code: 'internal', err: err?.message ?? String(err) }],
        }))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTruckId, force, JSON.stringify(planCodes)])

  return { loading, offers, error, refresh, debug }
}
