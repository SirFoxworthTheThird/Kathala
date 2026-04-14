import { useState, useRef, useEffect, useMemo, type MutableRefObject } from 'react'
import L from 'leaflet'
import { useParams } from 'react-router-dom'
import {
  Plus, Upload, Users, Map as MapIcon, Trash2, Undo2,
  ChevronRight, ChevronDown, MapPin, Package, Layers, Ruler, X, Route, Search,
} from 'lucide-react'
import { useAppStore, useActiveMapLayerId, useActiveEventId, useMapLayerHistory, usePlaybackTimelineId, type PlaybackSpeed } from '@/store'
import { useRootMapLayers, useMapLayer, useMapLayers, deleteMapLayer, updateMapLayer } from '@/db/hooks/useMapLayers'
import { useChapters, useTimelines, useWorldEvents } from '@/db/hooks/useTimeline'
import { useLocationMarkers, useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useBestSnapshots, upsertSnapshot, fetchSnapshot } from '@/db/hooks/useSnapshots'
import { useEventMovements, appendWaypoint, clearMovement, removeLastWaypoint } from '@/db/hooks/useMovements'
import { useItems } from '@/db/hooks/useItems'
import { useEventItemPlacements } from '@/db/hooks/useItemPlacements'
import { useItemSnapshot, upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'
import { useChapterLocationSnapshots } from '@/db/hooks/useLocationSnapshots'
import type { CharacterPin, MovementLine, PinAnimation, ScaleCalibrationPoint, MeasureLine } from './LeafletMapCanvas'
import { useBlobUrl, useWorldBlobUrls } from '@/db/hooks/useBlobs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/EmptyState'
import { PortraitImage } from '@/components/PortraitImage'
import { LeafletMapCanvas } from './LeafletMapCanvas'
import { LocationDetailPanel } from './LocationDetailPanel'
import { CharacterSnapshotPanel } from './CharacterSnapshotPanel'
import { UploadMapDialog } from './UploadMapDialog'
import { AddLocationDialog } from './AddLocationDialog'
import { StoryNotesOverlay } from './StoryNotesOverlay'
import type { Character, CharacterSnapshot, Item, LocationMarker, MapLayer, CharacterMovement } from '@/types'
import { pixelDist, pathPixelLength, formatDistance } from '@/lib/mapScale'

// ─── Utilities ───────────────────────────────────────────────────────────────

/** How long character pins animate across the map per playback speed (ms) */
const PIN_TRAVEL_MS: Record<PlaybackSpeed, number> = { slow: 6500, normal: 4000, fast: 2200 }

/** One stop in the ordered playback map-navigation queue */
interface PlaybackStep {
  mapLayerId: string
  pinAnimation: PinAnimation
}

/**
 * Build a sequential per-character animation queue.
 * Characters are sorted alphabetically by ID for a deterministic order.
 * Each character contributes one step (same-layer move) or two steps (cross-layer:
 * departure layer first, then arrival layer). Each step animates only that one character;
 * others appear at their current snapshot positions immediately.
 */
function buildSequentialQueue(
  prevSnaps: CharacterSnapshot[],
  currSnaps: CharacterSnapshot[],
  allMarkers: LocationMarker[],
  movements: CharacterMovement[],
  duration: number,
  keyRef: MutableRefObject<number>,
): PlaybackStep[] {
  const steps: PlaybackStep[] = []
  const markerById = new Map(allMarkers.map((m) => [m.id, m]))
  const prevByCharId = new Map(prevSnaps.map((s) => [s.characterId, s]))
  const currByCharId = new Map(currSnaps.map((s) => [s.characterId, s]))

  /** Returns true when the marker has finite, usable coordinates. */
  function validCoords(m: LocationMarker | undefined): m is LocationMarker {
    return !!m && Number.isFinite(m.x) && Number.isFinite(m.y)
  }

  /** Collect per-character trail waypoints on a specific layer. */
  function trailPts(charId: string, layerId: string): Array<{ x: number; y: number }> | null {
    const mov = movements.find((mv) => mv.characterId === charId)
    if (!mov || mov.waypoints.length < 2) return null
    const pts = mov.waypoints
      .map((id) => markerById.get(id))
      .filter((m): m is LocationMarker => !!m && m.mapLayerId === layerId && Number.isFinite(m.x) && Number.isFinite(m.y))
      .map((m) => ({ x: m.x, y: m.y }))
    return pts.length >= 2 ? pts : null
  }

  /**
   * First waypoint on `layerId` in the character's movement — used as the
   * entry point when entering a sub-map (no reverse portal marker exists).
   */
  function firstWaypointOnLayer(charId: string, layerId: string): { x: number; y: number } | null {
    const mov = movements.find((mv) => mv.characterId === charId)
    if (!mov) return null
    for (const wId of mov.waypoints) {
      const m = markerById.get(wId)
      if (m && m.mapLayerId === layerId && Number.isFinite(m.x) && Number.isFinite(m.y)) {
        return { x: m.x, y: m.y }
      }
    }
    return null
  }

  /**
   * Last waypoint on `layerId` in the character's movement — used as the
   * exit point when leaving a sub-map (no reverse portal marker exists).
   */
  function lastWaypointOnLayer(charId: string, layerId: string): { x: number; y: number } | null {
    const mov = movements.find((mv) => mv.characterId === charId)
    if (!mov) return null
    let last: { x: number; y: number } | null = null
    for (const wId of mov.waypoints) {
      const m = markerById.get(wId)
      if (m && m.mapLayerId === layerId && Number.isFinite(m.x) && Number.isFinite(m.y)) {
        last = { x: m.x, y: m.y }
      }
    }
    return last
  }

  // ── Step 1: collect every character move that actually changed position ──────
  interface CharMove {
    charId: string
    prevLayerId: string | null
    currLayerId: string
    prevMarkerId: string | null
    currMarkerId: string
  }
  const allMoves: CharMove[] = []
  const sortedCharIds = [...new Set([...prevByCharId.keys(), ...currByCharId.keys()])].sort()

  for (const charId of sortedCharIds) {
    const currSnap = currByCharId.get(charId)
    const prevSnap = prevByCharId.get(charId)
    if (!currSnap?.currentLocationMarkerId || !currSnap.currentMapLayerId) continue
    const prevMarkerId = prevSnap?.currentLocationMarkerId ?? null
    if (prevMarkerId === currSnap.currentLocationMarkerId && prevSnap?.currentMapLayerId === currSnap.currentMapLayerId) continue
    allMoves.push({
      charId,
      prevLayerId: prevSnap?.currentMapLayerId ?? null,
      currLayerId: currSnap.currentMapLayerId,
      prevMarkerId,
      currMarkerId: currSnap.currentLocationMarkerId,
    })
  }

  // ── Step 2: group by identical (prevLayerId, prevMarkerId, currLayerId, currMarkerId) ──
  // Characters sharing the exact same source and destination animate in the same step.
  const groups = new Map<string, CharMove[]>()
  for (const move of allMoves) {
    const key = `${move.prevLayerId ?? ''}|${move.prevMarkerId ?? ''}|${move.currLayerId}|${move.currMarkerId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(move)
  }

  // ── Step 3: build one PlaybackStep per group ──────────────────────────────
  for (const [, group] of groups) {
    const { prevLayerId, currLayerId, prevMarkerId, currMarkerId } = group[0]
    const currMarker = markerById.get(currMarkerId)
    if (!validCoords(currMarker)) continue

    if (!prevLayerId || prevLayerId === currLayerId) {
      // ── Same-layer move (or first appearance) ──────────────────────────────
      const prevMarker = prevMarkerId ? markerById.get(prevMarkerId) : undefined
      const from: Record<string, { x: number; y: number }> = {}
      const to: Record<string, { x: number; y: number }> = {}
      const waypoints: Record<string, Array<{ x: number; y: number }>> = {}
      const fadeIn: string[] = []

      for (const { charId } of group) {
        to[charId] = { x: currMarker.x, y: currMarker.y }
        if (validCoords(prevMarker)) {
          from[charId] = { x: prevMarker.x, y: prevMarker.y }
          const pts = trailPts(charId, currLayerId)
          if (pts) waypoints[charId] = pts
        } else {
          fadeIn.push(charId)
        }
      }

      keyRef.current += 1
      steps.push({
        mapLayerId: currLayerId,
        pinAnimation: {
          key: keyRef.current,
          from,
          to,
          waypoints: Object.keys(waypoints).length > 0 ? waypoints : undefined,
          duration,
          fadeIn,
          cameraFollow: true,
        },
      })
    } else {
      // ── Cross-layer move: departure step then arrival step ─────────────────
      //
      // `linkedMapLayerId` is ONE-DIRECTIONAL: a marker on the PARENT layer
      // links to a child layer — there is never a reverse link on the child.
      //
      // portalOnPrev: parent→child transition — portal is on prevLayerId (parent).
      //               Works when character exits parent to enter sub-map.
      // portalOnCurr: child→parent transition — portal is on currLayerId (parent).
      //               Works when character exits sub-map to enter parent.
      //
      // When there is no portal marker we fall back to waypoint-based entry/exit
      // points: firstWaypointOnLayer for arrival, lastWaypointOnLayer for departure.
      const prevMarker = prevMarkerId ? markerById.get(prevMarkerId) : undefined
      const portalOnPrev = allMarkers.find(
        (m) => m.mapLayerId === prevLayerId && m.linkedMapLayerId === currLayerId,
      )
      const portalOnCurr = allMarkers.find(
        (m) => m.mapLayerId === currLayerId && m.linkedMapLayerId === prevLayerId,
      )

      // ── Departure step ────────────────────────────────────────────────────
      // Exit point priority: explicit portal on prevLayerId → last waypoint on
      // prevLayerId → skip departure (character vanishes from prev layer).
      const departureTo: Record<string, { x: number; y: number }> = {}
      const departureFrom: Record<string, { x: number; y: number }> = {}
      const departureWp: Record<string, Array<{ x: number; y: number }>> = {}
      let hasDeparture = false

      if (validCoords(prevMarker)) {
        for (const { charId } of group) {
          let exitPt: { x: number; y: number } | null = null
          if (validCoords(portalOnPrev)) {
            exitPt = { x: portalOnPrev.x, y: portalOnPrev.y }
          } else {
            exitPt = lastWaypointOnLayer(charId, prevLayerId)
          }
          if (exitPt) {
            departureFrom[charId] = { x: prevMarker.x, y: prevMarker.y }
            departureTo[charId] = exitPt
            const pts = trailPts(charId, prevLayerId)
            if (pts) departureWp[charId] = pts
            hasDeparture = true
          }
        }
      }

      if (hasDeparture) {
        keyRef.current += 1
        steps.push({
          mapLayerId: prevLayerId,
          pinAnimation: {
            key: keyRef.current,
            from: departureFrom,
            to: departureTo,
            waypoints: Object.keys(departureWp).length > 0 ? departureWp : undefined,
            duration: duration * 0.5,
            cameraFollow: true,
          },
        })
      }

      // ── Arrival step ──────────────────────────────────────────────────────
      // Entry point priority: explicit portal on currLayerId → first waypoint on
      // currLayerId → fade-in at destination.
      const from2: Record<string, { x: number; y: number }> = {}
      const to2: Record<string, { x: number; y: number }> = {}
      const waypoints2: Record<string, Array<{ x: number; y: number }>> = {}
      const fadeIn2: string[] = []

      for (const { charId } of group) {
        to2[charId] = { x: currMarker.x, y: currMarker.y }
        let entryPt: { x: number; y: number } | null = null
        if (validCoords(portalOnCurr)) {
          entryPt = { x: portalOnCurr.x, y: portalOnCurr.y }
        } else {
          entryPt = firstWaypointOnLayer(charId, currLayerId)
        }
        if (entryPt) {
          from2[charId] = entryPt
          const pts = trailPts(charId, currLayerId)
          if (pts) waypoints2[charId] = pts
        } else {
          fadeIn2.push(charId)
        }
      }

      keyRef.current += 1
      steps.push({
        mapLayerId: currLayerId,
        pinAnimation: {
          key: keyRef.current,
          from: from2,
          to: to2,
          waypoints: Object.keys(waypoints2).length > 0 ? waypoints2 : undefined,
          duration: duration * 0.5,
          fadeIn: fadeIn2,
          cameraFollow: true,
        },
      })
    }
  }

  return steps
}

const MOVEMENT_COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa',
  '#fb923c', '#f472b6', '#22d3ee', '#a3e635', '#e879f9',
]
function characterColor(characterId: string): string {
  let hash = 0
  for (let i = 0; i < characterId.length; i++) hash = (hash * 31 + characterId.charCodeAt(i)) >>> 0
  return MOVEMENT_COLORS[hash % MOVEMENT_COLORS.length]
}

function resolveCharacterPin(
  snap: CharacterSnapshot,
  currentLayerId: string,
  allLayers: MapLayer[],
  allMarkers: LocationMarker[],
): CharacterPin | null {
  if (!snap.currentLocationMarkerId || !snap.currentMapLayerId) return null
  if (snap.currentMapLayerId === currentLayerId) {
    const m = allMarkers.find((x) => x.id === snap.currentLocationMarkerId)
    if (!m) return null
    return { character: null as unknown as Character, x: m.x, y: m.y, inSubMap: false }
  }
  let childLayerId = snap.currentMapLayerId
  for (let depth = 0; depth < 20; depth++) {
    const childLayer = allLayers.find((l) => l.id === childLayerId)
    if (!childLayer?.parentMapId) return null
    const parentLayerId = childLayer.parentMapId
    const linkMarker = allMarkers.find(
      (m) => m.mapLayerId === parentLayerId && m.linkedMapLayerId === childLayerId
    )
    if (!linkMarker) return null
    if (parentLayerId === currentLayerId) {
      return { character: null as unknown as Character, x: linkMarker.x, y: linkMarker.y, inSubMap: true }
    }
    childLayerId = parentLayerId
  }
  return null
}

// ─── SidebarSection ──────────────────────────────────────────────────────────

function SidebarSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  count,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  count?: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="flex flex-col border-b border-[hsl(var(--border))]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors select-none"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <span className="flex-1 text-left text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {title}
        </span>
        {count !== undefined && (
          <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
            {count}
          </span>
        )}
        {open
          ? <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
          : <ChevronRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />}
      </button>
      {open && children}
    </div>
  )
}

// ─── SidebarSearch ───────────────────────────────────────────────────────────

function SidebarSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mx-2 mb-1.5 mt-0.5">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-1 pl-6 pr-6 text-[11px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--ring))] transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ─── Map Layers tree ─────────────────────────────────────────────────────────

function LayerTreeNode({
  layer,
  allLayers,
  activeLayerId,
  depth,
  onSelect,
  onDeleted,
}: {
  layer: MapLayer
  allLayers: MapLayer[]
  activeLayerId: string | null
  depth: number
  onSelect: (id: string) => void
  onDeleted: (id: string) => void
}) {
  const children = allLayers.filter((l) => l.parentMapId === layer.id)
  const [open, setOpen] = useState(true)
  const [hovered, setHovered] = useState(false)
  const isActive = layer.id === activeLayerId

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    const childCount = allLayers.filter((l) => l.parentMapId === layer.id).length
    const msg = childCount > 0
      ? `Delete "${layer.name}" and its ${childCount} sub-map(s)? This cannot be undone.`
      : `Delete "${layer.name}"? This cannot be undone.`
    if (!confirm(msg)) return
    await deleteMapLayer(layer.id)
    onDeleted(layer.id)
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1 cursor-pointer select-none transition-colors rounded-sm mx-1 ${
          isActive
            ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: 4, paddingTop: 4, paddingBottom: 4 }}
        onClick={() => onSelect(layer.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children.length > 0 ? (
          <button
            className="shrink-0"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <MapPin className="h-3 w-3 shrink-0 opacity-40" />
        )}
        {depth === 0 && <MapIcon className="h-3 w-3 shrink-0 opacity-70" />}
        <span className="flex-1 truncate text-xs">{layer.name}</span>
        {hovered && (
          <button
            className="shrink-0 rounded p-0.5 hover:text-red-400 transition-colors"
            onClick={handleDelete}
            title="Delete map"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && children.map((child) => (
        <LayerTreeNode
          key={child.id}
          layer={child}
          allLayers={allLayers}
          activeLayerId={activeLayerId}
          depth={depth + 1}
          onSelect={onSelect}
          onDeleted={onDeleted}
        />
      ))}
    </div>
  )
}

function LayersSection({ worldId }: { worldId: string }) {
  const allLayers = useMapLayers(worldId)
  const history = useMapLayerHistory()
  const { resetMapHistory, setActiveMapLayerId } = useAppStore()
  const activeLayerId = history[history.length - 1] ?? null
  const roots = allLayers.filter((l) => l.parentMapId === null)

  function handleDeleted(deletedId: string) {
    if (history.includes(deletedId)) {
      const remaining = allLayers.filter((l) => l.id !== deletedId && l.parentMapId === null)
      if (remaining.length > 0) resetMapHistory(remaining[0].id)
      else setActiveMapLayerId('')
    }
  }

  return (
    <SidebarSection title="Map Layers" icon={Layers} count={roots.length}>
      <div className="py-1">
        {roots.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No maps yet.</p>
        ) : (
          roots.map((root) => (
            <LayerTreeNode
              key={root.id}
              layer={root}
              allLayers={allLayers}
              activeLayerId={activeLayerId}
              depth={0}
              onSelect={(id) => resetMapHistory(id)}
              onDeleted={handleDeleted}
            />
          ))
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Characters section ───────────────────────────────────────────────────────

function CharactersSection({
  characters,
  snapshots,
  allMarkers,
  activeEventId,
  worldId,
  scalePixelsPerUnit,
  scaleUnit,
  onDragStart,
  onDragEnd,
  onFocus,
}: {
  characters: Character[]
  snapshots: CharacterSnapshot[]
  allMarkers: LocationMarker[]
  activeEventId: string | null
  worldId: string
  scalePixelsPerUnit: number | null
  scaleUnit: string | null
  onDragStart: () => void
  onDragEnd: () => void
  onFocus: (characterId: string) => void
}) {
  const movements = useEventMovements(worldId, activeEventId)
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? characters.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : characters

  return (
    <SidebarSection title="Characters" icon={Users} count={characters.length}>
      {!activeEventId && (
        <p className="px-3 pb-2 text-[10px] italic text-[hsl(var(--muted-foreground))]">
          Select an event to place characters.
        </p>
      )}
      {characters.length > 0 && <SidebarSearch value={search} onChange={setSearch} />}
      <div className="flex flex-col gap-1 px-2 pb-2">
        {characters.length === 0 ? (
          <p className="px-1 py-1 text-xs italic text-[hsl(var(--muted-foreground))]">No characters yet.</p>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-1 text-xs italic text-[hsl(var(--muted-foreground))]">No matches.</p>
        ) : (
          filtered.map((c) => {
            const snap = snapshots.find((s) => s.characterId === c.id)
            const locationName = snap?.currentLocationMarkerId
              ? allMarkers.find((m) => m.id === snap.currentLocationMarkerId)?.name
              : null
            const movement = movements.find((m) => m.characterId === c.id)
            const color = characterColor(c.id)
            return (
              <div key={c.id} className="flex flex-col gap-0.5">
                <div
                  draggable={!!activeEventId}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('characterId', c.id)
                    e.dataTransfer.effectAllowed = 'move'
                    onDragStart()
                  }}
                  onDragEnd={onDragEnd}
                  onClick={() => onFocus(c.id)}
                  className={`flex items-center gap-2 rounded-md border bg-[hsl(var(--muted))] px-2 py-1.5 select-none cursor-pointer ${
                    activeEventId ? 'hover:border-[hsl(var(--ring))]' : 'opacity-60'
                  }`}
                  style={{ borderColor: movement ? color : 'hsl(var(--border))' }}
                >
                  <PortraitImage
                    imageId={c.portraitImageId}
                    className="h-6 w-6 rounded-full object-cover shrink-0"
                    fallbackClassName="h-6 w-6 rounded-full shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{c.name}</p>
                    {locationName && (
                      <p className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">{locationName}</p>
                    )}
                  </div>
                </div>

                {movement && movement.waypoints.length >= 2 && activeEventId && (
                  <div className="flex items-center gap-1 pl-2">
                    <span className="h-1 w-3 rounded-full shrink-0" style={{ background: color }} />
                    <p className="flex-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]">
                      {movement.waypoints.length} stops
                      {scalePixelsPerUnit && scaleUnit && (() => {
                        const pts = movement.waypoints
                          .map((id) => allMarkers.find((m) => m.id === id))
                          .filter(Boolean)
                          .map((m) => [m!.x, m!.y] as [number, number])
                        if (pts.length < 2) return null
                        return ` · ${formatDistance(pathPixelLength(pts), scalePixelsPerUnit, scaleUnit)}`
                      })()}
                    </p>
                    <button
                      title="Undo last stop"
                      className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                      onClick={() => removeLastWaypoint(c.id, activeEventId)}
                    >
                      <Undo2 className="h-3 w-3" />
                    </button>
                    <button
                      title="Clear path"
                      className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
                      onClick={() => clearMovement(c.id, activeEventId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Locations section ────────────────────────────────────────────────────────

const ICON_COLORS: Record<string, string> = {
  city: '#60a5fa', town: '#34d399', dungeon: '#f87171',
  landmark: '#fbbf24', building: '#a78bfa', region: '#fb923c', custom: '#94a3b8',
}

function LocationsSection({
  markers,
  selectedId,
  onSelect,
  onFocus,
}: {
  markers: LocationMarker[]
  selectedId: string | null
  onSelect: (id: string) => void
  onFocus: (marker: LocationMarker) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? markers.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : markers

  return (
    <SidebarSection title="Locations" icon={MapPin} count={markers.length} defaultOpen={false}>
      {markers.length > 0 && <SidebarSearch value={search} onChange={setSearch} />}
      <div className="flex flex-col py-1">
        {markers.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No locations on this map.</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No matches.</p>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => { onSelect(m.id); onFocus(m) }}
              className={`flex items-center gap-2 px-3 py-1.5 text-left transition-colors rounded-sm mx-1 ${
                selectedId === m.id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: ICON_COLORS[m.iconType] ?? '#94a3b8' }}
              />
              <span className="flex-1 truncate text-xs">{m.name}</span>
              {m.linkedMapLayerId && (
                <MapIcon className="h-3 w-3 shrink-0 opacity-50" />
              )}
            </button>
          ))
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Items section ────────────────────────────────────────────────────────────

const ITEM_CONDITIONS = ['intact', 'damaged', 'destroyed', 'lost', 'found', 'unknown']
const CONDITION_COLORS: Record<string, string> = {
  intact: '#34d399', damaged: '#fbbf24', destroyed: '#f87171',
  lost: '#94a3b8', found: '#60a5fa', unknown: '#a78bfa',
}

function ItemRow({
  item,
  activeEventId,
  worldId,
  locationName,
  onFocus,
}: {
  item: Item
  activeEventId: string | null
  worldId: string
  locationName: string | null
  onFocus: () => void
}) {
  const snap = useItemSnapshot(item.id, worldId, activeEventId)
  const [expanded, setExpanded] = useState(false)
  const condition = snap?.condition ?? 'intact'

  return (
    <div className="mx-1 rounded-sm border border-transparent hover:border-[hsl(var(--border))] transition-colors">
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        onClick={() => { onFocus(); setExpanded((v) => !v) }}
      >
        <PortraitImage
          imageId={item.imageId}
          fallbackIcon={Package}
          className="h-5 w-5 rounded object-cover shrink-0"
          fallbackClassName="h-5 w-5 rounded shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs">{item.name}</p>
          {locationName && (
            <p className="truncate text-[10px] opacity-60">{locationName}</p>
          )}
        </div>
        {activeEventId && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: CONDITION_COLORS[condition] ?? '#94a3b8' }}
            title={condition}
          />
        )}
        {activeEventId && (
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
      </div>

      {expanded && activeEventId && (
        <div className="flex flex-col gap-1.5 border-t border-[hsl(var(--border))] px-2 pb-2 pt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] w-16 shrink-0">Condition</span>
            <select
              className="flex-1 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--foreground))]"
              value={condition}
              onChange={(e) =>
                upsertItemSnapshot({
                  worldId,
                  itemId: item.id,
                  eventId: activeEventId,
                  condition: e.target.value,
                  notes: snap?.notes ?? '',
                })
              }
            >
              {ITEM_CONDITIONS.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
          <textarea
            className="w-full resize-none rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 py-1 text-[10px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            rows={2}
            placeholder="Chapter notes..."
            value={snap?.notes ?? ''}
            onChange={(e) =>
              upsertItemSnapshot({
                worldId,
                itemId: item.id,
                eventId: activeEventId,
                condition: snap?.condition ?? 'intact',
                notes: e.target.value,
              })
            }
          />
        </div>
      )}
    </div>
  )
}

function ItemsSection({
  worldId,
  activeEventId,
  allMarkers,
  snapshots,
  onFocus,
}: {
  worldId: string
  activeEventId: string | null
  allMarkers: LocationMarker[]
  snapshots: CharacterSnapshot[]
  onFocus: (itemId: string) => void
}) {
  const items = useItems(worldId)
  const placements = useEventItemPlacements(activeEventId)
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items

  function getItemLocation(itemId: string): string | null {
    const placement = placements.find((p) => p.itemId === itemId)
    if (placement) {
      return allMarkers.find((m) => m.id === placement.locationMarkerId)?.name ?? null
    }
    const snap = snapshots.find((s) => s.inventoryItemIds.includes(itemId))
    if (snap) {
      const loc = snap.currentLocationMarkerId
        ? allMarkers.find((m) => m.id === snap.currentLocationMarkerId)?.name
        : null
      return loc ?? null
    }
    return null
  }

  return (
    <SidebarSection title="Items" icon={Package} count={items.length} defaultOpen={false}>
      {items.length > 0 && <SidebarSearch value={search} onChange={setSearch} />}
      <div className="flex flex-col py-1">
        {items.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No items yet.</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No matches.</p>
        ) : (
          filtered.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              activeEventId={activeEventId}
              worldId={worldId}
              locationName={getItemLocation(item.id)}
              onFocus={() => onFocus(item.id)}
            />
          ))
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Map filters ─────────────────────────────────────────────────────────────

const ALL_LOCATION_TYPES = ['city', 'town', 'dungeon', 'landmark', 'building', 'region', 'custom']

export interface MapFilters {
  showCharacters: boolean
  showTrails: boolean
  showLocations: boolean
  showSubMapLinks: boolean
  characterIds: Set<string>   // empty = all
  locationTypes: Set<string>  // empty = all
}

export const DEFAULT_MAP_FILTERS: MapFilters = {
  showCharacters: true,
  showTrails: true,
  showLocations: true,
  showSubMapLinks: true,
  characterIds: new Set(),
  locationTypes: new Set(),
}

function MapFilterBar({
  filters,
  characters,
  onChange,
}: {
  filters: MapFilters
  characters: Character[]
  onChange: (f: MapFilters) => void
}) {
  const [charOpen, setCharOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const charRef = useRef<HTMLDivElement>(null)
  const typeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (charRef.current && !charRef.current.contains(e.target as Node)) setCharOpen(false)
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggleCharId(id: string) {
    const next = new Set(filters.characterIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange({ ...filters, characterIds: next })
  }

  function toggleLocType(type: string) {
    const next = new Set(filters.locationTypes)
    if (next.has(type)) next.delete(type); else next.add(type)
    onChange({ ...filters, locationTypes: next })
  }

  const activeBtn = 'border-[hsl(var(--ring))] bg-[hsl(var(--ring)/0.12)] text-[hsl(var(--foreground))]'
  const inactiveBtn = 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] opacity-50'
  const chevronBtn = (open: boolean) =>
    `flex items-center border border-l-0 px-1 py-1 transition-colors rounded-r-md ${
      open ? 'border-[hsl(var(--ring))] bg-[hsl(var(--ring)/0.12)] text-[hsl(var(--foreground))]'
           : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
    }`

  const charCount = filters.characterIds.size
  const typeCount = filters.locationTypes.size

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/0.6)] px-4 py-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Show</span>

      {/* Characters */}
      <div ref={charRef} className="relative flex items-center">
        <button
          onClick={() => onChange({ ...filters, showCharacters: !filters.showCharacters })}
          className={`flex items-center gap-1 rounded-l-md border px-2 py-1 text-[10px] font-medium transition-colors ${filters.showCharacters ? activeBtn : inactiveBtn}`}
        >
          <Users className="h-3 w-3" />
          Characters
          {charCount > 0 && (
            <span className="ml-0.5 rounded-full bg-[hsl(var(--ring))] px-1 text-[9px] font-bold text-[hsl(var(--background))]">{charCount}</span>
          )}
        </button>
        {filters.showCharacters && characters.length > 0 && (
          <button
            className={chevronBtn(charOpen)}
            onClick={() => { setCharOpen(v => !v); setTypeOpen(false) }}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
        {!filters.showCharacters && <div className="w-[1px]" />}
        {charOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[170px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Filter characters</span>
              {charCount > 0 && (
                <button onClick={() => onChange({ ...filters, characterIds: new Set() })} className="text-[10px] text-[hsl(var(--ring))] hover:underline">All</button>
              )}
            </div>
            {characters.map((c) => {
              const checked = charCount === 0 || filters.characterIds.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCharId(c.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-sm border-2 transition-colors ${checked ? 'border-[hsl(var(--ring))] bg-[hsl(var(--ring))]' : 'border-[hsl(var(--border))]'}`} />
                  <span className="truncate text-xs">{c.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Trails */}
      <button
        onClick={() => onChange({ ...filters, showTrails: !filters.showTrails })}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${filters.showTrails ? activeBtn : inactiveBtn}`}
      >
        <Route className="h-3 w-3" />
        Trails
      </button>

      {/* Locations */}
      <div ref={typeRef} className="relative flex items-center">
        <button
          onClick={() => onChange({ ...filters, showLocations: !filters.showLocations })}
          className={`flex items-center gap-1 rounded-l-md border px-2 py-1 text-[10px] font-medium transition-colors ${filters.showLocations ? activeBtn : inactiveBtn}`}
        >
          <MapPin className="h-3 w-3" />
          Locations
          {typeCount > 0 && (
            <span className="ml-0.5 rounded-full bg-[hsl(var(--ring))] px-1 text-[9px] font-bold text-[hsl(var(--background))]">{typeCount}</span>
          )}
        </button>
        {filters.showLocations && (
          <button
            className={chevronBtn(typeOpen)}
            onClick={() => { setTypeOpen(v => !v); setCharOpen(false) }}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
        {!filters.showLocations && <div className="w-[1px]" />}
        {typeOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[170px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Filter types</span>
              {typeCount > 0 && (
                <button onClick={() => onChange({ ...filters, locationTypes: new Set() })} className="text-[10px] text-[hsl(var(--ring))] hover:underline">All</button>
              )}
            </div>
            {ALL_LOCATION_TYPES.map((type) => {
              const checked = typeCount === 0 || filters.locationTypes.has(type)
              return (
                <button
                  key={type}
                  onClick={() => toggleLocType(type)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[hsl(var(--muted))]"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-sm border-2 transition-colors ${checked ? 'border-[hsl(var(--ring))] bg-[hsl(var(--ring))]' : 'border-[hsl(var(--border))]'}`} />
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: ICON_COLORS[type] ?? '#94a3b8' }}
                  />
                  <span className="capitalize text-xs">{type}</span>
                </button>
              )
            })}
            <div className="mt-1 border-t border-[hsl(var(--border))] px-3 py-1.5">
              <button
                onClick={() => onChange({ ...filters, showSubMapLinks: !filters.showSubMapLinks })}
                className="flex w-full items-center gap-2 text-left transition-colors hover:bg-[hsl(var(--muted))]"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm border-2 transition-colors ${filters.showSubMapLinks ? 'border-[hsl(var(--ring))] bg-[hsl(var(--ring))]' : 'border-[hsl(var(--border))]'}`} />
                <span className="text-xs">Sub-map indicators</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SetScaleDialog ───────────────────────────────────────────────────────────

const SCALE_UNITS = ['km', 'miles', 'leagues', 'days travel', 'furlongs', 'ft', 'meters']

function SetScaleDialog({
  open, onOpenChange, pixelDistance, layerId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pixelDistance: number
  layerId: string
}) {
  const [value, setValue] = useState('100')
  const [unit, setUnit] = useState('km')

  async function handleSave() {
    const dist = parseFloat(value)
    if (!dist || dist <= 0) return
    await updateMapLayer(layerId, {
      scalePixelsPerUnit: pixelDistance / dist,
      scaleUnit: unit,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Map Scale</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            The two points you selected are <span className="font-semibold text-[hsl(var(--foreground))]">{Math.round(pixelDistance)} px</span> apart. How far is that in the real world?
          </p>
          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label>Distance</Label>
              <Input
                type="number"
                min="0.1"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5 w-36">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCALE_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!value || parseFloat(value) <= 0}>Save Scale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── MapView ──────────────────────────────────────────────────────────────────

function MapView({ worldId, layerId }: { worldId: string; layerId: string }) {
  const layer = useMapLayer(layerId)
  const imageUrl = useBlobUrl(layer?.imageId ?? null)
  const markers = useLocationMarkers(layerId)
  const allLayers = useMapLayers(worldId)
  const allMarkers = useAllLocationMarkers(worldId)
  const characters = useCharacters(worldId)
  const activeEventId = useActiveEventId()
  const snapshots = useBestSnapshots(worldId, activeEventId)
  const blobUrls = useWorldBlobUrls(worldId)
  const movements = useEventMovements(worldId, activeEventId)
  const chapterPlacements = useEventItemPlacements(activeEventId)
  const chapterLocSnaps = useChapterLocationSnapshots(activeEventId)

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
  const { setSelectedLocationMarkerId, selectedLocationMarkerId, pushMapLayer, setActiveMapLayerId, isPlayingStory, playbackSpeed } = useAppStore()
  const mapRef = useRef<L.Map | null>(null)

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

  const timelines = useTimelines(worldId)
  const playbackTimelineId = usePlaybackTimelineId()
  const effectiveTimelineId = playbackTimelineId ?? timelines[0]?.id ?? null
  const chapters = useChapters(effectiveTimelineId)
  const allWorldEvents = useWorldEvents(worldId)
  // Derive active chapter from the active event's chapterId
  const activeEvent   = activeEventId ? allWorldEvents.find((e) => e.id === activeEventId) ?? null : null
  const activeChapter = activeEvent ? chapters.find((c) => c.id === activeEvent.chapterId) ?? null : null
  const activeChapterTitle = activeChapter ? `Ch.${activeChapter.number} — ${activeChapter.title}` : null

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

  const activeEventIdx = activeEventId ? orderedEvents.findIndex((e) => e.id === activeEventId) : -1
  const prevEventId = activeEventIdx > 0 ? orderedEvents[activeEventIdx - 1].id : null

  // Previous event snapshots (last-known state at the previous event — used for playback animation)
  const prevSnapshots = useBestSnapshots(worldId, prevEventId)

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
  const prevChapterSnapshots = useBestSnapshots(worldId, prevChapterLastEventId)

  function handleMarkerClick(markerId: string) {
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
      PIN_TRAVEL_MS[playbackSpeed], pinAnimationKeyRef,
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

  // Apply map filters
  const visibleCharIds = mapFilters.characterIds.size > 0 ? mapFilters.characterIds : null
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
            locationStatuses={locationStatusMap}
            isDraggingCharacter={isDraggingCharacter}
            pinAnimation={pinAnimation}
            onAnimationEnd={handlePlaybackAnimationEnd}
            onMarkerClick={handleMarkerClick}
            onMapClick={(x, y) => { setPendingPos({ x, y }); setAddLocationOpen(true) }}
            onDrillDown={pushMapLayer}
            onCharacterDrop={handleCharacterDrop}
            onCharacterDropOnEmpty={(characterId, x, y) => {
              setPendingDropCharacterId(characterId)
              setPendingPos({ x, y })
              setAddLocationOpen(true)
            }}
            onCharacterClick={handleCharacterClick}
            mapRef={mapRef}
            scaleMode={scaleMode || measureMode}
            onScalePoints={measureMode ? handleMeasurePoints : handleScalePoints}
            measureLine={
              measureResult && layer.scalePixelsPerUnit && layer.scaleUnit
                ? { p1: measureResult.p1, p2: measureResult.p2, label: formatDistance(measureResult.distPx, layer.scalePixelsPerUnit, layer.scaleUnit) } satisfies MeasureLine
                : null
            }
          />

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
