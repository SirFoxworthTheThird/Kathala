import { MapPin, Package, Heart, Skull } from 'lucide-react'
import type { CharacterSnapshot } from '@/types'
import { useCharacter } from '@/db/hooks/useCharacters'
import { useLocationMarker } from '@/db/hooks/useLocationMarkers'
import { useItems } from '@/db/hooks/useItems'
import { PortraitImage } from '@/components/PortraitImage'

interface SnapshotCardProps {
  snapshot: CharacterSnapshot
}

export function SnapshotCard({ snapshot }: SnapshotCardProps) {
  const character = useCharacter(snapshot.characterId)
  const location = useLocationMarker(snapshot.currentLocationMarkerId)
  const items = useItems(snapshot.worldId)

  if (!character) return null

  const heldItems = snapshot.inventoryItemIds
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean)

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <div className="flex items-center gap-2 mb-2">
        <PortraitImage
          imageId={character.portraitImageId}
          alt={character.name}
          className="h-8 w-8 rounded-full object-cover"
          fallbackClassName="h-8 w-8 rounded-full"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{character.name}</span>
            {snapshot.isAlive ? (
              <Heart className="h-3 w-3 text-green-400 shrink-0" />
            ) : (
              <Skull className="h-3 w-3 text-red-400 shrink-0" />
            )}
          </div>
        </div>
      </div>

      {location && (
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          <MapPin className="h-3 w-3 shrink-0" />
          {location.name}
        </div>
      )}

      {heldItems.length > 0 && (
        <div className="flex flex-col gap-0.5 mt-1">
          {heldItems.map((item) => (
            <div key={item!.id} className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <PortraitImage
                imageId={item!.imageId}
                fallbackIcon={Package}
                className="h-4 w-4 rounded object-cover shrink-0"
                fallbackClassName="h-4 w-4 rounded shrink-0"
              />
              <span className="truncate">{item!.name}</span>
            </div>
          ))}
        </div>
      )}

      {snapshot.statusNotes && (
        <p className="mt-1 whitespace-pre-wrap break-words text-xs italic text-[hsl(var(--muted-foreground))]">{snapshot.statusNotes}</p>
      )}
    </div>
  )
}
