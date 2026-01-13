/**
 * sellService.ts
 *
 * Minimal client-side sell helpers that use only public.user_trucks as input.
 *
 * NOTE:
 * - This file performs deterministic offer computation based solely on a user_trucks row.
 * - The acceptOffer implementation performs ownership checks and deletes the truck row via Supabase REST.
 * - For full atomic sale (credit + delete + audit) a server-side RPC or edge function is strongly recommended.
 */

import { supabaseFetch, getCurrentUser } from '../lib/supabase'

/**
 * Minimal shape representing public.user_trucks row fields we use.
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
  // Xorshift
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
  const depreciation = Math.min(
    0.5,
    ageFactor * 0.45 + conditionLoss * 0.4 + mileageNormalized * 0.15
  )

  const base = Math.round(newPrice * (1 - depreciation))
  // ensure not below 50% of newPrice (except Dealer offers will be allowed below later)
  const minBase = Math.round(newPrice * 0.5)
  return Math.max(base, minBase)
}

/**
 * computeOffersFromUserTruck
 *
 * Generate Dealer, Company, Private offers deterministically based on truck id.
 *
 * @param t - UserTruckRow
 * @returns Offer[]
 */
export function computeOffersFromUserTruck(t: UserTruckRow): Offer[] {
  const base = computeBasePriceFromUserTruck(t)
  const seed = (t.id ?? '') + 'offers'
  const r = seededRandom(seed)

  // Dealer: instant, can go below 50% of new price (we allow an extra reduction)
  // Dealer multiplier between 0.65 and 0.9 of base (deterministic)
  const dealerMul = 0.65 + (r * 0.25)
  const dealerPrice = Math.max(0, Math.round(base * dealerMul))

  // Company: 2-5 day settlement, near base (0.93..1.00)
  const companyMul = 0.93 + ((1 - r) * 0.07)
  const companyPrice = Math.max(0, Math.round(base * companyMul))

  // Private: 7-14 days, 2-5% better than company
  const privateMul = 1 + (0.02 + (r * 0.03)) // 1.02..1.05
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
    // 1) fetch current auth user to derive public.users.id
    const me = await getCurrentUser()
    const authUser = me?.data ?? null
    if (!authUser || !authUser.id) return { success: false, message: 'Not authenticated' }

    // 2) find public.users row by auth_user_id
    const usersRes = await supabaseFetch(`/rest/v1/users?auth_user_id=eq.${encodeURIComponent(authUser.id)}&select=id`)
    const userRows = Array.isArray(usersRes.data) ? usersRes.data : []
    const publicUser = userRows[0]
    if (!publicUser || !publicUser.id) return { success: false, message: 'User profile not found (public.users)' }

    // 3) fetch truck and re-check ownership
    const truck = await fetchUserTruck(truckId)
    if (!truck) return { success: false, message: 'Truck not found' }

    const ownerUserId = truck.owner_user_id ?? null
    if (!ownerUserId || ownerUserId !== publicUser.id) {
      return { success: false, message: 'You do not own this truck' }
    }

    // 4) delete the truck row
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