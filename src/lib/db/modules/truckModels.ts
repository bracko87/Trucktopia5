/**
 * truckModels.ts
 *
 * Helpers for working with the truck_models table.
 *
 * Responsibilities:
 * - Provide helpers to resolve a truck model's human-readable make & model
 *   from its id using the existing supabase REST helper.
 * - Provide a batched resolver for multiple ids that also returns associated
 *   cargo_type_id and cargo_type_name so the UI can display cargo type names.
 */

import { supabaseFetch } from '../../supabaseController'

/**
 * TruckModelInfo
 *
 * Full shape returned for a truck model row. Extended to include
 * fields used by the UI and cargo_type info.
 */
export interface TruckModelInfo {
  id: string
  make?: string | null
  model?: string | null
  country?: string | null
  class?: string | null
  max_load_kg?: number | null
  tonnage?: number | null
  year?: number | null
  cargo_type_id?: string | null
  cargo_type_name?: string | null
  /**
   * Secondary cargo type id (new)
   */
  cargo_type_id_secondary?: string | null
  /**
   * Secondary cargo type human readable name (new)
   */
  cargo_type_secondary_name?: string | null
  fuel_tank_capacity_l?: number | null
  fuel_type?: string | null
  image_url?: string | null
}

/**
 * getTruckModelName
 *
 * Fetch the combined human-readable name (\"make model\") for the truck model with the supplied id.
 *
 * @param id - truck_models.id UUID
 * @returns combined \"make model\" string or null when not found / error
 */
export async function getTruckModelName(id: string | undefined | null): Promise<string | null> {
  if (!id) return null
  try {
    const q = `id=eq.${encodeURIComponent(String(id))}&select=make,model&limit=1`
    const res = await supabaseFetch(`/rest/v1/truck_models?${q}`)
    if (res && Array.isArray(res.data) && res.data.length > 0) {
      const row = res.data[0]
      const parts = [row.make, row.model].filter(Boolean)
      return parts.length > 0 ? parts.join(' ') : null
    }
    return null
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug('getTruckModelName error', err)
    return null
  }
}

/**
 * getTruckModelsBatch
 *
 * Fetch multiple truck model rows in a single request and return a lookup map by id.
 * The selected fields include the cargo_type_id and cargo_type_id_secondary; if cargo_type_id values are present
 * we will also fetch cargo_types names and attach cargo_type_name and cargo_type_secondary_name.
 *
 * @param ids - array of truck_models.id UUIDs
 * @returns Record keyed by id with make/model and extra values
 */
export async function getTruckModelsBatch(
  ids: string[] | undefined | null
): Promise<Record<string, {
  make?: string | null
  model?: string | null
  country?: string | null
  class?: string | null
  max_payload?: number | null
  tonnage?: number | null
  year?: number | null
  cargo_type_id?: string | null
  cargo_type_name?: string | null
  cargo_type_id_secondary?: string | null
  cargo_type_secondary_name?: string | null
  max_load_kg?: number | null
  fuel_tank_capacity_l?: number | null
  fuel_type?: string | null
  image_url?: string | null
}>> {
  if (!ids || ids.length === 0) return {}

  try {
    // Build an "in" query: id=in.(id1,id2,...). Encode each id safely.
    const encodedIds = ids.map((i) => encodeURIComponent(String(i))).join(',')
    // Select extended set of fields used by UI including the new secondary cargo type
    const q = `id=in.(${encodedIds})&select=id,make,model,country,class,max_load_kg,tonnage,year,cargo_type_id,cargo_type_id_secondary,fuel_tank_capacity_l,fuel_type,image_url&limit=500`
    const res = await supabaseFetch(`/rest/v1/truck_models?${q}`)

    const map: Record<string, {
      make?: string | null
      model?: string | null
      country?: string | null
      class?: string | null
      max_payload?: number | null
      tonnage?: number | null
      year?: number | null
      cargo_type_id?: string | null
      cargo_type_name?: string | null
      cargo_type_id_secondary?: string | null
      cargo_type_secondary_name?: string | null
      max_load_kg?: number | null
      fuel_tank_capacity_l?: number | null
      fuel_type?: string | null
      image_url?: string | null
    }> = {}

    if (!(res && Array.isArray(res.data))) {
      return map
    }

    // Collect cargo_type_ids (primary + secondary) to fetch names
    const cargoTypeIdsSet = new Set<string>()
    res.data.forEach((r: any) => {
      if (r && r.id) {
        if (r.cargo_type_id) cargoTypeIdsSet.add(String(r.cargo_type_id))
        if (r.cargo_type_id_secondary) cargoTypeIdsSet.add(String(r.cargo_type_id_secondary))
        map[String(r.id)] = {
          make: r.make ?? null,
          model: r.model ?? null,
          country: r.country ?? null,
          class: r.class ?? null,
          max_payload: typeof r.max_load_kg === 'number' ? r.max_load_kg : (r.max_load_kg ? Number(r.max_load_kg) : null),
          tonnage: typeof r.tonnage === 'number' ? r.tonnage : (r.tonnage ? Number(r.tonnage) : null),
          year: typeof r.year === 'number' ? r.year : (r.year ? Number(r.year) : null),
          cargo_type_id: r.cargo_type_id ?? null,
          cargo_type_name: null,
          cargo_type_id_secondary: r.cargo_type_id_secondary ?? null,
          cargo_type_secondary_name: null,
          max_load_kg: typeof r.max_load_kg === 'number' ? r.max_load_kg : (r.max_load_kg ? Number(r.max_load_kg) : null),
          fuel_tank_capacity_l: typeof r.fuel_tank_capacity_l === 'number' ? r.fuel_tank_capacity_l : (r.fuel_tank_capacity_l ? Number(r.fuel_tank_capacity_l) : null),
          fuel_type: r.fuel_type ?? null,
          image_url: r.image_url ?? null,
        }
      }
    })

    // If we found cargo_type_ids, fetch their human-readable names
    if (cargoTypeIdsSet.size > 0) {
      const cargoIds = Array.from(cargoTypeIdsSet).map((i) => encodeURIComponent(i)).join(',')
      try {
        const ctRes = await supabaseFetch(`/rest/v1/cargo_types?id=in.(${cargoIds})&select=id,name&limit=500`)
        if (ctRes && Array.isArray(ctRes.data)) {
          const ctMap: Record<string, string> = {}
          ctRes.data.forEach((c: any) => {
            if (c && c.id) ctMap[String(c.id)] = c.name ?? ''
          })
          // Attach names to models (primary and secondary)
          Object.keys(map).forEach((mid) => {
            const mt = map[mid]
            if (mt.cargo_type_id) {
              mt.cargo_type_name = ctMap[String(mt.cargo_type_id)] ?? null
            }
            if (mt.cargo_type_id_secondary) {
              mt.cargo_type_secondary_name = ctMap[String(mt.cargo_type_id_secondary)] ?? null
            }
          })
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug('getTruckModelsBatch: cargo_types fetch failed', err)
      }
    }

    return map
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug('getTruckModelsBatch error', err)
    return {}
  }
}