import { MapPin, Package, Heart, Skull, BookOpen } from 'lucide-react'
import type { Character } from '@/types'
import { useCharacterSnapshots } from '@/db/hooks/useSnapshots'
import { useChapter } from '@/db/hooks/useTimeline'
import { useLocationMarker } from '@/db/hooks/useLocationMarkers'
import { useItems } from '@/db/hooks/useItems'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

function SnapshotRow({
  snapshotId: _snapshotId,
  eventId,
  isAlive,
  locationMarkerId,
  inventoryItemIds,
  statusNotes,
  worldId,
  isActive,
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
  onClick: () => void
}) {
  const chapter = useChapter(eventId)
  const location = useLocationMarker(locationMarkerId)
  const items = useItems(worldId)

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
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm font-medium">
            {chapter ? `Ch. ${chapter.number} — ${chapter.title}` : eventId}
          </span>
        </div>
        {isAlive ? (
          <Heart className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <Skull className="h-3.5 w-3.5 text-red-400" />
        )}
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
  const { activeEventId, setActiveEventId } = useAppStore()

  if (snapshots.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        No snapshots recorded yet. Select a chapter and save state in the "Current State" tab.
      </p>
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
          onClick={() => setActiveEventId(snap.eventId)}
        />
      ))}
    </div>
  )
}
