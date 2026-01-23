/**
 * netlify/functions/staff.ts
 *
 * Serverless handler for the frontend /api/staff route.
 *
 * - Proxies requests to Supabase and returns a paginated list of unemployed_staff rows.
 * - Expected query params:
 *    - page (1-based, default 1)
 *    - pageSize (default 20)
 *    - role (optional, 'all' to ignore)
 *    - country (optional, 'all' to ignore)
 *    - salaryMode (optional, 'any' | 'below' | 'above')
 *    - salaryValue (optional, numeric, interpreted as USD)
 *
 * Environment variables required:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
 *
 * Notes:
 *  - Returns JSON: { items: any[], pageCount: number }
 *  - Ensures pageCount is at least 1 so frontend doesn't break.
 */

import { APIGatewayEvent, Context } from 'aws-lambda'
import { createClient } from '@supabase/supabase-js'

/**
 * handler
 *
 * Netlify Lambda entrypoint. Reads query params, applies filters and pagination,
 * queries Supabase (unemployed_staff) and returns the paged result set with pageCount.
 *
 * @param event Incoming lambda event with queryStringParameters
 * @param _context Lambda context (unused)
 * @returns HTTP response compatible with Netlify functions
 */
export const handler = async (event: APIGatewayEvent | any, _context: Context | any) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Supabase credentials not configured on server.' }),
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    })

    const qs = event?.queryStringParameters ?? {}
    const page = Math.max(1, Number(qs.page) || 1)
    const pageSize = Math.max(1, Number(qs.pageSize) || 20)

    const role = typeof qs.role === 'string' ? qs.role.trim() : ''
    const country = typeof qs.country === 'string' ? qs.country.trim() : ''
    const salaryMode = typeof qs.salaryMode === 'string' ? qs.salaryMode.trim() : 'any'
    const salaryValueRaw = typeof qs.salaryValue === 'string' ? qs.salaryValue.trim() : ''

    // Calculate supabase range (limit/offset equivalent)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Query unemployed_staff (NOT hired_staff) with exact count for computing pageCount
    let query = supabase
      .from('unemployed_staff')
      .select('*', { count: 'exact' })
      .order('generated_at', { ascending: false })
      .range(from, to)

    // Apply optional filters
    if (role && role.toLowerCase() !== 'all') {
      query = query.ilike('role', `%${role}%`)
    }

    if (country && country.toLowerCase() !== 'all') {
      query = query.eq('country', country)
    }

    if (salaryMode && salaryMode !== 'any' && salaryValueRaw) {
      const val = Number(salaryValueRaw)
      if (!Number.isNaN(val)) {
        const cents = Math.round(val * 100)
        if (salaryMode === 'below') {
          query = query.lte('expected_salary_cents', cents)
        } else if (salaryMode === 'above') {
          query = query.gte('expected_salary_cents', cents)
        }
      }
    }

    const { data, count, error } = await query

    if (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: error.message ?? 'Supabase query failed' }),
      }
    }

    const pageCount = Math.max(1, Math.ceil((Number(count ?? 0) || 0) / pageSize))

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        items: data ?? [],
        pageCount,
      }),
    }
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err?.message ?? 'Internal server error' }),
    }
  }
}

export default handler