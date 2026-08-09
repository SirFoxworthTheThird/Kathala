import { pixelDist } from '@/lib/mapScale'
import { assessTravel, ROUTE_SPEED_MULTIPLIERS } from '@/lib/travelTime'
import { computeInWorldDays } from '@/lib/inWorldTime'
import { computeKnowledgeAnachronisms } from '@/lib/knowledgeAnachronisms'
import { computeDeadKnowerIssues } from '@/lib/knowledgeRevealContinuity'
import { computeProseMentionIssues, computeKnowledgeLeaks } from '@/lib/proseContinuity'
import { computeItemHandoffIssues } from '@/lib/itemHandoff'
import { computeThreadIssues } from '@/lib/threadContinuity'
import type {
  Chapter, Character, CharacterMovement, CharacterSnapshot, CrossTimelineArtifact,
  Faction, FactionMembership, FactionRelationship, Item, ItemPlacement, ItemSnapshot,
  KnowledgeFact, KnowledgeReveal, LocationMarker, LocationSnapshot, MapLayer, PlotThread,
  MapRegion, MapRegionSnapshot, MapRoute, Relationship, RelationshipSnapshot,
  SceneText, TravelMode, World, WorldEvent,
} from '@/types'

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

// ── types ─────────────────────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning'

export interface Issue {
  id: string
  severity: IssueSeverity
  category: 'character' | 'item' | 'relationship' | 'faction' | 'pov' | 'prose' | 'thread'
  message: string
  detail?: string
  navigatePath?: string
  eventId?: string
  /** Optional one-click fix: set this event's travelDays to the given value. */
  fix?: { label: string; eventId: string; setTravelDays: number }
}

/** Everything the checks read — the ContinuityChecker gathers these via hooks
 *  and passes them through unchanged. Plain data in, issues out. */
export interface ContinuityInput {
  worldId: string | undefined
  world: World | undefined
  chapters: Chapter[]
  allEvents: WorldEvent[]
  characters: Character[]
  rels: Relationship[]
  items: Item[]
  snapshots: CharacterSnapshot[]
  knowledgeFacts: KnowledgeFact[]
  knowledgeReveals: KnowledgeReveal[]
  sceneTexts: SceneText[]
  allRelSnaps: RelationshipSnapshot[]
  allItemPlacements: ItemPlacement[]
  allLocationSnapshots: LocationSnapshot[]
  allMarkers: LocationMarker[]
  allLayers: MapLayer[]
  travelModes: TravelMode[]
  allMovements: CharacterMovement[]
  artifacts: CrossTimelineArtifact[]
  allMapRoutes: MapRoute[]
  allMapRegions: MapRegion[]
  allRegionSnapshots: MapRegionSnapshot[]
  allFactions: Faction[]
  allMemberships: FactionMembership[]
  allFactionRels: FactionRelationship[]
  allItemSnapshots: ItemSnapshot[]
  plotThreads: PlotThread[]
}

/**
 * Runs every continuity check over a world's data and returns the found
 * issues. Extracted verbatim from the ContinuityChecker component so the
 * checks are pure and unit-testable; the component owns only data-fetching,
 * suppression state, and rendering.
 */
export function computeContinuityIssues(input: ContinuityInput): Issue[] {
  const {
    worldId, world, chapters, allEvents, characters, rels, items, snapshots,
    knowledgeFacts, knowledgeReveals, sceneTexts, allRelSnaps, allItemPlacements,
    allLocationSnapshots, allMarkers, allLayers, travelModes, allMovements,
    artifacts, allMapRoutes, allMapRegions, allRegionSnapshots, allFactions,
    allMemberships, allFactionRels, allItemSnapshots, plotThreads,
  } = input

    const out: Issue[] = []

    const chapById  = new Map(chapters.map((c) => [c.id, c]))
    const charById  = new Map(characters.map((c) => [c.id, c]))
    const itemById  = new Map(items.map((i) => [i.id, i]))
    const eventById = new Map(allEvents.map((e) => [e.id, e]))
    // Absolute in-world day per event, so travel checks can use the elapsed
    // time between two points (which spans every event in between, and honors
    // explicit inWorldTime pins) rather than a single event's travelDays.
    const inWorldDay = computeInWorldDays(allEvents, chapters)

    // Global event order: chapter.number * 10_000 + event.sortOrder
    const chapNumById = new Map(chapters.map((c) => [c.id, c.number]))
    function eventOrder(eventId: string): number {
      const ev = eventById.get(eventId)
      if (!ev) return -1
      return (chapNumById.get(ev.chapterId) ?? 0) * 10_000 + ev.sortOrder
    }

    // ── Shared lookup maps ──────────────────────────────────────────────────

    const markerById = new Map(allMarkers.map((m) => [m.id, m]))
    const layerById  = new Map(allLayers.map((l) => [l.id, l]))

    // Best region snapshot per region at a given event order
    const regionSnapHistory = new Map<string, Array<{ order: number; status: string }>>()
    for (const rs of allRegionSnapshots ?? []) {
      if (!regionSnapHistory.has(rs.regionId)) regionSnapHistory.set(rs.regionId, [])
      regionSnapHistory.get(rs.regionId)!.push({ order: eventOrder(rs.eventId), status: rs.status })
    }
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

    const regionsByLayer = new Map<string, MapRegion[]>()
    for (const region of allMapRegions ?? []) {
      if (!regionsByLayer.has(region.mapLayerId)) regionsByLayer.set(region.mapLayerId, [])
      regionsByLayer.get(region.mapLayerId)!.push(region)
    }

    const staleThreshold = world?.continuityStaleThreshold ?? 5

    // ── Character checks ────────────────────────────────────────────────────

    // Group snapshots by character
    const snapsByChar = new Map<string, CharacterSnapshot[]>()
    for (const snap of snapshots) {
      if (!snapsByChar.has(snap.characterId)) snapsByChar.set(snap.characterId, [])
      snapsByChar.get(snap.characterId)!.push(snap)
    }

    // Sorted alive-history per character (for dead-in-cast / before-intro checks)
    const snapsByCharSorted = new Map<string, Array<{ order: number; isAlive: boolean; eventId: string }>>()
    for (const snap of snapshots) {
      if (!snapsByCharSorted.has(snap.characterId)) snapsByCharSorted.set(snap.characterId, [])
      snapsByCharSorted.get(snap.characterId)!.push({ order: eventOrder(snap.eventId), isAlive: snap.isAlive, eventId: snap.eventId })
    }
    for (const arr of snapsByCharSorted.values()) arr.sort((a, b) => a.order - b.order)

    function isDeadAtOrder(charId: string, order: number): boolean {
      const hist = snapsByCharSorted.get(charId)
      if (!hist) return false
      let lastAlive: boolean | null = null
      for (const entry of hist) {
        if (entry.order > order) break
        lastAlive = entry.isAlive
      }
      return lastAlive === false
    }

    // Event IDs where each character has a snapshot (for stale-snapshot check)
    const snapEventIdsByChar = new Map<string, Set<string>>()
    for (const snap of snapshots) {
      if (!snapEventIdsByChar.has(snap.characterId)) snapEventIdsByChar.set(snap.characterId, new Set())
      snapEventIdsByChar.get(snap.characterId)!.add(snap.eventId)
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

    // ── Dead character in non-flashback event cast ──────────────────────────────
    for (const ev of allEvents) {
      if (ev.isFlashback) continue
      const evOrder = eventOrder(ev.id)
      const ch = chapById.get(ev.chapterId)
      const checkedDead = new Set<string>()
      const castIds = [
        ...ev.involvedCharacterIds,
        ...(ev.povCharacterId ? [ev.povCharacterId] : []),
      ]
      for (const charId of castIds) {
        if (checkedDead.has(charId)) continue
        checkedDead.add(charId)
        if (!isDeadAtOrder(charId, evOrder)) continue
        const char = charById.get(charId)
        const isPov = ev.povCharacterId === charId
        out.push({
          id: `dead-in-event-${charId}-${ev.id}`,
          severity: 'warning',
          category: 'character',
          message: `Dead character ${char?.name ?? '?'} in "${ev.title || 'untitled'}"`,
          detail: `${char?.name ?? '?'} is dead at this point${isPov ? ' and is the POV' : ''} — Ch. ${ch?.number ?? '?'}. Mark as Flashback if intentional.`,
          navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
          eventId: ev.id,
        })
      }
    }

    // ── Character referenced before first snapshot ───────────────────────────
    // For each character, find their first event appearance and first snapshot order.
    // If first appearance precedes first snapshot (or no snapshot at all), raise one warning.
    const charFirstAppearance = new Map<string, { evOrder: number; ev: (typeof allEvents)[0] }>()
    const sortedEventsAsc = [...allEvents].sort((a, b) => eventOrder(a.id) - eventOrder(b.id))
    for (const ev of sortedEventsAsc) {
      if (ev.isFlashback) continue
      const castIds = [
        ...ev.involvedCharacterIds,
        ...(ev.povCharacterId ? [ev.povCharacterId] : []),
      ]
      for (const charId of castIds) {
        if (!charFirstAppearance.has(charId)) {
          charFirstAppearance.set(charId, { evOrder: eventOrder(ev.id), ev })
        }
      }
    }
    for (const [charId, { evOrder, ev }] of charFirstAppearance) {
      if (!charById.has(charId)) continue
      const charHist = snapsByCharSorted.get(charId)
      const firstSnapOrder = charHist && charHist.length > 0 ? charHist[0].order : undefined
      if (firstSnapOrder !== undefined && firstSnapOrder <= evOrder) continue
      const char = charById.get(charId)
      const ch = chapById.get(ev.chapterId)
      out.push({
        id: `char-before-intro-${charId}`,
        severity: 'warning',
        category: 'character',
        message: `${char?.name ?? '?'} appears before any snapshot record`,
        detail: firstSnapOrder === undefined
          ? `First appears in "${ev.title || 'untitled'}" (Ch. ${ch?.number ?? '?'}) but has no snapshots at all`
          : `First appears in "${ev.title || 'untitled'}" (Ch. ${ch?.number ?? '?'}) but first snapshot is later in the timeline`,
        navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
        eventId: ev.id,
      })
    }

    // ── Stale snapshot warning ────────────────────────────────────────────────
    // Warn when a character is involved in staleThreshold+ consecutive events without a snapshot update.
    const involvedEventsByChar = new Map<string, Array<(typeof allEvents)[0]>>()
    for (const ev of sortedEventsAsc) {
      for (const charId of ev.involvedCharacterIds) {
        if (!involvedEventsByChar.has(charId)) involvedEventsByChar.set(charId, [])
        involvedEventsByChar.get(charId)!.push(ev)
      }
    }
    for (const [charId, charEvents] of involvedEventsByChar) {
      const char = charById.get(charId)
      if (!char) continue
      const snapEventSet = snapEventIdsByChar.get(charId) ?? new Set<string>()
      let streakStart: (typeof allEvents)[0] | null = null
      let streakCount = 0
      for (const ev of charEvents) {
        if (snapEventSet.has(ev.id)) {
          streakStart = null
          streakCount = 0
        } else {
          streakCount++
          if (!streakStart) streakStart = ev
          if (streakCount === staleThreshold) {
            const startCh = chapById.get(streakStart.chapterId)
            const endCh = chapById.get(ev.chapterId)
            out.push({
              id: `stale-snapshot-${charId}-${streakStart.id}`,
              severity: 'warning',
              category: 'character',
              message: `${char.name}'s state may be stale (${streakCount}+ events without update)`,
              detail: `Involved from Ch. ${startCh?.number ?? '?'} to Ch. ${endCh?.number ?? '?'} with no snapshot update`,
              navigatePath: `/worlds/${worldId}/timeline/${streakStart.chapterId}`,
              eventId: streakStart.id,
            })
          }
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

    // ── Character inside destroyed/occupied region ───────────────────────────

    for (const snap of snapshots) {
      if (!snap.currentLocationMarkerId || !snap.currentMapLayerId) continue
      const marker = markerById.get(snap.currentLocationMarkerId)
      if (!marker) continue

      const snapOrder = eventOrder(snap.eventId)
      const char = charById.get(snap.characterId)
      const ev = eventById.get(snap.eventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined

      const layerRegions = regionsByLayer.get(snap.currentMapLayerId) ?? []
      for (const region of layerRegions) {
        if (region.vertices.length < 3) continue
        const status = bestRegionStatus(region.id, snapOrder)
        if (status !== 'destroyed' && status !== 'occupied') continue
        if (!pointInPolygon(marker.x, marker.y, region.vertices)) continue

        out.push({
          id: `char-in-region-${snap.characterId}-${snap.eventId}-${region.id}`,
          severity: 'warning',
          category: 'character',
          message: `${char?.name ?? '?'} is inside a ${status} region in Ch. ${ch?.number ?? '?'}`,
          detail: `"${marker.name}" is inside "${region.name}" which is ${status} at this event`,
          navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
          eventId: snap.eventId,
        })
      }
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
        // A kind of thing rather than one object — several people carrying a
        // cloak each is not a contradiction, it is what a cloak is.
        if (itemById.get(itemId)?.isCollective) continue
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

    // ── Item used after destroyed ─────────────────────────────────────────────
    // An item's condition is tracked via ItemSnapshot. If the last condition at or before
    // a reference point is 'destroyed', flag it. A later non-destroyed snapshot acts as restoration.
    const itemSnapHistory = new Map<string, Array<{ order: number; condition: string }>>()
    for (const is of allItemSnapshots ?? []) {
      if (!itemSnapHistory.has(is.itemId)) itemSnapHistory.set(is.itemId, [])
      itemSnapHistory.get(is.itemId)!.push({ order: eventOrder(is.eventId), condition: is.condition })
    }
    for (const hist of itemSnapHistory.values()) hist.sort((a, b) => a.order - b.order)

    function isItemDestroyedAtOrder(itemId: string, order: number): boolean {
      const hist = itemSnapHistory.get(itemId)
      if (!hist) return false
      let lastCondition: string | null = null
      for (const entry of hist) {
        if (entry.order > order) break
        lastCondition = entry.condition
      }
      return lastCondition === 'destroyed'
    }

    for (const ev of allEvents) {
      if (!ev.involvedItemIds?.length) continue
      const evOrder = eventOrder(ev.id)
      const ch = chapById.get(ev.chapterId)
      for (const itemId of ev.involvedItemIds) {
        if (!isItemDestroyedAtOrder(itemId, evOrder)) continue
        const item = itemById.get(itemId)
        out.push({
          id: `item-after-destroyed-ev-${itemId}-${ev.id}`,
          severity: 'warning',
          category: 'item',
          message: `"${item?.name ?? itemId}" used after being destroyed`,
          detail: `Referenced in "${ev.title || 'untitled'}" (Ch. ${ch?.number ?? '?'}) — condition is "destroyed". Update the item snapshot to restore it if intentional.`,
          navigatePath: `/worlds/${worldId}/timeline/${ch?.id ?? ev.chapterId}`,
          eventId: ev.id,
        })
      }
    }

    for (const snap of snapshots) {
      if (!snap.inventoryItemIds?.length) continue
      const snapOrder = eventOrder(snap.eventId)
      const ev = eventById.get(snap.eventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      for (const itemId of snap.inventoryItemIds) {
        if (!isItemDestroyedAtOrder(itemId, snapOrder)) continue
        const item = itemById.get(itemId)
        const char = charById.get(snap.characterId)
        out.push({
          id: `item-after-destroyed-inv-${itemId}-${snap.eventId}-${snap.characterId}`,
          severity: 'warning',
          category: 'item',
          message: `Destroyed item "${item?.name ?? itemId}" in ${char?.name ?? '?'}'s inventory`,
          detail: `Held in Ch. ${ch?.number ?? '?'} — condition is "destroyed". Update the item snapshot to restore it if intentional.`,
          navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
          eventId: snap.eventId,
        })
      }
    }

    // ── Item hand-off "teleport" check ───────────────────────────────────────
    // An item that passes directly between two characters who were never in the
    // same place around the hand-off has no way to physically change hands.
    for (const h of computeItemHandoffIssues({ events: allEvents, chapters, snapshots, placements: allItemPlacements ?? [] })) {
      const item = itemById.get(h.itemId)
      // Two people holding their own cloak is not one cloak crossing the map.
      if (item?.isCollective) continue
      const from = charById.get(h.fromCharacterId)
      const to   = charById.get(h.toCharacterId)
      const fromMarker = markerById.get(h.fromMarkerId)
      const toMarker   = markerById.get(h.toMarkerId)
      const ev = eventById.get(h.handoffEventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      out.push({
        id: `item-handoff-${h.itemId}-${h.fromCharacterId}-${h.toCharacterId}-${h.handoffEventId}`,
        severity: 'warning',
        category: 'item',
        message: `"${item?.name ?? h.itemId}" changes hands between characters in different places`,
        detail: `${from?.name ?? '?'} last held it at "${fromMarker?.name ?? h.fromMarkerId}", but ${to?.name ?? '?'} has it at "${toMarker?.name ?? h.toMarkerId}" in Ch. ${ch?.number ?? '?'} — they never share a location. Add a scene where they meet, route it through a location, or suppress if intentional.`,
        navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
        eventId: h.handoffEventId,
      })
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

    const travelModeById = new Map(travelModes.map((t) => [t.id, t]))
    const movementKey = (charId: string, eventId: string) => `${charId}:${eventId}`
    const movementByKey = new Map(allMovements.map((m) => [movementKey(m.characterId, m.eventId), m]))

    // Group routes by mapLayerId for fast lookup
    const routesByLayer = new Map<string, MapRoute[]>()
    for (const route of allMapRoutes ?? []) {
      if (!routesByLayer.has(route.mapLayerId)) routesByLayer.set(route.mapLayerId, [])
      routesByLayer.get(route.mapLayerId)!.push(route)
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
        // Days available = elapsed in-world time between the two snapshots. This
        // spans every event in between (not just this one's travelDays) and
        // respects explicit inWorldTime. <= 0 means no tracked time (or a
        // flashback jump), so there's nothing to check.
        const daysAvailable = (inWorldDay.get(curr.eventId) ?? 0) - (inWorldDay.get(prev.eventId) ?? 0)
        if (!currEvent || daysAvailable <= 0) continue

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
        const assessment = assessTravel({
          pixelDistance: pixelDist(fromMarker.x, fromMarker.y, toMarker.x, toMarker.y),
          scalePixelsPerUnit: layer.scalePixelsPerUnit,
          baseSpeedPerDay: travelMode.speedPerDay,
          routeType: connectingRoute?.routeType ?? null,
          daysAvailable,
        })

        if (!assessment.feasible && Number.isFinite(assessment.shortfallDays)) {
          const currCh = chapById.get(currEvent.chapterId)
          const dist = assessment.distanceUnits < 10 ? assessment.distanceUnits.toFixed(1) : Math.round(assessment.distanceUnits).toString()
          const routeNote = connectingRoute
            ? ` via ${connectingRoute.routeType.replace('_', ' ')} (×${routeMultiplier} speed)`
            : ''
          // Adding the shortfall to this event's own travelDays lengthens the
          // elapsed time before it, making the journey possible.
          const newTravelDays = (currEvent.travelDays ?? 0) + assessment.shortfallDays
          out.push({
            id: `travel-dist-${charId}-${curr.eventId}`,
            severity: 'warning',
            category: 'character',
            message: `${char.name} can't reach ${toMarker.name} in time`,
            detail: `${fromMarker.name} → ${toMarker.name} is ~${dist} ${layer.scaleUnit} · ${travelMode.name} at ${assessment.effectiveSpeed.toFixed(1)} ${layer.scaleUnit}/day${routeNote} — needs ${assessment.daysNeeded.toFixed(1)} days but only ${daysAvailable} in-world day${daysAvailable === 1 ? '' : 's'} available (Ch. ${currCh?.number ?? '?'})`,
            navigatePath: `/worlds/${worldId}/timeline/${currEvent.chapterId}`,
            eventId: curr.eventId,
            fix: { label: `Allow ${assessment.shortfallDays} more day${assessment.shortfallDays === 1 ? '' : 's'}`, eventId: curr.eventId, setTravelDays: newTravelDays },
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

    // ── Faction membership gap check ────────────────────────────────────────
    const factionById = new Map(allFactions.map((f) => [f.id, f]))
    const membershipsByChar = new Map<string, typeof allMemberships>()
    for (const m of allMemberships) {
      if (!membershipsByChar.has(m.characterId)) membershipsByChar.set(m.characterId, [])
      membershipsByChar.get(m.characterId)!.push(m)
    }

    for (const [charId, memberships] of membershipsByChar) {
      const char = charById.get(charId)
      if (!char) continue
      for (const m of memberships) {
        if (!m.endEventId) continue
        const endOrder = eventOrder(m.endEventId)
        const endEvent = eventById.get(m.endEventId)
        const faction  = factionById.get(m.factionId)
        const hasOtherActive = memberships.some((other) => {
          if (other.id === m.id) return false
          const otherStart = other.startEventId ? eventOrder(other.startEventId) : 0
          const otherEnd   = other.endEventId   ? eventOrder(other.endEventId)   : Infinity
          return otherStart <= endOrder + 1 && otherEnd > endOrder
        })
        if (!hasOtherActive) {
          const endCh = endEvent ? chapById.get(endEvent.chapterId) : undefined
          out.push({
            id: `faction-gap-${charId}-${m.id}`,
            severity: 'warning',
            category: 'faction',
            message: `${char.name} leaves "${faction?.name ?? '?'}" with no replacement faction`,
            detail: `Membership ends at "${endEvent?.title ?? '?'}" (Ch. ${endCh?.number ?? '?'}) — no other faction active from this point.`,
            navigatePath: endEvent ? `/worlds/${worldId}/timeline/${endEvent.chapterId}` : undefined,
            eventId: m.endEventId,
          })
        }
      }
    }

    // ── Hostile faction location check ──────────────────────────────────────
    // Warn when a character is at a location controlled by a faction that is
    // hostile to one of the character's own active factions.

    const hostileRels = allFactionRels.filter((r) => r.stance === 'hostile')

    function areHostile(fA: string, fB: string): boolean {
      return hostileRels.some(
        (r) => (r.factionAId === fA && r.factionBId === fB) ||
               (r.factionAId === fB && r.factionBId === fA)
      )
    }

    for (const snap of snapshots) {
      if (!snap.currentLocationMarkerId) continue
      const marker = markerById.get(snap.currentLocationMarkerId)
      if (!marker?.factionId) continue

      const snapOrder = eventOrder(snap.eventId)
      const charMemberships = membershipsByChar.get(snap.characterId) ?? []
      const activeCharFactionIds = charMemberships
        .filter((m) => {
          const start = m.startEventId ? eventOrder(m.startEventId) : 0
          const end   = m.endEventId   ? eventOrder(m.endEventId)   : Infinity
          return start <= snapOrder && snapOrder < end
        })
        .map((m) => m.factionId)

      for (const charFactionId of activeCharFactionIds) {
        if (!areHostile(charFactionId, marker.factionId)) continue

        const char       = charById.get(snap.characterId)
        const ev         = eventById.get(snap.eventId)
        const ch         = ev ? chapById.get(ev.chapterId) : undefined
        const charFaction = factionById.get(charFactionId)
        const locFaction  = factionById.get(marker.factionId)
        out.push({
          id: `hostile-loc-${snap.characterId}-${snap.eventId}-${charFactionId}`,
          severity: 'warning',
          category: 'faction',
          message: `${char?.name ?? '?'} is at hostile territory in Ch. ${ch?.number ?? '?'}`,
          detail: `"${marker.name}" is controlled by "${locFaction?.name ?? '?'}" — hostile to "${charFaction?.name ?? '?'}"`,
          navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
          eventId: snap.eventId,
        })
      }
    }

    // ── POV checks ──────────────────────────────────────────────────────────────

    // Check 3: POV character not listed in involvedCharacterIds
    for (const ev of allEvents) {
      if (!ev.povCharacterId) continue
      if (!ev.involvedCharacterIds.includes(ev.povCharacterId)) {
        const char = charById.get(ev.povCharacterId)
        const ch = chapById.get(ev.chapterId)
        out.push({
          id: `pov-not-involved-${ev.id}`,
          severity: 'warning',
          category: 'pov',
          message: `POV "${char?.name ?? '?'}" is not in the cast of "${ev.title || 'untitled'}"`,
          detail: `Ch. ${ch?.number ?? '?'} — add them to Characters or clear the POV`,
          navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
          eventId: ev.id,
        })
      }
    }

    // Check 2: POV character dead at that event (non-flashback only)
    for (const ev of allEvents) {
      if (!ev.povCharacterId || ev.isFlashback) continue
      const evOrder = eventOrder(ev.id)
      if (!isDeadAtOrder(ev.povCharacterId, evOrder)) continue
      const char = charById.get(ev.povCharacterId)
      const ch = chapById.get(ev.chapterId)
      out.push({
        id: `dead-pov-${ev.povCharacterId}-${ev.id}`,
        severity: 'warning',
        category: 'pov',
        message: `POV "${char?.name ?? '?'}" is dead at "${ev.title || 'untitled'}"`,
        detail: `Ch. ${ch?.number ?? '?'} — mark event as Flashback if intentional`,
        navigatePath: `/worlds/${worldId}/timeline/${ev.chapterId}`,
        eventId: ev.id,
      })
    }

    // Check 4: 3+ consecutive events with the same POV character (considers only events with POV set)
    const povEvents = allEvents
      .filter((ev) => !!ev.povCharacterId)
      .sort((a, b) => eventOrder(a.id) - eventOrder(b.id))

    let runStart = 0
    while (runStart < povEvents.length) {
      const charId = povEvents[runStart].povCharacterId!
      let runEnd = runStart + 1
      while (runEnd < povEvents.length && povEvents[runEnd].povCharacterId === charId) runEnd++
      const runLen = runEnd - runStart
      if (runLen >= 3) {
        const char = charById.get(charId)
        const firstEv = povEvents[runStart]
        const lastEv  = povEvents[runEnd - 1]
        const firstCh = chapById.get(firstEv.chapterId)
        const lastCh  = chapById.get(lastEv.chapterId)
        out.push({
          id: `pov-consecutive-${charId}-${firstEv.id}`,
          severity: 'warning',
          category: 'pov',
          message: `${char?.name ?? '?'} is POV for ${runLen} consecutive events`,
          detail: `Ch. ${firstCh?.number ?? '?'} → Ch. ${lastCh?.number ?? '?'} — consider alternating perspectives`,
          navigatePath: `/worlds/${worldId}/timeline/${firstEv.chapterId}`,
          eventId: firstEv.id,
        })
      }
      runStart = runEnd
    }

    // ── Anachronistic knowledge: knowing a fact before it becomes true ────────
    for (const a of computeKnowledgeAnachronisms({ facts: knowledgeFacts, reveals: knowledgeReveals, events: allEvents, chapters })) {
      const knownCh  = chapById.get(eventById.get(a.knownAtEventId)?.chapterId ?? '')
      const originCh = chapById.get(eventById.get(a.originEventId)?.chapterId ?? '')
      const who = a.characterId ? (charById.get(a.characterId)?.name ?? 'A character') : 'The reader'
      out.push({
        id: `knowledge-anachronism-${a.fact.id}-${a.characterId ?? 'reader'}-${a.knownAtEventId}`,
        severity: 'warning',
        category: 'character',
        message: `${who} knows "${a.fact.title}" before it happens`,
        detail: `"${a.fact.title}" isn't true until Ch. ${originCh?.number ?? '?'}, but ${who.toLowerCase()} knows it in Ch. ${knownCh?.number ?? '?'}.`,
        navigatePath: `/worlds/${worldId}/timeline/${eventById.get(a.knownAtEventId)?.chapterId ?? ''}`,
        eventId: a.knownAtEventId,
      })
    }

    // ── Dead character learns a fact after dying ─────────────────────────────
    for (const d of computeDeadKnowerIssues({ facts: knowledgeFacts, reveals: knowledgeReveals, snapshots, events: allEvents, chapters })) {
      const char = charById.get(d.characterId)
      const ev = eventById.get(d.revealEventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      out.push({
        id: `dead-knower-${d.fact.id}-${d.characterId}-${d.revealEventId}`,
        severity: 'warning',
        category: 'character',
        message: `${char?.name ?? '?'} learns "${d.fact.title}" after dying`,
        detail: `A reveal places this knowledge with ${char?.name ?? '?'} in Ch. ${ch?.number ?? '?'}, but they're already dead by then. Move the reveal earlier, or mark the event a flashback if intentional.`,
        navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
        eventId: d.revealEventId,
      })
    }

    // ── Prose ↔ metadata drift (scene text vs. the event's cast) ─────────────
    const sceneTextByEvent = new Map(sceneTexts.map((s) => [s.eventId, s.text]))

    for (const p of computeProseMentionIssues({ events: allEvents, chapters, characters, snapshots, sceneTextByEvent })) {
      const ev = eventById.get(p.eventId)
      const ch = ev ? chapById.get(ev.chapterId) : undefined
      if (p.kind === 'dead') {
        out.push({
          id: `prose-dead-${p.characterId}-${p.eventId}`,
          severity: 'warning',
          category: 'prose',
          message: `Dead character ${p.characterName} is named in the prose of "${ev?.title || 'untitled'}"`,
          detail: `Ch. ${ch?.number ?? '?'} — ${p.characterName} is dead at this point. Mark the event as a flashback or update their status if intentional.`,
          navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
          eventId: p.eventId,
        })
      } else {
        out.push({
          id: `prose-untagged-${p.characterId}-${p.eventId}`,
          severity: 'warning',
          category: 'prose',
          message: `${p.characterName} is named in the prose but not in the cast of "${ev?.title || 'untitled'}"`,
          detail: `Ch. ${ch?.number ?? '?'} — appears ${p.count}× in the scene text. Add them to the event or check the reference.`,
          navigatePath: ev ? `/worlds/${worldId}/timeline/${ev.chapterId}` : undefined,
          eventId: p.eventId,
        })
      }
    }

    // ── Reader knowledge leaks (fact referenced in prose before its reveal) ──
    for (const leak of computeKnowledgeLeaks({ facts: knowledgeFacts, events: allEvents, chapters, sceneTextByEvent })) {
      const leakEv = eventById.get(leak.leakEventId)
      const leakCh = leakEv ? chapById.get(leakEv.chapterId) : undefined
      const revealCh = chapById.get(eventById.get(leak.revealEventId)?.chapterId ?? '')
      out.push({
        id: `prose-leak-${leak.fact.id}-${leak.leakEventId}`,
        severity: 'warning',
        category: 'prose',
        message: `Possible early reveal: "${leak.fact.title}"`,
        detail: `The reader is set to learn this in Ch. ${revealCh?.number ?? '?'}, but "${leakEv?.title || 'untitled'}" (Ch. ${leakCh?.number ?? '?'}) already references it (matched "${leak.matchedTerm}").`,
        navigatePath: leakEv ? `/worlds/${worldId}/timeline/${leakEv.chapterId}` : undefined,
        eventId: leak.leakEventId,
      })
    }

    // ── Plot-thread cadence: dangling / dormant / unstarted subplots ─────────
    const chaptersByNumber = [...chapters].sort((a, b) => a.number - b.number)
    for (const ti of computeThreadIssues({ threads: plotThreads, events: allEvents, chapters })) {
      // Send the writer to the chapter where the thread was last (or first) seen.
      const targetChapter = ti.chapterNumber !== null
        ? chaptersByNumber.find((c) => c.number === ti.chapterNumber)
        : undefined
      const firstEvent = targetChapter
        ? allEvents.filter((e) => e.chapterId === targetChapter.id).sort((a, b) => a.sortOrder - b.sortOrder)[0]
        : undefined
      out.push({
        id: `thread-${ti.kind}-${ti.threadId}`,
        severity: 'warning',
        category: 'thread',
        message: ti.message,
        detail: ti.detail,
        navigatePath: targetChapter ? `/worlds/${worldId}/timeline/${targetChapter.id}` : undefined,
        eventId: firstEvent?.id,
      })
    }

    return out
}
