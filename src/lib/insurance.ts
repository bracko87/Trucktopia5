/**
 * src/lib/insurance.ts
 *
 * Insurance helper library:
 * - Provides computation logic for insurance premium calculation (mirrors DB trigger logic)
 * - Provides API helpers to list plans / categories / rates and to create/list truck insurance rows.
 *
 * Note: This file uses the existing supabase client exported from src/lib/supabase.
 */

import { supabase } from './supabase'

/**
 * Interface: TruckModelRow
 * Represents the relevant fields from the truck_models table used for premium calculation.
 */
export interface TruckModelRow {
  id: string
  list_price?: number | null
  manufacture_year?: number | null
  [key: string]: any
}

/**
 * Interface: UserTruckRow
 * Represents the relevant fields from the user_trucks table used for premium calculation.
 */
export interface UserTruckRow {
  id: string
  master_truck_id: string
  purchase_date?: string | null
  owner_user_id?: string | null
  owner_company_id?: string | null
  [key: string]: any
}

/**
 * Interface: InsurancePlan
 * Row shape for insurance_plans table.
 */
export interface InsurancePlan {
  id: string
  code: string
  name?: string | null
  base_percent: number
  coverage_percent: number
  description?: string | null
  [key: string]: any
}

/**
 * Interface: InsuranceAgeCategory
 * Row shape for insurance_age_categories table.
 */
export interface InsuranceAgeCategory {
  id: string
  code: string
  name?: string | null
  min_years?: number | null
  max_years?: number | null
  [key: string]: any
}

/**
 * Interface: InsurancePlanRate
 * Row shape for insurance_plan_rates table.
 */
export interface InsurancePlanRate {
  id: string
  plan_id: string
  age_category_id: string
  additional_percent: number
  effective?: boolean
  [key: string]: any
}

/**
 * Interface: ComputeResult
 * Returned structure from computePremiumForTruck
 */
export interface ComputeResult {
  percent: number
  premium_amount: number
  plan?: InsurancePlan | null
  ageCategory?: InsuranceAgeCategory | null
  planRate?: InsurancePlanRate | null
  list_price?: number | null
  age_years?: number
}

/**
 * getInsurancePlans
 *
 * Fetches all insurance plans.
 *
 * @returns Array of plans or throws on error.
 */
export async function getInsurancePlans(): Promise<InsurancePlan[]> {
  const { data, error } = await supabase.from<InsurancePlan>('insurance_plans').select('*')
  if (error) throw error
  return data || []
}

/**
 * getAgeCategories
 *
 * Fetches all insurance age categories.
 *
 * @returns Array of age categories or throws on error.
 */
export async function getAgeCategories(): Promise<InsuranceAgeCategory[]> {
  const { data, error } = await supabase.from<InsuranceAgeCategory>('insurance_age_categories').select('*')
  if (error) throw error
  return data || []
}

/**
 * getPlanRates
 *
 * Fetches plan rates. Optionally filter by planId.
 *
 * @param planId Optional plan id to filter.
 * @returns Array of plan rates or throws on error.
 */
export async function getPlanRates(planId?: string): Promise<InsurancePlanRate[]> {
  let query = supabase.from<InsurancePlanRate>('insurance_plan_rates').select('*')
  if (planId) query = query.eq('plan_id', planId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * fetchUserTruck
 *
 * Fetches user_trucks row by id.
 *
 * @param userTruckId The id of the user_trucks row.
 * @returns UserTruckRow or null.
 */
export async function fetchUserTruck(userTruckId: string): Promise<UserTruckRow | null> {
  const { data, error } = await supabase.from<UserTruckRow>('user_trucks').select('*').eq('id', userTruckId).limit(1).single()
  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }
  return data || null
}

/**
 * fetchTruckModel
 *
 * Fetches truck_models row by id.
 *
 * @param truckModelId The id of the truck_models row.
 * @returns TruckModelRow or null.
 */
export async function fetchTruckModel(truckModelId: string): Promise<TruckModelRow | null> {
  const { data, error } = await supabase.from<TruckModelRow>('truck_models').select('*').eq('id', truckModelId).limit(1).single()
  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }
  return data || null
}

/**
 * findAgeCategoryForYears
 *
 * Finds the most appropriate age category for a given age in years.
 *
 * @param ageYears Age in whole years.
 * @returns InsuranceAgeCategory or null.
 */
export async function findAgeCategoryForYears(ageYears: number): Promise<InsuranceAgeCategory | null> {
  // Query: find category where (min_years is null or age >= min) AND (max_years is null or age <= max)
  const { data, error } = await supabase
    .from<InsuranceAgeCategory>('insurance_age_categories')
    .select('*')
    .or(
      `and(min_years.is.null,min_years.lte.${ageYears})`,
      `and(min_years.not.is.null,min_years.lte.${ageYears})`
    )
  if (error) throw error
  // Fallback: do client-side filter because supabase/or construction can be complex; fetch all and pick
  const all = data || (await getAgeCategories())
  const found = all.find((c) => {
    const min = c.min_years ?? -Infinity
    const max = c.max_years ?? Infinity
    return ageYears >= min && ageYears <= max
  })
  return found || null
}

/**
 * computePremiumForTruck
 *
 * Computes applied percent and premium amount for a truck.
 *
 * Strategy:
 * 1. Prefer server-side computation via RPC function `compute_premium_for_truck`
 *    (runs as SECURITY DEFINER so it is not affected by RLS). This is deterministic,
 *    fast and immune to RLS problems.
 * 2. If the RPC is missing or fails, fall back to the existing client-side implementation
 *    (keeps parity and allows graceful migration).
 *
 * @param userTruckIdOrRow Either a user_trucks id or an already fetched UserTruckRow.
 * @param planCode Plan code to compute for (e.g. 'basic'). Defaults to 'basic'.
 * @returns ComputeResult with percent & premium_amount and metadata.
 */
export async function computePremiumForTruck(
  userTruckIdOrRow: string | UserTruckRow,
  planCode = 'basic'
): Promise<ComputeResult> {
  // If caller passed a full row we can compute locally without RPC.
  const isRow = typeof userTruckIdOrRow !== 'string'
  const userTruckId = isRow ? (userTruckIdOrRow as UserTruckRow).id : (userTruckIdOrRow as string)

  // Try RPC first: compute_premium_for_truck(p_user_truck_id uuid, p_plan_code text)
  // The RPC is expected to return a JSON object compatible with ComputeResult.
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('compute_premium_for_truck', {
      p_user_truck_id: userTruckId,
      p_plan_code: planCode,
    } as any) as any

    if (!rpcErr && rpcData) {
      // rpcData may be returned as an object or JSON string depending on supabase config.
      const parsed = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData

      // Normalize field names to ComputeResult shape
      return {
        percent: Number(parsed.percent ?? 0),
        premium_amount: Number(parsed.premium_amount ?? parsed.premium_amount ?? 0),
        plan: parsed.plan ?? null,
        ageCategory: parsed.age_category ?? parsed.ageCategory ?? null,
        planRate: parsed.plan_rate ?? parsed.planRate ?? null,
        list_price: parsed.list_price ?? null,
        age_years: parsed.age_years ?? parsed.ageYears ?? parsed.age_years ?? 0,
      } as ComputeResult
    }
    // If RPC exists but returned null (e.g. truck not found), fall through to client-side logic to provide a clearer error.
  } catch (rpcErr: any) {
    // Ignore RPC errors and fall back to client-side compute. RPC may not exist in older deployments.
    // eslint-disable-next-line no-console
    console.debug('computePremiumForTruck: RPC unavailable or failed, falling back to client logic', rpcErr)
  }

  // Fallback: client-side computation (keeps previous behavior)
  const userTruck: UserTruckRow =
    isRow ? (userTruckIdOrRow as UserTruckRow) : (await fetchUserTruck(userTruckId) as UserTruckRow)

  if (!userTruck || !userTruck.master_truck_id) {
    throw new Error('user_truck not found or missing master_truck_id')
  }

  const truckModel = await fetchTruckModel(userTruck.master_truck_id)

  // Resolve list price: prefer list_price, then fall back to common alternate fields (price), convert strings to numbers.
  const rawListPrice: any =
    truckModel?.list_price ?? truckModel?.price ?? truckModel?.amount ?? null
  const list_price =
    typeof rawListPrice === 'number'
      ? rawListPrice
      : rawListPrice
      ? Number(rawListPrice)
      : 0

  // Compute age in years. Prefer manufacture_year, then common alternate fields such as year.
  let age_years = 0
  const manufactureYearRaw: any =
    truckModel?.manufacture_year ?? truckModel?.manufactureYear ?? truckModel?.year ?? null

  if (manufactureYearRaw != null) {
    const manufactureYear = typeof manufactureYearRaw === 'number' ? manufactureYearRaw : Number(manufactureYearRaw)
    if (!Number.isNaN(manufactureYear)) {
      const now = new Date()
      const manufacturedDate = new Date(manufactureYear, 0, 1)
      age_years = Math.floor((now.getTime() - manufacturedDate.getTime()) / (1000 * 60 * 60 * 24 * 365))
    } else {
      age_years = 0
    }
  } else if (userTruck.purchase_date) {
    const purchase = new Date(userTruck.purchase_date)
    const now = new Date()
    age_years = Math.floor((now.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24 * 365))
  } else {
    age_years = 0
  }

  // Find age category
  const ageCategory = await findAgeCategoryForYears(age_years)

  // Find plan
  const { data: planData, error: planErr } = await supabase
    .from<InsurancePlan>('insurance_plans')
    .select('*')
    .eq('code', planCode)
    .limit(1)
  if (planErr) throw planErr
  const plan = (planData && planData[0]) || null
  if (!plan) throw new Error(`Plan not found: ${planCode}`)

  // Find plan rate
  let planRate: InsurancePlanRate | null = null
  if (plan && ageCategory) {
    const { data: rateData, error: rateErr } = await supabase
      .from<InsurancePlanRate>('insurance_plan_rates')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('age_category_id', ageCategory.id)
      .limit(1)
    if (rateErr) throw rateErr
    planRate = (rateData && rateData[0]) || null
  }

  const additional_percent = planRate?.additional_percent ?? 0
  const percent = (plan.base_percent ?? 0) + additional_percent
  const premium_amount = ((percent / 100) * (list_price ?? 0)) || 0

  return {
    percent,
    premium_amount: Number(premium_amount),
    plan,
    ageCategory: ageCategory ?? null,
    planRate: planRate ?? null,
    list_price: list_price ?? null,
    age_years
  }
}

/**
 * purchaseInsurance
 *
 * Creates a truck_insurances row for a user_truck using the computed premium.
 * The function computes the premium first then inserts a snapshot row with start/end dates.
 *
 * @param userTruckId user_trucks.id to insure
 * @param planCode plan code (e.g. 'basic')
 * @param months duration in months to set end_date (integer). Defaults to 3.
 * @returns inserted truck_insurances row(s)
 */
export async function purchaseInsurance(userTruckId: string, planCode = 'basic', months = 3) {
  // compute values
  const compute = await computePremiumForTruck(userTruckId, planCode)

  const startDate = new Date()
  const endDate = new Date(startDate)
  endDate.setMonth(endDate.getMonth() + Math.max(1, Math.floor(months)))

  const insertPayload: any = {
    user_truck_id: userTruckId,
    plan_id: compute.plan?.id ?? null,
    age_category_id: compute.ageCategory?.id ?? null,
    percent: compute.percent,
    premium_amount: compute.premium_amount,
    currency: 'USD',
    coverage_percent: compute.plan?.coverage_percent ?? 0,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    is_active: true,
    auto_renew: false,
    notes: `Purchased via client: ${planCode} for ${months} months`
  }

  // If possible, attach owner_user_id / owner_company_id from user_trucks row
  try {
    const ut = await fetchUserTruck(userTruckId)
    if (ut?.owner_user_id) insertPayload.owner_user_id = ut.owner_user_id
    if (ut?.owner_company_id) insertPayload.owner_company_id = ut.owner_company_id
  } catch (e) {
    // ignore - not critical
  }

  const { data, error } = await supabase.from('truck_insurances').insert(insertPayload).select('*')
  if (error) throw error
  return data
}

/**
 * listInsurancesForTruck
 *
 * Lists truck_insurances rows for a given truck.
 *
 * @param userTruckId user_trucks.id
 * @returns Array of truck_insurances rows
 */
export async function listInsurancesForTruck(userTruckId: string) {
  const { data, error } = await supabase.from('truck_insurances').select('*').eq('user_truck_id', userTruckId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * listInsurancesForUser
 *
 * Lists truck_insurances rows where owner_user_id = userId
 *
 * @param userId users.id
 * @returns Array of truck_insurances rows
 */
export async function listInsurancesForUser(userId: string) {
  const { data, error } = await supabase.from('truck_insurances').select('*').eq('owner_user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}