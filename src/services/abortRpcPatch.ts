/**
 * abortRpcPatch.ts
 *
 * Monkeypatch to forward legacy RPC name `abort_job` to the existing
 * database function `abort_assignment_and_return`. This keeps the UI working
 * without changing page layout or other components.
 *
 * The patch is installed immediately when this module is imported.
 */

import { supabase } from '../lib/supabase'

/**
 * installAbortRpcPatch
 *
 * Replace supabase.rpc so that calls to 'abort_job' are transparently
 * forwarded to 'abort_assignment_and_return'. The parameter mapping will
 * attempt to resolve common naming variants to p_assignment_id.
 *
 * This is a safety shim only; it does not change backend schema or UI.
 */
(function installAbortRpcPatch() {
  // Defensive: ensure supabase client exists and rpc is a function
  // @ts-ignore
  if (!supabase || typeof (supabase as any).rpc !== 'function') return

  // Preserve original rpc
  const originalRpc = (supabase as any).rpc.bind(supabase)

  /**
   * patchedRpc
   *
   * Intercepts legacy 'abort_job' calls and forwards them to the correct RPC.
   *
   * @param fnName - requested RPC function name
   * @param params - parameters passed to RPC
   * @param opts - optional RPC options
   * @returns Promise resolving to the original rpc response
   */
  // @ts-ignore
  (supabase as any).rpc = function patchedRpc(fnName: string, params?: any, opts?: any) {
    try {
      if (typeof fnName === 'string' && fnName === 'abort_job') {
        const p = params ?? {}

        // Attempt to find the assignment id from multiple common keys
        const assignmentId =
          p.p_assignment_id ??
          p.assignment_id ??
          p.id ??
          p.job_id ??
          p.p_job_id ??
          p.assignmentId ??
          null

        const mappedParams = assignmentId ? { p_assignment_id: assignmentId } : params

        // Forward to canonical RPC name
        return originalRpc('abort_assignment_and_return', mappedParams, opts)
      }
    } catch (e) {
      // In case of patch failure, fall back to original RPC call below
      // eslint-disable-next-line no-console
      console.warn('abortRpcPatch: forwarding failed, calling original rpc', e)
    }

    return originalRpc(fnName, params, opts)
  }
})()