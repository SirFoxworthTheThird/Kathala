import { useMemo, useState, useRef, useEffect } from 'react'
import { X, ShieldCheck, ShieldAlert, AlertTriangle, Users, Package, Network, ChevronRight, EyeOff, Eye } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import { useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRelationships } from '@/db/hooks/useRelationships'
import { useItems } from '@/db/hooks/useItems'
import { useWorldSnapshots } from '@/db/hooks/useSnapshots'
import { useCrossTimelineArtifacts } from '@/db/hooks/useTimelineRelationships'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { useTravelModes } from '@/db/hooks/useTravelModes'
import { useWorldMovements } from '@/db/hooks/useMovements'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { cn } from '@/lib/utils'
import { pixelDist } from '@/lib/mapScale'
import type { CharacterSnapshot, ItemPlacement, MapRoute, MapRegion, RouteType } from '@/types'

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** Point-in-polygon test using ray casting */
function pointInPolygon(px: number, py: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

/** Check if line segment (ax,ay)→(bx,by) intersects segment (cx,cy)→(dx,dy) */
function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): boolean {
  const d1x = bx - ax, d1y = by - ay
  const d2x = dx - cx, d2y = dy - cy
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return false // parallel
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

/** Check if segment AB crosses or touches polygon (path traversal test) */
function pathCrossesPolygon(
  ax: number, ay: number, bx: number, by: number,
  polygon: Array<{ x: number; y: number }>
): boolean {
  if (polygon.length < 3) return false
  if (pointInPolygon(ax, ay, polygon) || pointInPolygon(bx, by, polygon)) return true
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (segmentsIntersect(ax, ay, bx, by, polygon[i].x, polygon[i].y, polygon[j].x, polygon[j].y)) return true
  }
  return false
}

// ── Route type speed multipliers ──────────────────────────────────────────────

const ROUTE_SPEED_MULTIPLIERS: Record<RouteType, number> = {
  road: 1.5,
  river: 1.2,
  sea_route: 1.2,
  trail: 0.6,
  border: 1.0,
  custom: 1.0,
}

// ── types ─────────────────────────────────────────────────────────────────────

type IssueSeverity = 'error' | 'warning'

interface Issue {
  id: string
  severity: IssueSeverity
  category: 'character' | 'item' | 'relationship'
  message: string
  detail?: string
  navigatePath?: string
  eventId?: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function IssueRow({
  issue,
  focused,
  suppressed,
  onNavigate,
  onSuppress,
}: {
  issue: Issue
  focused: boolean
  suppressed: boolean
  onNavigate: (issue: Issue) => void
  onSuppress: (issue: Issue) => void
}) {
  return (
    <div className={cn(
      'flex items-start gap-3 rounded border px-3 py-2.5 text-xs transition-colors',
      suppressed
        ? 'border-[hsl(var(--border))] bg-transparent opacity-40'
        : issue.severity === 'error'
          ? 'border-red-500/30 bg-red-500/10'
          : 'border-amber-500/30 bg-amber-500/10',
      focused && !suppressed && 'ring-1 ring-[hsl(var(--ring))]',
    )}>
      <AlertTriangle className={cn(
        'mt-0.5 h-3.5 w-3.5 shrink-0',
        suppressed ? 'text-[hsl(var(--muted-foreground))]' : issue.severity === 'error' ? 'text-red-400' : 'text-amber-400'
      )} />
      <div className="min-w-0 flex-1">
        <p className={cn(
          'font-medium',
          suppressed ? 'text-[hsl(var(--muted-foreground))]' : issue.severity === 'error' ? 'text-red-300' : 'text-amber-300'
        )}>{issue.message}</p>
        {issue.detail && <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{issue.detail}</p>}
      </div>
      <button
        onClick={() => onSuppress(issue)}
        className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        title={suppressed ? 'Un-suppress' : 'Suppress'}
      >
        {suppressed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
      {issue.navigatePath && !suppressed && (
        <button
          onClick={() => onNavigate(issue)}
          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          title="Go to chapter"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function CategorySection({ title, icon: Icon, issues, focusedIdx, baseIdx, suppressedIds, showSuppressed, onNavigate, onSuppress }: {
  title: string
  icon: React.ElementType
  issues: Issue[]
  focusedIdx: number
  baseIdx: number
  suppressedIds: Set<string>
  showSuppressed: boolean
  onNavigate: (issue: Issue) => void
  onSuppress: (issue: Issue) => void
}) {
  const visible = issues.filter((i) => showSuppressed || !suppressedIds.has(i.id))
  if (visible.length === 0) return null
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{title}</span>
        <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{visible.length}</span>
      </div>
      <div className="space-y-1.5">
        {visible.map((issue, i) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            focused={focusedIdx === baseIdx + i}
            suppressed={suppressedIds.has(issue.id)}
            onNavigate={onNavigate}
            onSuppress={onSuppress}
          />
        ))}
      </div>
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────

export function ContinuityChecker() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { checkerOpen, setCheckerOpen, setActiveEventId, suppressedIssueIds: suppressedByWorld, toggleSuppressIssue } = useAppStore()
  const suppressedIssueIds = suppressedByWorld[worldId ?? ''] ?? []
  const [showSuppressed, setShowSuppressed] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  const chapters    = useWorldChapters(worldId ?? null)
  const allEvents   = useWorldEvents(worldId ?? null)
  const characters  = useCharacters(worldId ?? null)
  const rels        = useRelationships(worldId ?? null)
  const items       = useItems(worldId ?? null)
  const snapshots   = useWorldSnapshots(worldId ?? null)
  const allMarkers  = useAllLocationMarkers(worldId ?? null)
  const allLayers   = useMapLayers(worldId ?? null)
  const travelModes = useTravelModes(worldId ?? null)
  const allMovements = useWorldMovements(worldId ?? null)
  const artifacts    = useCrossTimelineArtifacts(worldId ?? null)
  const allRelSnaps = useLiveQuery(
    () => worldId ? db.relationshipSnapshots.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const allItemPlacements = useLiveQuery(
    () => worldId ? db.itemPlacements.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const allLocationSnapshots = useLiveQuery(
    () => worldId ? db.locationSnapshots.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const allMapRoutes = useLiveQuery(
    () => worldId ? db.mapRoutes.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const allMapRegions = useLiveQuery(
    () => worldId ? db.mapRegions.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )
  const allRegionSnapshots = useLiveQuery(
    () => worldId ? db.mapRegionSnapshots.where('worldId').equals(worldId).toArray() : [],
    [worldId], []
  )

  const issues = useMemo(() => {
    const out: Issue[] = []

    const chapById  = new Map(chapters.map((c) => [c.id, c]))
    const charById  = new Map(characters.map((c) => [c.id, c]))
    const itemById  = new Map(items.map((i) => [i.id, i]))
    const eventById = new Map(allEvents.map((e) => [e.id, e]))

    // Global event order: chapter.number * 10_000 + event.sortOrder
    const chapNumById = new Map(chapters.map((c) => [c.id, c.number]))
    function eventOrder(eventId: string): number {
      const ev = eventById.get(eventId)
      if (!ev) return -1
      return (chapNumById.get(ev.chapterId) ?? 0) * 10_000 + ev.sortOrder
    }

    // ── Character checks ────────────────────────────────────────────────────

    // Group snapshots by character
    const snapsByChar = new Map<string, CharacterSnapshot[]>()
    for (const snap of snapshots) {
      if (!snapsByChar.has(snap.characterId)) snapsByChar.set(snap.characterId, [])
      snapsByChar.get(snap.characterId)!.push(snap)
    }

    for (const [charId, charSnaps] of snapsByChar) {
      const char = charById.get(charId)
      if (!char) continue

      // Find the earliest "dead" snapshot
      const deathSnap = charSnaps
        .filter((s) => !s.isAlive)
        .sort((a, b) => eventOrder(a.eventId) - eventOrder(b.eventId))[0]

      if (!deathSnap) continue

      const deathOrder = eventOrder(deathSnap.eventId)
      const deathChapNum = chapNumById.get(eventById.get(deathSnap.eventId)?.chapterId ?? '') ?? 0

      // Any alive snapshot AFTER the death event
      const aliveAfterDeath = charSnaps.filter((s) => {
        if (s.isAlive === false) return false
        return eventOrder(s.eventId) > deathOrder
      })

      for (const snap of aliveAfterDeath) {
        const ev = eventById.get(snap.eventId)
        const ch = ev ? chapById.get(ev.chapterId) : undefined
        out.push({
          id: `dead-then-alive-${charId}-${snap.eventId}`,
          severity: 'error',
          category: 'character',
          message: `${char.name} is alive in Ch. ${ch?.number ?? '?'} after dying in Ch. ${deathChapNum}`,
          detail: `Death recorded in Ch. ${deathChapNum} — ${chapById.get(eventById.get(deathSnap.eventId)?.chapterId ?? '')?.title ?? ''}`,
          navigatePath: `/worlds/${worldId}/timeline/${ev?.chapterId ?? snap.eventId}`,
          eventId: snap.eventId,
        })
      }

      // Snapshot referencing a deleted event
      for (const snap of charSnaps) {
        if (!eventById.has(snap.eventId)) {
          out.push({
            id: `orphan-snap-${snap.id}`,
            severity: 'warning',
            category: 'character',
            message: `${char.name} has a snapshot for a deleted event`,
            detail: `Snapshot ID ${snap.id} — event no longer exists`,
          })
        }
      }
    }

    // ── Location destroyed check ─────────────────────────────────────────────

    // Group location snapshots by locationMarkerId
    const locSnapsByMarker = new Map<string, { order: number; status: string }[]>()
    for (const ls of allLocationSnapshots ?? []) {
      if (!locSnapsByMarker.has(ls.locationMarkerId)) locSnapsByMarker.set(ls.locationMarkerId, [])
      locSnapsByMarker.get(ls.locationMarkerId)!.push({ order: eventOrder(ls.eventId), status: ls.status })
    }

    for (const snap of snapshots) {
      if (!snap.currentLocationMarkerId) continue
      const snapOrder = eventOrder(snap.eventId)
      const locHistory = locSnapsByMarker.get(snap.currentLocationMarkerId)
      if (!locHistory) continue

      // Any destroyed/ruined snapshot at or before this event
      const wasDestroyed = locHistory.some(
        (ls) => ls.order <= snapOrder && (ls.status === 'destroyed' || ls.status === 'ruined')
      )
      if (!wasDestroyed) continue

      const char = charById.get(snap.characterId)
      const ev = eventById.get(snap.eventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      const marker = allMarkers.find((m) => m.id === snap.currentLocationMarkerId)
      out.push({
        id: `loc-destroyed-${snap.characterId}-${snap.eventId}`,
        severity: 'warning',
        category: 'character',
        message: `${char?.name ?? '?'} is at a destroyed location in Ch. ${ch?.number ?? '?'}`,
        detail: `"${marker?.name ?? snap.currentLocationMarkerId}" was destroyed at or before this event`,
        navigatePath: `/worlds/${worldId}/timeline/${ev?.chapterId ?? snap.eventId}`,
        eventId: snap.eventId,
      })
    }

    // ── Item checks ─────────────────────────────────────────────────────────

    // Group item placements by eventId
    const placementsByEvent = new Map<string, ItemPlacement[]>()
    for (const p of (allItemPlacements ?? [])) {
      if (!placementsByEvent.has(p.eventId)) placementsByEvent.set(p.eventId, [])
      placementsByEvent.get(p.eventId)!.push(p)
    }

    // Group snapshots by eventId to check inventory duplication
    const snapsByEvent = new Map<string, CharacterSnapshot[]>()
    for (const snap of snapshots) {
      if (!snapsByEvent.has(snap.eventId)) snapsByEvent.set(snap.eventId, [])
      snapsByEvent.get(snap.eventId)!.push(snap)
    }

    for (const [evId, evSnaps] of snapsByEvent) {
      const ev = eventById.get(evId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      if (!ch) continue

      // Build a count of each item across all inventories in this event
      const itemOwnerCount = new Map<string, string[]>()
      for (const snap of evSnaps) {
        for (const itemId of snap.inventoryItemIds) {
          if (!itemOwnerCount.has(itemId)) itemOwnerCount.set(itemId, [])
          itemOwnerCount.get(itemId)!.push(snap.characterId)
        }
      }

      // Also count items placed at locations
      const evPlacements = placementsByEvent.get(evId) ?? []
      for (const p of evPlacements) {
        if (!itemOwnerCount.has(p.itemId)) itemOwnerCount.set(p.itemId, [])
        itemOwnerCount.get(p.itemId)!.push(`location:${p.locationMarkerId}`)
      }

      for (const [itemId, owners] of itemOwnerCount) {
        if (owners.length > 1) {
          const item = itemById.get(itemId)
          const ownerNames = owners.map((o) => {
            if (o.startsWith('location:')) return 'a location'
            return charById.get(o)?.name ?? 'unknown'
          })
          out.push({
            id: `dup-item-${itemId}-${evId}`,
            severity: 'error',
            category: 'item',
            message: `"${item?.name ?? itemId}" appears in multiple places in Ch. ${ch.number}`,
            detail: `Held by: ${ownerNames.join(', ')}`,
            navigatePath: `/worlds/${worldId}/timeline/${ch.id}`,
            eventId: evId,
          })
        }
      }
    }

    // ── Item used before acquired check ─────────────────────────────────────

    // Find the earliest event order where each item first appears in any inventory
    const itemFirstAcquiredOrder = new Map<string, number>()
    for (const snap of snapshots) {
      const order = eventOrder(snap.eventId)
      for (const itemId of snap.inventoryItemIds) {
        const current = itemFirstAcquiredOrder.get(itemId) ?? Infinity
        if (order < current) itemFirstAcquiredOrder.set(itemId, order)
      }
    }

    for (const ev of allEvents) {
      if (!ev.involvedItemIds || ev.involvedItemIds.length === 0) continue
      const ch = chapById.get(ev.chapterId)
      if (!ch) continue
      const evOrder = eventOrder(ev.id)

      for (const itemId of ev.involvedItemIds) {
        const firstOrder = itemFirstAcquiredOrder.get(itemId)
        if (firstOrder !== undefined && evOrder < firstOrder) {
          const item = itemById.get(itemId)
          out.push({
            id: `item-before-acquired-${itemId}-${ev.id}`,
            severity: 'warning',
            category: 'item',
            message: `"${item?.name ?? itemId}" used before acquired in Ch. ${ch.number}`,
            detail: `Appears in event "${ev.title}" but isn't in any inventory until later`,
            navigatePath: `/worlds/${worldId}/timeline/${ch.id}`,
            eventId: ev.id,
          })
        }
      }
    }

    // ── Relationship checks ──────────────────────────────────────────────────

    for (const rel of rels) {
      if (!rel.startEventId) continue
      const startOrder = eventOrder(rel.startEventId)
      const startChapNum = chapNumById.get(eventById.get(rel.startEventId)?.chapterId ?? '') ?? 0

      // Any snapshot for an event BEFORE the relationship started
      const earlySnaps = (allRelSnaps ?? []).filter((rs) => {
        if (rs.relationshipId !== rel.id) return false
        return eventOrder(rs.eventId) < startOrder
      })

      for (const rs of earlySnaps) {
        const rsEv = eventById.get(rs.eventId)
        const rsCh = rsEv ? chapById.get(rsEv.chapterId) : undefined
        const charA = charById.get(rel.characterAId)
        const charB = charById.get(rel.characterBId)
        out.push({
          id: `rel-before-start-${rs.id}`,
          severity: 'warning',
          category: 'relationship',
          message: `Relationship snapshot exists before it started`,
          detail: `${charA?.name ?? '?'} ↔ ${charB?.name ?? '?'} — snapshot in Ch. ${rsCh?.number ?? '?'} but relationship starts in Ch. ${startChapNum}`,
          navigatePath: `/worlds/${worldId}/timeline/${rsEv?.chapterId ?? rs.eventId}`,
          eventId: rs.eventId,
        })
      }
    }

    // ── Dead character in relationship snapshot ──────────────────────────────

    // Map: characterId → eventId → isAlive
    const charAliveAtEvent = new Map<string, Map<string, boolean>>()
    for (const snap of snapshots) {
      if (!charAliveAtEvent.has(snap.characterId)) charAliveAtEvent.set(snap.characterId, new Map())
      charAliveAtEvent.get(snap.characterId)!.set(snap.eventId, snap.isAlive)
    }

    for (const rs of allRelSnaps ?? []) {
      const rel = rels.find((r) => r.id === rs.relationshipId)
      if (!rel) continue

      const charAAlive = charAliveAtEvent.get(rel.characterAId)?.get(rs.eventId)
      const charBAlive = charAliveAtEvent.get(rel.characterBId)?.get(rs.eventId)

      if (charAAlive === false || charBAlive === false) {
        const deadCharId = charAAlive === false ? rel.characterAId : rel.characterBId
        const deadChar = charById.get(deadCharId)
        const charA = charById.get(rel.characterAId)
        const charB = charById.get(rel.characterBId)
        const rsEv = eventById.get(rs.eventId)
        const rsCh = rsEv ? chapById.get(rsEv.chapterId) : undefined
        out.push({
          id: `dead-char-in-rel-snap-${rs.id}`,
          severity: 'warning',
          category: 'relationship',
          message: `Relationship snapshot references deceased ${deadChar?.name ?? '?'}`,
          detail: `${charA?.name ?? '?'} ↔ ${charB?.name ?? '?'} in Ch. ${rsCh?.number ?? '?'}`,
          navigatePath: `/worlds/${worldId}/timeline/${rsEv?.chapterId ?? rs.eventId}`,
          eventId: rs.eventId,
        })
      }
    }

    // ── Travel distance checks (with route speed multipliers) ───────────────

    const markerById    = new Map(allMarkers.map((m) => [m.id, m]))
    const layerById     = new Map(allLayers.map((l) => [l.id, l]))
    const travelModeById = new Map(travelModes.map((t) => [t.id, t]))
    const movementKey = (charId: string, eventId: string) => `${charId}:${eventId}`
    const movementByKey = new Map(allMovements.map((m) => [movementKey(m.characterId, m.eventId), m]))

    // Group routes by mapLayerId for fast lookup
    const routesByLayer = new Map<string, MapRoute[]>()
    for (const route of allMapRoutes ?? []) {
      if (!routesByLayer.has(route.mapLayerId)) routesByLayer.set(route.mapLayerId, [])
      routesByLayer.get(route.mapLayerId)!.push(route)
    }

    // Best region snapshot per region at a given event order (for region traversal check)
    // Pre-build: regionId → sorted [{order, status}]
    const regionSnapHistory = new Map<string, Array<{ order: number; status: string }>>()
    for (const rs of allRegionSnapshots ?? []) {
      if (!regionSnapHistory.has(rs.regionId)) regionSnapHistory.set(rs.regionId, [])
      regionSnapHistory.get(rs.regionId)!.push({ order: eventOrder(rs.eventId), status: rs.status })
    }
    // Sort each history by order
    for (const hist of regionSnapHistory.values()) hist.sort((a, b) => a.order - b.order)

    function bestRegionStatus(regionId: string, atOrder: number): string | null {
      const hist = regionSnapHistory.get(regionId)
      if (!hist || hist.length === 0) return null
      let best: string | null = null
      for (const entry of hist) {
        if (entry.order <= atOrder) best = entry.status
        else break
      }
      return best
    }

    // Group regions by mapLayerId for fast lookup
    const regionsByLayer = new Map<string, MapRegion[]>()
    for (const region of allMapRegions ?? []) {
      if (!regionsByLayer.has(region.mapLayerId)) regionsByLayer.set(region.mapLayerId, [])
      regionsByLayer.get(region.mapLayerId)!.push(region)
    }

    for (const [charId, charSnaps] of snapsByChar) {
      const char = charById.get(charId)
      if (!char) continue

      const snapsWithLocation = charSnaps
        .filter((s) => s.currentLocationMarkerId && s.currentMapLayerId)
        .sort((a, b) => eventOrder(a.eventId) - eventOrder(b.eventId))

      for (let i = 1; i < snapsWithLocation.length; i++) {
        const prev = snapsWithLocation[i - 1]
        const curr = snapsWithLocation[i]

        if (prev.currentLocationMarkerId === curr.currentLocationMarkerId &&
            prev.currentMapLayerId === curr.currentMapLayerId) continue

        const fromMarker = prev.currentLocationMarkerId ? markerById.get(prev.currentLocationMarkerId) : undefined
        const toMarker   = curr.currentLocationMarkerId ? markerById.get(curr.currentLocationMarkerId) : undefined
        if (!fromMarker || !toMarker || fromMarker.mapLayerId !== toMarker.mapLayerId) continue

        const currEvent = eventById.get(curr.eventId)
        const currOrder = eventOrder(curr.eventId)

        // ── Region traversal: warn if path crosses a destroyed/abandoned region ──
        const layerRegions = regionsByLayer.get(fromMarker.mapLayerId) ?? []
        for (const region of layerRegions) {
          const status = bestRegionStatus(region.id, currOrder)
          if (status !== 'destroyed' && status !== 'abandoned') continue
          if (!pathCrossesPolygon(fromMarker.x, fromMarker.y, toMarker.x, toMarker.y, region.vertices)) continue

          out.push({
            id: `region-traversal-${charId}-${curr.eventId}-${region.id}`,
            severity: 'warning',
            category: 'character',
            message: `${char.name} travels through a ${status} region`,
            detail: `"${region.name}" is ${status} when ${char.name} moves from ${fromMarker.name} → ${toMarker.name}${currEvent ? ` (Ch. ${chapById.get(currEvent.chapterId)?.number ?? '?'})` : ''}`,
            navigatePath: currEvent ? `/worlds/${worldId}/timeline/${currEvent.chapterId}` : undefined,
            eventId: curr.eventId,
          })
        }

        // ── Travel time check ─────────────────────────────────────────────────
        if (!currEvent || currEvent.travelDays === null || currEvent.travelDays <= 0) continue

        const mov = movementByKey.get(movementKey(charId, curr.eventId))
        const travelModeId = mov?.travelModeId ?? curr.travelModeId
        const travelMode = travelModeId ? travelModeById.get(travelModeId) : undefined
        if (!travelMode) continue

        const layer = layerById.get(fromMarker.mapLayerId)
        if (!layer?.scalePixelsPerUnit || !layer.scaleUnit) continue

        // Find a route connecting the two markers (on the same layer)
        const layerRoutes = routesByLayer.get(fromMarker.mapLayerId) ?? []
        const connectingRoute = layerRoutes.find((r) => {
          const wps = r.waypoints
          return wps.some((wp) => wp === prev.currentLocationMarkerId) &&
                 wps.some((wp) => wp === curr.currentLocationMarkerId)
        })

        const routeMultiplier = connectingRoute ? ROUTE_SPEED_MULTIPLIERS[connectingRoute.routeType] : 1.0
        const effectiveSpeed = travelMode.speedPerDay * routeMultiplier

        const distPx = pixelDist(fromMarker.x, fromMarker.y, toMarker.x, toMarker.y)
        const distUnits = distPx / layer.scalePixelsPerUnit
        const daysNeeded = distUnits / effectiveSpeed

        if (daysNeeded > currEvent.travelDays) {
          const currCh = chapById.get(currEvent.chapterId)
          const dist = distUnits < 10 ? distUnits.toFixed(1) : Math.round(distUnits).toString()
          const routeNote = connectingRoute
            ? ` via ${connectingRoute.routeType.replace('_', ' ')} (×${routeMultiplier} speed)`
            : ''
          out.push({
            id: `travel-dist-${charId}-${curr.eventId}`,
            severity: 'warning',
            category: 'character',
            message: `${char.name} can't reach ${toMarker.name} in time`,
            detail: `${fromMarker.name} → ${toMarker.name} is ~${dist} ${layer.scaleUnit} at ${effectiveSpeed.toFixed(1)} ${layer.scaleUnit}/day${routeNote} — needs ${daysNeeded.toFixed(1)} days but only ${currEvent.travelDays} available (Ch. ${currCh?.number ?? '?'})`,
            navigatePath: `/worlds/${worldId}/timeline/${currEvent.chapterId}`,
            eventId: curr.eventId,
          })
        }
      }
    }

    // ── Cross-timeline artifact anachronism check ────────────────────────────

    // Build a map: timelineId → Set<chapterId>
    const chaptersByTimeline = new Map<string, Set<string>>()
    for (const ch of chapters) {
      if (!chaptersByTimeline.has(ch.timelineId)) chaptersByTimeline.set(ch.timelineId, new Set())
      chaptersByTimeline.get(ch.timelineId)!.add(ch.id)
    }

    for (const artifact of artifacts) {
      const item = itemById.get(artifact.itemId)
      if (!item) continue

      const allowedTimelines = new Set([artifact.originTimelineId, artifact.encounterTimelineId])

      // Find snapshots where this item is in inventory
      for (const snap of snapshots) {
        if (!snap.inventoryItemIds.includes(artifact.itemId)) continue
        const ev = eventById.get(snap.eventId)
        if (!ev) continue
        const ch = chapById.get(ev.chapterId)
        if (!ch) continue

        // If the snapshot's chapter belongs to a timeline outside the two declared timelines, flag it
        if (!allowedTimelines.has(ch.timelineId)) {
          const char = charById.get(snap.characterId)
          out.push({
            id: `artifact-wrong-timeline-${artifact.id}-${snap.id}`,
            severity: 'warning',
            category: 'item',
            message: `"${item.name}" appears outside its declared timelines`,
            detail: `${char?.name ?? '?'} holds it in Ch. ${ch.number} — not in origin or encounter timeline`,
            navigatePath: `/worlds/${worldId}/timeline/${ch.id}`,
            eventId: snap.eventId,
          })
        }
      }
    }

    return out
  }, [chapters, allEvents, characters, rels, items, snapshots, allRelSnaps, allItemPlacements, allLocationSnapshots, allMarkers, allLayers, travelModes, allMovements, artifacts, allMapRoutes, allMapRegions, allRegionSnapshots, worldId])

  // Focus modal on open so keyboard navigation works immediately
  useEffect(() => {
    if (checkerOpen) {
      setFocusedIdx(-1)
      setTimeout(() => containerRef.current?.focus(), 0)
    }
  }, [checkerOpen])

  const suppressedSet = useMemo(() => new Set(suppressedIssueIds), [suppressedIssueIds])

  // Flat ordered list of navigable (non-suppressed) issues for keyboard nav
  const navigableIssues = useMemo(
    () => issues.filter((i) => !suppressedSet.has(i.id) && i.navigatePath),
    [issues, suppressedSet]
  )

  function handleNavigate(issue: Issue) {
    if (!issue.navigatePath || !issue.eventId) return
    setActiveEventId(issue.eventId)
    navigate(issue.navigatePath)
    setCheckerOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (navigableIssues.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx((i) => Math.min(i + 1, navigableIssues.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault()
      handleNavigate(navigableIssues[focusedIdx])
    }
  }

  if (!checkerOpen) return null

  const errors   = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const activeCount = issues.filter((i) => !suppressedSet.has(i.id)).length
  const suppressedCount = suppressedIssueIds.length

  // Per-category visible issues (respects showSuppressed)
  const charIssues = issues.filter((i) => i.category === 'character')
  const itemIssues = issues.filter((i) => i.category === 'item')
  const relIssues  = issues.filter((i) => i.category === 'relationship')

  // Compute base indices for keyboard focus mapping per category
  const visibleChar = charIssues.filter((i) => showSuppressed || !suppressedSet.has(i.id))
  const visibleItem = itemIssues.filter((i) => showSuppressed || !suppressedSet.has(i.id))

  // focusedIdx is into navigableIssues; map back to category position
  function categoryFocusedIdx(categoryIssues: Issue[]): number {
    if (focusedIdx < 0) return -1
    const focused = navigableIssues[focusedIdx]
    const visible = categoryIssues.filter((i) => showSuppressed || !suppressedSet.has(i.id))
    return visible.findIndex((i) => i.id === focused?.id)
  }

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center pt-[8vh]"
      onClick={() => setCheckerOpen(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={containerRef}
        tabIndex={0}
        className="relative z-10 flex w-full max-w-xl flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl outline-none"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5">
          {activeCount === 0
            ? <ShieldCheck className="h-4 w-4 text-green-400" />
            : <ShieldAlert className="h-4 w-4 text-amber-400" />
          }
          <span className="text-sm font-semibold">Continuity Checker</span>
          {issues.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              {errors.length > 0 && (
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-red-400">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>
              )}
              {warnings.length > 0 && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-400">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
          <button
            className="ml-auto text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            onClick={() => setCheckerOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-3">
          {activeCount === 0 && !showSuppressed ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <ShieldCheck className="h-10 w-10 text-green-400" />
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">No issues found</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                No continuity errors detected across {characters.length} character{characters.length !== 1 ? 's' : ''}, {items.length} item{items.length !== 1 ? 's' : ''}, and {rels.length} relationship{rels.length !== 1 ? 's' : ''}.
              </p>
            </div>
          ) : (
            <>
              <CategorySection title="Characters" icon={Users} issues={charIssues}
                focusedIdx={categoryFocusedIdx(charIssues)} baseIdx={0}
                suppressedIds={suppressedSet} showSuppressed={showSuppressed}
                onNavigate={handleNavigate} onSuppress={(i) => toggleSuppressIssue(worldId ?? '', i.id)} />
              <CategorySection title="Items" icon={Package} issues={itemIssues}
                focusedIdx={categoryFocusedIdx(itemIssues)} baseIdx={visibleChar.length}
                suppressedIds={suppressedSet} showSuppressed={showSuppressed}
                onNavigate={handleNavigate} onSuppress={(i) => toggleSuppressIssue(worldId ?? '', i.id)} />
              <CategorySection title="Relationships" icon={Network} issues={relIssues}
                focusedIdx={categoryFocusedIdx(relIssues)} baseIdx={visibleChar.length + visibleItem.length}
                suppressedIds={suppressedSet} showSuppressed={showSuppressed}
                onNavigate={handleNavigate} onSuppress={(i) => toggleSuppressIssue(worldId ?? '', i.id)} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-[hsl(var(--border))] px-5 py-2">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            ↑↓ navigate · Enter go to event
          </span>
          {suppressedCount > 0 && (
            <button
              onClick={() => setShowSuppressed((v) => !v)}
              className="ml-auto flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              {showSuppressed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {showSuppressed ? 'Hide' : 'Show'} {suppressedCount} suppressed
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
