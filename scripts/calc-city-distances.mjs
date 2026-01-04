/**
 * scripts/calc-city-distances.mjs
 *
 * Optimized Node 18+ script to compute pairwise Haversine distances
 * between cities in the `cities` table and insert results into
 * `city_distances` via Supabase PostgREST.
 *
 * Performance improvements implemented:
 *  - Pre-filter pairs using cheap latitude/longitude bounding-box checks
 *    to avoid expensive Haversine computations for obviously-far cities.
 *  - Use an in-memory Set of existing canonical pairs to avoid per-pair HTTP checks.
 *  - Batch inserts to PostgREST to reduce HTTP overhead.
 *
 * Required env vars:
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_KEY
 *
 * Optional env vars:
 *  - BATCH_DELAY_MS (default 25)
 *  - BATCH_SIZE (default 500)
 *  - MAX_KM (default 3000)
 */

/**
 * Get an environment variable or throw.
 * @param {string} name
 * @returns {string}
 */
function getEnv(name) {
  const v = process.env[name]
  if (!v) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return v
}

const SUPABASE_URL = getEnv('SUPABASE_URL')
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_KEY')
const BATCH_DELAY_MS = Number(process.env.BATCH_DELAY_MS ?? '25')
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? '500')
const MAX_KM = Number(process.env.MAX_KM ?? '3000')

/**
 * Sleep helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Compute Haversine distance (km) between two lat/lon coordinates.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number}
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 6371 // Earth radius km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Canonical key for unordered pair so (A,B) === (B,A).
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
function canonicalKey(a, b) {
  return a <= b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Maximum latitude difference (degrees) for MAX_KM.
 */
const MAX_LAT_DIFF = MAX_KM / 111 // ~111 km per degree latitude

/**
 * Compute the maximum longitude difference (degrees) at given latitude for MAX_KM.
 * Accounts for shrinking longitude arc lengths at higher latitudes.
 * @param {number} lat
 * @returns {number}
 */
function maxLonDiff(lat) {
  // prevent division by zero near poles
  const cos = Math.cos((lat * Math.PI) / 180)
  const safeCos = Math.abs(cos) < 1e-6 ? 1e-6 : cos
  return MAX_KM / (111 * Math.abs(safeCos))
}

/**
 * Fetch all cities that have lat AND lon not null.
 * Uses PostgREST filters lat=not.is.null & lon=not.is.null
 * @returns {Promise<Array<{id:string, city_name:string, lat:number, lon:number}>>}
 */
async function fetchCitiesWithCoords() {
  const endpoint = `${SUPABASE_URL}/rest/v1/cities?select=id,city_name,lat,lon&lat=not.is.null&lon=not.is.null`
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Failed to fetch cities: ${res.status} ${t}`)
  }
  const data = await res.json()
  return data.map((c) => ({
    id: c.id,
    city_name: c.city_name,
    lat: Number(c.lat),
    lon: Number(c.lon),
  }))
}

/**
 * Fetch existing city distance pairs into a Set of canonical keys so we can skip inserts.
 * If your DB is extremely large, consider paginating this request.
 * @returns {Promise<Set<string>>}
 */
async function fetchExistingPairsSet() {
  const endpoint = `${SUPABASE_URL}/rest/v1/city_distances?select=city_a_id,city_b_id&limit=1000000`
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Failed to fetch existing distances: ${res.status} ${t}`)
  }
  const rows = await res.json()
  const set = new Set()
  for (const r of rows) {
    if (r.city_a_id && r.city_b_id) {
      set.add(canonicalKey(r.city_a_id, r.city_b_id))
    }
  }
  return set
}

/**
 * Batch-insert buffered distances into city_distances via PostgREST.
 * Returns number of rows inserted (based on returned representation).
 * @param {Array<object>} buffer
 * @returns {Promise<number>}
 */
async function insertBuffer(buffer) {
  if (!buffer.length) return 0
  const endpoint = `${SUPABASE_URL}/rest/v1/city_distances`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(buffer),
  })
  if (!res.ok) {
    const t = await res.text()
    // On 409 conflicts PostgREST may return an error; we choose to warn and continue.
    if (res.status === 409) {
      console.warn('Batch insert conflict (some rows already exist).')
      return 0
    }
    throw new Error(`Failed to insert batch: ${res.status} ${t}`)
  }
  const created = await res.json()
  return Array.isArray(created) ? created.length : 0
}

/**
 * Main runner: computes pairwise distances with cheap pre-filters,
 * batches inserts, and avoids per-pair HTTP checks by using an in-memory set
 * of existing pairs.
 */
async function run() {
  console.log('Loading cities with coordinates...')
  const cities = await fetchCitiesWithCoords()
  if (!Array.isArray(cities) || cities.length < 2) {
    console.log('Not enough cities with coordinates. Exiting.')
    return
  }

  console.log(`Found ${cities.length} cities. Loading existing pairs...`)
  const existing = await fetchExistingPairsSet()
  console.log(`Loaded ${existing.size} existing pairs. Starting pairwise computation...`)

  let totalInserted = 0
  let totalCandidates = 0
  let totalFilteredOut = 0
  let totalHaversinePassed = 0

  const buffer = []

  for (let i = 0; i < cities.length; i++) {
    const a = cities[i]
    if (Number.isNaN(a.lat) || Number.isNaN(a.lon)) continue

    for (let j = i + 1; j < cities.length; j++) {
      const b = cities[j]
      if (Number.isNaN(b.lat) || Number.isNaN(b.lon)) continue

      // FAST filter 1: latitude bounding
      if (Math.abs(a.lat - b.lat) > MAX_LAT_DIFF) {
        totalFilteredOut++
        continue
      }

      // FAST filter 2: longitude bounding accounting for latitude (use average latitude)
      const avgLat = (a.lat + b.lat) / 2
      const lonLimit = maxLonDiff(avgLat)
      if (Math.abs(a.lon - b.lon) > lonLimit) {
        totalFilteredOut++
        continue
      }

      // candidate for Haversine
      totalCandidates++

      // skip if already exists in DB (canonical)
      const key = canonicalKey(a.id, b.id)
      if (existing.has(key)) continue

      // exact distance
      const distanceKm = haversineKm(a.lat, a.lon, b.lat, b.lon)
      if (distanceKm > MAX_KM) continue

      totalHaversinePassed++

      // prepare canonical ordering for insert
      const [ca, cb] = a.id <= b.id ? [a.id, b.id] : [b.id, a.id]
      buffer.push({
        city_a_id: ca,
        city_b_id: cb,
        distance_km: Number(distanceKm.toFixed(3)),
        source: 'generated',
      })

      // mark as existing preemptively to avoid duplicate buffering
      existing.add(key)

      // flush batch
      if (buffer.length >= BATCH_SIZE) {
        try {
          const inserted = await insertBuffer(buffer)
          totalInserted += inserted
          buffer.length = 0
          if (BATCH_DELAY_MS > 0) await sleep(BATCH_DELAY_MS)
        } catch (err) {
          console.error('Batch insert failed:', err.message || err)
          // allow loop to continue; optionally you may want to exit here
        }
      }
    }
  }

  // final flush
  if (buffer.length > 0) {
    try {
      const inserted = await insertBuffer(buffer)
      totalInserted += inserted
      buffer.length = 0
    } catch (err) {
      console.error('Final batch insert failed:', err.message || err)
    }
  }

  console.log('--- Summary ---')
  console.log(`Cities: ${cities.length}`)
  console.log(`Candidates passed cheap filters: ${totalCandidates}`)
  console.log(`Filtered-out by cheap checks: ${totalFilteredOut}`)
  console.log(`Passed Haversine and buffered: ${totalHaversinePassed}`)
  console.log(`Inserted rows (approx): ${totalInserted}`)
  console.log('✅ Done.')
}

/* Run the script */
run().catch((err) => {
  console.error('Fatal error:', err.message || err)
  process.exit(1)
})