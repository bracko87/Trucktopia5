/**
 * src/lib/supabaseClient.ts
 *
 * Compatibility wrapper that re-exports the canonical supabase client used
 * across the codebase. Some modules import "@/lib/supabaseClient" while the
 * main client implementation lives in src/lib/supabase.ts — this file keeps
 * both import styles working.
 */

/**
 * Import the real supabase client from the canonical file.
 */
import { supabase } from './supabase'

/**
 * Re-export supabase under the original name for modules that import { supabase }.
 */
export { supabase }

/**
 * supabaseClient
 *
 * Named compatibility export used by modules importing "@/lib/supabaseClient".
 */
export const supabaseClient = supabase

/**
 * Default export
 *
 * Provide a default export to cover `import supabase from "@/lib/supabaseClient"`.
 */
export default supabase