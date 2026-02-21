/**
 * route.ts
 *
 * API route to abort a running assignment.
 * Calls the Supabase RPC `abort_job` with the provided assignment id.
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST
 *
 * Handle POST /api/jobs/{id}/abort
 *
 * @param _req - Incoming Request object (not used)
 * @param params - Route params object containing the assignment id
 * @returns NextResponse JSON with { ok: true } on success or { error } on failure
 */
export async function POST(
  _req: Request,
  { params }: { params: { id?: string } }
) {
  const assignmentId = params.id

  if (!assignmentId) {
    return NextResponse.json({ error: 'Missing assignment id' }, { status: 400 })
  }

  try {
    const res = await supabase.rpc('abort_job', {
      p_assignment_id: assignmentId,
    })

    const anyRes: any = res
    if (anyRes?.error) {
      console.error('abort_job failed:', anyRes.error)
      return NextResponse.json({ error: anyRes.error?.message ?? String(anyRes.error) }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('abort_job exception:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}