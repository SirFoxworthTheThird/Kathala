import { useParams, Link } from 'react-router-dom'
import { MapPin, Package, Skull } from 'lucide-react'
import type { Character } from '@/types'
import { PortraitImage } from '@/components/PortraitImage'
import { InheritedBadge } from '@/components/InheritedBadge'
import { useResolvedCharacterSnapshot } from '@/db/hooks/useSnapshots'
import { useActiveEventId } from '@/store'
import { useLocationMarker } from '@/db/hooks/useLocationMarkers'
import { cn } from '@/lib/utils'

interface CharacterCardProps {
  character: Character
}

function LocationBadge({ locationId }: { locationId: string | null }) {
  const loc = useLocationMarker(locationId)
  if (!loc) return null
  return (
    <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
      <MapPin className="h-3 w-3" />
      {loc.name}
    </span>
  )
}

export function CharacterCard({ character }: CharacterCardProps) {
  const { worldId } = useParams<{ worldId: string }>()
  const activeEventId = useActiveEventId()
  const snapshot = useResolvedCharacterSnapshot(character.id, character.worldId, activeEventId)
  const isInherited = !!snapshot && snapshot.eventId !== activeEventId

  return (
    // A Link rather than a clickable div — see ItemCard.
    <Link
      to={`/worlds/${worldId}/characters/${character.id}`}
      className={cn(
        'group flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))]',
        snapshot && !snapshot.isAlive && 'opacity-60'
      )}
    >
      <PortraitImage
        imageId={character.portraitImageId}
        alt={character.name}
        className="h-12 w-12 rounded-full object-cover"
        fallbackClassName="h-12 w-12 rounded-full"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium truncate', snapshot && !snapshot.isAlive ? 'text-[hsl(var(--muted-foreground))] line-through' : 'text-[hsl(var(--foreground))]')}>{character.name}</span>
          {snapshot && !snapshot.isAlive && (
            <span className="flex items-center gap-0.5 text-xs text-red-400">
              <Skull className="h-3 w-3" aria-hidden="true" />
              deceased
            </span>
          )}
        </div>
        {snapshot ? (
          <div className="mt-0.5 flex flex-col gap-0.5">
            <LocationBadge locationId={snapshot.currentLocationMarkerId} />
            {snapshot.inventoryItemIds.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                <Package className="h-3 w-3" />
                {snapshot.inventoryItemIds.length} item{snapshot.inventoryItemIds.length !== 1 ? 's' : ''}
              </span>
            )}
            {isInherited && <InheritedBadge className="mt-0.5 self-start" />}
          </div>
        ) : activeEventId ? (
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">No state recorded for this chapter</p>
        ) : (
          <p className="mt-0.5 text-xs italic text-[hsl(var(--muted-foreground)/0.7)]">Pick a chapter to see where they are</p>
        )}
      </div>
    </Link>
  )
}
