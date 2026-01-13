/**
 * sellService.tsx
 *
 * Helpers to compute deterministic sell offers for user_trucks rows and perform
 * minimal client-side sell operations (fetching row, accepting offer).
 *
 * This file:
 * - exposes computeBasePriceFromUserTruck (price derived from new price, age, condition, mileage)
 * - exposes computeOffersFromUserTruck (simple 3-offer generator)
 * - exposes computeDetailedOffersFromUserTruck (5 offers: dealer, companies, private buyers)
 * - exposes fetchUserTruck and acceptOffer
 */

import { supabaseFetch, getCurrentUser } from '../lib/supabase'

/**
 * UserTruckRow
 *
 * Minimal client-side shape representing public.user_trucks row fields we use.
 */
export interface UserTruckRow {
  id: string
  master_truck_id?: string | null
  owner_user_id?: string | null
  owner_company_id?: string | null
  purchase_price?: number | null
  purchase_date?: string | null
  created_at?: string | null
  condition_score?: number | null
  mileage_km?: number | null
}

/**
 * Offer
 *
 * A sell offer returned to the UI.
 */
export interface Offer {
  id: string
  label: string
  price: number
  settlementDays: [number, number]
  note?: string
}

/**
 * DEFAULT_NEW_PRICE
 *
 * Fallback new market price used when user_trucks.purchase_price is absent.
 */
const DEFAULT_NEW_PRICE = 30000

/**
 * seededRandom
 *
 * Deterministic pseudo-random number generator based on a string seed.
 *
 * @param seed - string seed
 * @returns number in [0,1)
 */
function seededRandom(seed: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0
  }
  // xorshift step
  h ^= h << 13
  h ^= h >>> 17
  h ^= h << 5
  return (h >>> 0) / 4294967295
}

/**
 * computeBasePriceFromUserTruck
 *
 * Compute a deterministic base price for a truck using only fields from user_trucks.
 *
 * Formula (high level):
 *  - newPrice (from purchase_price or fallback)
 *  - ageYears, conditionPct, mileageNormalized
 *  - weighted depreciation from these factors, capped at 50% of newPrice
 *
 * @param t - UserTruckRow
 * @returns base computed price (number, rounded)
 */
export function computeBasePriceFromUserTruck(t: UserTruckRow): number {
  const newPrice = Math.max(0, t.purchase_price ?? DEFAULT_NEW_PRICE)

  // compute age in years from purchase_date or created_at
  const dateStr = t.purchase_date ?? t.created_at ?? null
  let ageYears = 0
  if (dateStr) {
    const dt = new Date(dateStr)
    if (!Number.isNaN(dt.getTime())) {
      const now = new Date()
      ageYears = Math.max(0, now.getFullYear() - dt.getFullYear())
    }
  }

  const conditionPct = Math.max(0, Math.min(100, t.condition_score ?? 100)) / 100
  const mileageKm = Math.max(0, t.mileage_km ?? 0)

  // parameters
  const ageDepPerYear = 0.04 // 4% per year
  const lifecycleKm = 800000 // normalized km scale

  const ageFactor = Math.min(1, ageYears * ageDepPerYear) // 0..1
  const conditionLoss = 1 - conditionPct // 0..1
  const mileageNormalized = Math.min(1, mileageKm / lifecycleKm) // 0..1

  // weighted depreciation components
  const depreciation = Math.min(0.5, ageFactor * 0.45 + conditionLoss * 0.4 + mileageNormalized * 0.15)

  const base = Math.round(newPrice * (1 - depreciation))
  // ensure not below 50% of newPrice
  const minBase = Math.round(newPrice * 0.5)
  return Math.max(base, minBase)
}

/**
 * computeOffersFromUserTruck
 *
 * Generate Dealer, Company, Private offers deterministically based on truck id.
 *
 * Dealer is now slightly more generous (increased multiplier range) to avoid too-low instant offers.
 *
 * @param t - UserTruckRow
 * @returns Offer[]
 */
export function computeOffersFromUserTruck(t: UserTruckRow): Offer[] {
  const base = computeBasePriceFromUserTruck(t)
  const seed = (t.id ?? '') + 'offers'
  const r = seededRandom(seed)

  // Dealer: instant, slightly increased range vs previous logic so dealer offers are more attractive
  const dealerMul = 0.75 + r * 0.10 // ~75%..85% of base
  const dealerPrice = Math.max(0, Math.round(base * dealerMul))

  // Company: 2-5 day settlement, near base (0.93..1.00)
  const companyMul = 0.93 + (1 - r) * 0.07
  const companyPrice = Math.max(0, Math.round(base * companyMul))

  // Private: 7-14 days, 2-5% better than company
  const privateMul = 1 + (0.02 + r * 0.03) // 1.02..1.05
  const privatePrice = Math.max(0, Math.round(companyPrice * privateMul))

  const offers: Offer[] = [
    {
      id: 'dealer',
      label: 'Dealer buy (instant)',
      price: dealerPrice,
      settlementDays: [0, 0],
      note: 'Fast sale, instant payout. Dealer may offer lower price.',
    },
    {
      id: 'company',
      label: 'Company purchase (2-5 days)',
      price: companyPrice,
      settlementDays: [2, 5],
      note: 'Institutional buyer — reliable settlement window.',
    },
    {
      id: 'private',
      label: 'Private buyer (7-14 days)',
      price: privatePrice,
      settlementDays: [7, 14],
      note: 'Direct sale — better price but longer settlement.',
    },
  ]

  return offers
}

/**
 * computeDetailedOffersFromUserTruck
 *
 * Create 4-5 deterministic offers that are intentionally close in price but
 * differ by settlement timeframe. Uses:
 * - newPrice (purchase_price or fallback)
 * - computed base price (accounting for age/condition/mileage)
 *
 * Dealer may offer below the 50% new-price floor but will be somewhat increased
 * compared to the very low floor in previous iterations. Companies and private buyers
 * are clustered near the computed base price with small +/- variations to keep prices similar.
 *
 * @param t - UserTruckRow
 * @returns Offer[]
 */
export function computeDetailedOffersFromUserTruck(t: UserTruckRow): Offer[] {
  const newPrice = Math.max(0, t.purchase_price ?? DEFAULT_NEW_PRICE)
  const base = computeBasePriceFromUserTruck(t)
  const seed = (t.id ?? '') + 'detailed_offers'
  const r = seededRandom(seed) // 0..1 deterministic

  // Dealer: allow as low as 45%..65% of newPrice (increased vs previous 35..55)
  const dealerPrice = Math.round(newPrice * (0.45 + r * 0.20)) // 45..65%

  // Companies: cluster around base +/- small variance (2-6%)
  const companyA = Math.round(base * (0.98 + (r - 0.5) * 0.04)) // ~±2%
  const companyB = Math.round(base * (0.95 + (1 - r) * 0.05)) // small deterministic variance

  // Private buyers: slightly higher than companies (2-5% better) with different timeframes
  const privateA = Math.round(Math.max(companyA, companyB) * (1.02 + (r * 0.02))) // ~2..4% better
  const privateB = Math.round(Math.max(companyA, companyB) * (1.03 + ((1 - r) * 0.02))) // ~3..5% better

  const offers: Offer[] = [
    {
      id: 'dealer',
      label: 'Dealer buy (instant)',
      price: dealerPrice,
      settlementDays: [0, 0],
      note: 'Fast sale, instant payout. Price may be lower but payment is immediate.',
    },
    {
      id: 'company_fast',
      label: 'Company purchase (2-3 days)',
      price: companyA,
      settlementDays: [2, 3],
      note: 'Institutional buyer — fast settlement.',
    },
    {
      id: 'company_slow',
      label: 'Company purchase (3-5 days)',
      price: companyB,
      settlementDays: [3, 5],
      note: 'Institutional buyer — slightly different settlement timing.',
    },
    {
      id: 'private_fast',
      label: 'Private buyer (7-10 days)',
      price: privateA,
      settlementDays: [7, 10],
      note: 'Direct buyer — slightly better price, moderate settlement time.',
    },
    {
      id: 'private_slow',
      label: 'Private buyer (10-14 days)',
      price: privateB,
      settlementDays: [10, 14],
      note: 'Direct buyer — best estimated price but longest settlement.',
    },
  ]

  return offers
}

/**
 * fetchUserTruck
 *
 * Fetch a user_trucks row by id using REST endpoint.
 *
 * @param truckId - uuid
 * @returns UserTruckRow | null
 */
export async function fetchUserTruck(truckId: string): Promise<UserTruckRow | null> {
  const res = await supabaseFetch(`/rest/v1/user_trucks?id=eq.${encodeURIComponent(truckId)}&select=*`)
  const rows = Array.isArray(res.data) ? res.data : []
  return rows[0] ?? null
}

/**
 * acceptOffer
 *
 * Attempt to accept an offer:
 *  - Validates current auth user owns the truck (owner_user_id matches public.users.id)
 *  - Deletes the truck row from user_trucks
 *
 * IMPORTANT:
 * - This operation is not atomic with payments. For production you should implement
 *   a server-side RPC that:
 *    - validates ownership
 *    - inserts financial transactions/credits
 *    - deletes or marks truck sold
 *    - returns success in a DB transaction
 *
 * @param truckId - string
 * @param offer - Offer accepted
 * @returns { success: boolean, message?: string }
 */
export async function acceptOffer(truckId: string, offer: Offer): Promise<{ success: boolean; message?: string }> {
  try {
    const me = await getCurrentUser()
    const authUser = me?.data ?? null
    if (!authUser || !authUser.id) return { success: false, message: 'Not authenticated' }

    const usersRes = await supabaseFetch(`/rest/v1/users?auth_user_id=eq.${encodeURIComponent(authUser.id)}&select=id`)
    const userRows = Array.isArray(usersRes.data) ? usersRes.data : []
    const publicUser = userRows[0]
    if (!publicUser || !publicUser.id) return { success: false, message: 'User profile not found (public.users)' }

    const truck = await fetchUserTruck(truckId)
    if (!truck) return { success: false, message: 'Truck not found' }

    const ownerUserId = truck.owner_user_id ?? null
    if (!ownerUserId || ownerUserId !== publicUser.id) {
      return { success: false, message: 'You do not own this truck' }
    }

    const del = await supabaseFetch(`/rest/v1/user_trucks?id=eq.${encodeURIComponent(truckId)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    })

    if (del && (del.status === 200 || del.status === 204)) {
      return { success: true, message: 'Truck sold and removed from fleet' }
    }

    return { success: false, message: `Delete failed: ${del?.error?.message ?? 'unknown'}` }
  } catch (err: any) {
    return { success: false, message: err?.message ?? String(err) }
  }
}