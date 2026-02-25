/**
 * Map.tsx
 *
 * Interactive live-ish map (NO react-leaflet) using:
 * - Supabase for real data
 * - OpenStreetMap tiles as <img>
 * - SVG overlay for routes, hubs, and truck positions
 * - Pan/zoom interaction
 * - Sidebar focus actions (click sidebar item -> map recenters)
 *
 * NOTE: With only city-to-city + progress, truck positions are estimated.
 */

import React from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type LatLon = { lat: number; lon: number }

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

type LatLngTuple = [number, number]
type LatLngBoundsTuple = [LatLngTuple, LatLngTuple]

type WorldPoint = { x: number; y: number }

type WorldBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type OSMTile = { x: number; y: number; z: number }

type MapFocus =
  | { kind: 'route'; route: TruckRoute }
  | { kind: 'hub'; hub: HubMarker }
  | null

const MAP_POLL_MS = 30000
const OSM_TILE_SIZE = 256

const MIN_ZOOM = 3
const MAX_ZOOM = 12
const DEFAULT_ZOOM = 6

// Expanded active status detection
const ACTIVE_ASSIGNMENT_STATUSES = new Set([
  'assigned',
  'to_pickup',
  'picking_load',
  'loading',
  'to_delivery',
  'to_deliver',
  'delivering',
  'unloading',
  'in_progress',
  'waiting_driver',
  'picking_up',
  'pickup',
])

const INACTIVE_SESSION_PHASES = new Set(['idle', 'completed', 'delivered', 'cancelled', 'failed'])

function normalizeTag(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function isActiveAssignmentStatus(value: unknown) {
  return ACTIVE_ASSIGNMENT_STATUSES.has(normalizeTag(value))
}

function isActiveSessionPhase(value: unknown) {
  const phase = normalizeTag(value)
  if (!phase) return false
  return !INACTIVE_SESSION_PHASES.has(phase)
}

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
    points.push(
      { lat: 52.52, lon: 13.405 }, // Berlin
      { lat: 48.2082, lon: 16.3738 }, // Vienna
      { lat: 50.0755, lon: 14.4378 } // Prague
    )
  }

  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity

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

// WebMercator: lat/lon <-> world pixel coordinates at zoom
function latLonToWorld(point: LatLon, zoom: number): WorldPoint {
  const lat = clamp(point.lat, -85.05112878, 85.05112878)
  const lon = clamp(point.lon, -180, 180)

  const scale = OSM_TILE_SIZE * Math.pow(2, zoom)
  const x = ((lon + 180) / 360) * scale

  const latRad = (lat * Math.PI) / 180
  const mercatorY = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
  const y = ((1 - mercatorY / Math.PI) / 2) * scale

  return { x, y }
}

function worldToLatLon(world: WorldPoint, zoom: number): LatLon {
  const scale = OSM_TILE_SIZE * Math.pow(2, zoom)
  const x = clamp(world.x, 0, scale)
  const y = clamp(world.y, 0, scale)

  const lon = (x / scale) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / scale
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))

  return { lat, lon }
}

function worldToPercent(world: WorldPoint, bounds: WorldBounds): { left: number; top: number } {
  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)

  const left = ((world.x - bounds.minX) / width) * 100
  const top = ((world.y - bounds.minY) / height) * 100

  return {
    left: clamp(left, -200, 300),
    top: clamp(top, -200, 300),
  }
}

function buildTilesForBounds(bounds: WorldBounds, zoom: number): OSMTile[] {
  const n = Math.pow(2, zoom)

  const minTileX = Math.floor(bounds.minX / OSM_TILE_SIZE)
  const maxTileX = Math.floor((bounds.maxX - 1) / OSM_TILE_SIZE)
  const minTileY = Math.floor(bounds.minY / OSM_TILE_SIZE)
  const maxTileY = Math.floor((bounds.maxY - 1) / OSM_TILE_SIZE)

  const tiles: OSMTile[] = []
  for (let y = minTileY; y <= maxTileY; y++) {
    if (y < 0 || y >= n) continue
    for (let x = minTileX; x <= maxTileX; x++) {
      const wrappedX = ((x % n) + n) % n
      tiles.push({ x: wrappedX, y, z: zoom })
    }
  }
  return tiles
}

function useElementSize<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null)
  const [size, setSize] = React.useState({ width: 0, height: 0 })

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize({ width: Math.round(cr.width), height: Math.round(cr.height) })
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { ref, size }
}

function isSchemaLikeError(err: any) {
  const code = String(err?.code ?? '')
  // 42703 = undefined column; PGRSTxxx = relation/select parsing issues
  return code === '42703' || code.startsWith('PGRST') || /column .* does not exist/i.test(String(err?.message ?? ''))
}

function FleetInteractiveMap({
  data,
  loading,
  error,
  focus,
}: {
  data: FleetMapData
  loading: boolean
  error: string | null
  focus: MapFocus
}) {
  const [zoom, setZoom] = React.useState(DEFAULT_ZOOM)
  const [center, setCenter] = React.useState<LatLon>({ lat: 50.0755, lon: 14.4378 })

  const { ref: wrapRef, size } = useElementSize<HTMLDivElement>()

  const [selected, setSelected] = React.useState<
    | { type: 'truck'; route: TruckRoute }
    | { type: 'hub'; hub: HubMarker }
    | { type: 'route'; route: TruckRoute }
    | null
  >(null)

  // Fit once initially
  const didFit = React.useRef(false)
  React.useEffect(() => {
    if (didFit.current) return
    const [[south, west], [north, east]] = computeLatLonBounds(data)
    setCenter({ lat: (south + north) / 2, lon: (west + east) / 2 })
    didFit.current = true
  }, [data])

  // Sidebar focus
  React.useEffect(() => {
    if (!focus) return

    if (focus.kind === 'hub') {
      const p = focus.hub.point
      setCenter({ lat: p.lat, lon: p.lon })
      setZoom((z) => Math.max(z, 8))
      setSelected({ type: 'hub', hub: focus.hub })
      return
    }

    if (focus.kind === 'route') {
      const r = focus.route
      const truck = interpolatePoint(r.from, r.to, r.progress)
      setCenter({ lat: truck.lat, lon: truck.lon })
      setZoom((z) => Math.max(z, 7))
      setSelected({ type: 'truck', route: r })
    }
  }, [focus])

  const worldBounds = React.useMemo((): WorldBounds => {
    const w = Math.max(size.width, 1)
    const h = Math.max(size.height, 1)
    const c = latLonToWorld(center, zoom)
    return { minX: c.x - w / 2, maxX: c.x + w / 2, minY: c.y - h / 2, maxY: c.y + h / 2 }
  }, [center, zoom, size.width, size.height])

  const tiles = React.useMemo(() => buildTilesForBounds(worldBounds, zoom), [worldBounds, zoom])

  // Pan/zoom interaction
  const dragState = React.useRef<{ dragging: boolean; startX: number; startY: number; startCenterWorld: WorldPoint } | null>(
    null
  )

  const rafRef = React.useRef<number | null>(null)
  const pendingCenterWorld = React.useRef<WorldPoint | null>(null)

  function commitCenterFromWorld(world: WorldPoint) {
    setCenter(worldToLatLon(world, zoom))
  }

  function scheduleCenterWorld(world: WorldPoint) {
    pendingCenterWorld.current = world
    if (rafRef.current != null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      const w = pendingCenterWorld.current
      if (!w) return
      pendingCenterWorld.current = null
      commitCenterFromWorld(w)
    })
  }

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startCenterWorld: latLonToWorld(center, zoom),
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    const st = dragState.current
    if (!st?.dragging) return
    const dx = e.clientX - st.startX
    const dy = e.clientY - st.startY
    scheduleCenterWorld({ x: st.startCenterWorld.x - dx, y: st.startCenterWorld.y - dy })
  }

  function endDrag() {
    dragState.current = null
  }

  function zoomBy(delta: number, anchorClient?: { x: number; y: number }) {
    const nextZoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM)
    if (nextZoom === zoom) return

    if (!anchorClient || !wrapRef.current) {
      setZoom(nextZoom)
      return
    }

    const rect = wrapRef.current.getBoundingClientRect()
    const ax = anchorClient.x - rect.left
    const ay = anchorClient.y - rect.top

    const anchorWorld = { x: worldBounds.minX + ax, y: worldBounds.minY + ay }
    const anchorLatLon = worldToLatLon(anchorWorld, zoom)
    const anchorWorldNext = latLonToWorld(anchorLatLon, nextZoom)

    const nextCenterWorld = {
      x: anchorWorldNext.x - ax + size.width / 2,
      y: anchorWorldNext.y - ay + size.height / 2,
    }

    setZoom(nextZoom)
    setCenter(worldToLatLon(nextCenterWorld, nextZoom))
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    zoomBy(e.deltaY > 0 ? -1 : 1, { x: e.clientX, y: e.clientY })
  }

  const touchRef = React.useRef<{ x: number; y: number; startCenterWorld: WorldPoint } | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, startCenterWorld: latLonToWorld(center, zoom) }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!touchRef.current || e.touches.length !== 1) return
    const t = e.touches[0]
    const dx = t.clientX - touchRef.current.x
    const dy = t.clientY - touchRef.current.y
    scheduleCenterWorld({ x: touchRef.current.startCenterWorld.x - dx, y: touchRef.current.startCenterWorld.y - dy })
  }

  function onTouchEnd() {
    touchRef.current = null
  }

  function fitToData() {
    const [[south, west], [north, east]] = computeLatLonBounds(data)
    setCenter({ lat: (south + north) / 2, lon: (west + east) / 2 })
  }

  const tileServers = ['a', 'b', 'c']

  function focusHubLocal(hub: HubMarker) {
    setCenter({ lat: hub.point.lat, lon: hub.point.lon })
    setZoom((z) => Math.max(z, 8))
    setSelected({ type: 'hub', hub })
  }

  function focusRouteLocal(route: TruckRoute) {
    const truckPoint = interpolatePoint(route.from, route.to, route.progress)
    setCenter({ lat: truckPoint.lat, lon: truckPoint.lon })
    setZoom((z) => Math.max(z, 7))
    setSelected({ type: 'truck', route })
  }

  return (
    <div className="rounded border border-black/10 bg-white p-3 shadow">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">Live Route View</div>
          <div className="text-xs text-black/60">Drag to pan • Wheel to zoom • Zoom: {zoom}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-black/10 bg-white px-2 py-1 text-xs hover:bg-slate-50"
            onClick={() => zoomBy(1)}
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="rounded border border-black/10 bg-white px-2 py-1 text-xs hover:bg-slate-50"
            onClick={() => zoomBy(-1)}
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="rounded border border-black/10 bg-white px-2 py-1 text-xs hover:bg-slate-50"
            onClick={fitToData}
            title="Center on fleet"
          >
            Fit
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative h-[520px] w-full overflow-hidden rounded border border-black/10 bg-slate-100"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <div className="absolute inset-0">
          {tiles.map((tile) => {
            const tileMinX = tile.x * OSM_TILE_SIZE
            const tileMinY = tile.y * OSM_TILE_SIZE
            const tileMaxX = tileMinX + OSM_TILE_SIZE
            const tileMaxY = tileMinY + OSM_TILE_SIZE

            const topLeft = worldToPercent({ x: tileMinX, y: tileMinY }, worldBounds)
            const bottomRight = worldToPercent({ x: tileMaxX, y: tileMaxY }, worldBounds)

            const srv = tileServers[(tile.x + tile.y) % tileServers.length]

            return (
              <img
                key={`${tile.z}-${tile.x}-${tile.y}`}
                src={`https://${srv}.tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`}
                alt=""
                aria-hidden="true"
                className="absolute select-none pointer-events-none"
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
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

        <svg viewBox="0 0 100 100" className="relative h-full w-full">
          {data.routes.map((route) => {
            const a = worldToPercent(latLonToWorld(route.from, zoom), worldBounds)
            const b = worldToPercent(latLonToWorld(route.to, zoom), worldBounds)
            return (
              <line
                key={`${route.assignmentId}-line`}
                x1={a.left}
                y1={a.top}
                x2={b.left}
                y2={b.top}
                stroke="#0284c7"
                strokeWidth="0.55"
                strokeDasharray="2 1.2"
                opacity="0.9"
                onClick={() => setSelected({ type: 'route', route })}
                style={{ cursor: 'pointer' }}
              />
            )
          })}

          {data.hubs.map((hub) => {
            const p = worldToPercent(latLonToWorld(hub.point, zoom), worldBounds)
            return (
              <g key={hub.id} onClick={() => focusHubLocal(hub)} style={{ cursor: 'pointer' }}>
                <circle cx={p.left} cy={p.top} r="1.1" fill="#16a34a" stroke="white" strokeWidth="0.25" />
                <text x={p.left + 1.2} y={p.top - 1.0} fill="#0f172a" fontSize="2.6" fontWeight="700">
                  {hub.city}
                </text>
              </g>
            )
          })}

          {data.routes.map((route) => {
            const truckPoint = interpolatePoint(route.from, route.to, route.progress)
            const p = worldToPercent(latLonToWorld(truckPoint, zoom), worldBounds)
            return (
              <g key={`${route.assignmentId}-truck`} onClick={() => focusRouteLocal(route)} style={{ cursor: 'pointer' }}>
                <circle cx={p.left} cy={p.top} r="1.25" fill="#ea580c" stroke="white" strokeWidth="0.25" />
                <text x={p.left + 1.35} y={p.top + 1.0} fill="#7c2d12" fontSize="2.4" fontWeight="800">
                  {route.truckLabel}
                </text>
              </g>
            )
          })}
        </svg>

        {error ? (
          <div className="absolute left-2 top-2 z-10 rounded border border-rose-200 bg-white/95 px-2 py-1 text-xs text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {!loading && !error && data.routes.length === 0 ? (
          <div className="absolute left-2 top-2 z-10 rounded border border-black/10 bg-white/95 px-2 py-1 text-xs text-black/75 shadow-sm">
            No active assignments with mappable coordinates.
          </div>
        ) : null}

        {selected ? (
          <div className="absolute right-2 top-2 z-10 w-[280px] rounded border border-black/10 bg-white/95 p-2 text-xs text-black/80 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">
                {selected.type === 'hub' ? 'Hub' : selected.type === 'route' ? 'Route' : 'Truck'}
              </div>
              <button
                type="button"
                className="text-black/50 hover:text-black"
                onClick={() => setSelected(null)}
                title="Close"
              >
                ✕
              </button>
            </div>

            {selected.type === 'hub' ? (
              <div className="mt-1">
                <div className="font-medium">{selected.hub.city}</div>
                {selected.hub.country ? <div>{selected.hub.country}</div> : null}
              </div>
            ) : (
              <div className="mt-1">
                <div className="font-medium">{selected.route.truckLabel}</div>
                <div>
                  {selected.route.fromCity} → {selected.route.toCity}
                </div>
                <div>Cargo: {selected.route.cargo}</div>
                <div>Progress: {Math.round(selected.route.progress * 100)}%</div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

async function resolveCompanyId(authUserId: string): Promise<string | null> {
  if (!authUserId) return null

  const byAuth = await supabase.from('users').select('company_id').eq('auth_user_id', authUserId).limit(1).maybeSingle()
  if (!byAuth.error && byAuth.data?.company_id) return String(byAuth.data.company_id)

  const byId = await supabase.from('users').select('company_id').eq('id', authUserId).limit(1).maybeSingle()
  if (!byId.error && byId.data?.company_id) return String(byId.data.company_id)

  return null
}

async function fetchHubs(companyId: string) {
  const select = 'id,city,country,city_id'
  const filterCols = ['owner_id', 'company_id', 'carrier_company_id']
  let lastErr: any = null

  for (const col of filterCols) {
    // try with is_main ordering, then without
    const first = await supabase.from('hubs').select(select).eq(col, companyId).order('is_main', { ascending: false }).limit(100)
    if (!first.error) return Array.isArray(first.data) ? first.data : []
    if (!isSchemaLikeError(first.error)) throw first.error
    lastErr = first.error

    const second = await supabase.from('hubs').select(select).eq(col, companyId).limit(100)
    if (!second.error) return Array.isArray(second.data) ? second.data : []
    if (!isSchemaLikeError(second.error)) throw second.error
    lastErr = second.error
  }

  if (lastErr) {
    // if table exists but columns differ, throw so you see it (instead of empty)
    throw lastErr
  }
  return []
}

async function fetchAssignments(companyId: string) {
  // simplest + most robust select (no deep nesting)
  const selectVariants = [
    // Variant A: join job_offer via FK (fast if relation exists)
    'id,status,user_truck_id,updated_at,job_offer:job_offer_id(id,distance_km,origin_city_id,destination_city_id)',
    // Variant B: no join (fallback)
    'id,status,user_truck_id,updated_at,job_offer_id',
    // Variant C: even more minimal
    'id,status,updated_at,job_offer_id',
  ]

  const filterCols = ['carrier_company_id', 'company_id', 'owner_id', 'carrier_id']
  const orderCols = ['accepted_at', 'updated_at', 'created_at', 'id']

  let lastErr: any = null

  for (const sel of selectVariants) {
    for (const fcol of filterCols) {
      for (const ocol of orderCols) {
        const q = supabase.from('job_assignments').select(sel).eq(fcol, companyId).order(ocol, { ascending: false }).limit(250)
        const { data, error } = await q
        if (!error) return { rows: Array.isArray(data) ? data : [], selectUsed: sel }
        if (!isSchemaLikeError(error)) throw error
        lastErr = error
      }
    }
  }

  throw lastErr ?? new Error('Failed to load job_assignments (schema mismatch).')
}

async function fetchJobOffersByIds(ids: string[]) {
  if (!ids.length) return { byId: {} as Record<string, any> }

  // Try likely table names (your schema may differ)
  const tableCandidates = ['job_offer', 'job_offers']
  const select = 'id,distance_km,origin_city_id,destination_city_id'

  let lastErr: any = null
  for (const t of tableCandidates) {
    const res = await supabase.from(t).select(select).in('id', ids)
    if (!res.error) {
      const byId: Record<string, any> = {}
      for (const r of Array.isArray(res.data) ? res.data : []) byId[String((r as any).id)] = r
      return { byId }
    }
    if (!isSchemaLikeError(res.error) && String(res.error?.code ?? '') !== '42P01') {
      throw res.error
    }
    lastErr = res.error
  }

  // If offers can't be loaded, return empty mapping
  // (Routes won't be drawable without origin/destination ids)
  return { byId: {} as Record<string, any> }
}

async function loadFleetMapData(authUserId: string): Promise<FleetMapData> {
  const companyId = await resolveCompanyId(authUserId)
  if (!companyId) return { hubs: [], routes: [], companyId: null }

  // IMPORTANT: don’t silently swallow schema errors — surface them
  const [hubRows, assignmentResult] = await Promise.all([fetchHubs(companyId), fetchAssignments(companyId)])
  const assignmentRows = assignmentResult.rows

  // If we didn’t get joined offers, load them separately
  const needsOffers = assignmentResult.selectUsed.includes('job_offer_id') && !assignmentResult.selectUsed.includes('job_offer:job_offer_id')
  let offersById: Record<string, any> = {}

  if (needsOffers) {
    const offerIds = assignmentRows.map((r: any) => r?.job_offer_id).filter(Boolean).map(String)
    const uniq = Array.from(new Set(offerIds))
    const offers = await fetchJobOffersByIds(uniq)
    offersById = offers.byId
  }

  // Collect city ids
  const cityIds = new Set<string>()

  for (const hub of Array.isArray(hubRows) ? hubRows : []) {
    if ((hub as any)?.city_id) cityIds.add(String((hub as any).city_id))
  }

  for (const row of assignmentRows) {
    const offer = (row as any)?.job_offer ?? offersById[String((row as any)?.job_offer_id ?? '')] ?? null
    if (offer?.origin_city_id) cityIds.add(String(offer.origin_city_id))
    if (offer?.destination_city_id) cityIds.add(String(offer.destination_city_id))
  }

  const assignmentIds = assignmentRows.map((r: any) => r.id).filter(Boolean)
  const truckIds = Array.from(new Set(assignmentRows.map((r: any) => r.user_truck_id).filter(Boolean).map(String)))

  // Cities
  const { data: cityRows, error: cityErr } = cityIds.size
    ? await supabase.from('cities').select('id,city_name,country_code,lat,lon').in('id', Array.from(cityIds))
    : ({ data: [] as any[], error: null } as any)
  if (cityErr) throw cityErr

  const cityById: Record<string, any> = {}
  for (const city of Array.isArray(cityRows) ? cityRows : []) {
    const id = String((city as any)?.id ?? '')
    if (!id) continue
    cityById[id] = city
  }

  // Sessions (best-effort; don’t fail whole map if schema differs)
  let sessionRows: any[] = []
  if (assignmentIds.length) {
    const try1 = await supabase
      .from('driving_sessions')
      .select('job_assignment_id,phase,distance_completed_km,total_distance_km,segment_completed_km,segment_distance_km,updated_at')
      .in('job_assignment_id', assignmentIds)
      .order('updated_at', { ascending: false })

    if (!try1.error) {
      sessionRows = Array.isArray(try1.data) ? try1.data : []
    } else if (isSchemaLikeError(try1.error)) {
      const try2 = await supabase
        .from('driving_sessions')
        .select('job_assignment_id,phase,updated_at')
        .in('job_assignment_id', assignmentIds)
        .order('updated_at', { ascending: false })

      if (!try2.error) sessionRows = Array.isArray(try2.data) ? try2.data : []
    } else {
      throw try1.error
    }
  }

  const latestSessionByAssignment: Record<string, any> = {}
  for (const row of Array.isArray(sessionRows) ? sessionRows : []) {
    const key = String((row as any)?.job_assignment_id ?? '')
    if (!key || latestSessionByAssignment[key]) continue
    latestSessionByAssignment[key] = row
  }

  // Trucks (best-effort)
  let truckRows: any[] = []
  if (truckIds.length) {
    const res = await supabase.from('user_trucks').select('id,registration,name').in('id', truckIds)
    if (res.error) throw res.error
    truckRows = Array.isArray(res.data) ? res.data : []
  }

  const truckLabelById: Record<string, string> = {}
  for (const truck of Array.isArray(truckRows) ? truckRows : []) {
    const id = String((truck as any).id)
    truckLabelById[id] = (truck as any)?.registration ?? (truck as any)?.name ?? `Truck ${id.slice(0, 8)}`
  }

  // Build hubs
  const hubs: HubMarker[] = (hubRows ?? [])
    .map((hub: any) => {
      const cityId = String(hub?.city_id ?? '')
      const city = cityById[cityId]
      const lat = Number(city?.lat)
      const lon = Number(city?.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

      return {
        id: String(hub.id),
        city: String(city?.city_name ?? hub?.city ?? 'Hub'),
        country: city?.country_code ?? hub?.country ?? null,
        point: { lat, lon },
      } as HubMarker
    })
    .filter(Boolean) as HubMarker[]

  // Build routes
  const routes: TruckRoute[] = assignmentRows
    .map((row: any) => {
      const offer = row?.job_offer ?? offersById[String(row?.job_offer_id ?? '')] ?? null
      if (!offer) return null

      const session = latestSessionByAssignment[String(row.id)]

      const fromCityId = String(offer?.origin_city_id ?? '')
      const toCityId = String(offer?.destination_city_id ?? '')
      const fromCityRow = cityById[fromCityId]
      const toCityRow = cityById[toCityId]

      const fromLat = Number(fromCityRow?.lat)
      const fromLon = Number(fromCityRow?.lon)
      const toLat = Number(toCityRow?.lat)
      const toLon = Number(toCityRow?.lon)

      if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) {
        return null
      }

      const activeBySession = isActiveSessionPhase(session?.phase)
      const activeByStatus = isActiveAssignmentStatus(row?.status)
      if (!activeBySession && !activeByStatus) return null

      const distanceCompleted = Number(session?.distance_completed_km ?? session?.segment_completed_km ?? 0) || 0
      const totalDistance = Number(session?.total_distance_km ?? session?.segment_distance_km ?? offer?.distance_km ?? 0) || 0
      const progress = totalDistance > 0 ? clamp(distanceCompleted / totalDistance, 0, 1) : 0

      const truckId = row?.user_truck_id ? String(row.user_truck_id) : null
      const cargo = 'Assignment'

      return {
        assignmentId: String(row.id),
        truckId,
        truckLabel: truckId ? truckLabelById[truckId] ?? `Truck ${truckId.slice(0, 8)}` : 'Truck not assigned',
        fromCity: String(fromCityRow?.city_name ?? 'Origin'),
        toCity: String(toCityRow?.city_name ?? 'Destination'),
        cargo,
        from: { lat: fromLat, lon: fromLon },
        to: { lat: toLat, lon: toLon },
        progress,
        updatedAt: session?.updated_at ?? row?.updated_at ?? null,
      } as TruckRoute
    })
    .filter(Boolean) as TruckRoute[]

  return { hubs, routes, companyId }
}

export default function MapPage() {
  const { user } = useAuth()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<FleetMapData>({ hubs: [], routes: [], companyId: null })
  const [lastRefreshAt, setLastRefreshAt] = React.useState<Date | null>(null)
  const [focus, setFocus] = React.useState<MapFocus>(null)

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
      // IMPORTANT: show the real error so you can fix schema mismatches quickly
      const msg = e?.message ?? 'Failed to load map data'
      const code = e?.code ? ` (code ${String(e.code)})` : ''
      setError(`${msg}${code}`)
      setData((prev) => ({ ...prev, hubs: [], routes: [] }))
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  React.useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), MAP_POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const activeTrucks = React.useMemo(() => {
    const seen = new Set<string>()
    const items: TruckRoute[] = []
    for (const r of data.routes) {
      const key = r.truckId ? `id:${r.truckId}` : `label:${r.truckLabel}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push(r)
    }
    return items
  }, [data.routes])

  return (
    <Layout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Map</h1>
          <p className="text-sm text-black/70">Live positions of your fleet</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div>
            {loading && data.routes.length === 0 && data.hubs.length === 0 ? (
              <div className="mb-2 text-sm text-black/65">Loading map data…</div>
            ) : null}

            <FleetInteractiveMap data={data} loading={loading} error={error} focus={focus} />
          </div>

          <aside className="space-y-4">
            <div className="bg-white p-4 rounded shadow border border-black/10">
              <h2 className="font-semibold mb-2">Active Trucks</h2>

              {loading ? <div className="text-sm text-black/65">Loading…</div> : null}
              {error ? <div className="text-sm text-rose-600">{error}</div> : null}

              {!loading && !error && activeTrucks.length === 0 ? (
                <div className="text-sm text-black/65">No active trucks found.</div>
              ) : null}

              <ul className="space-y-2 text-sm">
                {activeTrucks.map((route) => {
                  const progress = Math.round(route.progress * 100)
                  return (
                    <li key={`truck-${route.assignmentId}`} className="rounded border border-black/10 p-2">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setFocus({ kind: 'route', route })}
                        title="Focus on map"
                      >
                        <div className="font-medium">{route.truckLabel}</div>
                        <div className="text-black/70">
                          {route.fromCity} → {route.toCity}
                        </div>
                        <div className="text-black/70">Progress: {progress}%</div>
                      </button>
                    </li>
                  )
                })}
              </ul>

              <div className="mt-3 text-xs text-black/55">
                Last refresh: {lastRefreshAt ? lastRefreshAt.toLocaleTimeString() : '—'}
              </div>
            </div>

            <div className="bg-white p-4 rounded shadow border border-black/10">
              <h2 className="font-semibold mb-2">Active Assignments</h2>

              {!loading && !error && data.routes.length === 0 ? (
                <div className="text-sm text-black/65">No active assignments with route coordinates found.</div>
              ) : null}

              <ul className="space-y-2 text-sm">
                {data.routes.map((route) => {
                  const progress = Math.round(route.progress * 100)
                  return (
                    <li key={`as-${route.assignmentId}`} className="rounded border border-black/10 p-2">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setFocus({ kind: 'route', route })}
                        title="Focus on map"
                      >
                        <div className="font-medium">{route.fromCity} → {route.toCity}</div>
                        <div className="text-black/70">{route.truckLabel}</div>
                        <div className="text-black/70">Progress: {progress}%</div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="bg-white p-4 rounded shadow border border-black/10">
              <h2 className="font-semibold mb-2">Hubs</h2>

              {!loading && !error && data.hubs.length === 0 ? (
                <div className="text-sm text-black/65">No hubs with coordinates found.</div>
              ) : null}

              <ul className="space-y-2 text-sm">
                {data.hubs.map((hub) => (
                  <li key={`hub-${hub.id}`} className="rounded border border-black/10 p-2">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setFocus({ kind: 'hub', hub })}
                      title="Focus on map"
                    >
                      <div className="font-medium">{hub.city}</div>
                      {hub.country ? <div className="text-black/70">{hub.country}</div> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </Layout>
  )
}