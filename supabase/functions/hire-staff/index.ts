/**
 * hire-staff/index.ts
 *
 * Edge Function for hiring a staff member.
 *
 * This function is the single authoritative hiring path for the app.
 * It validates the caller's JWT, resolves the caller's company, moves a
 * record from `unemployed_staff` into `hired_staff`, and returns the hired row.
 *
 * Notes:
 * - Expects Authorization: Bearer &lt;JWT access token&gt; header.
 * - Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env variables.
 */

import { serve } from 'https://deno.land/std@0.201.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

/**
 * handleRequest
 *
 * Main request handler for the hire-staff function.
 *
 * @param req Incoming Request object
 * @returns Response with JSON body: { hired } or { error }
 */
async function handleRequest(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    const body = await req.json().catch(() => ({}))
    const unemployed_id = (body && (body.unemployed_id || body.unemployedId)) as string | undefined

    if (!unemployed_id) {
      return new Response(JSON.stringify({ error: 'Missing unemployed_id' }), { status: 400 })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No Authorization header' }), { status: 401 })
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Empty token' }), { status: 401 })
    }

    // Validate token and get user
    const { data: authData, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), { status: 401 })
    }
    const authUserId = authData.user.id

    // Find company owned by this auth user
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_auth_user_id', authUserId)
      .limit(1)
      .maybeSingle()

    if (companyErr || !company) {
      return new Response(JSON.stringify({ error: 'User has no company' }), { status: 400 })
    }

    // Fetch unemployed staff
    const { data: staff, error: staffErr } = await supabase
      .from('unemployed_staff')
      .select('*')
      .eq('id', unemployed_id)
      .limit(1)
      .maybeSingle()

    if (staffErr || !staff) {
      return new Response(JSON.stringify({ error: 'Staff not found' }), { status: 404 })
    }

    // Insert into hired_staff
    const insertPayload = {
      first_name: (staff as any).first_name ?? (staff as any).name ?? null,
      last_name: (staff as any).last_name ?? null,
      age: (staff as any).age ?? null,
      country_code: (staff as any).country_code ?? (staff as any).country ?? null,
      job_category: (staff as any).job_category ?? null,
      salary: (staff as any).expected_salary ?? (staff as any).expected_salary_cents ?? null,
      company_id: (company as any).id,
      hired_at: new Date().toISOString(),
    }

    const { data: hired, error: hireErr } = await supabase
      .from('hired_staff')
      .insert(insertPayload)
      .select()
      .limit(1)
      .maybeSingle()

    if (hireErr || !hired) {
      return new Response(JSON.stringify({ error: 'Failed to insert hired_staff' }), { status: 500 })
    }

    // Remove from unemployed_staff (best-effort)
    await supabase.from('unemployed_staff').delete().eq('id', unemployed_id)

    return new Response(JSON.stringify({ hired }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), { status: 400 })
  }
}

serve(handleRequest)