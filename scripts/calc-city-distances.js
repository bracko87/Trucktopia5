/**
 * scripts/calc-city-distances.js
 *
 * Bulk compute pairwise distances between cities and insert into city_distances.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/calc-city-distances.js
 *
 * Environment variables:
 * - SUPABASE_URL            e.g. https://xyz.supabase.co
 * - SUPABASE_SERVICE_KEY    Supabase service_role key (keep private)
 * - BATCH_DELAY_MS          optional, delay between inserts in ms (default 25)
 *
 * Notes:
 * - Uses PostgREST endpoints; requires Node 18+ (fetch available globally).
 * - The script orders city ids lexicographically to ensure canonical pair ordering.
 */

/**
 * Get environment variable or throw if missing.
 * @param {string} name
 * @returns {string}
 */
function getEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return v;
}

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_KEY = getEnv("SUPABASE_SERVICE_KEY");
const BATCH_DELAY_MS = Number(process.env.BATCH_DELAY_MS || "25");

/**
 * Sleep helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Compute Haversine distance in kilometers between two lat/lon points.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number}
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fetch all cities with lat AND lon not null from Supabase (PostgREST).
 * @returns {Promise<Array<{id:string,city_name:string,lat:number,lon:number}>>}
 */
async function fetchCities() {
  const endpoint = `${SUPABASE_URL}/rest/v1/cities?select=id,city_name,lat,lon&lat=is.not.null&lon=is.not.null`;
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Failed to fetch cities: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data.map((c) => ({
    id: c.id,
    city_name: c.city_name,
    lat: Number(c.lat),
    lon: Number(c.lon),
  }));
}

/**
 * Check whether distance exists for canonical pair (a,b).
 * @param {string} a
 * @param {string} b
 * @returns {Promise<boolean>}
 */
async function distanceExists(a, b) {
  // canonical ordering: a <= b lexicographically
  const [ca, cb] = a <= b ? [a, b] : [b, a];
  const endpoint = `${SUPABASE_URL}/rest/v1/city_distances?select=id&city_a_id=eq.${encodeURIComponent(
    ca
  )}&city_b_id=eq.${encodeURIComponent(cb)}`;
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Failed to query existing distance: ${res.status} ${t}`);
  }
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

/**
 * Insert a distance row into city_distances.
 * @param {string} a
 * @param {string} b
 * @param {number} distanceKm
 * @returns {Promise<void>}
 */
async function insertDistance(a, b, distanceKm) {
  // canonical ordering for storage
  const [ca, cb] = a <= b ? [a, b] : [b, a];
  const endpoint = `${SUPABASE_URL}/rest/v1/city_distances`;
  const payload = {
    city_a_id: ca,
    city_b_id: cb,
    distance_km: Number(distanceKm.toFixed(3)),
    source: "generated",
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text();
    // If unique constraint violated (409), treat as already existing; otherwise surface error.
    if (res.status === 409) {
      console.warn("  → Conflict: already exists (skipping)");
      return;
    }
    throw new Error(`Failed to insert distance: ${res.status} ${t}`);
  }

  // optional: parse returned record
  // const created = await res.json();
  // return created;
}

/**
 * Main runner.
 */
async function run() {
  console.log("Loading cities with coordinates...");
  const cities = await fetchCities();
  if (!Array.isArray(cities) || cities.length < 2) {
    console.log("Not enough cities with coordinates. Exiting.");
    return;
  }

  console.log(`Found ${cities.length} cities. Computing pairwise distances...`);

  // Simple nested loop, canonical ordering prevents duplicates.
  let total = 0;
  for (let i = 0; i < cities.length; i++) {
    const a = cities[i];
    for (let j = i + 1; j < cities.length; j++) {
      const b = cities[j];

      // quick check: skip if either lat/lon invalid
      if (
        Number.isNaN(a.lat) ||
        Number.isNaN(a.lon) ||
        Number.isNaN(b.lat) ||
        Number.isNaN(b.lon)
      ) {
        console.warn(`Skipping pair with invalid coords: ${a.id}, ${b.id}`);
        continue;
      }

      // compute distance
      const distanceKm = haversineKm(a.lat, a.lon, b.lat, b.lon);

      // optionally check if exists to reduce inserts
      const exists = await distanceExists(a.id, b.id);
      if (exists) {
        // console.log(`  ↳ exists: ${a.city_name} ↔ ${b.city_name}`);
        continue;
      }

      // insert
      try {
        await insertDistance(a.id, b.id, distanceKm);
        total++;
        if (total % 50 === 0) {
          console.log(`  Inserted ${total} distances so far...`);
        }
      } catch (err) {
        console.error("Insert error:", err.message || err);
      }

      // small delay to avoid spamming DB
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`✅ Done. Inserted approximately ${total} new distances.`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});