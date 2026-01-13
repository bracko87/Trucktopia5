/**
 * scripts/bootstrapCompanyService.ts
 *
 * Small Node script (TypeScript) that performs company bootstrap using Supabase service role.
 * Usage:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=xxx node dist/bootstrapCompanyService.js
 *
 * Notes:
 * - This script requires @supabase/supabase-js available in the project (already installed).
 * - Run from a trusted environment (CI / server) and never expose the service role key to clients.
 */

import { createClient } from '@supabase/supabase-js'

/**
 * bootstrapCompany
 *
 * Creates a starter lease and user_truck for the provided company id using the service role client.
 *
 * @param supabaseAdmin - Supabase client instantiated with service role key
 * @param companyId - target company uuid
 * @param ownerUserId - optional public.users.id owner to attach as owner_user_id
 * @param starterModelId - truck model to use for starter (defaults to canonical Isuzu id)
 */
export async function bootstrapCompany(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  ownerUserId: string | null = null,
  starterModelId: string = 'd87583a5-1bf0-4451-ac90-32318b7b1093'
) {
  // 1) verify model exists and fetch lease_rate
  const modelQ = await supabaseAdmin.from('truck_models').select('lease_rate').eq('id', starterModelId).limit(1)
  const model = (modelQ.data && Array.isArray(modelQ.data)) ? modelQ.data[0] : null
  const lease_rate = model?.lease_rate ?? null

  // 2) ensure no existing starter lease for this company/model
  const existingLeaseQ = await supabaseAdmin.from('user_leases').select('id').eq('owner_company_id', companyId).eq('asset_model_id', starterModelId).limit(1)
  if (existingLeaseQ.data && Array.isArray(existingLeaseQ.data) && existingLeaseQ.data.length > 0) {
    return { ok: true, message: 'starter lease already exists', leaseId: existingLeaseQ.data[0].id }
  }

  // 3) insert lease (60 weeks)
  const leasePayload: any = {
    asset_model_id: starterModelId,
    asset_type: 'truck',
    owner_company_id: companyId,
    owner_user_id: ownerUserId,
    lease_start: new Date().toISOString(),
    lease_end: new Date(Date.now() + 60 * 7 * 24 * 60 * 60 * 1000).toISOString(),
    lease_rate,
    acquisition_type: 'starter',
    status: 'active',
    is_active: true,
  }

  const leaseInsert = await supabaseAdmin.from('user_leases').insert(leasePayload).select('*').limit(1)
  if (leaseInsert.error) {
    return { ok: false, error: leaseInsert.error, step: 'insert_lease' }
  }

  // 4) insert user_truck (if not exists)
  const existingTruckQ = await supabaseAdmin.from('user_trucks').select('id').eq('owner_company_id', companyId).eq('master_truck_id', starterModelId).limit(1)
  if (!(existingTruckQ.data && Array.isArray(existingTruckQ.data) && existingTruckQ.data.length > 0)) {
    const truckPayload: any = {
      master_truck_id: starterModelId,
      owner_company_id: companyId,
      owner_user_id: ownerUserId,
      acquisition_type: 'starter',
      condition_score: 100,
      mileage_km: 0,
      status: 'available',
      is_active: true,
    }
    const truckInsert = await supabaseAdmin.from('user_trucks').insert(truckPayload).select('*').limit(1)
    if (truckInsert.error) {
      return { ok: false, error: truckInsert.error, step: 'insert_truck' }
    }
  }

  // 5) sync companies.trucks
  const countRes = await supabaseAdmin.from('user_trucks').select('id', { count: 'exact' }).eq('owner_company_id', companyId)
  const trucksCount = (countRes.count ?? 0)
  const updateRes = await supabaseAdmin.from('companies').update({ trucks: trucksCount }).eq('id', companyId)
  if (updateRes.error) {
    return { ok: false, error: updateRes.error, step: 'sync_count' }
  }

  return { ok: true, lease: leaseInsert.data?.[0] ?? null, trucksCount }
}

/**
 * Simple CLI runner when invoked directly.
 */
if (require.main === module) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const companyId = process.env.COMPANY_ID
  const ownerUserId = process.env.OWNER_USER_ID ?? null
  const starterModelId = process.env.STARTER_MODEL_ID ?? 'd87583a5-1bf0-4451-ac90-32318b7b1093'

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !companyId) {
    // eslint-disable-next-line no-console
    console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or COMPANY_ID env vars.')
    process.exit(1)
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  ;(async () => {
    const res = await bootstrapCompany(supabaseAdmin, companyId, ownerUserId, starterModelId)
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2))
    process.exit(res && (res as any).ok ? 0 : 2)
  })()
}