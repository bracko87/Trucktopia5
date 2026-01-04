/**
 * scripts/bulk-geocode-cities.js
 *
 * Bulk geocoding script for Supabase "cities" table.
 *
 * Requirements:
 * - Node 18+ (global fetch available). If using older Node, install node-fetch or run with a Node version that provides fetch.
 * - Environment variables:
 *   SUPABASE_URL            - e.g. https://xyz.supabase.co
 *   SUPABASE_SERVICE_KEY    - Supabase service_role key (keep private)
 *   OPENCAGE_KEY            - OpenCage API key
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... OPENCAGE_KEY=... node --experimental-json-modules scripts/bulk-geocode-cities.js
 *
 * Notes:
 * - Uses Supabase PostgREST endpoints to avoid adding @supabase/supabase-js dependency.
 * - Idempotent: only updates rows where lat is null (fetched by the initial query).
 */

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get environment variable or throw an error if missing.
 * @param {string} name - The env var name.
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
const OPENCAGE_KEY = getEnv("OPENCAGE_KEY");

/**
 * Geocode a single city + country using OpenCage (limit=1).
 * @param {string} city
 * @param {string} country
 * @returns {Promise<{lat:number,lng:number}|null>}
 */
async function geocode(city, country) {
  try {
    const q = encodeURIComponent(`${city}, ${country}`);
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${q}&key=${OPENCAGE_KEY}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`OpenCage HTTP ${res.status} for ${city}, ${country}`);
      return null;
    }
    const json = await res.json();
    if (!json.results || json.results.length === 0) return null;
    return json.results[0].geometry;
  } catch (err) {
    console.error("Geocode error:", err);
    return null;
  }
}

/**
 * Fetch all cities with null lat from Supabase via PostgREST.
 * @returns {Promise<Array<{id:string,city_name:string,country_name:string}>>}
 */
async function fetchCitiesToGeocode() {
  const endpoint = `${SUPABASE_URL}/rest/v1/cities?select=id,city_name,country_name&lat=is.null`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch cities: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data;
}

/**
 * Update lat/lon for a city row by id via PostgREST PATCH.
 * @param {string} id
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<void>}
 */
async function updateCityLatLon(id, lat, lon) {
  // PostgREST requires query param filter; id may need encoding
  const endpoint = `${SUPABASE_URL}/rest/v1/cities?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ lat, lon })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update city ${id}: ${res.status} ${text}`);
  }
}

/**
 * Main runner.
 * - Fetch cities with null lat
 * - For each: geocode via OpenCage, PATCH lat/lon back to Supabase
 */
async function run() {
  console.log("Starting bulk geocode...");

  const cities = await fetchCitiesToGeocode();
  if (!Array.isArray(cities) || cities.length === 0) {
    console.log("No cities found with null lat. Nothing to do.");
    return;
  }

  console.log(`Found ${cities.length} cities to geocode`);

  for (const row of cities) {
    const cityName = row.city_name;
    const countryName = row.country_name;
    const id = row.id;

    console.log(`→ Geocoding: ${cityName}, ${countryName} (id=${id})`);
    const geometry = await geocode(cityName, countryName);

    if (!geometry) {
      console.warn(`  ⚠️ Not found for ${cityName}, ${countryName}`);
      // Respect rate limit even on misses
      await sleep(1100);
      continue;
    }

    const { lat, lng } = geometry;
    try {
      await updateCityLatLon(id, lat, lng);
      console.log(`  ✅ Updated lat=${lat} lon=${lng}`);
    } catch (err) {
      console.error(`  ❌ Update failed for id=${id}:`, err.message || err);
    }

    // OpenCage free-tier rate limit: keep >1s between requests
    await sleep(1100);
  }

  console.log("✅ Done");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});