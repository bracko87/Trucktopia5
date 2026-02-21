/**
 * route.ts
 *
 * App Router API route for aborting a running assignment.
 * This file must live under app/api/... so Next.js App Router picks it up.
 */

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST
 *
 * Handle POST /api/jobs/{id}/abort
 *
 * Calls the Supabase RPC `abort_job` with the provided assignment id and
 * returns a JSON success or error payload.
 *
 * @param _req - Incoming Request object (not used)
 * @param params - Route params object containing the assignment id
 * @returns NextResponse JSON with { ok: true } on success or { error } on failure
 */
export async function POST(
  _req: Request,
  { params }: { params: { id?: string } }
) {
  const assignmentId = params?.id

  if (!assignmentId) {
    return NextResponse.json({ error: 'Missing assignment id' }, { status: 400 })
  }

  try {
    const { error } = await supabase.rpc('abort_job', {
      p_assignment_id: assignmentId,
    } as any)

    if (error) {
      console.error('abort_job failed:', error)
      return NextResponse.json({ error: error.message ?? String(error) }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('abort_job exception:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}