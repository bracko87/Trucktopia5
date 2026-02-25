/**
 * Map.tsx
 *
 * Page showing an interactive live map with positions of all user trucks.
 *
 * Note: This version uses real backend data (Supabase) and renders a no-cost
 * OpenStreetMap tile background with SVG overlays for hubs, routes, and trucks.
 */

import React from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type LatLon = {
  lat: number
  lon: number
}

type HubMarker = {
  id: string
  city: string
  country: string | null
  point: LatLon
}

type TruckRoute = {
  assignmentId: string
  truckId: string | null
  truckLabel: string
  fromCity: string
  toCity: string
  cargo: string
  from: LatLon
  to: LatLon
  progress: number // 0..1
  updatedAt?: string | null
}

type FleetMapData = {
  hubs: HubMarker[]
  routes: TruckRoute[]
  companyId: string | null
}

type WorldPoint = {
  x: number
  y: number
}

type WorldBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type TileDescriptor = {
  x: number
  y: number
  z: number
}

const MAP_ZOOM = 6
const MAP_POLL_MS = 30000
const TILE_SIZE = 256

const ACTIVE_ASSIGNMENT_STATUSES = [
  'assigned',
  'to_pickup',
  'picking_load',
  'in_progress',
  'in_transit',
  'delivering',
]

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function interpolatePoint(from: LatLon, to: LatLon, progress: number): LatLon {
  const p = clamp(progress, 0, 1)
  return {
    lat: from.lat + (to.lat - from.lat) * p,
    lon: from.lon + (to.lon - from.lon) * p,
  }
}

/**
 * Convert latitude/longitude to world pixel coordinates for Web Mercator.
 * Coordinates are scaled for the selected zoom level.
 */
function latLonToWorld(point: LatLon): WorldPoint {
  const scale = TILE_SIZE * 2 ** MAP_ZOOM
  const lat = clamp(point.lat, -85.05112878, 85.05112878)
  const x = ((point.lon + 180) / 360) * scale
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  return { x, y }
}

function worldToPercent(point: WorldPoint, bounds: WorldBounds) {
  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  return {
    left: ((point.x - bounds.minX) / width) * 100,
    top: ((point.y - bounds.minY) / height) * 100,
  }
}

function tileGridForBounds(bounds: WorldBounds): TileDescriptor[] {
  const minTileX = Math.floor(bounds.minX / TILE_SIZE)
  const maxTileX = Math.floor(bounds.maxX / TILE_SIZE)
  const minTileY = Math.floor(bounds.minY / TILE_SIZE)
  const maxTileY = Math.floor(bounds.maxY / TILE_SIZE)
  const maxTile = 2 ** MAP_ZOOM

  const tiles: TileDescriptor[] = []
  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      if (y < 0 || y >= maxTile) continue
      const wrappedX = ((x % maxTile) + maxTile) % maxTile
      tiles.push({ x: wrappedX, y, z: MAP_ZOOM })
    }
  }
  return tiles
}

function computeBoundsFromData(data: FleetMapData): WorldBounds {
  const pts: WorldPoint[] = []

  for (const h of data.hubs) pts.push(latLonToWorld(h.point))
  for (const r of data.routes) {
    pts.push(latLonToWorld(r.from))
    pts.push(latLonToWorld(r.to))
    pts.push(latLonToWorld(interpolatePoint(r.from, r.to, r.progress)))
  }

  if (pts.length === 0) {
    // Fallback around central Europe
    const fallback = [
      { lat: 52.52, lon: 13.405 }, // Berlin
      { lat: 48.2082, lon: 16.3738 }, // Vienna
      { lat: 50.0755, lon: 14.4378 }, // Prague
    ].map(latLonToWorld)

    pts.push(...fallback)
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  const width = Math.max(maxX - minX, 1)
  const height = Math.max(maxY - minY, 1)
  const padX = Math.max(width * 0.15, 80)
  const padY = Math.max(height * 0.15, 80)

  return {
    minX: minX - padX,
    minY: minY - padY,
    maxX: maxX + padX,
    maxY: maxY + padY,
  }
}

async function resolveCompanyId(authUserId: string): Promise<string | null> {
  if (!authUserId) return null

  const byAuth = await supabase
    .from('users')
    .select('company_id')
    .eq('auth_user_id', authUserId)
    .limit(1)
    .maybeSingle()

  if (!byAuth.error && byAuth.data?.company_id) return String(byAuth.data.company_id)

  const byId = await supabase
    .from('users')
    .select('company_id')
    .eq('id', authUserId)
    .limit(1)
    .maybeSingle()

  if (!byId.error && byId.data?.company_id) return String(byId.data.company_id)
  return null
}

async function loadFleetMapData(authUserId: string): Promise<FleetMapData> {
  const companyId = await resolveCompanyId(authUserId)
  if (!companyId) return { hubs: [], routes: [], companyId: null }

  const [{ data: hubRows }, { data: assignmentsRows, error: assignmentsError }] =
    await Promise.all([
      supabase
        .from('hubs')
        .select('id,city,country,cities:city_id(city_name,lat,lon)')
        .eq('owner_id', companyId)
        .order('is_main', { ascending: false }),
      supabase
        .from('job_assignments')
        .select(
          [
            'id,',
            'status,',
            'user_truck_id,',
            'updated_at,',
            'accepted_at,',
            'job_offer:job_offer_id(',
            'id,',
            'distance_km,',
            'cargo_type_obj:cargo_type_id(name),',
            'cargo_item_obj:cargo_item_id(name),',
            'origin_city:origin_city_id(city_name,country_code,lat,lon),',
            'destination_city:destination_city_id(city_name,country_code,lat,lon)',
            ')',
          ].join('')
        )
        .eq('carrier_company_id', companyId)
        .in('status', ACTIVE_ASSIGNMENT_STATUSES)
        .order('accepted_at', { ascending: false })
        .limit(150),
    ])

  const mappedHubs: HubMarker[] = (hubRows ?? [])
    .map((h: any) => {
      const lat = Number(h?.cities?.lat)
      const lon = Number(h?.cities?.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return {
        id: String(h.id),
        city: String(h?.cities?.city_name ?? h?.city ?? 'Hub'),
        country: h?.country ?? null,
        point: { lat, lon },
      } as HubMarker
    })
    .filter(Boolean) as HubMarker[]

  if (assignmentsError || !Array.isArray(assignmentsRows)) {
    return {
      hubs: mappedHubs,
      routes: [],
      companyId,
    }
  }

  const assignmentIds = assignmentsRows.map((row: any) => row.id).filter(Boolean)
  const truckIds = Array.from(
    new Set(assignmentsRows.map((row: any) => row.user_truck_id).filter(Boolean))
  )

  const [{ data: sessionsRows }, { data: trucksRows }] = await Promise.all([
    assignmentIds.length
      ? supabase
          .from('driving_sessions')
          .select(
            'job_assignment_id,distance_completed_km,total_distance_km,segment_completed_km,segment_distance_km,updated_at'
          )
          .in('job_assignment_id', assignmentIds)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    truckIds.length
      ? supabase.from('user_trucks').select('id,registration,name').in('id', truckIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const latestSessionByAssignment: Record<string, any> = {}
  for (const row of Array.isArray(sessionsRows) ? sessionsRows : []) {
    const key = String(row?.job_assignment_id ?? '')
    if (!key || latestSessionByAssignment[key]) continue
    latestSessionByAssignment[key] = row
  }

  const truckLabelById: Record<string, string> = {}
  for (const truck of Array.isArray(trucksRows) ? trucksRows : []) {
    truckLabelById[String(truck.id)] =
      truck?.registration ?? truck?.name ?? `Truck ${String(truck.id).slice(0, 8)}`
  }

  const routes: TruckRoute[] = assignmentsRows
    .map((row: any) => {
      const offer = row?.job_offer ?? null
      const originLat = Number(offer?.origin_city?.lat)
      const originLon = Number(offer?.origin_city?.lon)
      const destinationLat = Number(offer?.destination_city?.lat)
      const destinationLon = Number(offer?.destination_city?.lon)

      if (
        !Number.isFinite(originLat) ||
        !Number.isFinite(originLon) ||
        !Number.isFinite(destinationLat) ||
        !Number.isFinite(destinationLon)
      ) {
        return null
      }

      const session = latestSessionByAssignment[String(row.id)]
      const distanceCompleted =
        Number(session?.distance_completed_km ?? session?.segment_completed_km ?? 0) || 0
      const totalDistance =
        Number(session?.total_distance_km ?? session?.segment_distance_km ?? offer?.distance_km ?? 0) || 0
      const progress = totalDistance > 0 ? clamp(distanceCompleted / totalDistance, 0, 1) : 0

      const truckId = row?.user_truck_id ? String(row.user_truck_id) : null
      const cargo = String(
        offer?.cargo_item_obj?.name ?? offer?.cargo_type_obj?.name ?? 'Cargo delivery'
      )

      return {
        assignmentId: String(row.id),
        truckId,
        truckLabel: truckId
          ? truckLabelById[truckId] ?? `Truck ${truckId.slice(0, 8)}`
          : 'Unassigned truck',
        fromCity: String(offer?.origin_city?.city_name ?? 'Origin'),
        toCity: String(offer?.destination_city?.city_name ?? 'Destination'),
        cargo,
        from: { lat: originLat, lon: originLon },
        to: { lat: destinationLat, lon: destinationLon },
        progress,
        updatedAt: session?.updated_at ?? row?.updated_at ?? null,
      } as TruckRoute
    })
    .filter(Boolean) as TruckRoute[]

  return { hubs: mappedHubs, routes, companyId }
}

/**
 * MapPage
 *
 * Real-data fleet map using Supabase + free OpenStreetMap tiles.
 */
export default function MapPage() {
  const { user } = useAuth()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<FleetMapData>({ hubs: [], routes: [], companyId: null })
  const [lastRefreshAt, setLastRefreshAt] = React.useState<Date | null>(null)

  const load = React.useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      setError(null)
      setData({ hubs: [], routes: [], companyId: null })
      return
    }

    setLoading(true)
    setError(null)
    try {
      const mapData = await loadFleetMapData(String(user.id))
      setData(mapData)
      setLastRefreshAt(new Date())
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load map data')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  React.useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      void load()
    }, MAP_POLL_MS)

    return () => window.clearInterval(timer)
  }, [load])

  const bounds = React.useMemo(() => computeBoundsFromData(data), [data])
  const tiles = React.useMemo(() => tileGridForBounds(bounds), [bounds])

  return (
    <Layout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Map</h1>
          <p className="text-sm text-black/70">Live positions of your fleet</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="bg-white p-4 rounded shadow border border-black/10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Live Route View</h2>
              <span className="text-xs text-black/60">
                Refresh interval: {Math.round(MAP_POLL_MS / 1000)} seconds
              </span>
            </div>

            {loading && data.routes.length === 0 && data.hubs.length === 0 ? (
              <div className="text-sm text-black/65">Loading map data…</div>
            ) : null}

            <div className="relative aspect-[16/9] w-full overflow-hidden rounded border border-black/10 bg-slate-200">
              {/* OpenStreetMap tile background */}
              <div className="absolute inset-0">
                {tiles.map((tile) => {
                  const tileMinX = tile.x * TILE_SIZE
                  const tileMinY = tile.y * TILE_SIZE
                  const tileMaxX = tileMinX + TILE_SIZE
                  const tileMaxY = tileMinY + TILE_SIZE
                  const topLeft = worldToPercent({ x: tileMinX, y: tileMinY }, bounds)
                  const bottomRight = worldToPercent({ x: tileMaxX, y: tileMaxY }, bounds)

                  return (
                    <img
                      key={`${tile.z}-${tile.x}-${tile.y}`}
                      src={`https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`}
                      alt=""
                      aria-hidden="true"
                      className="absolute select-none pointer-events-none"
                      style={{
                        left: `${topLeft.left}%`,
                        top: `${topLeft.top}%`,
                        width: `${bottomRight.left - topLeft.left}%`,
                        height: `${bottomRight.top - topLeft.top}%`,
                      }}
                    />
                  )
                })}
              </div>

              {/* Overlay */}
              <svg viewBox="0 0 100 100" className="relative h-full w-full">
                <rect x="0" y="0" width="100" height="100" fill="rgba(15,23,42,0.06)" />

                {data.routes.map((route) => {
                  const a = worldToPercent(latLonToWorld(route.from), bounds)
                  const b = worldToPercent(latLonToWorld(route.to), bounds)

                  return (
                    <line
                      key={`${route.assignmentId}-line`}
                      x1={a.left}
                      y1={a.top}
                      x2={b.left}
                      y2={b.top}
                      stroke="#0369a1"
                      strokeWidth="0.45"
                      strokeDasharray="1.8 1"
                    />
                  )
                })}

                {data.hubs.map((hub) => {
                  const p = worldToPercent(latLonToWorld(hub.point), bounds)
                  return (
                    <g key={hub.id}>
                      <circle cx={p.left} cy={p.top} r="0.9" fill="#16a34a" />
                      <text
                        x={p.left + 1.1}
                        y={p.top - 0.9}
                        fill="#0f172a"
                        fontSize="2.6"
                        fontWeight="600"
                      >
                        {hub.city}
                      </text>
                    </g>
                  )
                })}

                {data.routes.map((route) => {
                  const truckPoint = interpolatePoint(route.from, route.to, route.progress)
                  const p = worldToPercent(latLonToWorld(truckPoint), bounds)
                  return (
                    <g key={`${route.assignmentId}-truck`}>
                      <circle cx={p.left} cy={p.top} r="1" fill="#ea580c" />
                      <text
                        x={p.left + 1.2}
                        y={p.top + 0.9}
                        fill="#7c2d12"
                        fontSize="2.3"
                        fontWeight="700"
                      >
                        {route.truckLabel}
                      </text>
                    </g>
                  )
                })}
              </svg>

              {error ? (
                <div className="absolute left-2 top-2 text-xs text-rose-700 bg-white/90 border border-rose-200 px-2 py-1 rounded">
                  {error}
                </div>
              ) : null}

              {!loading && !error && data.routes.length === 0 ? (
                <div className="absolute left-2 top-2 text-xs text-black/75 bg-white/90 border border-black/10 px-2 py-1 rounded">
                  No active assignments with mappable coordinates.
                </div>
              ) : null}

              <div className="absolute right-2 bottom-1 text-[10px] text-black/70 bg-white/80 px-1.5 py-0.5 rounded">
                © OpenStreetMap contributors
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="bg-white p-4 rounded shadow border border-black/10">
              <h2 className="font-semibold mb-2">Active Trucks</h2>

              {loading ? <div className="text-sm text-black/65">Loading map data…</div> : null}
              {error ? <div className="text-sm text-rose-600">{error}</div> : null}

              {!loading && !error && data.routes.length === 0 ? (
                <div className="text-sm text-black/65">
                  No active assignments with mappable city coordinates found.
                </div>
              ) : null}

              <ul className="space-y-2 text-sm">
                {data.routes.map((route) => {
                  const progress = Math.round(route.progress * 100)
                  return (
                    <li
                      key={`${route.assignmentId}-details`}
                      className="rounded border border-black/10 p-2"
                    >
                      <div className="font-medium">{route.truckLabel}</div>
                      <div className="text-black/70">
                        {route.fromCity} → {route.toCity}
                      </div>
                      <div className="text-black/70">Cargo: {route.cargo}</div>
                      <div className="text-black/70">Route progress: {progress}%</div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="bg-white p-4 rounded shadow border border-black/10 text-sm">
              <h2 className="font-semibold mb-2">Data source</h2>
              <ul className="list-disc pl-5 space-y-1 text-black/75">
                <li>
                  Routes: <code>job_assignments</code> + <code>driving_sessions</code>.
                </li>
                <li>
                  Hubs: <code>hubs</code> joined with <code>cities(lat, lon)</code>.
                </li>
                <li>
                  Truck labels: <code>user_trucks.registration</code>.
                </li>
                <li>Last refresh: {lastRefreshAt ? lastRefreshAt.toLocaleTimeString() : '—'}.</li>
              </ul>
            </div>

            <div className="bg-white p-4 rounded shadow border border-black/10 text-sm">
              <h2 className="font-semibold mb-2">How to make this fully real (free stack)</h2>
              <ol className="list-decimal pl-5 space-y-1 text-black/75">
                <li>Keep using OpenStreetMap tiles with this overlay approach (or Leaflet/MapLibre).</li>
                <li>Store GPS points in Supabase and poll/realtime-subscribe for updates.</li>
                <li>Record driving progress in <code>driving_sessions</code> more frequently.</li>
                <li>Replace straight lines with route polylines from a routing engine later.</li>
              </ol>
            </div>
          </aside>
        </section>
      </div>
    </Layout>
  )
}