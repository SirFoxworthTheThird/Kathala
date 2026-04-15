import { MapPin, Package, Heart, Skull, BookOpen, Camera } from 'lucide-react'
import type { Character, Timeline } from '@/types'
import { useCharacterSnapshots } from '@/db/hooks/useSnapshots'
import { useChapter, useEvent, useTimelines } from '@/db/hooks/useTimeline'
import { useLocationMarker } from '@/db/hooks/useLocationMarkers'
import { useItems } from '@/db/hooks/useItems'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/EmptyState'

function SnapshotRow({
  snapshotId: _snapshotId,
  eventId,
  isAlive,
  locationMarkerId,
  inventoryItemIds,
  statusNotes,
  worldId,
  isActive,
  timelines,
  onClick,
}: {
  snapshotId: string
  eventId: string
  isAlive: boolean
  locationMarkerId: string | null
  inventoryItemIds: string[]
  statusNotes: string
  worldId: string
  isActive: boolean
  timelines: Timeline[]
  onClick: () => void
}) {
  const event = useEvent(eventId)
  const chapter = useChapter(event?.chapterId ?? null)
  const location = useLocationMarker(locationMarkerId)
  const items = useItems(worldId)
  const timeline = chapter ? timelines.find((t) => t.id === chapter.timelineId) ?? null : null

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
      {snapshots.map((snap) => (
        <SnapshotRow
          key={snap.id}
          snapshotId={snap.id}
          eventId={snap.eventId}
          isAlive={snap.isAlive}
          locationMarkerId={snap.currentLocationMarkerId}
          inventoryItemIds={snap.inventoryItemIds}
          statusNotes={snap.statusNotes}
          worldId={character.worldId}
          isActive={snap.eventId === activeEventId}
          timelines={timelines}
          onClick={() => setActiveEventId(snap.eventId)}
        />
      ))}
    </div>
  )
}
