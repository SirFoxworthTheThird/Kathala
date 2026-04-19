import { useState, useRef, useEffect, useMemo } from 'react'
import L from 'leaflet'
import { useParams } from 'react-router-dom'
import { Plus, Upload, Map as MapIcon, Ruler, X, Route, Download } from 'lucide-react'
import { useAppStore, useActiveMapLayerId, useActiveEventId, usePlaybackTimelineId, useActiveDepthTimelineId, useActiveOuterEventId } from '@/store'
import { useRootMapLayers, useMapLayer, useMapLayers, updateMapLayer } from '@/db/hooks/useMapLayers'
import { useChapters, useTimelines, useWorldEvents } from '@/db/hooks/useTimeline'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { useLocationMarkers, useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useBestSnapshots, useWorldSnapshots, upsertSnapshot, fetchSnapshot } from '@/db/hooks/useSnapshots'
import { useEventMovements, appendWaypoint } from '@/db/hooks/useMovements'
import { useEventItemPlacements } from '@/db/hooks/useItemPlacements'
import { useChapterLocationSnapshots } from '@/db/hooks/useLocationSnapshots'
import type { CharacterPin, MovementLine, JourneyLine, PinAnimation, ScaleCalibrationPoint, MeasureLine, GhostPin, EchoMarker } from './LeafletMapCanvas'
import { useEchoLocations } from '@/lib/useEchoLocations'
import { useBlobUrl, useWorldBlobUrls } from '@/db/hooks/useBlobs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { LeafletMapCanvas } from './LeafletMapCanvas'
import { LocationDetailPanel } from './LocationDetailPanel'
import { CharacterSnapshotPanel } from './CharacterSnapshotPanel'
import { UploadMapDialog } from './UploadMapDialog'
import { AddLocationDialog } from './AddLocationDialog'
import { StoryNotesOverlay } from './StoryNotesOverlay'
import type { LocationMarker } from '@/types'
import { pixelDist, pathPixelLength, formatDistance } from '@/lib/mapScale'
import { PIN_TRAVEL_MS, type PlaybackStep, buildSequentialQueue, characterColor, resolveCharacterPin } from './mapUtils'
import { MapFilterBar, DEFAULT_MAP_FILTERS } from './MapFilterBar'
import type { MapFilters } from './MapFilterBar'
import { SetScaleDialog } from './SetScaleDialog'
import { LayersSection, CharactersSection, LocationsSection, ItemsSection, RoutesSection, RegionsSection } from './MapSidebar'
import { CharacterFilmStrip } from './CharacterFilmStrip'
import { RouteDrawHud, RegionDrawHud } from './DrawHuds'
import { useMapRoutes } from '@/db/hooks/useMapRoutes'
import { useMapRegions, useBestRegionSnapshots } from '@/db/hooks/useMapRegions'
import type { MapRegionStatus } from '@/types'

// ─── MapView ──────────────────────────────────────────────────────────────────

function MapView({ worldId, layerId }: { worldId: string; layerId: string }) {
  const layer = useMapLayer(layerId)
  const imageUrl = useBlobUrl(layer?.imageId ?? null)
  const markers = useLocationMarkers(layerId)
  const allLayers = useMapLayers(worldId)
  const allMarkers = useAllLocationMarkers(worldId)
  const characters = useCharacters(worldId)
  const activeEventId = useActiveEventId()
  const timelines = useTimelines(worldId)
  const relationships = useTimelineRelationships(worldId)
  const playbackTimelineId = usePlaybackTimelineId()
  const activeDepthTimelineId = useActiveDepthTimelineId()
  const activeOuterEventId = useActiveOuterEventId()
  const effectiveTimelineId = playbackTimelineId ?? timelines[0]?.id ?? null
  const chapters = useChapters(effectiveTimelineId)
  const allWorldEvents = useWorldEvents(worldId)

  // Frame narrative context — determines whether ghost pins should be shown
  const frameRel = useMemo(() => {
    const tlIds = new Set(timelines.map((t) => t.id))
    return relationships.find(
      (r) => r.type === 'frame_narrative' && tlIds.has(r.sourceTimelineId) && tlIds.has(r.targetTimelineId)
    ) ?? null
  }, [relationships, timelines])
  const outerTimelineId = frameRel?.sourceTimelineId ?? null
  const innerTimelineId = frameRel?.targetTimelineId ?? null
  const isInnerActive = !!(frameRel && activeDepthTimelineId === innerTimelineId)

  // Ordered events for the active timeline — used to find the previous event for playback
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

  // Restrict snapshot resolution to events belonging to the active timeline only,
  // preventing characters from other timelines bleeding into this view.
  const activeTimelineEventIds = useMemo(() => {
    return orderedEvents.length > 0 ? new Set(orderedEvents.map((e) => e.id)) : undefined
  }, [orderedEvents])

  const snapshots = useBestSnapshots(worldId, activeEventId, activeTimelineEventIds)
  const blobUrls = useWorldBlobUrls(worldId)
  const movements = useEventMovements(worldId, activeEventId)
  const chapterPlacements = useEventItemPlacements(activeEventId)
  const chapterLocSnaps = useChapterLocationSnapshots(activeEventId)

  const mapRoutes = useMapRoutes(layerId)
  const mapRegions = useMapRegions(layerId)
  const regionSnaps = useBestRegionSnapshots(worldId, activeEventId)
  const regionStatusMap = useMemo(
    () => new Map<string, MapRegionStatus>(regionSnaps.map((s) => [s.regionId, s.status])),
    [regionSnaps]
  )

  const [isDraggingCharacter, setIsDraggingCharacter] = useState(false)
  const crossLayerPanTargetRef = useRef<[number, number] | null>(null)
  const pinAnimationKeyRef  = useRef(0)
  const [playbackQueue, setPlaybackQueue]     = useState<PlaybackStep[]>([])
  const [playbackStepIdx, setPlaybackStepIdx] = useState(0)
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null)
  const [addLocationOpen, setAddLocationOpen] = useState(false)
  const [pendingDropCharacterId, setPendingDropCharacterId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [scaleMode, setScaleMode] = useState(false)
  const [scaleDialog, setScaleDialog] = useState<{ pixelDist: number } | null>(null)
  const [measureMode, setMeasureMode] = useState(false)
  const [measureResult, setMeasureResult] = useState<{ distPx: number; p1: ScaleCalibrationPoint; p2: ScaleCalibrationPoint } | null>(null)
  const [mapFilters, setMapFilters] = useState<MapFilters>(DEFAULT_MAP_FILTERS)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [drawingRoute, setDrawingRoute] = useState(false)
  const [routeWaypoints, setRouteWaypoints] = useState<Array<string | { x: number; y: number }>>([])
  const [drawingRegion, setDrawingRegion] = useState(false)
  const [regionVertices, setRegionVertices] = useState<Array<{ x: number; y: number }>>([])
  const { setSelectedLocationMarkerId, selectedLocationMarkerId, pushMapLayer, setActiveMapLayerId, isPlayingStory, playbackSpeed } = useAppStore()
  const mapRef = useRef<L.Map | null>(null)

  async function handleExportMap() {
    const mapEl = document.querySelector('.leaflet-container') as HTMLElement | null
    if (!mapEl) return
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(mapEl, { useCORS: true, allowTaint: true, logging: false })
    const link = document.createElement('a')
    link.download = `${layer?.name ?? 'map'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function handleScalePoints(p1: ScaleCalibrationPoint, p2: ScaleCalibrationPoint) {
    const dist = pixelDist(p1.x, p1.y, p2.x, p2.y)
    setScaleMode(false)
    setScaleDialog({ pixelDist: dist })
  }

  function handleMeasurePoints(p1: ScaleCalibrationPoint, p2: ScaleCalibrationPoint) {
    const dist = pixelDist(p1.x, p1.y, p2.x, p2.y)
    setMeasureMode(false)
    setMeasureResult({ distPx: dist, p1, p2 })
  }

  function focusOnLocation(marker: LocationMarker) {
    setSelectedCharacterId(null)
    setSelectedLocationMarkerId(marker.id)
    mapRef.current?.panTo([marker.y, marker.x])
  }

  function focusOnRoute(routeId: string) {
    const route = mapRoutes.find((r) => r.id === routeId)
    if (!route) return
    const pts = route.waypoints
      .map((wp) => typeof wp === 'string' ? routeMarkerPositions.get(wp) : [wp.y, wp.x] as [number, number])
      .filter((pt): pt is [number, number] => pt != null && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))
    if (pts.length === 0) return
    if (pts.length === 1) { mapRef.current?.panTo(pts[0]); return }
    const lats = pts.map((p) => p[0])
    const lngs = pts.map((p) => p[1])
    mapRef.current?.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [48, 48], maxZoom: mapRef.current.getZoom() }
    )
  }

  function focusOnRegion(regionId: string) {
    const region = mapRegions.find((r) => r.id === regionId)
    if (!region || region.vertices.length === 0) return
    const lats = region.vertices.map((v) => v.y)
    const lngs = region.vertices.map((v) => v.x)
    mapRef.current?.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [48, 48], maxZoom: mapRef.current.getZoom() }
    )
  }

  function focusOnCharacter(characterId: string) {
    const pin = charPins.find((p) => p.character.id === characterId)
    setSelectedLocationMarkerId(null)
    setSelectedCharacterId(characterId)

    if (pin && !pin.inSubMap) {
      // Character is directly on this layer — just pan
      mapRef.current?.panTo([pin.y, pin.x])
      return
    }

    // Navigate to the layer the character is actually on.
    // Pass the target position as initialCenter so FitBounds applies it
    // synchronously after fitting — no setTimeout race condition.
    const snap = snapshots.find((s) => s.characterId === characterId)
    if (!snap?.currentMapLayerId) return

    const targetMarker = allMarkers.find((m) => m.id === snap.currentLocationMarkerId)
    if (targetMarker) {
      crossLayerPanTargetRef.current = [targetMarker.y, targetMarker.x]
    }
    pushMapLayer(snap.currentMapLayerId)
  }

  function focusOnItem(itemId: string) {
    // Check if item is in a character's inventory
    const snap = snapshots.find((s) => s.inventoryItemIds.includes(itemId))
    if (snap) { focusOnCharacter(snap.characterId); return }
    // Check if item is placed at a location
    const placement = chapterPlacements.find((p) => p.itemId === itemId)
    if (placement) {
      const marker = allMarkers.find((m) => m.id === placement.locationMarkerId)
      if (marker) focusOnLocation(marker)
    }
  }

  // Listen for map-focus requests dispatched from the chapter timeline bar
  useEffect(() => {
    function handler(e: Event) {
      const markerId = (e as CustomEvent<{ markerId: string }>).detail.markerId
      const marker = allMarkers.find((m) => m.id === markerId)
      if (marker) focusOnLocation(marker)
    }
    window.addEventListener('wb:map:focusMarker', handler)
    return () => window.removeEventListener('wb:map:focusMarker', handler)
  }, [allMarkers]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derive active chapter from the active event's chapterId
  const activeEvent   = activeEventId ? allWorldEvents.find((e) => e.id === activeEventId) ?? null : null
  const activeChapter = activeEvent ? chapters.find((c) => c.id === activeEvent.chapterId) ?? null : null
  const activeChapterTitle = activeChapter ? `Ch.${activeChapter.number} — ${activeChapter.title}` : null

  const activeEventIdx = activeEventId ? orderedEvents.findIndex((e) => e.id === activeEventId) : -1
  const prevEventId = activeEventIdx > 0 ? orderedEvents[activeEventIdx - 1].id : null

  // Previous event snapshots (last-known state at the previous event — used for playback animation)
  const prevSnapshots = useBestSnapshots(worldId, prevEventId, activeTimelineEventIds)

  // Previous chapter (for travel-line display — still chapter-based)
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

  // ── Ghost pins (frame narrative) ─────────────────────────────────────────
  // When the inner track is active, show outer-timeline characters as dimmed
  // ghost pins at their position as of the active outer event.
  const outerChaptersForGhost = useChapters(isInnerActive ? outerTimelineId : null)
  const outerTimelineEventIds = useMemo(() => {
    if (!isInnerActive || outerChaptersForGhost.length === 0) return undefined
    const chapIds = new Set(outerChaptersForGhost.map((c) => c.id))
    return new Set(allWorldEvents.filter((e) => chapIds.has(e.chapterId)).map((e) => e.id))
  }, [isInnerActive, outerChaptersForGhost, allWorldEvents])
  const outerSnapshots = useBestSnapshots(worldId, activeOuterEventId ?? null, outerTimelineEventIds)
  const outerTimeline = useMemo(
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

  // ── Echo rings (historical echo) ─────────────────────────────────────────
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

  const [echoPopoverMarkerId, setEchoPopoverMarkerId] = useState<string | null>(null)
  const echoPopoverInfo = echoPopoverMarkerId ? echoLocations.get(echoPopoverMarkerId) ?? null : null
  const echoPopoverMarker = echoPopoverMarkerId ? allMarkers.find((m) => m.id === echoPopoverMarkerId) ?? null : null

  function handleMarkerClick(markerId: string) {
    if (drawingRoute) {
      setRouteWaypoints((prev) => {
        const last = prev[prev.length - 1]
        if (last === markerId) return prev
        return [...prev, markerId]
      })
      return
    }
    setSelectedCharacterId(null)
    setSelectedLocationMarkerId(markerId)
  }

  function handleCharacterClick(characterId: string) {
    setSelectedLocationMarkerId(null)
    setSelectedCharacterId((prev) => prev === characterId ? null : characterId)
  }

  // Resolve character pins for the current chapter.
  // Memoised so that Zustand store updates (e.g. isAnimating toggling) don't produce
  // a new array reference and restart the LeafletMapCanvas animation effect.
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

  // ── Playback sequential animation queue ────────────────────────────────────
  // When the active event advances during playback, build a sequential per-character
  // animation queue. Each step animates one character at a time and follows their
  // drawn trail; cross-layer moves generate two steps (departure + arrival).
  useEffect(() => {
    if (!isPlayingStory || !activeEventId) {
      setPlaybackQueue([])
      setPlaybackStepIdx(0)
      return
    }
    if (prevSnapshots.length === 0 && snapshots.length === 0) return

    const queue = buildSequentialQueue(
      prevSnapshots, snapshots, allMarkers, movements,
      PIN_TRAVEL_MS[playbackSpeed], pinAnimationKeyRef, mapRoutes,
    )
    setPlaybackQueue(queue)
    setPlaybackStepIdx(0)

    // Navigate immediately to the first map in the queue (if different from current)
    if (queue.length > 0 && queue[0].mapLayerId !== layerId) {
      setActiveMapLayerId(queue[0].mapLayerId)
    }
  }, [activeEventId, isPlayingStory]) // eslint-disable-line react-hooks/exhaustive-deps

  // When the step index advances, navigate to that step's map layer
  useEffect(() => {
    if (playbackQueue.length === 0) return
    const step = playbackQueue[playbackStepIdx]
    if (step && step.mapLayerId !== layerId) {
      setActiveMapLayerId(step.mapLayerId)
    }
  }, [playbackStepIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the cross-layer pan target once the new layer has mounted and consumed it
  useEffect(() => {
    crossLayerPanTargetRef.current = null
  }, [layerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derive the active pin animation: only animate if we're on the right map for this step
  const currentStep = playbackQueue[playbackStepIdx] ?? null
  const pinAnimation: PinAnimation | null =
    currentStep && currentStep.mapLayerId === layerId ? currentStep.pinAnimation : null

  function handlePlaybackAnimationEnd() {
    setPlaybackStepIdx((i) => i + 1)
  }

  // Build in-chapter waypoint lines — one segment per consecutive waypoint pair
  const movementLines: MovementLine[] = []
  for (const mov of movements) {
    const resolvedPoints: [number, number][] = []
    for (const wId of mov.waypoints) {
      const m = allMarkers.find((mk) => mk.id === wId && mk.mapLayerId === layerId)
      if (m) resolvedPoints.push([m.y, m.x])
    }
    for (let i = 0; i < resolvedPoints.length - 1; i++) {
      const segPoints: [number, number][] = [resolvedPoints[i], resolvedPoints[i + 1]]
      const distanceLabel = layer && layer.scalePixelsPerUnit && layer.scaleUnit
        ? formatDistance(pathPixelLength(segPoints.map(([y, x]) => [x, y])), layer.scalePixelsPerUnit, layer.scaleUnit)
        : undefined
      movementLines.push({
        id: `${mov.characterId}-seg-${i}`,
        characterId: mov.characterId,
        color: characterColor(mov.characterId),
        points: segPoints,
        distanceLabel,
        style: 'waypoint',
      })
    }
  }

  // Build inter-chapter travel lines (previous chapter location → current chapter location)
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
      const travelDistanceLabel = layer && layer.scalePixelsPerUnit && layer.scaleUnit
        ? formatDistance(pathPixelLength(travelPoints.map(([y, x]) => [x, y])), layer.scalePixelsPerUnit, layer.scaleUnit)
        : undefined
      movementLines.push({
        characterId: `travel-${snap.characterId}`,
        color: characterColor(snap.characterId),
        points: travelPoints,
        distanceLabel: travelDistanceLabel,
        style: 'travel',
      })
    }
  }

  async function placeCharacterAtMarker(characterId: string, marker: LocationMarker) {
    if (!activeEventId) return
    // Read from DB directly to avoid stale React state
    const existingInDb = await fetchSnapshot(characterId, activeEventId)
    const fromMarkerId = existingInDb?.currentLocationMarkerId
    // Use last-known snapshot (already resolved by useBestSnapshots) for non-location fields
    const existing = snapshots.find((s) => s.characterId === characterId)
    await upsertSnapshot({
      worldId,
      characterId,
      eventId: activeEventId,
      isAlive: existingInDb?.isAlive ?? existing?.isAlive ?? true,
      currentLocationMarkerId: marker.id,
      currentMapLayerId: marker.mapLayerId,
      inventoryItemIds: existingInDb?.inventoryItemIds ?? existing?.inventoryItemIds ?? [],
      inventoryNotes: existingInDb?.inventoryNotes ?? existing?.inventoryNotes ?? '',
      statusNotes: existingInDb?.statusNotes ?? existing?.statusNotes ?? '',
      travelModeId: existingInDb?.travelModeId ?? existing?.travelModeId ?? null,
    })
    await appendWaypoint(worldId, characterId, activeEventId, marker.id, fromMarkerId ?? undefined)
  }

  async function handleCharacterDrop(characterId: string, markerId: string) {
    const targetMarker = markers.find((m) => m.id === markerId)
    if (!targetMarker) return
    await placeCharacterAtMarker(characterId, targetMarker)
  }

  // Build markerId → status map for the active chapter
  const locationStatusMap: Record<string, string> = {}
  for (const snap of chapterLocSnaps) {
    locationStatusMap[snap.locationMarkerId] = snap.status
  }

  // Route marker position lookup: markerId → [lat, lng]
  const routeMarkerPositions = useMemo(() => {
    const map = new Map<string, [number, number]>()
    for (const m of allMarkers) {
      if (Number.isFinite(m.x) && Number.isFinite(m.y)) {
        map.set(m.id, [m.y, m.x])
      }
    }
    return map
  }, [allMarkers])

  // Apply map filters
  const visibleCharIds = mapFilters.characterIds.size > 0 ? mapFilters.characterIds : null

  // Full journey trails — all-chapter paths per character
  const allWorldSnaps = useWorldSnapshots(mapFilters.showJourneys ? worldId : null)
  const journeyLines = useMemo<JourneyLine[]>(() => {
    if (!mapFilters.showJourneys || allWorldSnaps.length === 0) return []
    // Build event→index map for ordering
    const eventOrderMap = new Map<string, number>()
    for (let i = 0; i < orderedEvents.length; i++) {
      eventOrderMap.set(orderedEvents[i].id, i)
    }
    // Group snapshots by character, only those on the current layer
    const byChar = new Map<string, typeof allWorldSnaps>()
    for (const snap of allWorldSnaps) {
      if (!snap.currentLocationMarkerId || snap.currentMapLayerId !== layerId) continue
      if (!eventOrderMap.has(snap.eventId)) continue
      const arr = byChar.get(snap.characterId) ?? []
      arr.push(snap)
      byChar.set(snap.characterId, arr)
    }
    const lines: JourneyLine[] = []
    for (const [charId, snaps] of byChar) {
      const char = characters.find((c) => c.id === charId)
      if (!char) continue
      if (visibleCharIds && !visibleCharIds.has(charId)) continue
      const sorted = [...snaps].sort((a, b) => (eventOrderMap.get(a.eventId) ?? 0) - (eventOrderMap.get(b.eventId) ?? 0))
      const points: [number, number][] = []
      let lastMarkerId: string | null = null
      for (const snap of sorted) {
        if (!snap.currentLocationMarkerId || snap.currentLocationMarkerId === lastMarkerId) continue
        const m = allMarkers.find((mk) => mk.id === snap.currentLocationMarkerId)
        if (!m) continue
        points.push([m.y, m.x])
        lastMarkerId = snap.currentLocationMarkerId
      }
      if (points.length >= 2) {
        lines.push({ characterId: charId, color: characterColor(charId), points })
      }
    }
    return lines
  }, [mapFilters.showJourneys, allWorldSnaps, orderedEvents, layerId, characters, allMarkers, visibleCharIds]) // eslint-disable-line react-hooks/exhaustive-deps
  const displayedCharPins = !mapFilters.showCharacters ? []
    : visibleCharIds ? charPins.filter((p) => visibleCharIds.has(p.character.id))
    : charPins
  const displayedMovementLines = !mapFilters.showTrails ? []
    : visibleCharIds ? movementLines.filter((l) => visibleCharIds.has(l.characterId) || visibleCharIds.has(l.characterId.replace(/^travel-/, '')))
    : movementLines
  const displayedMarkers = !mapFilters.showLocations ? []
    : mapFilters.locationTypes.size > 0 ? markers.filter((m) => mapFilters.locationTypes.has(m.iconType))
    : markers

  if (!layer || !imageUrl) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-[hsl(var(--ring))]" />
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left sidebar ── */}
      <div className="flex w-52 shrink-0 flex-col overflow-y-auto border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <LayersSection worldId={worldId} />
        <CharactersSection
          characters={characters}
          snapshots={snapshots}
          allMarkers={allMarkers}
          activeEventId={activeEventId}
          worldId={worldId}
          scalePixelsPerUnit={layer.scalePixelsPerUnit ?? null}
          scaleUnit={layer.scaleUnit ?? null}
          onDragStart={() => setIsDraggingCharacter(true)}
          onDragEnd={() => setIsDraggingCharacter(false)}
          onFocus={focusOnCharacter}
        />
        <LocationsSection
          markers={markers}
          selectedId={selectedLocationMarkerId}
          onSelect={setSelectedLocationMarkerId}
          onFocus={focusOnLocation}
        />
        <ItemsSection
          worldId={worldId}
          activeEventId={activeEventId}
          allMarkers={allMarkers}
          snapshots={snapshots}
          onFocus={focusOnItem}
        />
        <RoutesSection
          mapLayerId={layerId}
          worldId={worldId}
          selectedRouteId={selectedRouteId}
          onSelectRoute={(id) => {
            setSelectedRouteId((prev) => (prev === id ? null : id))
            if (id) focusOnRoute(id)
          }}
          drawingRoute={drawingRoute}
          onStartDraw={() => { setDrawingRoute(true); setRouteWaypoints([]) }}
          onCancelDraw={() => { setDrawingRoute(false); setRouteWaypoints([]) }}
        />
        <RegionsSection
          mapLayerId={layerId}
          worldId={worldId}
          activeEventId={activeEventId}
          selectedRegionId={selectedRegionId}
          onSelectRegion={(id) => {
            setSelectedRegionId((prev) => (prev === id ? null : id))
            if (id) focusOnRegion(id)
          }}
          drawingRegion={drawingRegion}
          onStartDraw={() => { setDrawingRegion(true); setRegionVertices([]) }}
          onCancelDraw={() => { setDrawingRegion(false); setRegionVertices([]) }}
        />
      </div>

      {/* ── Center: header + map ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Map header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{layer.name}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {layer.scalePixelsPerUnit && layer.scaleUnit
                ? `Scale: 1 ${layer.scaleUnit} = ${Math.round(layer.scalePixelsPerUnit)} px`
                : `${layer.imageWidth} × ${layer.imageHeight}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={scaleMode ? 'default' : 'outline'}
              className="gap-1.5 text-xs"
              onClick={() => { setScaleMode((v) => !v); setMeasureMode(false); setMeasureResult(null) }}
              title={layer.scalePixelsPerUnit ? 'Recalibrate scale' : 'Set map scale'}
            >
              <Ruler className="h-3.5 w-3.5" />
              {layer.scalePixelsPerUnit && layer.scaleUnit ? layer.scaleUnit : 'Scale'}
              {layer.scalePixelsPerUnit && !scaleMode && (
                <button
                  className="ml-0.5 opacity-50 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); updateMapLayer(layer.id, { scalePixelsPerUnit: null, scaleUnit: null }) }}
                  title="Clear scale"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Button>
            {layer.scalePixelsPerUnit && layer.scaleUnit && (
              <Button
                size="sm"
                variant={measureMode ? 'default' : 'outline'}
                className="gap-1.5 text-xs"
                onClick={() => { setMeasureMode((v) => !v); setScaleMode(false); setMeasureResult(null) }}
                title="Measure distance between two points"
              >
                <Route className="h-3.5 w-3.5" />
                Measure
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={handleExportMap}
              title="Export map as PNG"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              Sub-map
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => window.dispatchEvent(new CustomEvent('wb:map:startAddMarker'))}
            >
              <Plus className="h-3.5 w-3.5" />
              Location
            </Button>
          </div>
        </div>

        {/* Filter bar — relative + z-index so its dropdowns paint above the Leaflet canvas */}
        <div className="relative z-[1100] shrink-0">
          <MapFilterBar filters={mapFilters} characters={characters} onChange={setMapFilters} />
        </div>

        {/* Story playback notes overlay */}
        {isPlayingStory && activeEventId && activeChapter && worldId && (
          <StoryNotesOverlay
            key={activeEventId}
            eventId={activeEventId}
            worldId={worldId}
            playbackSpeed={playbackSpeed}
            chapterNumber={activeChapter.number}
            chapterTitle={activeChapter.title}
            synopsis={activeChapter.synopsis}
          />
        )}

        {/* Map canvas — relative so detail panels can overlay without resizing the Leaflet container */}
        <div className="relative flex-1 overflow-hidden">
          <LeafletMapCanvas
            key={layerId}
            layer={layer}
            imageUrl={imageUrl}
            initialCenter={crossLayerPanTargetRef.current}
            markers={displayedMarkers}
            charPins={displayedCharPins}
            movementLines={displayedMovementLines}
            showSubMapLinks={mapFilters.showSubMapLinks}
            showLocationLabels={mapFilters.showLocationLabels}
            journeyLines={journeyLines}
            mapRoutes={mapRoutes}
            routeMarkerPositions={routeMarkerPositions}
            mapRegions={mapRegions}
            regionStatuses={regionStatusMap}
            drawRegionVertices={drawingRegion ? regionVertices : undefined}
            drawRoutePoints={drawingRoute && routeWaypoints.length >= 2
              ? routeWaypoints.map((wp) =>
                  typeof wp === 'string'
                    ? routeMarkerPositions.get(wp)
                    : [wp.y, wp.x] as [number, number]
                ).filter((pt): pt is [number, number] => pt != null && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))
              : undefined}
            locationStatuses={locationStatusMap}
            isDraggingCharacter={isDraggingCharacter}
            pinAnimation={pinAnimation}
            onAnimationEnd={handlePlaybackAnimationEnd}
            onMarkerClick={handleMarkerClick}
            onMapClick={(x, y) => {
              if (drawingRegion) {
                setRegionVertices((prev) => [...prev, { x, y }])
                return
              }
              if (drawingRoute) {
                // Snap to a nearby marker if within 30px, otherwise free point
                const SNAP_PX = 30
                let nearest: LocationMarker | null = null
                let nearestDist = Infinity
                for (const m of markers) {
                  const d = Math.hypot(m.x - x, m.y - y)
                  if (d < nearestDist) { nearestDist = d; nearest = m }
                }
                const point: string | { x: number; y: number } =
                  nearest && nearestDist <= SNAP_PX ? nearest.id : { x, y }
                setRouteWaypoints((prev) => {
                  const last = prev[prev.length - 1]
                  if (typeof last === 'string' && last === point) return prev
                  return [...prev, point]
                })
                return
              }
              setPendingPos({ x, y })
              setAddLocationOpen(true)
            }}
            onDrillDown={pushMapLayer}
            onCharacterDrop={handleCharacterDrop}
            onCharacterDropOnEmpty={(characterId, x, y) => {
              setPendingDropCharacterId(characterId)
              setPendingPos({ x, y })
              setAddLocationOpen(true)
            }}
            ghostPins={ghostPins}
            echoMarkers={echoMarkers}
            onEchoRingClick={setEchoPopoverMarkerId}
            onCharacterClick={handleCharacterClick}
            mapRef={mapRef}
            scaleMode={scaleMode || measureMode}
            directMapClick={drawingRegion || drawingRoute}
            onScalePoints={measureMode ? handleMeasurePoints : handleScalePoints}
            selectedRouteId={selectedRouteId}
            selectedRegionId={selectedRegionId}
            onRouteClick={(id) => {
              setSelectedRouteId((prev) => (prev === id ? null : id))
              if (id) focusOnRoute(id)
            }}
            onRegionClick={(id) => {
              setSelectedRegionId((prev) => (prev === id ? null : id))
              if (id) focusOnRegion(id)
            }}
            measureLine={
              measureResult && layer.scalePixelsPerUnit && layer.scaleUnit
                ? { p1: measureResult.p1, p2: measureResult.p2, label: formatDistance(measureResult.distPx, layer.scalePixelsPerUnit, layer.scaleUnit) } satisfies MeasureLine
                : null
            }
          />

          {/* ── Route draw HUD ── */}
          {drawingRoute && (
            <RouteDrawHud
              worldId={worldId}
              mapLayerId={layerId}
              waypoints={routeWaypoints}
              allMarkers={allMarkers}
              onUndo={() => setRouteWaypoints((prev) => prev.slice(0, -1))}
              onCancel={() => { setDrawingRoute(false); setRouteWaypoints([]) }}
              onSave={() => { setDrawingRoute(false); setRouteWaypoints([]) }}
            />
          )}

          {/* ── Region draw HUD ── */}
          {drawingRegion && (
            <RegionDrawHud
              worldId={worldId}
              mapLayerId={layerId}
              vertices={regionVertices}
              onUndo={() => setRegionVertices((prev) => prev.slice(0, -1))}
              onCancel={() => { setDrawingRegion(false); setRegionVertices([]) }}
              onSave={() => { setDrawingRegion(false); setRegionVertices([]) }}
            />
          )}

          {/* ── Echo ring popover ── */}
          {echoPopoverMarkerId && echoPopoverInfo && (
            <div className="absolute left-1/2 top-4 z-[610] -translate-x-1/2">
              <div className="w-72 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-2.5">
                  <div>
                    <div className="text-xs font-semibold text-amber-500 uppercase tracking-wide">Historical Echo</div>
                    <div className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {echoPopoverMarker?.name ?? 'Location'}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {echoPopoverInfo.counterpartTimelineName}
                    </div>
                  </div>
                  <button
                    onClick={() => setEchoPopoverMarkerId(null)}
                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ul className="max-h-52 overflow-y-auto divide-y divide-[hsl(var(--border))]">
                  {echoPopoverInfo.events.map((ev) => (
                    <li key={ev.id} className="px-4 py-2 text-sm text-[hsl(var(--foreground))]">
                      {ev.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── Measure result overlay ── */}
          {measureResult && layer.scalePixelsPerUnit && layer.scaleUnit && (
            <div className="absolute bottom-4 left-1/2 z-[600] -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 shadow-xl text-sm">
                <Route className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="font-semibold">
                  {formatDistance(measureResult.distPx, layer.scalePixelsPerUnit, layer.scaleUnit)}
                </span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  ({Math.round(measureResult.distPx)} px)
                </span>
                <button
                  onClick={() => setMeasureResult(null)}
                  className="ml-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── Detail panels (absolute overlay — keeps map container size stable) ── */}
          {selectedLocationMarkerId && (
            <div className="absolute inset-y-0 right-0 z-[500] flex">
              <LocationDetailPanel
                markerId={selectedLocationMarkerId}
                worldId={worldId}
                onClose={() => setSelectedLocationMarkerId(null)}
                onDrillDown={pushMapLayer}
              />
            </div>
          )}
          {selectedCharacterId && (() => {
            const char = characters.find((c) => c.id === selectedCharacterId)
            const snap = snapshots.find((s) => s.characterId === selectedCharacterId)
            if (!char) return null
            return (
              <div className="absolute inset-y-0 right-0 z-[500] flex">
                <CharacterSnapshotPanel
                  character={char}
                  snapshot={snap}
                  allMarkers={allMarkers}
                  allLayers={allLayers}
                  allCharacters={characters}
                  activeChapterTitle={activeChapterTitle}
                  worldId={worldId}
                  onClose={() => setSelectedCharacterId(null)}
                />
              </div>
            )
          })()}

          {/* ── Character film strip ── */}
          {selectedCharacterId && (() => {
            const char = characters.find((c) => c.id === selectedCharacterId)
            if (!char) return null
            return (
              <CharacterFilmStrip
                character={char}
                allMarkers={allMarkers}
                orderedEvents={orderedEvents}
                chapters={chapters}
                activeEventId={activeEventId}
                onClose={() => setSelectedCharacterId(null)}
              />
            )
          })()}
        </div>

        {scaleDialog && (
          <SetScaleDialog
            open
            onOpenChange={(v) => { if (!v) setScaleDialog(null) }}
            pixelDistance={scaleDialog.pixelDist}
            layerId={layer.id}
          />
        )}

      </div>

      {/* Dialogs */}
      {pendingPos && (
        <AddLocationDialog
          open={addLocationOpen}
          onOpenChange={(o) => {
            setAddLocationOpen(o)
            if (!o) { setPendingPos(null); setPendingDropCharacterId(null) }
          }}
          worldId={worldId}
          mapLayerId={layerId}
          position={pendingPos}
          subtitle={pendingDropCharacterId
            ? `${characters.find(c => c.id === pendingDropCharacterId)?.name ?? 'Character'} will be placed at this location.`
            : undefined}
          onCreated={async (marker) => {
            if (pendingDropCharacterId) {
              await placeCharacterAtMarker(pendingDropCharacterId, marker)
              setPendingDropCharacterId(null)
            }
          }}
        />
      )}
      <UploadMapDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        worldId={worldId}
        parentMapId={layerId}
        onCreated={(newLayerId) => { setActiveMapLayerId(newLayerId); setUploadOpen(false) }}
      />
    </div>
  )
}

// ─── MapExplorerView ──────────────────────────────────────────────────────────

export default function MapExplorerView() {
  const { worldId } = useParams<{ worldId: string }>()
  const activeLayerId = useActiveMapLayerId()
  const rootLayers = useRootMapLayers(worldId ?? null)
  const { setActiveMapLayerId } = useAppStore()
  const [uploadOpen, setUploadOpen] = useState(false)

  if (!worldId) return null

  if (!activeLayerId && rootLayers.length > 0) {
    setActiveMapLayerId(rootLayers[0].id)
  }

  if (rootLayers.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-2">
          <span className="text-sm font-medium">Maps</span>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload Map
          </Button>
        </div>
        <EmptyState
          icon={MapIcon}
          title="No maps yet"
          description="Upload a map image to start placing locations and tracking characters."
          action={
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" />
              Upload Map
            </Button>
          }
        />
        <UploadMapDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          worldId={worldId}
          onCreated={setActiveMapLayerId}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        {activeLayerId ? <MapView worldId={worldId} layerId={activeLayerId} /> : null}
      </div>
    </div>
  )
}
