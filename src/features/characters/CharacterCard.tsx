import { useNavigate, useParams } from 'react-router-dom'
import { MapPin, Package } from 'lucide-react'
import type { Character } from '@/types'
import { PortraitImage } from '@/components/PortraitImage'
import { useSnapshot } from '@/db/hooks/useSnapshots'
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
  const navigate = useNavigate()
  const { worldId } = useParams<{ worldId: string }>()
  const activeEventId = useActiveEventId()
  const snapshot = useSnapshot(character.id, activeEventId)

  return (
    <div
      onClick={() => navigate(`/worlds/${worldId}/characters/${character.id}`)}
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))]',
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
          <span className="font-medium text-[hsl(var(--foreground))] truncate">{character.name}</span>
          {snapshot && !snapshot.isAlive && (
            <span className="text-xs text-red-400">deceased</span>
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
          </div>
        ) : (
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">No snapshot for selected chapter</p>
        )}
      </div>
    </div>
  )
}
