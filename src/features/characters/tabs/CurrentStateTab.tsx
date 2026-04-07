import { useState, useEffect } from 'react'
import { MapPin, Package, Plus, X, Heart, Skull, Footprints } from 'lucide-react'
import type { Character } from '@/types'
import { useSnapshot, useChapterSnapshots, upsertSnapshot } from '@/db/hooks/useSnapshots'
import { removeItemPlacement } from '@/db/hooks/useItemPlacements'
import { useItems, createItem } from '@/db/hooks/useItems'
import { useLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useRootMapLayers } from '@/db/hooks/useMapLayers'
import { useTravelModes } from '@/db/hooks/useTravelModes'
import { useActiveEventId } from '@/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { PortraitImage } from '@/components/PortraitImage'

interface CurrentStateTabProps {
  character: Character
}

export function CurrentStateTab({ character }: CurrentStateTabProps) {
  const activeEventId = useActiveEventId()
  const snapshot = useSnapshot(character.id, activeEventId)
  const chapterSnapshots = useChapterSnapshots(activeEventId)
  const items = useItems(character.worldId)
  const maps = useRootMapLayers(character.worldId)
  const firstMapId = maps[0]?.id ?? null
  const locationMarkers = useLocationMarkers(firstMapId)
  const travelModes = useTravelModes(character.worldId)

  const [isAlive, setIsAlive] = useState(true)
  const [locationId, setLocationId] = useState<string>('')
  const [inventoryIds, setInventoryIds] = useState<string[]>([])
  const [statusNotes, setStatusNotes] = useState('')
  const [inventoryNotes, setInventoryNotes] = useState('')
  const [travelModeId, setTravelModeId] = useState<string>('')
  const [newItemName, setNewItemName] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (snapshot) {
      setIsAlive(snapshot.isAlive)
      setLocationId(snapshot.currentLocationMarkerId ?? '')
      setInventoryIds(snapshot.inventoryItemIds)
      setStatusNotes(snapshot.statusNotes)
      setInventoryNotes(snapshot.inventoryNotes)
      setTravelModeId(snapshot.travelModeId ?? '')
      setDirty(false)
    } else {
      setIsAlive(true)
      setLocationId('')
      setInventoryIds([])
      setStatusNotes('')
      setInventoryNotes('')
      setTravelModeId('')
      setDirty(false)
    }
  }, [snapshot])

  if (!activeEventId) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        <p>Select a chapter from the top bar to view and edit state.</p>
      </div>
    )
  }

  async function save() {
    // Remove these items from any other character's snapshot in the same chapter
    const others = chapterSnapshots.filter(
      (s) => s.characterId !== character.id && s.inventoryItemIds.some((id) => inventoryIds.includes(id))
    )
    await Promise.all(
      others.map((s) =>
        upsertSnapshot({
          ...s,
          inventoryItemIds: s.inventoryItemIds.filter((id) => !inventoryIds.includes(id)),
        })
      )
    )
    // Also remove any location placements for these items in this chapter
    await Promise.all(inventoryIds.map((id) => removeItemPlacement(id, activeEventId!)))

    await upsertSnapshot({
      worldId: character.worldId,
      characterId: character.id,
      eventId: activeEventId!,
      isAlive,
      currentLocationMarkerId: locationId || null,
      currentMapLayerId: firstMapId,
      inventoryItemIds: inventoryIds,
      inventoryNotes,
      statusNotes,
      travelModeId: travelModeId || null,
    })
    setDirty(false)
  }

  function mark(fn: () => void) {
    fn()
    setDirty(true)
  }

  async function addNewItem() {
    if (!newItemName.trim()) return
    const item = await createItem({
      worldId: character.worldId,
      name: newItemName.trim(),
      description: '',
      iconType: 'item',
      tags: [],
    })
    mark(() => setInventoryIds((ids) => [...ids, item.id]))
    setNewItemName('')
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Alive / Deceased */}
      <div className="flex flex-col gap-1.5">
        <Label>Status</Label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isAlive ? 'default' : 'outline'}
            className="gap-1.5"
            onClick={() => mark(() => setIsAlive(true))}
          >
            <Heart className="h-3.5 w-3.5" /> Alive
          </Button>
          <Button
            size="sm"
            variant={!isAlive ? 'destructive' : 'outline'}
            className="gap-1.5"
            onClick={() => mark(() => setIsAlive(false))}
          >
            <Skull className="h-3.5 w-3.5" /> Deceased
          </Button>
        </div>
      </div>

      {/* Location */}
      <div className="flex flex-col gap-1.5">
        <Label className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> Current Location
        </Label>
        <Select value={locationId} onValueChange={(v) => mark(() => setLocationId(v === 'none' ? '' : v))}>
          <SelectTrigger>
            <SelectValue placeholder="Unknown / not set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unknown / not set</SelectItem>
            {locationMarkers.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Travel mode — how did the character get here? */}
      {travelModes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-1.5">
            <Footprints className="h-3.5 w-3.5" /> Arrived by
          </Label>
          <Select value={travelModeId} onValueChange={(v) => mark(() => setTravelModeId(v === 'none' ? '' : v))}>
            <SelectTrigger>
              <SelectValue placeholder="Unknown / not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unknown / not specified</SelectItem>
              {travelModes.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Status notes */}
      <div className="flex flex-col gap-1.5">
        <Label>Status Notes</Label>
        <Textarea
          placeholder="Physical condition, disguise, mood..."
          value={statusNotes}
          onChange={(e) => { setStatusNotes(e.target.value); setDirty(true) }}
          rows={2}
        />
      </div>

      {/* Inventory */}
      <div className="flex flex-col gap-2">
        <Label className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" /> Inventory
        </Label>

        {inventoryIds.length > 0 && (
          <div className="flex flex-col gap-1">
            {inventoryIds.map((itemId) => {
              const item = items.find((i) => i.id === itemId)
              return (
                <div key={itemId} className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-1.5">
                  <PortraitImage
                    imageId={item?.imageId ?? null}
                    fallbackIcon={Package}
                    className="h-6 w-6 rounded object-cover shrink-0"
                    fallbackClassName="h-6 w-6 rounded shrink-0"
                  />
                  <span className="flex-1 text-sm">{item?.name ?? itemId}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => mark(() => setInventoryIds((ids) => ids.filter((id) => id !== itemId)))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {/* Add existing item — exclude items already held by another character this chapter */}
        {(() => {
          const heldByOthers = new Set(
            chapterSnapshots
              .filter((s) => s.characterId !== character.id)
              .flatMap((s) => s.inventoryItemIds)
          )
          const available = items.filter((i) => !inventoryIds.includes(i.id))
          const free = available.filter((i) => !heldByOthers.has(i.id))
          const taken = available.filter((i) => heldByOthers.has(i.id))
          if (available.length === 0) return null
          return (
            <Select onValueChange={(v) => mark(() => setInventoryIds((ids) => [...ids, v]))}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Add existing item..." />
              </SelectTrigger>
              <SelectContent>
                {free.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
                {taken.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} <span className="opacity-50">(transfer from other character)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        })()}

        {/* Create new item */}
        <div className="flex gap-2">
          <Input
            placeholder="New item name..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && addNewItem()}
          />
          <Button size="sm" variant="outline" onClick={addNewItem} disabled={!newItemName.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Inventory Notes</Label>
          <Textarea
            placeholder="Quantities, conditions, notes..."
            value={inventoryNotes}
            onChange={(e) => { setInventoryNotes(e.target.value); setDirty(true) }}
            rows={2}
          />
        </div>
      </div>

      <Button onClick={save} disabled={!dirty} className="w-full">
        Save State
      </Button>
    </div>
  )
}
