import { useMemo } from 'react'
import { MapPin, Package, Heart, Skull, BookOpen, Camera, Footprints, Route, Ruler } from 'lucide-react'
import type { Character, Timeline } from '@/types'
import { useCharacterSnapshots } from '@/db/hooks/useSnapshots'
import { useChapter, useEvent, useTimelines } from '@/db/hooks/useTimeline'
import { useLocationMarker, useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useItems } from '@/db/hooks/useItems'
import { useTravelModes } from '@/db/hooks/useTravelModes'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/EmptyState'
import { formatDistance } from '@/lib/mapScale'

function SnapshotRow({
  snapshotId: _snapshotId,
  eventId,
  isAlive,
  locationMarkerId,
  inventoryItemIds,
  statusNotes,
  travelModeId,
  worldId,
  isActive,
  timelines,
  routeLabel,
  distanceLabel,
  onClick,
}: {
  snapshotId: string
  eventId: string
  isAlive: boolean
  locationMarkerId: string | null
  inventoryItemIds: string[]
  statusNotes: string
  travelModeId: string | null
  worldId: string
  isActive: boolean
  timelines: Timeline[]
  routeLabel: string | null
  distanceLabel: string | null
  onClick: () => void
}) {
  const event = useEvent(eventId)
  const chapter = useChapter(event?.chapterId ?? null)
  const location = useLocationMarker(locationMarkerId)
  const items = useItems(worldId)
  const travelModes = useTravelModes(worldId)
  const timeline = chapter ? timelines.find((t) => t.id === chapter.timelineId) ?? null : null
  const travelModeName = travelModeId ? (travelModes.find((m) => m.id === travelModeId)?.name ?? null) : null

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors hover:bg-[hsl(var(--accent))]',
        isActive
          ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm font-medium truncate">
            {chapter ? `Ch. ${chapter.number} — ${chapter.title}` : eventId}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {timeline && timelines.length >= 2 && (
            <span
              className="rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide"
              style={{
                background: `${timeline.color}22`,
                color: timeline.color,
                border: `1px solid ${timeline.color}55`,
              }}
            >
              {timeline.name}
            </span>
          )}
          {isAlive ? (
            <Heart className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Skull className="h-3.5 w-3.5 text-red-400" />
          )}
        </div>
      </div>
      {location && (
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          <MapPin className="h-3 w-3" />
          {location.name}
        </div>
      )}
      {travelModeName && (
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          <Footprints className="h-3 w-3" />
          {travelModeName}
        </div>
      )}
      {routeLabel && (
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          <Route className="h-3 w-3" />
          {routeLabel}
        </div>
      )}
      {distanceLabel && (
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          <Ruler className="h-3 w-3" />
          {distanceLabel}
        </div>
      )}
      {inventoryItemIds.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          <Package className="h-3 w-3" />
          {inventoryItemIds.map((id) => items.find((i) => i.id === id)?.name).filter(Boolean).join(', ')}
        </div>
      )}
      {statusNotes && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] italic line-clamp-1">{statusNotes}</p>
      )}
    </button>
  )
}

interface HistoryTabProps {
  character: Character
}

export function HistoryTab({ character }: HistoryTabProps) {
  const snapshots = useCharacterSnapshots(character.id)
  const timelines = useTimelines(character.worldId)
  const { activeEventId, setActiveEventId } = useAppStore()

  // Data for enrichment
  const allMarkers = useAllLocationMarkers(character.worldId)
  const allLayers  = useMapLayers(character.worldId)
  const allRoutes  = useLiveQuery(
    () => db.mapRoutes.where('worldId').equals(character.worldId).toArray(),
    [character.worldId],
    []
  )

  // Sort snapshots by sortKey ascending (nulls last), then pre-compute enrichment per row
  const enriched = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => {
      if (a.sortKey == null && b.sortKey == null) return 0
      if (a.sortKey == null) return 1
      if (b.sortKey == null) return -1
      return a.sortKey - b.sortKey
    })

    return sorted.map((snap, i) => {
      const prev = i > 0 ? sorted[i - 1] : null

      // Only compute travel info when on the same layer as previous snapshot
      const sameLayer =
        prev &&
        snap.currentLocationMarkerId &&
        prev.currentLocationMarkerId &&
        snap.currentMapLayerId &&
        snap.currentMapLayerId === prev.currentMapLayerId

      let routeLabel: string | null = null
      let distanceLabel: string | null = null

      if (sameLayer) {
        const fromMarker = allMarkers.find((m) => m.id === prev!.currentLocationMarkerId)
        const toMarker   = allMarkers.find((m) => m.id === snap.currentLocationMarkerId)

        if (fromMarker && toMarker) {
          // Route: look for a MapRoute whose waypoints include both marker IDs as strings
          const route = (allRoutes ?? []).find(
            (r) =>
              r.mapLayerId === snap.currentMapLayerId &&
              r.waypoints.includes(fromMarker.id) &&
              r.waypoints.includes(toMarker.id)
          )
          if (route) {
            const typeLabel = route.routeType.replace('_', ' ')
            routeLabel = `${route.name} (${typeLabel})`
          }

          // Distance: straight-line pixel distance, formatted if layer has scale
          const dx = toMarker.x - fromMarker.x
          const dy = toMarker.y - fromMarker.y
          const pixelDist = Math.sqrt(dx * dx + dy * dy)
          const layer = allLayers.find((l) => l.id === snap.currentMapLayerId)
          if (layer?.scalePixelsPerUnit && layer.scaleUnit) {
            distanceLabel = formatDistance(pixelDist, layer.scalePixelsPerUnit, layer.scaleUnit)
          }
        }
      }

      return { snap, routeLabel, distanceLabel }
    })
  }, [snapshots, allMarkers, allLayers, allRoutes])

  if (snapshots.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title="No snapshots yet"
        description='Select an event and save state in the "Current State" tab.'
        className="py-8"
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {enriched.map(({ snap, routeLabel, distanceLabel }) => (
        <SnapshotRow
          key={snap.id}
          snapshotId={snap.id}
          eventId={snap.eventId}
          isAlive={snap.isAlive}
          locationMarkerId={snap.currentLocationMarkerId}
          inventoryItemIds={snap.inventoryItemIds}
          statusNotes={snap.statusNotes}
          travelModeId={snap.travelModeId}
          worldId={character.worldId}
          isActive={snap.eventId === activeEventId}
          timelines={timelines}
          routeLabel={routeLabel}
          distanceLabel={distanceLabel}
          onClick={() => setActiveEventId(snap.eventId)}
        />
      ))}
    </div>
  )
}
