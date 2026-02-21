/**
 * trailersApi.ts
 *
 * API layer for fetching and mapping trailer rows from the DB to UI-friendly objects.
 *
 * Exposes:
 * - TrailerModel: DB model shape for joined trailer_models row
 * - TrailerCardRow: UI shape consumed by TrailerCard component
 * - fetchCompanyTrailers: loads user_trailers for a company (with joined trailer_models)
 * - mapTrailerRow: maps raw DB row → TrailerCardRow
 */

import { supabase } from '../supabase'

/**
 * TrailerModel
 *
 * DB representation of a trailer model (joined from trailer_models table).
 */
export interface TrailerModel {
  id: string
  make?: string | null
  model?: string | null
  class?: string | null
  manufacture_year?: number | null
  max_load_kg?: number | null
  tonnage?: number | null
  gcw?: string | null
  cargo_type_id?: string | null
  image_url?: string | null
  // optional join of cargo_types may appear here as cargo_types or cargo_types array
  cargo_types?: any
}

/**
 * TrailerCardRow
 *
 * Shape used by the UI Trailer card component.
 */
export interface TrailerCardRow {
  id: string
  label: string
  payloadKg: number
  condition: number
  mileageKm: number
  cargoTypeId: string | null
  cargoTypeName: string | null
  imageUrl: string | null
  status: string | null
  isActive: boolean
  model?: TrailerModel | null
  _raw: any
}

/**
 * fetchCompanyTrailers
 *
 * Fetch trailers owned by a company from user_trailers and include joined trailer_models.
 *
 * Note:
 * - Do NOT include JS comments inside the PostgREST select string (they break parsing).
 * - Avoid forcing joins through non-existent FK relationships.
 *
 * @param companyId - company id to filter by
 * @returns array of raw DB rows (includes trailer_models relation)
 */
export async function fetchCompanyTrailers(companyId: string): Promise<any[]> {
  if (!companyId) return []

  // Request joined trailer_models and join cargo_types via the trailer_models relation.
  // Joining cargo_types through trailer_models prevents PostgREST errors when user_trailers
  // does not have a direct FK to cargo_types.
  const selectStr = `
    id,
    master_trailer_id,
    name,
    condition_score,
    mileage_km,
    status,
    is_active,
    image_url,
    model_make,
    model_model,
    model_class,
    model_max_load_kg,
    model_tonnage,
    cargo_type_id,
    location_city_id,
    cities:location_city_id(city_name),
    trailer_models:trailer_models!fk_user_trailer_model(
      id,
      make,
      model,
      class,
      manufacture_year,
      max_load_kg,
      tonnage,
      gcw,
      cargo_type_id,
      image_url,
      cargo_types:cargo_type_id(name)
    )
  `

  const { data, error } = await supabase
    .from('user_trailers')
    .select(selectStr)
    .eq('owner_company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchCompanyTrailers error', error)
    throw error
  }

  return Array.isArray(data) ? data : []
}

/**
 * mapTrailerRow
 *
 * Map raw DB row → TrailerCardRow consumed by the UI.
 *
 * Important:
 * - Ensure model is derived from joined trailer_models (preferred) or fallback columns on user_trailers
 * - Surface cargo type by id (cargoTypeId) while preserving an optional human name when available
 *
 * @param row - raw DB row from fetchCompanyTrailers
 * @returns TrailerCardRow
 */
export function mapTrailerRow(row: any): TrailerCardRow {
  // Normalize joined trailer_models which may be returned as an array (PostgREST) or object
  const model: TrailerModel | null = Array.isArray(row?.trailer_models)
    ? row.trailer_models[0] ?? null
    : row?.trailer_models ?? null

  // Prefer joined model.make/model, fallback to denormalized columns on user_trailers
  const make = model?.make ?? row?.model_make ?? ''
  const modelName = model?.model ?? row?.model_model ?? ''

  // Compose final model label; guarantee non-empty string
  const modelLabel = `${make} ${modelName}`.trim() || 'Unnamed trailer'

  // Determine cargo type id (we return id; name may be available via the join)
  const cargoTypeId = (model?.cargo_type_id ?? row?.cargo_type_id) ?? null

  // Normalize joined cargo_types which may be returned inside trailer_models (preferred)
  // or directly on the row (legacy). Support both array and object forms.
  let cargoTypesJoined: any = null
  if (model && (model as any).cargo_types) {
    cargoTypesJoined = Array.isArray((model as any).cargo_types) ? (model as any).cargo_types[0] : (model as any).cargo_types
  } else if (row?.cargo_types) {
    cargoTypesJoined = Array.isArray(row.cargo_types) ? row.cargo_types[0] : row.cargo_types
  }
  const cargoTypeName = cargoTypesJoined?.name ?? null

  // Resolve joined cities (may be returned as array or object)
  let locationCityName: string | null = null
  if (row?.cities) {
    const c = Array.isArray(row.cities) ? row.cities[0] : row.cities
    locationCityName = c?.city_name ?? null
  } else if (row?.location_city_id) {
    // fallback to raw id (keeps shape compatible)
    locationCityName = String(row.location_city_id)
  }

  // GCW originates from the joined trailer model (trailer_models.gcw)
  const gcwClass = model?.gcw ?? null

  return {
    id: String(row?.id ?? ''),
    // user-editable name takes precedence, otherwise use composed model label
    label: row?.name ?? modelLabel,
    payloadKg: Number(model?.max_load_kg ?? row?.model_max_load_kg ?? 0),
    condition: Number(row?.condition_score ?? 100),
    mileageKm: Number(row?.mileage_km ?? 0),
    cargoTypeId,
    cargoTypeName,
    imageUrl: model?.image_url ?? row?.image_url ?? null,
    status: row?.status ?? null,
    isActive: Boolean(row?.is_active ?? false),
    model,
    locationCityName,
    gcwClass,
    _raw: row,
  }
}