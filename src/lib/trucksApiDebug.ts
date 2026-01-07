/**
 * trucksApiDebug.ts
 *
 * Diagnostic helpers to validate that user_trucks rows include embedded truck_models
 * with the expected extended fields. Uses a runtime probe of truck_models columns
 * to avoid requesting non-existent columns (which triggers PostgREST 42703).
 *
 * Usage:
 *  - Call debugFetchTrucksWithModels() from the browser console or a page effect.
 */

import { supabaseFetch } from './supabaseController'

/**
 * DebugResult
 *
 * Result shape returned by debugFetchTrucksWithModels.
 */
export interface DebugResult {
  trucks: any[]
  issues: Array<{
    truckId: string
    missingFields: string[]
    embeddedModel?: any | null
  }>
}

/**
 * getTruckModelColumns
 *
 * Probe the truck_models table by fetching a single row and returning its keys.
 * This provides a runtime list of valid column names so REST selects won't request
 * missing columns (avoiding PostgREST 42703 errors).
 *
 * @returns array of column names present on truck_models (fallback list if probe fails)
 */
export async function getTruckModelColumns(): Promise<string[]> {
  try {
    const res = await supabaseFetch(`/rest/v1/truck_models?select=*&limit=1`)
    if (res && res.status >= 200 && res.status < 300 && Array.isArray(res.data) && res.data.length > 0) {
      return Object.keys(res.data[0])
    }
    // fallback conservative list
    return [
      'id',
      'make',
      'model',
      'country',
      'class',
      'year',
      'max_load_kg',
      'tonnage',
      'load_type',
      'fuel_tank_capacity_l',
      'fuel_type',
      'image_url',
    ]
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug('getTruckModelColumns probe failed', err)
    return [
      'id',
      'make',
      'model',
      'country',
      'class',
      'year',
      'max_payload',
      'tonnage',
      'load_type',
      'macroscopic_notes',
    ]
  }
}

/**
 * debugFetchTrucksWithModels
 *
 * Fetch user_trucks with an embedded truck_models selection built from existing
 * columns and report which trucks are missing expected model fields. This avoids
 * requesting non-existent columns and surfaces which fields are null/absent.
 *
 * @param limit - maximum number of trucks to fetch (default 100)
 * @returns DebugResult with raw trucks and a list of issues (truckId + missing fields)
 */
export async function debugFetchTrucksWithModels(limit = 100): Promise<DebugResult> {
  try {
    // Columns we'd like to inspect if they exist
    const desiredFields = [
      'make',
      'model',
      'country',
      'class',
      'year',
      'max_load_kg',
      'tonnage',
      'load_type',
      'fuel_tank_capacity_l',
      'fuel_type',
      'image_url',
    ]

    const validColumns = await getTruckModelColumns()

    // Only include the desired fields that actually exist on the table
    const selectColumns = desiredFields.filter((f) => validColumns.includes(f))

    // Always include id in the embedded selection
    if (!selectColumns.includes('id')) selectColumns.unshift('id')

    const truckModelsSelect = `truck_models:truck_models!user_trucks_master_truck_id_fkey(${selectColumns.join(',')})`
    const selectQuery = `*,${truckModelsSelect}`
    const encodedSelect = encodeURIComponent(selectQuery)

    const qs = `/rest/v1/user_trucks?select=${encodedSelect}&order=created_at.desc&limit=${encodeURIComponent(String(limit))}`
    const res = await supabaseFetch(qs)

    if (!res || typeof res.status !== 'number' || res.status < 200 || res.status >= 300) {
      // Capture the failure for inspection
      // eslint-disable-next-line no-console
      console.error('debugFetchTrucksWithModels: REST call failed', res)
      return {
        trucks: Array.isArray(res?.data) ? res.data : [],
        issues: [{ truckId: 'ERROR', missingFields: ['rest_call_failed'], embeddedModel: res?.data ?? null }],
      }
    }

    const rows: any[] = Array.isArray(res.data) ? res.data : []
    const issues: DebugResult['issues'] = []

    rows.forEach((r) => {
      const embedded = Array.isArray(r.truck_models) && r.truck_models.length > 0 ? r.truck_models[0] : null
      const missing: string[] = []

      // For each requested column, treat undefined/null as missing
      selectColumns.forEach((f) => {
        if (!embedded || embedded[f] === undefined || embedded[f] === null) missing.push(f)
      })

      if (missing.length > 0) {
        issues.push({
          truckId: String(r.id ?? r.master_truck_id ?? 'unknown'),
          missingFields: missing,
          embeddedModel: embedded,
        })
      }
    })

    // eslint-disable-next-line no-console
    console.debug('debugFetchTrucksWithModels result', { total: rows.length, issuesCount: issues.length, issues })
    return { trucks: rows, issues }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('debugFetchTrucksWithModels error', err)
    return { trucks: [], issues: [{ truckId: 'EXCEPTION', missingFields: [String(err)], embeddedModel: null }] }
  }
}