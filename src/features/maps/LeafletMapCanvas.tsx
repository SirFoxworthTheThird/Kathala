import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, ImageOverlay, Marker, Popup, Polyline, Polygon, CircleMarker, Tooltip, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { MapLayer, LocationMarker, Character, MapRoute, MapRegion, MapRegionStatus } from '@/types'
import { updateLocationMarker } from '@/db/hooks/useLocationMarkers'
import { useAppStore } from '@/store'
import { type GhostPin, makeGhostIcon } from '@/lib/ghostMarkerIcon'

export type { GhostPin }

// CSS-variable shortcuts used inside DivIcon HTML strings.
// These resolve against the document root, so they automatically follow the active theme.
const V = {
  bg:     'hsl(var(--leaflet-card))',
  border: 'hsl(var(--ring))',          // accent ring — changes per theme
  frame:  'hsl(var(--leaflet-border))',// subtle structural border
  fg:     'hsl(var(--leaflet-fg))',    // primary text
  muted:  'hsl(var(--leaflet-muted))', // secondary / subtext
  font:   'var(--font-body)',          // theme font (sans / serif / mono)
} as const

function escapeHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Location marker: pill badge  [◇ | Name · type] ───────────────────────────
const TYPE_COLORS: Record<string, string> = {
  city: '#60a5fa', town: '#34d399', dungeon: '#f87171',
  landmark: '#fbbf24', building: '#a78bfa', region: '#fb923c', custom: '#94a3b8',
}
const STATUS_COLORS: Record<string, string> = {
  active:    '',          // falls back to type color
  occupied:  '#fb923c',
  sieged:    '#ef4444',
  abandoned: '#94a3b8',
  ruined:    '#d97706',
  destroyed: '#dc2626',
  unknown:   '#a78bfa',
}

function makeLocationIcon(
  iconType: string,
  isLinked: boolean,
  name: string | undefined,
  highlighted = false,
  status = 'active',
  showLabel = true,
) {
  const typeColor   = TYPE_COLORS[iconType] ?? '#94a3b8'
  const statusColor = STATUS_COLORS[status] || typeColor
  const color       = statusColor

  const glowFilter = highlighted
    ? `drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 6px ${color})`
    : status !== 'active'
      ? `drop-shadow(0 4px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 4px ${color}88)`
      : 'drop-shadow(0 4px 8px rgba(0,0,0,0.9))'

  // ── Dot-only mode (labels hidden) ──────────────────────────────────────────
  if (!showLabel) {
    const r = 7
    const innerBg = isLinked
      ? `radial-gradient(circle at center,#fff 20%,${color} 55%)`
      : color
    const dot = `<div style="width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${innerBg};border:1.5px solid ${V.frame};"></div>`
    const html = `<div style="display:inline-block;filter:${glowFilter};">${dot}</div>`
    return L.divIcon({
      html, className: '',
      iconSize:    [r * 2, r * 2],
      iconAnchor:  [r, r],
      popupAnchor: [0, -r],
    })
  }

  // ── Full pill mode ─────────────────────────────────────────────────────────
  const safeName = name ?? ''
  const pillH  = 32
  const iconW  = 28
  const side   = 10
  const labelW = Math.max(88, safeName.length * 8 + 16)

  const innerBg = isLinked
    ? `radial-gradient(circle at center,#fff 20%,${color} 55%)`
    : color

  const statusBadge = status !== 'active'
    ? `<span style="margin-left:4px;padding:0 4px;border-radius:2px;background:${color}22;border:1px solid ${color}88;color:${color};font-size:8px;font-family:${V.font};font-weight:600;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">${escapeHtml(status)}</span>`
    : ''

  const diamond  = `<div style="width:${side}px;height:${side}px;background:${innerBg};border:1.5px solid ${V.frame};transform:rotate(45deg);flex-shrink:0;"></div>`
  const iconArea = `<div style="width:${iconW}px;height:${pillH}px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${diamond}</div>`
  const divider  = `<div style="width:1px;height:${Math.round(pillH * 0.65)}px;align-self:center;background:${V.frame};opacity:0.6;flex-shrink:0;"></div>`
  const label    = `<div style="display:flex;flex-direction:column;justify-content:center;padding:0 8px;min-width:${labelW}px;height:${pillH}px;overflow:hidden;">
    <div style="color:${V.fg};font-size:11px;font-family:${V.font};line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(safeName)}</div>
    <div style="display:flex;align-items:center;gap:0;font-size:9px;font-family:${V.font};line-height:1.3;white-space:nowrap;">
      <span style="color:${V.muted};text-transform:capitalize;">${escapeHtml(iconType)}</span>${statusBadge}
    </div>
  </div>`

  const borderColor = status !== 'active' ? color : V.border
  const pill = `<div style="display:inline-flex;align-items:stretch;border:1px solid ${borderColor};border-radius:4px;background:${V.bg};overflow:hidden;">${iconArea}${divider}${label}</div>`
  const html = `<div style="display:inline-block;filter:${glowFilter};">${pill}</div>`

  const totalW = iconW + 1 + labelW + 2
  const totalH = pillH + 2

  return L.divIcon({
    html, className: '',
    iconSize:    [totalW, totalH],
    iconAnchor:  [1 + Math.round(iconW / 2), Math.round(totalH / 2)],
    popupAnchor: [totalW / 2 - Math.round(iconW / 2), -Math.round(totalH / 2)],
  })
}

// ── Character marker: pill badge  [○portrait | Name · sub] ───────────────────
export interface CharacterPin {
  character: Character
  x: number
  y: number
  inSubMap: boolean
  portraitUrl?: string | null
  locationName?: string | null
}

function makeCharacterGroupIcon(pins: CharacterPin[], zoom: number): L.DivIcon {
  const size  = Math.max(20, Math.min(80, Math.round(36 * Math.pow(2, zoom))))
  const first = pins[0]
  const n     = pins.length
  const extra = n - 1

  const fontSize = Math.round(size * 0.36)
  const opacity  = first.inSubMap ? '0.65' : '1'

  const avatarContent = first.portraitUrl
    ? `<img src="${escapeHtml(first.portraitUrl)}" style="width:100%;height:100%;object-fit:cover;display:block;">`
    : `<span style="color:${V.border};font-size:${fontSize}px;font-weight:bold;font-family:${V.font};line-height:1;user-select:none;">${escapeHtml(first.character.name.slice(0, 2).toUpperCase())}</span>`

  const avatarInner = `<div style="width:${size}px;height:${size}px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:${V.bg};opacity:${opacity};flex-shrink:0;">${avatarContent}</div>`

  // "+N" overflow badge
  const bs    = Math.round(size * 0.38)
  const badge = extra > 0
    ? `<div style="position:absolute;right:-${Math.round(bs * 0.2)}px;bottom:-${Math.round(bs * 0.2)}px;width:${bs}px;height:${bs}px;border-radius:50%;background:${V.border};border:1px solid ${V.fg};display:flex;align-items:center;justify-content:center;font-size:${Math.max(7, Math.round(bs * 0.55))}px;font-weight:bold;font-family:${V.font};color:${V.bg};z-index:10;">+${extra}</div>`
    : ''

  const avatarWrap = `<div style="position:relative;flex-shrink:0;width:${size}px;height:${size}px;">${avatarInner}${badge}</div>`

  const divider = `<div style="width:1px;height:${Math.round(size * 0.65)}px;align-self:center;background:${V.frame};opacity:0.6;flex-shrink:0;"></div>`

  const labelText = n === 1 ? escapeHtml(first.character.name) : `${n} characters`
  const subText   = n === 1
    ? first.inSubMap
      ? `${first.locationName ? escapeHtml(first.locationName) + ' · ' : ''}Sub-map`
      : (first.locationName ? escapeHtml(first.locationName) : '')
    : ''
  const fsPrimary = Math.max(10, Math.round(size * 0.3))
  const fsSub     = Math.max(8,  Math.round(size * 0.24))
  const labelW    = 110

  const labelBox = `<div style="display:flex;flex-direction:column;justify-content:center;padding:0 8px;min-width:${labelW}px;height:${size}px;overflow:hidden;">
    <div style="color:${V.fg};font-size:${fsPrimary}px;font-family:${V.font};line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${labelText}</div>
    ${subText ? `<div style="color:${V.muted};font-size:${fsSub}px;font-family:${V.font};line-height:1.3;white-space:nowrap;">${subText}</div>` : ''}
  </div>`

  // Left border-radius matches avatar circle curvature so the pill "is" the avatar on the left
  const r    = Math.round(size / 2) + 1
  const pill = `<div style="display:inline-flex;align-items:stretch;border:1px solid ${V.border};border-radius:${r}px 4px 4px ${r}px;background:${V.bg};overflow:hidden;">${avatarWrap}${divider}${labelBox}</div>`
  const html = `<div style="display:inline-block;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.9));">${pill}</div>`

  const totalW = size + 1 + labelW + 2
  const totalH = size + 2

  return L.divIcon({
    html, className: '',
    iconSize:    [totalW, totalH],
    iconAnchor:  [1 + Math.round(size / 2), Math.round(totalH / 2)],
    popupAnchor: [totalW / 2 - Math.round(size / 2), -Math.round(totalH / 2)],
  })
}

// ── Inner map-event components ────────────────────────────────────────────────

/** Detects when the Leaflet map context is ready (react-leaflet creates it
 *  asynchronously via setContext) and notifies the parent via callback. */
function MapInstanceTracker({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => { onReady(map) }, [map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function ClickHandler({ onMapClickRef }: { onMapClickRef: React.RefObject<(latlng: L.LatLng) => void> }) {
  useMapEvents({ click: (e) => onMapClickRef.current?.(e.latlng) })
  return null
}

interface ContextMenuState { screenX: number; screenY: number; mapX: number; mapY: number }

function ContextMenuHandler({ onContextMenu }: { onContextMenu: (s: ContextMenuState) => void }) {
  useMapEvents({
    contextmenu: (e) => {
      L.DomEvent.preventDefault(e.originalEvent)
      onContextMenu({ screenX: e.containerPoint.x, screenY: e.containerPoint.y, mapX: e.latlng.lng, mapY: e.latlng.lat })
    },
  })
  return null
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoomChange(map.getZoom()) })
  useEffect(() => { onZoomChange(map.getZoom()) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function FitBounds({ bounds, initialCenter }: { bounds: L.LatLngBoundsExpression; initialCenter?: [number, number] | null }) {
  const map = useMapEvents({})
  useEffect(() => {
    // Defer to a macro-task so react-leaflet's ResizeObserver callback (which fires
    // asynchronously and calls invalidateSize) runs first. Without this, the observer
    // fires after our effect and resets the map's center back to [0,0].
    const center = initialCenter // capture before async gap
    const id = setTimeout(() => {
      map.invalidateSize()
      const prevSnap = map.options.zoomSnap
      map.options.zoomSnap = 0
      map.fitBounds(bounds, { padding: [0, 0], animate: false })
      const minZoom = map.getBoundsZoom(bounds, false)
      map.setMinZoom(minZoom)
      map.setMaxBounds(bounds)
      map.options.zoomSnap = prevSnap ?? 0.25
      if (center && typeof center[0] === 'number' && typeof center[1] === 'number') {
        map.panTo(center, { animate: false })
      }
    }, 0)
    return () => clearTimeout(id)
  }, [map, bounds]) // eslint-disable-line react-hooks/exhaustive-deps — initialCenter intentionally read only at mount
  return null
}

// ── Public types ──────────────────────────────────────────────────────────────
export interface PinAnimation {
  key: number
  from: Record<string, { x: number; y: number }>
  to: Record<string, { x: number; y: number }>
  /** Full pixel-coord paths per character (includes from and to). When present, marker follows path instead of linear interpolation. */
  waypoints?: Record<string, Array<{ x: number; y: number }>>
  duration: number
  /** Character IDs with no known from-position: fade in at their destination instead of popping */
  fadeIn?: string[]
  /** When true, the map camera pans to follow the animated character each frame */
  cameraFollow?: boolean
}

// ── Path interpolation helper ─────────────────────────────────────────────────

function interpolateAlongPath(
  path: Array<{ x: number; y: number }>,
  t: number,
): { x: number; y: number } {
  if (path.length === 0) return { x: 0, y: 0 }
  if (path.length === 1 || t <= 0) return path[0]
  if (t >= 1) return path[path.length - 1]

  let totalLen = 0
  const segLens: number[] = []
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
    segLens.push(d)
    totalLen += d
  }
  if (totalLen === 0) return path[0]

  const target = t * totalLen
  let accumulated = 0
  for (let i = 0; i < segLens.length; i++) {
    if (accumulated + segLens[i] >= target) {
      const segT = segLens[i] === 0 ? 0 : (target - accumulated) / segLens[i]
      return {
        x: path[i].x + (path[i + 1].x - path[i].x) * segT,
        y: path[i].y + (path[i + 1].y - path[i].y) * segT,
      }
    }
    accumulated += segLens[i]
  }
  return path[path.length - 1]
}

export interface MovementLine {
  /** Unique key for React rendering; falls back to `characterId-style` if omitted */
  id?: string
  characterId: string
  color: string
  points: [number, number][]
  distanceLabel?: string
  /** 'waypoint' = in-chapter path (dashed), 'travel' = inter-chapter travel (solid) */
  style?: 'waypoint' | 'travel'
}

export interface ScaleCalibrationPoint { x: number; y: number }

export interface MeasureLine {
  p1: ScaleCalibrationPoint
  p2: ScaleCalibrationPoint
  label: string
}

export interface EchoMarker {
  markerId: string
  x: number
  y: number
  counterpartTimelineName: string
  eventCount: number
}

/** Full-journey polyline for a single character across all chapters */
export interface JourneyLine {
  characterId: string
  color: string
  points: [number, number][]
}

interface LeafletMapCanvasProps {
  layer: MapLayer
  imageUrl: string
  markers: LocationMarker[]
  charPins: CharacterPin[]
  movementLines: MovementLine[]
  isDraggingCharacter: boolean
  onMarkerClick: (markerId: string) => void
  onMapClick: (x: number, y: number) => void
  onDrillDown: (mapLayerId: string) => void
  onCharacterDrop: (characterId: string, markerId: string) => void
  onCharacterDropOnEmpty?: (characterId: string, x: number, y: number) => void
  onCharacterClick?: (characterId: string) => void
  pinAnimation?: PinAnimation | null
  onAnimationEnd?: () => void
  mapRef?: React.RefObject<L.Map | null>
  scaleMode?: boolean
  onScalePoints?: (p1: ScaleCalibrationPoint, p2: ScaleCalibrationPoint) => void
  showSubMapLinks?: boolean
  locationStatuses?: Record<string, string>
  /** When set, pan to this [y, x] position after FitBounds on mount (used for cross-layer character focus) */
  initialCenter?: [number, number] | null
  /** When set, draws a measurement line between two points with a distance label */
  measureLine?: MeasureLine | null
  /** Ghost pins — outer-timeline characters shown as a dimmed overlay when the inner depth track is active */
  ghostPins?: GhostPin[]
  /** Echo rings — amber dashed circles marking locations that exist in a historical-echo counterpart timeline */
  echoMarkers?: EchoMarker[]
  /** Called when the user clicks an echo ring */
  onEchoRingClick?: (markerId: string) => void
  /** When false, location markers render as dots instead of full pill labels */
  showLocationLabels?: boolean
  /** Full-journey polylines — one per character, spanning all chapters */
  journeyLines?: JourneyLine[]
  /** Persistent route polylines (roads, rivers, etc.) — always visible */
  mapRoutes?: MapRoute[]
  /** Route marker positions: markerId → [lat, lng] */
  routeMarkerPositions?: Map<string, [number, number]>
  /** Region polygons with optional per-event fill tint */
  mapRegions?: MapRegion[]
  /** regionId → status at the active event */
  regionStatuses?: Map<string, MapRegionStatus>
  /** In-progress region draw vertices — shown as a preview polygon */
  drawRegionVertices?: Array<{ x: number; y: number }>
  /** When true, every canvas click calls onMapClick directly (no addMode gate) */
  directMapClick?: boolean
  /** In-progress route draw points — shown as a preview polyline */
  drawRoutePoints?: [number, number][]
  /** Called when the user clicks a persistent route polyline */
  onRouteClick?: (routeId: string) => void
  /** Called when the user clicks a persistent region polygon */
  onRegionClick?: (regionId: string) => void
  /** ID of the currently selected route (highlighted on canvas) */
  selectedRouteId?: string | null
  /** ID of the currently selected region (highlighted on canvas) */
  selectedRegionId?: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────
export function LeafletMapCanvas({
  layer, imageUrl, markers, charPins, movementLines,
  isDraggingCharacter, onMarkerClick, onMapClick, onDrillDown,
  onCharacterDrop, onCharacterDropOnEmpty, onCharacterClick, mapRef: externalMapRef,
  scaleMode, onScalePoints, showSubMapLinks = true, locationStatuses = {},
  pinAnimation, onAnimationEnd, initialCenter, measureLine, ghostPins,
  echoMarkers, onEchoRingClick, showLocationLabels = true, journeyLines = [],
  mapRoutes = [], routeMarkerPositions, mapRegions = [], regionStatuses, drawRegionVertices,
  directMapClick = false, drawRoutePoints,
  onRouteClick, onRegionClick, selectedRouteId, selectedRegionId,
}: LeafletMapCanvasProps) {
  const { setIsAnimating } = useAppStore()
  const internalMapRef = useRef<L.Map | null>(null)
  const mapRef         = externalMapRef ?? internalMapRef
  // Imperative character marker management — bypasses react-leaflet's position-prop mechanism
  const charMarkersRef  = useRef<Map<string, L.Marker>>(new Map()) // per-char, during animation
  const groupMarkersRef = useRef<Map<string, L.Marker>>(new Map()) // per-pos-group, when idle
  const ghostMarkersRef = useRef<Map<string, L.Marker>>(new Map())        // ghost pins — never animated
  const echoMarkersRef  = useRef<Map<string, L.CircleMarker>>(new Map()) // echo rings — historical echo
  const animFrameRef    = useRef<number | null>(null)
  const runningAnimKeyRef = useRef<number | null>(null) // guard: skip re-init for same animation key
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null)
  const [mapZoom, setMapZoom]         = useState(0)
  const charPinsRef     = useRef(charPins)   // always-fresh snapshot for RAF callbacks
  const mapZoomRef      = useRef(mapZoom)
  const [addMode, setAddMode]         = useState(false)
  const addModeRef                    = useRef(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [scalePoint1, setScalePoint1] = useState<ScaleCalibrationPoint | null>(null)
  const onMapClickRef      = useRef<(latlng: L.LatLng) => void>(() => {})
  const onMarkerClickRef   = useRef(onMarkerClick)
  const onCharacterDropRef = useRef(onCharacterDrop)
  const markersRef         = useRef(markers)

  const onCharacterDropOnEmptyRef = useRef(onCharacterDropOnEmpty)
  const onCharacterClickRef       = useRef(onCharacterClick)
  onMarkerClickRef.current          = onMarkerClick
  onCharacterDropRef.current        = onCharacterDrop
  onCharacterDropOnEmptyRef.current = onCharacterDropOnEmpty
  onCharacterClickRef.current       = onCharacterClick
  charPinsRef.current               = charPins
  mapZoomRef.current                = mapZoom
  markersRef.current                = markers

  const w      = layer.imageWidth
  const h      = layer.imageHeight
  const bounds = useMemo<L.LatLngBoundsExpression>(() => [[0, 0], [h, w]], [h, w])

  onMapClickRef.current = (latlng: L.LatLng) => {
    if (scaleMode) {
      const pt = { x: latlng.lng, y: latlng.lat }
      if (!scalePoint1) {
        setScalePoint1(pt)
      } else {
        onScalePoints?.(scalePoint1, pt)
        setScalePoint1(null)
      }
      return
    }
    if (directMapClick) {
      onMapClick(latlng.lng, latlng.lat)
      return
    }
    if (!addModeRef.current) return
    onMapClick(latlng.lng, latlng.lat)
    addModeRef.current = false
    setAddMode(false)
  }

  useEffect(() => {
    const handler = () => { addModeRef.current = true; setAddMode(true) }
    window.addEventListener('wb:map:startAddMarker', handler)
    return () => window.removeEventListener('wb:map:startAddMarker', handler)
  }, [])

  useEffect(() => {
    if (!scaleMode) setScalePoint1(null)
  }, [scaleMode])

  // ── Imperative character marker helpers ──────────────────────────────────────

  // (Re)build group markers from scratch. Called when not animating or when an
  // animation finishes. Always removes all existing group markers first so each
  // call produces a fully up-to-date set with the correct icons and drag state.
  function buildGroupMarkers(map: L.Map, pins: CharacterPin[], zoom: number) {
    for (const [, m] of groupMarkersRef.current) m.remove()
    groupMarkersRef.current.clear()

    const groups = new Map<string, CharacterPin[]>()
    for (const pin of pins) {
      if (typeof pin.x !== 'number' || typeof pin.y !== 'number') continue
      const key = `${Math.round(pin.x)},${Math.round(pin.y)}`
      const g = groups.get(key) ?? []
      g.push(pin)
      groups.set(key, g)
    }

    for (const [key, group] of groups) {
      const first = group[0]
      const isSingle = group.length === 1
      const marker = L.marker([first.y, first.x], {
        icon: makeCharacterGroupIcon(group, zoom),
        zIndexOffset: 1000,
        draggable: isSingle && !first.inSubMap,
      }).addTo(map)

      if (isSingle) {
        marker.on('click', () => onCharacterClickRef.current?.(first.character.id))
        marker.on('dragend', (e) => {
          const lm = e.target as L.Marker
          const latlng = lm.getLatLng()
          const m2 = mapRef.current
          if (!m2) { lm.setLatLng([first.y, first.x]); return }
          const dropPt = m2.latLngToContainerPoint(latlng)
          let nearest: LocationMarker | null = null
          let minDist = Infinity
          for (const loc of markersRef.current) {
            const pt = m2.latLngToContainerPoint([loc.y, loc.x])
            const dist = Math.hypot(dropPt.x - pt.x, dropPt.y - pt.y)
            if (dist < minDist) { minDist = dist; nearest = loc }
          }
          if (nearest && minDist < 60) {
            onCharacterDropRef.current(first.character.id, nearest.id)
            lm.setLatLng([nearest.y, nearest.x])
          } else {
            lm.setLatLng([first.y, first.x])
            onCharacterDropOnEmptyRef.current?.(first.character.id, latlng.lng, latlng.lat)
          }
        })
      } else {
        const content = document.createElement('div')
        content.style.minWidth = '110px'
        const title = document.createElement('p')
        title.style.cssText = `font-size:11px;font-weight:bold;margin-bottom:4px;color:hsl(var(--ring));font-family:var(--font-body);`
        title.textContent = 'At this location:'
        content.appendChild(title)
        for (const pin of group) {
          const btn = document.createElement('button')
          btn.style.cssText = `display:block;width:100%;text-align:left;padding:2px 4px;font-size:12px;cursor:pointer;border-radius:3px;background:none;border:none;font-family:var(--font-body);`
          btn.textContent = pin.character.name + (pin.inSubMap ? ' (sub-map)' : '')
          btn.addEventListener('click', () => onCharacterClickRef.current?.(pin.character.id))
          btn.addEventListener('mouseenter', () => { btn.style.background = 'hsl(var(--accent))' })
          btn.addEventListener('mouseleave', () => { btn.style.background = 'none' })
          content.appendChild(btn)
        }
        marker.bindPopup(content)
      }

      groupMarkersRef.current.set(key, marker)
    }
  }

  // Main imperative marker effect — manages all character markers without JSX.
  // leafletMap is in deps so the effect re-runs once MapContainer has finished
  // its async initialisation (react-leaflet v5 creates the map via setContext).
  useEffect(() => {
    const map = leafletMap ?? mapRef.current
    if (!map) return

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

    if (pinAnimation) {
      // Guard: skip re-init if this exact animation key is already running
      if (pinAnimation.key === runningAnimKeyRef.current) return
      runningAnimKeyRef.current = pinAnimation.key

      const { from, to, duration, fadeIn, waypoints, cameraFollow } = pinAnimation

      // Switch from group markers to per-character animation markers
      for (const [, m] of groupMarkersRef.current) m.remove()
      groupMarkersRef.current.clear()

      // Remove markers for characters that are no longer on this layer
      const pinIds = new Set(charPins.map(p => p.character.id))
      for (const [id, m] of charMarkersRef.current) {
        if (!pinIds.has(id)) { m.remove(); charMarkersRef.current.delete(id) }
      }

      // Determine which character is the active mover (has a from position)
      const movingCharId = Object.keys(from)[0] ?? null

      // Create / reposition per-character markers at their FROM positions
      for (const pin of charPins) {
        const id = pin.character.id
        const fromPos = from[id] ?? to[id]
        if (!fromPos || !Number.isFinite(fromPos.x) || !Number.isFinite(fromPos.y)) continue

        const icon = makeCharacterGroupIcon([pin], mapZoomRef.current)
        let marker = charMarkersRef.current.get(id)
        if (!marker) {
          marker = L.marker([fromPos.y, fromPos.x], {
            icon, zIndexOffset: 1000, interactive: true,
          }).addTo(map)
          marker.on('click', () => onCharacterClickRef.current?.(id))
          charMarkersRef.current.set(id, marker)
        } else {
          marker.setIcon(icon)
          marker.setLatLng([fromPos.y, fromPos.x])
        }

        if (fadeIn?.includes(id)) {
          const el = marker.getElement()
          if (el) el.style.opacity = '0'
        }
      }

      // Pan camera to the moving character's start position
      if (cameraFollow && movingCharId) {
        const startPos = from[movingCharId]
        if (startPos) map.panTo([startPos.y, startPos.x], { animate: false })
      }

      setIsAnimating(true)

      // RAF loop
      const start = performance.now()
      function tick() {
        const t = Math.min((performance.now() - start) / duration, 1)
        const eased = -(Math.cos(Math.PI * t) - 1) / 2 // ease-in-out sine

        for (const [id, marker] of charMarkersRef.current) {
          const toPos = to[id]
          if (!toPos) continue

          let pos: { x: number; y: number }
          const path = waypoints?.[id]
          if (path && path.length >= 2) {
            pos = interpolateAlongPath(path, eased)
          } else {
            const fromPos = from[id] ?? toPos
            pos = {
              x: fromPos.x + (toPos.x - fromPos.x) * eased,
              y: fromPos.y + (toPos.y - fromPos.y) * eased,
            }
          }

          if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue
          marker.setLatLng([pos.y, pos.x])

          if (fadeIn?.includes(id)) {
            const el = marker.getElement()
            if (el) el.style.opacity = String(eased)
          }

          // Camera follow: pan to keep the active mover centered
          if (cameraFollow && id === movingCharId) {
            mapRef.current?.panTo([pos.y, pos.x], { animate: false })
          }
        }

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick)
        } else {
          for (const id of (fadeIn ?? [])) {
            const el = charMarkersRef.current.get(id)?.getElement()
            if (el) el.style.opacity = ''
          }
          animFrameRef.current = null
          setIsAnimating(false)
          // Animation complete — switch back to group markers
          for (const [, m] of charMarkersRef.current) m.remove()
          charMarkersRef.current.clear()
          const currentMap = mapRef.current
          if (currentMap) buildGroupMarkers(currentMap, charPinsRef.current, mapZoomRef.current)
          onAnimationEnd?.()
        }
      }

      tick()

    } else {
      // Not animating — use stable group markers
      runningAnimKeyRef.current = null
      for (const [, m] of charMarkersRef.current) m.remove()
      charMarkersRef.current.clear()
      buildGroupMarkers(map, charPins, mapZoom)
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
        runningAnimKeyRef.current = null
        setIsAnimating(false)
      }
    }
  }, [pinAnimation, charPins, leafletMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update icon sizes when zoom changes, without interrupting any running animation
  useEffect(() => {
    const zoom = mapZoom
    for (const [id, marker] of charMarkersRef.current) {
      const pin = charPinsRef.current.find(p => p.character.id === id)
      if (pin) marker.setIcon(makeCharacterGroupIcon([pin], zoom))
    }
    for (const [key, marker] of groupMarkersRef.current) {
      const [xs, ys] = key.split(',')
      const rx = parseInt(xs), ry = parseInt(ys)
      const group = charPinsRef.current.filter(p => Math.round(p.x) === rx && Math.round(p.y) === ry)
      if (group.length > 0) marker.setIcon(makeCharacterGroupIcon(group, zoom))
    }
  }, [mapZoom]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ghost marker effect — fully decoupled from the animation system.
  // Ghost pins never animate; they just snap to updated positions when outerEventId changes.
  useEffect(() => {
    const map = leafletMap ?? mapRef.current
    if (!map) return
    for (const [, m] of ghostMarkersRef.current) { try { m.remove() } catch { /* ok */ } }
    ghostMarkersRef.current.clear()
    for (const pin of ghostPins ?? []) {
      if (!Number.isFinite(pin.x) || !Number.isFinite(pin.y)) continue
      const marker = L.marker([pin.y, pin.x], {
        icon: makeGhostIcon(pin, mapZoom),
        zIndexOffset: 900, // below regular character pins (1000)
        interactive: true,
        draggable: false,
      })
      .bindTooltip(
        `${pin.name} — ${pin.outerTimelineName}${pin.outerEventTitle ? '\n' + pin.outerEventTitle : ''}`,
        { permanent: false, direction: 'top' }
      )
      .addTo(map)
      ghostMarkersRef.current.set(pin.characterId, marker)
    }
    return () => {
      for (const [, m] of ghostMarkersRef.current) { try { m.remove() } catch { /* ok */ } }
      ghostMarkersRef.current.clear()
    }
  }, [leafletMap, ghostPins, mapZoom]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Echo rings (historical echo) ──────────────────────────────────────────
  // Dashed amber circles drawn beneath location markers; always-on, not animated.
  useEffect(() => {
    const map = leafletMap ?? mapRef.current
    if (!map) return
    for (const [, c] of echoMarkersRef.current) { try { c.remove() } catch { /* ok */ } }
    echoMarkersRef.current.clear()
    for (const em of echoMarkers ?? []) {
      if (!Number.isFinite(em.x) || !Number.isFinite(em.y)) continue
      const circle = L.circleMarker([em.y, em.x], {
        radius: 18,
        fill: false,
        color: 'hsl(38 92% 50%)',
        weight: 2,
        dashArray: '5 4',
        interactive: true,
      })
        .bindTooltip(
          `${escapeHtml(em.counterpartTimelineName)} — ${em.eventCount} event${em.eventCount !== 1 ? 's' : ''}`,
          { permanent: false, direction: 'top' },
        )
        .on('click', (e) => { L.DomEvent.stopPropagation(e); onEchoRingClick?.(em.markerId) })
        .addTo(map)
      echoMarkersRef.current.set(em.markerId, circle)
    }
    return () => {
      for (const [, c] of echoMarkersRef.current) { try { c.remove() } catch { /* ok */ } }
      echoMarkersRef.current.clear()
    }
  }, [leafletMap, echoMarkers]) // eslint-disable-line react-hooks/exhaustive-deps

  // Remove all character markers when the component unmounts
  useEffect(() => {
    return () => {
      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
      charMarkersRef.current.forEach(m => { try { m.remove() } catch { /* map may be gone */ } })
      groupMarkersRef.current.forEach(m => { try { m.remove() } catch { /* map may be gone */ } })
      ghostMarkersRef.current.forEach(m => { try { m.remove() } catch { /* map may be gone */ } })
      echoMarkersRef.current.forEach(c => { try { c.remove() } catch { /* map may be gone */ } })
    }
  }, [])

  function findNearestMarker(clientX: number, clientY: number, el: HTMLElement): LocationMarker | null {
    const map = mapRef.current
    if (!map) return null
    const rect   = el.getBoundingClientRect()
    const dropPt = L.point(clientX - rect.left, clientY - rect.top)
    let nearest: LocationMarker | null = null
    let minDist = Infinity
    for (const m of markersRef.current) {
      const pt   = map.latLngToContainerPoint([m.y, m.x])
      const dist = Math.hypot(dropPt.x - pt.x, dropPt.y - pt.y)
      if (dist < minDist) { minDist = dist; nearest = m }
    }
    return minDist < 60 ? nearest : null
  }

  return (
    <div
      className="relative h-full w-full"
      onDragOver={(e) => { if (isDraggingCharacter) e.preventDefault() }}
      onDrop={(e) => {
        e.preventDefault()
        const characterId = e.dataTransfer.getData('characterId')
        if (!characterId) return
        const nearest = findNearestMarker(e.clientX, e.clientY, e.currentTarget)
        if (nearest) onCharacterDropRef.current(characterId, nearest.id)
      }}
      onClick={() => setContextMenu(null)}
    >
      {addMode && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-start justify-center pt-4">
          <div className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white shadow-lg">
            Click on the map to place the location
          </div>
        </div>
      )}
      {scaleMode && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-start justify-center pt-4">
          <div className="rounded-md bg-amber-600 px-3 py-1.5 text-xs text-white shadow-lg">
            {scalePoint1 ? 'Now click the second point' : 'Click the first point on the map'}
          </div>
        </div>
      )}
      {isDraggingCharacter && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-start justify-center pt-4">
          <div className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white shadow-lg">
            Drop on a location marker to place the character there
          </div>
        </div>
      )}

      <MapContainer
        ref={mapRef}
        crs={L.CRS.Simple}
        center={[h / 2, w / 2]}
        zoom={0}
        style={{ height: '100%', width: '100%' }}
        maxZoom={4} zoomSnap={0.25}
      >
        <MapInstanceTracker onReady={(m) => { mapRef.current = m; setLeafletMap(m) }} />
        <FitBounds bounds={bounds} initialCenter={initialCenter} />
        <ZoomTracker onZoomChange={setMapZoom} />
        <ImageOverlay url={imageUrl} bounds={bounds} />
        <ClickHandler onMapClickRef={onMapClickRef} />
        <ContextMenuHandler onContextMenu={setContextMenu} />

        {/* In-progress region draw preview */}
        {drawRegionVertices && drawRegionVertices.length >= 2 && (
          <Polygon
            positions={drawRegionVertices.map((v) => [v.y, v.x] as [number, number])}
            pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', weight: 1.5, opacity: 0.8, fillOpacity: 0.15, dashArray: '4 4' }}
          />
        )}

        {/* Region polygons */}
        {mapRegions.map((region) => {
          const verts = region.vertices.map((v) => [v.y, v.x] as [number, number])
          if (verts.length < 3) return null
          const status = regionStatuses?.get(region.id) ?? 'active'
          const isRegionSelected = selectedRegionId === region.id
          const fillOpacity = status === 'destroyed' ? 0.08 : status === 'abandoned' ? 0.12 : region.opacity * 0.45
          const color = region.fillColor
          return (
            <Polygon
              key={region.id}
              positions={verts}
              pathOptions={{
                color,
                fillColor: color,
                weight: isRegionSelected ? 2.5 : 1.5,
                opacity: isRegionSelected ? 1 : 0.7,
                fillOpacity: isRegionSelected ? Math.min(fillOpacity + 0.1, 0.7) : fillOpacity,
                dashArray: isRegionSelected ? '5 4' : undefined,
              }}
              eventHandlers={{ click: () => onRegionClick?.(region.id) }}
            >
              <Tooltip direction="center" permanent className="region-label-tooltip">
                <span style={{ fontSize: '10px', fontWeight: 600 }}>{region.name}</span>
              </Tooltip>
            </Polygon>
          )
        })}

        {/* In-progress route draw preview */}
        {drawRoutePoints && drawRoutePoints.length >= 2 && (
          <Polyline
            positions={drawRoutePoints}
            pathOptions={{ color: '#a78bfa', weight: 2, opacity: 0.8, dashArray: '6 4' }}
          />
        )}

        {/* Persistent map routes */}
        {mapRoutes.map((route) => {
          const pts = route.waypoints
            .map((wp) =>
              typeof wp === 'string'
                ? routeMarkerPositions?.get(wp)
                : [wp.y, wp.x] as [number, number]
            )
            .filter((pt): pt is [number, number] => pt != null && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))
          if (pts.length < 2) return null
          const isDashed = route.routeType === 'border' || route.routeType === 'trail'
          const isRouteSelected = selectedRouteId === route.id
          return (
            <Polyline
              key={route.id}
              positions={pts}
              pathOptions={{
                color: route.color ?? '#94a3b8',
                weight: isRouteSelected
                  ? (route.routeType === 'river' || route.routeType === 'sea_route' ? 5 : 4)
                  : (route.routeType === 'river' || route.routeType === 'sea_route' ? 3 : 2),
                opacity: isRouteSelected ? 1 : 0.75,
                dashArray: isDashed ? '4 6' : undefined,
              }}
              eventHandlers={{ click: () => onRouteClick?.(route.id) }}
            >
              <Tooltip sticky>{route.name}</Tooltip>
            </Polyline>
          )
        })}

        {/* Full journey trails (all-chapter paths) */}
        {journeyLines.map((line) =>
          line.points.length >= 2 && (
            <Polyline
              key={`journey-${line.characterId}`}
              positions={line.points}
              pathOptions={{ color: line.color, weight: 2, opacity: 0.35, dashArray: '4 6' }}
            />
          )
        )}

        {/* Movement lines */}
        {movementLines.map((line) =>
          line.points.length >= 2 && (
            <Polyline
              key={line.id ?? `${line.characterId}-${line.style ?? 'waypoint'}`}
              positions={line.points}
              pathOptions={
                line.style === 'travel'
                  ? { color: line.color, weight: 2, opacity: 0.55, dashArray: '2 8' }
                  : { color: line.color, weight: 2.5, opacity: 0.75, dashArray: '6 4' }
              }
            >
              {line.distanceLabel && (
                <Tooltip permanent direction="center" className="movement-distance-tooltip">
                  {line.distanceLabel}
                </Tooltip>
              )}
            </Polyline>
          )
        )}

        {/* Scale calibration markers */}
        {scalePoint1 && (
          <CircleMarker
            center={[scalePoint1.y, scalePoint1.x]}
            radius={6}
            pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 1, weight: 2 }}
          />
        )}

        {/* Distance measurement line */}
        {measureLine && (
          <>
            <Polyline
              positions={[[measureLine.p1.y, measureLine.p1.x], [measureLine.p2.y, measureLine.p2.x]]}
              pathOptions={{ color: '#22d3ee', weight: 2, opacity: 0.9, dashArray: '6 4' }}
            >
              <Tooltip permanent direction="center" className="movement-distance-tooltip">
                {measureLine.label}
              </Tooltip>
            </Polyline>
            <CircleMarker
              center={[measureLine.p1.y, measureLine.p1.x]}
              radius={5}
              pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 1, weight: 2 }}
            />
            <CircleMarker
              center={[measureLine.p2.y, measureLine.p2.x]}
              radius={5}
              pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 1, weight: 2 }}
            />
          </>
        )}

        {/* Location markers — guard against markers with missing coordinates (data integrity) */}
        {markers.filter((m) => typeof m.x === 'number' && typeof m.y === 'number').map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.y, marker.x]}
            icon={makeLocationIcon(marker.iconType, !!marker.linkedMapLayerId && showSubMapLinks, marker.name, isDraggingCharacter, locationStatuses[marker.id] ?? 'active', showLocationLabels)}
            zIndexOffset={isDraggingCharacter ? 2000 : -100}
            draggable
            eventHandlers={{
              click: () => onMarkerClickRef.current(marker.id),
              dragend: (e) => {
                const { lat, lng } = (e.target as L.Marker).getLatLng()
                updateLocationMarker(marker.id, { x: lng, y: lat })
              },
            }}
          >
            <Popup>
              <div className="min-w-32">
                <p className="font-semibold">{marker.name}</p>
                <p className="text-xs opacity-70 capitalize mb-1">{marker.iconType}</p>
                {marker.description && <p className="text-xs mb-2">{marker.description}</p>}
                {marker.linkedMapLayerId && (
                  <button onClick={() => onDrillDown(marker.linkedMapLayerId!)} className="text-xs text-blue-400 hover:underline">
                    Open sub-map →
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Character markers are managed imperatively by the useEffect above — no JSX here */}
      </MapContainer>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="absolute z-[2000] min-w-[140px] overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg"
          style={{ left: contextMenu.screenX, top: contextMenu.screenY }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[hsl(var(--accent))] transition-colors"
            onClick={() => { onMapClick(contextMenu.mapX, contextMenu.mapY); setContextMenu(null) }}
          >
            <span className="text-[hsl(var(--muted-foreground))]">＋</span>
            Add Location
          </button>
        </div>
      )}
    </div>
  )
}
