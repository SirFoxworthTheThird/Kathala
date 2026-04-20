import { useMemo } from 'react'
import { useActiveEventId, usePlaybackTimelineId, useActiveDepthTimelineId, useActiveOuterEventId } from '@/store'
import { useMapLayer, useMapLayers } from '@/db/hooks/useMapLayers'
import { useChapters, useTimelines, useWorldEvents } from '@/db/hooks/useTimeline'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { useLocationMarkers, useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useBestSnapshots } from '@/db/hooks/useSnapshots'
import { useEventMovements } from '@/db/hooks/useMovements'
import { useEventItemPlacements } from '@/db/hooks/useItemPlacements'
import { useChapterLocationSnapshots } from '@/db/hooks/useLocationSnapshots'
import { useEchoLocations } from '@/lib/useEchoLocations'
import { useBlobUrl, useWorldBlobUrls } from '@/db/hooks/useBlobs'
import { useMapRoutes } from '@/db/hooks/useMapRoutes'
import { useMapRegions, useBestRegionSnapshots } from '@/db/hooks/useMapRegions'
import type { CharacterPin, GhostPin, EchoMarker, MovementLine } from './LeafletMapCanvas'
import { characterColor, resolveCharacterPin } from './mapUtils'
import { pathPixelLength, formatDistance } from '@/lib/mapScale'
import type { MapRegionStatus } from '@/types'

// ── useMapViewState ───────────────────────────────────────────────────────────
// Centralises all data-fetching hooks and derived memos for MapView.
// No local UI state lives here — just DB queries and computed read-only values.

export function useMapViewState(worldId: string, layerId: string) {
  const layer          = useMapLayer(layerId)
  const imageUrl       = useBlobUrl(layer?.imageId ?? null)
  const markers        = useLocationMarkers(layerId)
  const allLayers      = useMapLayers(worldId)
  const allMarkers     = useAllLocationMarkers(worldId)
  const characters     = useCharacters(worldId)
  const activeEventId  = useActiveEventId()
  const timelines      = useTimelines(worldId)
  const relationships  = useTimelineRelationships(worldId)
  const playbackTimelineId     = usePlaybackTimelineId()
  const activeDepthTimelineId  = useActiveDepthTimelineId()
  const activeOuterEventId     = useActiveOuterEventId()
  const effectiveTimelineId    = playbackTimelineId ?? timelines[0]?.id ?? null
  const chapters               = useChapters(effectiveTimelineId)
  const allWorldEvents         = useWorldEvents(worldId)

  // ── Frame narrative context ────────────────────────────────────────────────
  const frameRel = useMemo(() => {
    const tlIds = new Set(timelines.map((t) => t.id))
    return relationships.find(
      (r) => r.type === 'frame_narrative' && tlIds.has(r.sourceTimelineId) && tlIds.has(r.targetTimelineId)
    ) ?? null
  }, [relationships, timelines])
  const outerTimelineId = frameRel?.sourceTimelineId ?? null
  const innerTimelineId = frameRel?.targetTimelineId ?? null
  const isInnerActive   = !!(frameRel && activeDepthTimelineId === innerTimelineId)

  // ── Ordered events for playback ────────────────────────────────────────────
  const orderedEvents = useMemo(() => {
    const chapNumById = new Map(chapters.map((c) => [c.id, c.number]))
    return [...allWorldEvents]
      .filter((e) => chapNumById.has(e.chapterId))
      .sort((a, b) => {
        const aN = (chapNumById.get(a.chapterId) ?? 0) * 10_000 + a.sortOrder
        const bN = (chapNumById.get(b.chapterId) ?? 0) * 10_000 + b.sortOrder
        return aN - bN
      })
  }, [allWorldEvents, chapters])

  const activeTimelineEventIds = useMemo(
    () => orderedEvents.length > 0 ? new Set(orderedEvents.map((e) => e.id)) : undefined,
    [orderedEvents]
  )

  // ── Snapshot queries ───────────────────────────────────────────────────────
  const snapshots       = useBestSnapshots(worldId, activeEventId, activeTimelineEventIds)
  const blobUrls        = useWorldBlobUrls(worldId)
  const movements       = useEventMovements(worldId, activeEventId)
  const chapterPlacements = useEventItemPlacements(activeEventId)
  const chapterLocSnaps   = useChapterLocationSnapshots(activeEventId)

  // ── Map routes and regions ─────────────────────────────────────────────────
  const mapRoutes = useMapRoutes(layerId)
  const mapRegions = useMapRegions(layerId)
  const regionSnaps = useBestRegionSnapshots(worldId, activeEventId)
  const regionStatusMap = useMemo(
    () => new Map<string, MapRegionStatus>(regionSnaps.map((s) => [s.regionId, s.status])),
    [regionSnaps]
  )

  // ── Derived event context ──────────────────────────────────────────────────
  const activeEvent        = activeEventId ? allWorldEvents.find((e) => e.id === activeEventId) ?? null : null
  const activeChapter      = activeEvent ? chapters.find((c) => c.id === activeEvent.chapterId) ?? null : null
  const activeChapterTitle = activeChapter ? `Ch.${activeChapter.number} — ${activeChapter.title}` : null
  const activeEventIdx     = activeEventId ? orderedEvents.findIndex((e) => e.id === activeEventId) : -1
  const prevEventId        = activeEventIdx > 0 ? orderedEvents[activeEventIdx - 1].id : null

  const prevSnapshots = useBestSnapshots(worldId, prevEventId, activeTimelineEventIds)

  const prevChapter = activeChapter
    ? chapters.find((c) => c.timelineId === activeChapter.timelineId && c.number === activeChapter.number - 1)
    : null
  const prevChapterEvents = useMemo(
    () => prevChapter
      ? allWorldEvents.filter((e) => e.chapterId === prevChapter.id).sort((a, b) => b.sortOrder - a.sortOrder)
      : [],
    [allWorldEvents, prevChapter?.id], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const prevChapterLastEventId = prevChapterEvents[0]?.id ?? null
  const prevChapterSnapshots = useBestSnapshots(worldId, prevChapterLastEventId, activeTimelineEventIds)

  // ── Ghost pins (frame narrative outer characters) ──────────────────────────
  const outerChaptersForGhost = useChapters(isInnerActive ? outerTimelineId : null)
  const outerTimelineEventIds = useMemo(() => {
    if (!isInnerActive || outerChaptersForGhost.length === 0) return undefined
    const chapIds = new Set(outerChaptersForGhost.map((c) => c.id))
    return new Set(allWorldEvents.filter((e) => chapIds.has(e.chapterId)).map((e) => e.id))
  }, [isInnerActive, outerChaptersForGhost, allWorldEvents])
  const outerSnapshots = useBestSnapshots(worldId, activeOuterEventId ?? null, outerTimelineEventIds)
  const outerTimeline  = useMemo(
    () => timelines.find((t) => t.id === outerTimelineId) ?? null,
    [timelines, outerTimelineId]
  )
  const outerActiveEvent = useMemo(
    () => (activeOuterEventId ? allWorldEvents.find((e) => e.id === activeOuterEventId) ?? null : null),
    [allWorldEvents, activeOuterEventId]
  )
  const ghostPins = useMemo<GhostPin[]>(() => {
    if (!isInnerActive || !outerTimeline) return []
    const pins: GhostPin[] = []
    for (const snap of outerSnapshots) {
      const char = characters.find((c) => c.id === snap.characterId)
      if (!char) continue
      const pin = resolveCharacterPin(snap, layerId, allLayers, allMarkers)
      if (!pin) continue
      pins.push({
        characterId: char.id,
        name: char.name,
        color: char.color ?? '#888',
        portraitUrl: char.portraitImageId ? blobUrls.get(char.portraitImageId) ?? null : null,
        x: pin.x,
        y: pin.y,
        outerTimelineName: outerTimeline.name,
        outerEventTitle: outerActiveEvent?.title ?? '',
      })
    }
    return pins
  }, [isInnerActive, outerTimeline, outerSnapshots, characters, layerId, allLayers, allMarkers, blobUrls, outerActiveEvent]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Echo rings (historical echo) ──────────────────────────────────────────
  const echoLocations = useEchoLocations(effectiveTimelineId, worldId)
  const echoMarkers = useMemo<EchoMarker[]>(() => {
    const result: EchoMarker[] = []
    for (const [markerId, info] of echoLocations) {
      const marker = allMarkers.find((m) => m.id === markerId)
      if (!marker || marker.mapLayerId !== layerId) continue
      result.push({
        markerId,
        x: marker.x,
        y: marker.y,
        counterpartTimelineName: info.counterpartTimelineName,
        eventCount: info.events.length,
      })
    }
    return result
  }, [echoLocations, allMarkers, layerId])

  // ── Character pins ────────────────────────────────────────────────────────
  const charPins = useMemo<CharacterPin[]>(() => {
    const pins: CharacterPin[] = []
    for (const snap of snapshots) {
      const char = characters.find((c) => c.id === snap.characterId)
      if (!char) continue
      const pin = resolveCharacterPin(snap, layerId, allLayers, allMarkers)
      if (pin) pins.push({
        ...pin,
        character: char,
        portraitUrl: char.portraitImageId ? blobUrls.get(char.portraitImageId) ?? null : null,
        locationName: snap.currentLocationMarkerId
          ? allMarkers.find((m) => m.id === snap.currentLocationMarkerId)?.name ?? null
          : null,
      })
    }
    return pins
  }, [snapshots, characters, layerId, allLayers, allMarkers, blobUrls]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Route marker position lookup ──────────────────────────────────────────
  const routeMarkerPositions = useMemo(() => {
    const map = new Map<string, [number, number]>()
    for (const m of allMarkers) {
      if (Number.isFinite(m.x) && Number.isFinite(m.y)) {
        map.set(m.id, [m.y, m.x])
      }
    }
    return map
  }, [allMarkers])

  // ── Location status map ───────────────────────────────────────────────────
  const locationStatusMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const snap of chapterLocSnaps) map[snap.locationMarkerId] = snap.status
    return map
  }, [chapterLocSnaps])

  // ── Movement lines (in-chapter waypoints + inter-chapter travel) ──────────
  const movementLines = useMemo<MovementLine[]>(() => {
    const lines: MovementLine[] = []

    // In-chapter waypoint lines
    for (const mov of movements) {
      const resolvedPoints: [number, number][] = []
      for (const wId of mov.waypoints) {
        const m = allMarkers.find((mk) => mk.id === wId && mk.mapLayerId === layerId)
        if (m) resolvedPoints.push([m.y, m.x])
      }
      for (let i = 0; i < resolvedPoints.length - 1; i++) {
        const segPoints: [number, number][] = [resolvedPoints[i], resolvedPoints[i + 1]]
        const distanceLabel = layer?.scalePixelsPerUnit && layer.scaleUnit
          ? formatDistance(pathPixelLength(segPoints.map(([y, x]) => [x, y])), layer.scalePixelsPerUnit, layer.scaleUnit)
          : undefined
        lines.push({
          id: `${mov.characterId}-seg-${i}`,
          characterId: mov.characterId,
          color: characterColor(mov.characterId),
          points: segPoints,
          distanceLabel,
          style: 'waypoint',
        })
      }
    }

    // Inter-chapter travel lines (previous chapter → current)
    if (prevChapterSnapshots.length > 0) {
      for (const snap of snapshots) {
        if (!snap.currentLocationMarkerId || snap.currentMapLayerId !== layerId) continue
        const prev = prevChapterSnapshots.find((s) => s.characterId === snap.characterId)
        if (!prev?.currentLocationMarkerId || prev.currentLocationMarkerId === snap.currentLocationMarkerId) continue
        if (prev.currentMapLayerId !== layerId) continue
        const fromMarker = markers.find((m) => m.id === prev.currentLocationMarkerId)
        const toMarker = markers.find((m) => m.id === snap.currentLocationMarkerId)
        if (!fromMarker || !toMarker) continue
        const travelPoints: [number, number][] = [[fromMarker.y, fromMarker.x], [toMarker.y, toMarker.x]]
        const travelDistanceLabel = layer?.scalePixelsPerUnit && layer.scaleUnit
          ? formatDistance(pathPixelLength(travelPoints.map(([y, x]) => [x, y])), layer.scalePixelsPerUnit, layer.scaleUnit)
          : undefined
        lines.push({
          characterId: `travel-${snap.characterId}`,
          color: characterColor(snap.characterId),
          points: travelPoints,
          distanceLabel: travelDistanceLabel,
          style: 'travel',
        })
      }
    }

    return lines
  }, [movements, snapshots, prevChapterSnapshots, allMarkers, markers, layerId, layer])

  return {
    // Map layer
    layer, imageUrl,
    // Markers
    markers, allLayers, allMarkers,
    // Characters
    characters, blobUrls,
    // Event/chapter context
    activeEventId, orderedEvents, activeTimelineEventIds,
    activeEvent, activeChapter, activeChapterTitle,
    prevEventId,
    // Snapshots
    snapshots, prevSnapshots, prevChapterSnapshots,
    // Interactions
    movements, chapterPlacements,
    // Timelines
    timelines, chapters, frameRel, effectiveTimelineId,
    // Routes & regions
    mapRoutes, mapRegions, regionStatusMap,
    routeMarkerPositions,
    // Location status
    locationStatusMap,
    // Pins & overlays
    charPins, ghostPins, echoMarkers, echoLocations,
    // Lines
    movementLines,
    // orderedEvents also used for journey lines in MapView
  }
}
