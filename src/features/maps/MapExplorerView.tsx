import { useState, useRef, useEffect, useMemo } from 'react'
import L from 'leaflet'
import { useParams } from 'react-router-dom'
import { Plus, Upload, Map as MapIcon, Ruler, X, Route, Download, Sparkles, Type, Trash2 } from 'lucide-react'
import { useAppStore, useActiveMapLayerId } from '@/store'
import { useRootMapLayers, updateMapLayer } from '@/db/hooks/useMapLayers'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { LeafletMapCanvas } from './LeafletMapCanvas'
import { LocationDetailPanel } from './LocationDetailPanel'
import { CharacterSnapshotPanel } from './CharacterSnapshotPanel'
import { UploadMapDialog } from './UploadMapDialog'
import { AddLocationDialog } from './AddLocationDialog'
import { StoryNotesOverlay } from './StoryNotesOverlay'
import type { ScaleCalibrationPoint, MeasureLine, JourneyLine } from './LeafletMapCanvas'
import { pixelDist, formatDistance } from '@/lib/mapScale'
import { characterColor } from './mapUtils'
import { MapFilterBar, DEFAULT_MAP_FILTERS } from './MapFilterBar'
import type { MapFilters } from './MapFilterBar'
import { SetScaleDialog } from './SetScaleDialog'
import { LayersSection, CharactersSection, LocationsSection, ItemsSection, RoutesSection, RegionsSection } from './MapSidebar'
import { CharacterFilmStrip } from './CharacterFilmStrip'
import { RouteDrawHud, RegionDrawHud } from './DrawHuds'
import { RouteDetailPanel, RegionDetailPanel } from './RouteRegionDetailPanel'
import { MapAIDialog } from './MapAIDialog'
import { useMapViewState } from './useMapViewState'
import { usePlaybackQueue } from './usePlaybackQueue'
import { upsertSnapshot, fetchSnapshot, useWorldSnapshots } from '@/db/hooks/useSnapshots'
import { appendWaypoint } from '@/db/hooks/useMovements'
import { useMapAnnotations, createMapAnnotation, updateMapAnnotation, deleteMapAnnotation } from '@/db/hooks/useMapAnnotations'
import type { LocationMarker } from '@/types'

// ─── MapView ──────────────────────────────────────────────────────────────────

function MapView({ worldId, layerId }: { worldId: string; layerId: string }) {
  const {
    layer, imageUrl, markers, allLayers, allMarkers, characters,
    activeEventId, orderedEvents,
    activeChapter, activeChapterTitle,
    snapshots, prevSnapshots,
    chapterPlacements, chapters,
    mapRoutes, mapRegions, regionStatusMap, routeMarkerPositions,
    locationStatusMap, charPins, ghostPins, echoMarkers, echoLocations,
    movementLines,
  } = useMapViewState(worldId, layerId)

  const {
    setSelectedLocationMarkerId, selectedLocationMarkerId, pushMapLayer,
    setActiveMapLayerId, setIsAnimating, isPlayingStory, playbackSpeed,
    pendingFocusRouteId, setPendingFocusRouteId,
    pendingFocusRegionId, setPendingFocusRegionId,
  } = useAppStore()

  // ── Local UI state ────────────────────────────────────────────────────────
  const [isDraggingCharacter, setIsDraggingCharacter] = useState(false)
  const crossLayerPanTargetRef = useRef<[number, number] | null>(null)
  const pinAnimationKeyRef = useRef(0)
  const [addLocationOpen, setAddLocationOpen] = useState(false)
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null)
  const [pendingDropCharacterId, setPendingDropCharacterId] = useState<string | null>(null)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
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
  const [echoPopoverMarkerId, setEchoPopoverMarkerId] = useState<string | null>(null)
  const [annotateMode, setAnnotateMode] = useState(false)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  // ── Layer-switch transition (zoom-out → switch → zoom-in) ──────────────────
  type TransitionPhase = 'idle' | 'zooming-out' | 'zoomed-out' | 'zooming-in'
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle')
  const pendingLayerSwitchRef = useRef<string | null>(null)

  function requestLayerSwitch(targetId: string) {
    if (!isPlayingStory) { setActiveMapLayerId(targetId); return }
    setIsAnimating(true)
    pendingLayerSwitchRef.current = targetId
    setTransitionPhase('zooming-out')
  }

  // Once zoomed out: switch the layer, then trigger zoom-in on the new canvas
  useEffect(() => {
    if (transitionPhase !== 'zoomed-out') return
    const targetId = pendingLayerSwitchRef.current
    if (!targetId) return
    pendingLayerSwitchRef.current = null
    setActiveMapLayerId(targetId)
    // Double-rAF: new LeafletMapCanvas renders at zoomed-out styles first, then animate in
    requestAnimationFrame(() => requestAnimationFrame(() => setTransitionPhase('zooming-in')))
  }, [transitionPhase]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCanvasTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    // Filter: only handle transitions on this div, only the opacity property
    if (e.target !== e.currentTarget || e.propertyName !== 'opacity') return
    if (transitionPhase === 'zooming-out') {
      setTransitionPhase('zoomed-out')
    } else if (transitionPhase === 'zooming-in') {
      setTransitionPhase('idle')
      setIsAnimating(false)
    }
  }

  const canvasTransitionStyle: React.CSSProperties = (() => {
    switch (transitionPhase) {
      case 'zooming-out':
        return { transform: 'scale(0.88)', opacity: 0, transition: 'transform 0.3s ease-in, opacity 0.3s ease-in' }
      case 'zoomed-out':
        return { transform: 'scale(0.88)', opacity: 0, transition: 'none' }
      case 'zooming-in':
        return { transform: 'scale(1)', opacity: 1, transition: 'transform 0.35s ease-out, opacity 0.35s ease-out' }
      default:
        return {}
    }
  })()

  const mapAnnotations = useMapAnnotations(layerId)

  // ── Playback queue ─────────────────────────────────────────────────────────
  const { pinAnimation, handlePlaybackAnimationEnd } = usePlaybackQueue({
    worldId, layerId, isPlayingStory, playbackSpeed, activeEventId,
    prevSnapshots, snapshots, allMarkers, mapRoutes,
    pinAnimationKeyRef, requestLayerSwitch,
  })

  // Clear cross-layer pan target once the new layer has mounted
  useEffect(() => {
    crossLayerPanTargetRef.current = null
  }, [layerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Consume pending route/region focus from search palette ────────────────
  useEffect(() => {
    if (pendingFocusRouteId && mapRoutes.length > 0) {
      setSelectedRouteId(pendingFocusRouteId)
      focusOnRoute(pendingFocusRouteId)
      setPendingFocusRouteId(null)
    }
  }, [pendingFocusRouteId, mapRoutes]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingFocusRegionId && mapRegions.length > 0) {
      setSelectedRegionId(pendingFocusRegionId)
      focusOnRegion(pendingFocusRegionId)
      setPendingFocusRegionId(null)
    }
  }, [pendingFocusRegionId, mapRegions]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Focus helpers ─────────────────────────────────────────────────────────
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
      mapRef.current?.panTo([pin.y, pin.x])
      return
    }
    const snap = snapshots.find((s) => s.characterId === characterId)
    if (!snap?.currentMapLayerId) return
    const targetMarker = allMarkers.find((m) => m.id === snap.currentLocationMarkerId)
    if (targetMarker) crossLayerPanTargetRef.current = [targetMarker.y, targetMarker.x]
    pushMapLayer(snap.currentMapLayerId)
  }

  function focusOnItem(itemId: string) {
    const snap = snapshots.find((s) => s.inventoryItemIds.includes(itemId))
    if (snap) { focusOnCharacter(snap.characterId); return }
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

  // ── Map export ────────────────────────────────────────────────────────────
  async function handleExportMap() {
    const mapEl = document.querySelector('.leaflet-container') as HTMLElement | null
    if (!mapEl) return

    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(mapEl, {
      useCORS: true,
      allowTaint: true,
      logging: false,
    })

    const link = document.createElement('a')
    link.download = `${layer?.name ?? 'map'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  // ── Scale & measure ───────────────────────────────────────────────────────
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

  // ── Map click handlers ────────────────────────────────────────────────────
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

  // ── Character placement ───────────────────────────────────────────────────
  async function placeCharacterAtMarker(characterId: string, marker: LocationMarker) {
    if (!activeEventId) return
    const existingInDb = await fetchSnapshot(characterId, activeEventId)
    const fromMarkerId = existingInDb?.currentLocationMarkerId
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

  // ── Display filtering ─────────────────────────────────────────────────────
  const visibleCharIds = mapFilters.characterIds.size > 0 ? mapFilters.characterIds : null

  // World snapshots for journey trails — only loaded when the filter is enabled
  const allWorldSnaps = useWorldSnapshots(mapFilters.showJourneys ? worldId : null)

  const journeyLines = useMemo<JourneyLine[]>(() => {
    if (!mapFilters.showJourneys || allWorldSnaps.length === 0) return []
    const eventOrderMap = new Map<string, number>()
    for (let i = 0; i < orderedEvents.length; i++) eventOrderMap.set(orderedEvents[i].id, i)
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
      if (points.length >= 2) lines.push({ characterId: charId, color: characterColor(charId), points })
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

  const echoPopoverInfo   = echoPopoverMarkerId ? echoLocations.get(echoPopoverMarkerId) ?? null : null
  const echoPopoverMarker = echoPopoverMarkerId ? allMarkers.find((m) => m.id === echoPopoverMarkerId) ?? null : null

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
              onClick={() => setAiDialogOpen(true)}
              title="Extract location moves from prose with AI"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Moves
            </Button>
            <Button
              size="sm"
              variant={annotateMode ? 'default' : 'outline'}
              className="gap-1.5 text-xs"
              onClick={() => { setAnnotateMode((v) => !v); setSelectedAnnotationId(null) }}
              title="Place a text label on the map"
            >
              <Type className="h-3.5 w-3.5" />
              Label
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

        {/* Filter bar */}
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

        {/* Map canvas */}
        <div
          className="relative flex-1 overflow-hidden"
          style={canvasTransitionStyle}
          onTransitionEnd={handleCanvasTransitionEnd}
        >
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
            onMapClick={async (x, y) => {
              if (annotateMode) {
                const ann = await createMapAnnotation({ worldId, mapLayerId: layerId, x, y, text: 'Label' })
                setSelectedAnnotationId(ann.id)
                setAnnotateMode(false)
                return
              }
              if (drawingRegion) { setRegionVertices((prev) => [...prev, { x, y }]); return }
              if (drawingRoute) {
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
            directMapClick={drawingRegion || drawingRoute || annotateMode}
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
            onRegionDrillDown={pushMapLayer}
            onContextAddLabel={async (x, y) => {
              const ann = await createMapAnnotation({ worldId, mapLayerId: layerId, x, y, text: 'Label' })
              setSelectedAnnotationId(ann.id)
            }}
            onContextStartRoute={(x, y) => {
              setDrawingRoute(true)
              setRouteWaypoints([{ x, y }])
            }}
            onContextStartRegion={(x, y) => {
              setDrawingRegion(true)
              setRegionVertices([{ x, y }])
            }}
            mapAnnotations={mapAnnotations}
            selectedAnnotationId={selectedAnnotationId}
            onAnnotationClick={(id) => setSelectedAnnotationId((prev) => prev === id ? null : id)}
            measureLine={
              measureResult && layer.scalePixelsPerUnit && layer.scaleUnit
                ? { p1: measureResult.p1, p2: measureResult.p2, label: formatDistance(measureResult.distPx, layer.scalePixelsPerUnit, layer.scaleUnit) } satisfies MeasureLine
                : null
            }
          />

          {/* Route draw HUD */}
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

          {/* Region draw HUD */}
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

          {/* Annotate placement HUD */}
          {annotateMode && (
            <div className="absolute bottom-4 left-1/2 z-[610] -translate-x-1/2">
              <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 shadow-lg text-sm">
                <Type className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <span>Click on the map to place a text label</span>
                <button
                  onClick={() => setAnnotateMode(false)}
                  className="ml-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Annotation edit popover */}
          {selectedAnnotationId && (() => {
            const ann = mapAnnotations.find((a) => a.id === selectedAnnotationId)
            if (!ann) return null
            return (
              <div className="absolute right-4 top-4 z-[610] w-56">
                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
                  <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Label</span>
                    <button
                      onClick={() => setSelectedAnnotationId(null)}
                      className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-3 p-3">
                    <textarea
                      className="w-full resize-none rounded border border-[hsl(var(--border))] bg-[hsl(var(--input))] px-2 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      rows={3}
                      value={ann.text}
                      onChange={(e) => updateMapAnnotation(ann.id, { text: e.target.value })}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[hsl(var(--muted-foreground))] w-16 shrink-0">Size</span>
                      <input
                        type="range"
                        min={10}
                        max={40}
                        value={ann.fontSize}
                        onChange={(e) => updateMapAnnotation(ann.id, { fontSize: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-xs w-6 text-right">{ann.fontSize}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[hsl(var(--muted-foreground))] w-16 shrink-0">Color</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {['#ffffff', '#fbbf24', '#34d399', '#60a5fa', '#f87171', '#a78bfa', '#fb923c'].map((c) => (
                          <button
                            key={c}
                            title={c}
                            onClick={() => updateMapAnnotation(ann.id, { color: c })}
                            className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                            style={{
                              background: c,
                              borderColor: ann.color === c ? '#fff' : 'transparent',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await deleteMapAnnotation(ann.id)
                        setSelectedAnnotationId(null)
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded border border-[hsl(var(--destructive)/0.4)] px-2 py-1 text-xs text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete label
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Echo ring popover */}
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

          {/* Measure result overlay */}
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

          {/* Detail panels */}
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
          {selectedRouteId && !selectedLocationMarkerId && !selectedCharacterId && (
            <div className="absolute inset-y-0 right-0 z-[500] flex">
              <RouteDetailPanel routeId={selectedRouteId} onClose={() => setSelectedRouteId(null)} />
            </div>
          )}
          {selectedRegionId && !selectedLocationMarkerId && !selectedCharacterId && (
            <div className="absolute inset-y-0 right-0 z-[500] flex">
              <RegionDetailPanel regionId={selectedRegionId} worldId={worldId} onClose={() => setSelectedRegionId(null)} onDrillDown={pushMapLayer} />
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

          {/* Character film strip */}
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
      <MapAIDialog
        worldId={worldId}
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
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
