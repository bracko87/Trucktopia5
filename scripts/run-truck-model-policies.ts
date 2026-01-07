/**
 * scripts/run-truck-model-policies.ts
 *
 * Server-side helper script that calls the RPC wrapper created by the migration
 * (run_truck_model_policies_migration). This script MUST be executed only in a
 * secure environment with the service role key available via environment variables.
 *
 * Usage (example):
 *   export SUPABASE_URL="https://your-project-ref.supabase.co"
 *   export SUPABASE_SERVICE_KEY="...(service role key)..."
 *   npx ts-node scripts/run-truck-model-policies.ts
 *
 * Do NOT place the service role key in browser / frontend code.
 */

import { createClient } from '@supabase/supabase-js'

/**
 * getEnv
 *
 * Read required environment variables and assert presence.
 *
 * @returns object with SUPABASE_URL and SUPABASE_SERVICE_KEY
 */
function getEnv() {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.')
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY before running this script.')
    process.exit(1)
  }

  return { SUPABASE_URL, SUPABASE_SERVICE_KEY }
}

/**
 * runMigrationRPC
 *
 * Call the migration RPC function created by the SQL file. This uses the service
 * role key (never include that key in the frontend).
 */
async function runMigrationRPC() {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = getEnv()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('Calling RPC: run_truck_model_policies_migration ...')
  const { data, error } = await supabase.rpc('run_truck_model_policies_migration')

  if (error) {
    console.error('Migration RPC failed:', error)
    process.exit(2)
  }

  console.log('Migration RPC result:', data)
  console.log('Done.')
  process.exit(0)
}

runMigrationRPC().catch((err) => {
  console.error('Unexpected error running migration RPC:', err)
  process.exit(3)
})