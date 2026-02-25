/**
 * Map.tsx
 *
 * Page showing an interactive live map with positions of all user trucks.
 *
 * This version uses:
 * - Supabase for real data
 * - React-Leaflet (Leaflet) for a real interactive map (zoom/pan)
 * - OpenStreetMap tiles as a free/open basemap
 *
 * NOTE:
 * react-leaflet is loaded dynamically (client-only) to avoid SSR/top-level import issues.
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

type ReactLeafletModule = typeof import('react-leaflet')

type LatLngTuple = [number, number]
type LatLngBoundsTuple = [LatLngTuple, LatLngTuple]

const MAP_POLL_MS = 30000
const DEFAULT_INITIAL_ZOOM = 6

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

function computeLatLonBounds(data: FleetMapData): LatLngBoundsTuple {
  const points: LatLon[] = []

  for (const h of data.hubs) points.push(h.point)
  for (const r of data.routes) {
    points.push(r.from, r.to, interpolatePoint(r.from, r.to, r.progress))
  }

  if (points.length === 0) {
    // Fallback around central Europe
    points.push(
      { lat: 52.52, lon: 13.405 }, // Berlin
      { lat: 48.2082, lon: 16.3738 }, // Vienna
      { lat: 50.0755, lon: 14.4378 } // Prague
    )
  }

  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity

  for (const p of points) {
    const lat = clamp(Number(p.lat), -85.0511, 85.0511)
    const lon = clamp(Number(p.lon), -180, 180)

    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
  }

  const latSpan = Math.max(maxLat - minLat, 0.01)
  const lonSpan = Math.max(maxLon - minLon, 0.01)

  // Add padding so markers aren't at the edges.
  const padLat = Math.max(latSpan * 0.18, 0.6)
  const padLon = Math.max(lonSpan * 0.18, 0.9)

  const south = clamp(minLat - padLat, -85.0511, 85.0511)
  const north = clamp(maxLat + padLat, -85.0511, 85.0511)
  const west = clamp(minLon - padLon, -180, 180)
  const east = clamp(maxLon + padLon, -180, 180)

  return [
    [south, west],
    [north, east],
  ]
}

function boundsCenter(bounds: LatLngBoundsTuple): LatLngTuple {
  const [[south, west], [north, east]] = bounds
  return [(south + north) / 2, (west + east) / 2]
}

function FleetLeafletMap({
  data,
  loading,
  error,
}: {
  data: FleetMapData
  loading: boolean
  error: string | null
}) {
  const bounds = React.useMemo(() => computeLatLonBounds(data), [data])
  const center = React.useMemo(() => boundsCenter(bounds), [bounds])

  const [rl, setRl] = React.useState<ReactLeafletModule | null>(null)
  const [rlError, setRlError] = React.useState<string | null>(null)
  const mapRef = React.useRef<any>(null)

  // Load react-leaflet only on the client
  React.useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const mod = await import('react-leaflet')
        if (!cancelled) setRl(mod)
      } catch (e: any) {
        if (!cancelled) {
          setRlError(e?.message ?? 'Failed to load map library')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Fit bounds whenever data changes
  React.useEffect(() => {
    if (!rl || !mapRef.current) return

    const t = window.setTimeout(() => {
      try {
        mapRef.current.invalidateSize?.()
        mapRef.current.fitBounds(bounds, {
          padding: [24, 24],
          maxZoom: 11,
        })
      } catch {
        // no-op
      }
    }, 0)

    return () => window.clearTimeout(t)
  }, [rl, bounds, data.routes.length, data.hubs.length])

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded border border-black/10 bg-slate-100">
      {!rl ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-black/60">
          Loading map…
        </div>
      ) : (
        (() => {
          const RL: any = rl

          return (
            <RL.MapContainer
              center={center}
              zoom={DEFAULT_INITIAL_ZOOM}
              zoomControl={false}
              scrollWheelZoom
              doubleClickZoom
              dragging
              attributionControl
              className="h-full w-full"
              style={{ height: '100%', width: '100%' }}
              ref={(mapInstance: any) => {
                if (mapInstance) mapRef.current = mapInstance
              }}
            >
              <RL.ZoomControl position="topright" />

              {/* Free / open basemap */}
              <RL.TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
                maxZoom={19}
              />

              {/* Route lines */}
              {data.routes.map((route) => {
                const positions: LatLngTuple[] = [
                  [route.from.lat, route.from.lon],
                  [route.to.lat, route.to.lon],
                ]
                const progressPct = Math.round(route.progress * 100)

                return (
                  <RL.Polyline
                    key={`${route.assignmentId}-line`}
                    positions={positions}
                    pathOptions={{
                      color: '#0284c7',
                      weight: 2,
                      dashArray: '6 6',
                      opacity: 0.8,
                    }}
                  >
                    <RL.Tooltip sticky>
                      <div className="text-xs">
                        <div className="font-semibold">{route.truckLabel}</div>
                        <div>
                          {route.fromCity} → {route.toCity}
                        </div>
                        <div>{route.cargo}</div>
                        <div>Progress: {progressPct}%</div>
                      </div>
                    </RL.Tooltip>
                  </RL.Polyline>
                )
              })}

              {/* Hubs */}
              {data.hubs.map((hub) => (
                <RL.CircleMarker
                  key={hub.id}
                  center={[hub.point.lat, hub.point.lon]}
                  radius={6}
                  pathOptions={{
                    color: '#166534',
                    weight: 2,
                    fillColor: '#22c55e',
                    fillOpacity: 0.95,
                  }}
                >
                  <RL.Tooltip direction="top" offset={[0, -2]}>
                    <div className="text-xs">
                      <div className="font-semibold">{hub.city}</div>
                      {hub.country ? <div>{hub.country}</div> : null}
                    </div>
                  </RL.Tooltip>
                </RL.CircleMarker>
              ))}

              {/* Trucks (interpolated along straight line route) */}
              {data.routes.map((route) => {
                const truckPoint = interpolatePoint(route.from, route.to, route.progress)
                const progressPct = Math.round(route.progress * 100)

                return (
                  <RL.CircleMarker
                    key={`${route.assignmentId}-truck`}
                    center={[truckPoint.lat, truckPoint.lon]}
                    radius={7}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 2,
                      fillColor: '#f97316',
                      fillOpacity: 1,
                    }}
                  >
                    <RL.Tooltip direction="right" offset={[8, 0]}>
                      <div className="text-xs">
                        <div className="font-semibold">{route.truckLabel}</div>
                        <div>
                          {route.fromCity} → {route.toCity}
                        </div>
                        <div>{route.cargo}</div>
                        <div>Progress: {progressPct}%</div>
                      </div>
                    </RL.Tooltip>
                  </RL.CircleMarker>
                )
              })}
            </RL.MapContainer>
          )
        })()
      )}

      {/* Errors / empty-state overlays */}
      {rlError ? (
        <div className="absolute left-2 top-2 z-[500] rounded border border-rose-200 bg-white/95 px-2 py-1 text-xs text-rose-700 shadow-sm">
          Map library error: {rlError}
        </div>
      ) : null}

      {error ? (
        <div className="absolute left-2 top-2 z-[500] rounded border border-rose-200 bg-white/95 px-2 py-1 text-xs text-rose-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error && data.routes.length === 0 ? (
        <div className="absolute left-2 top-2 z-[500] rounded border border-black/10 bg-white/95 px-2 py-1 text-xs text-black/75 shadow-sm">
          No active assignments with mappable coordinates.
        </div>
      ) : null}
    </div>
  )
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
        Number(
          session?.total_distance_km ??
            session?.segment_distance_km ??
            offer?.distance_km ??
            0
        ) || 0
      const progress =
        totalDistance > 0 ? clamp(distanceCompleted / totalDistance, 0, 1) : 0

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
 * Real-data fleet map using Supabase + Leaflet + OpenStreetMap tiles.
 */
export default function MapPage() {
  const { user } = useAuth()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<FleetMapData>({
    hubs: [],
    routes: [],
    companyId: null,
  })
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

  return (
    <Layout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Map</h1>
          <p className="text-sm text-black/70">Live positions of your fleet</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded border border-black/10 bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Live Route View</h2>
              <span className="text-xs text-black/60">
                Refresh interval: {Math.round(MAP_POLL_MS / 1000)} seconds
              </span>
            </div>

            {loading && data.routes.length === 0 && data.hubs.length === 0 ? (
              <div className="mb-2 text-sm text-black/65">Loading map data…</div>
            ) : null}

            <FleetLeafletMap data={data} loading={loading} error={error} />
          </div>

          <aside className="space-y-4">
            <div className="rounded border border-black/10 bg-white p-4 shadow">
              <h2 className="mb-2 font-semibold">Active Trucks</h2>

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

            <div className="rounded border border-black/10 bg-white p-4 text-sm shadow">
              <h2 className="mb-2 font-semibold">Data source</h2>
              <ul className="list-disc space-y-1 pl-5 text-black/75">
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

            <div className="rounded border border-black/10 bg-white p-4 text-sm shadow">
              <h2 className="mb-2 font-semibold">How to make this fully real (free stack)</h2>
              <ol className="list-decimal space-y-1 pl-5 text-black/75">
                <li>Keep using OpenStreetMap tiles + Leaflet (what this page now uses).</li>
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