/**
 * netlify/functions/jobs.ts
 *
 * Simple Netlify Function that returns sample open job offers.
 *
 * This is a temporary mock implementation so the frontend can call /api/jobs.
 * In production this function should query your real backend / database.
 */

/**
 * Handler
 *
 * Responds to GET requests with a JSON array of job offers.
 *
 * @param event - Netlify function event
 */
export async function handler(event: any) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  // Sample job offers - shape matches the Market UI expectations
  const jobs = [
    {
      id: 'job-1',
      origin_city_id: 'city-101',
      origin_city_name: 'Berlin',
      destination_city_id: 'city-202',
      destination_city_name: 'Hamburg',
      cargo_type: 'Electronics',
      cargo_item: null,
      distance_km: 289,
      pickup_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      delivery_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      transport_mode: 'trailer',
      reward_trailer_cargo: 450.0,
      reward_load_cargo: 300.0,
    },
    {
      id: 'job-2',
      origin_city_id: 'city-303',
      origin_city_name: 'Munich',
      destination_city_id: 'city-404',
      destination_city_name: 'Stuttgart',
      cargo_type: 'Food',
      cargo_item: 'Perishables',
      distance_km: 220,
      pickup_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      delivery_deadline: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
      transport_mode: 'load',
      reward_trailer_cargo: 0.0,
      reward_load_cargo: 280.0,
    },
    {
      id: 'job-3',
      origin_city_id: 'city-505',
      origin_city_name: 'Cologne',
      destination_city_id: 'city-606',
      destination_city_name: 'Dusseldorf',
      cargo_type: 'Furniture',
      cargo_item: null,
      distance_km: 45,
      pickup_time: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
      delivery_deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      transport_mode: 'trailer',
      reward_trailer_cargo: 120.0,
      reward_load_cargo: 90.0,
    },
  ]

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jobs),
  }
}