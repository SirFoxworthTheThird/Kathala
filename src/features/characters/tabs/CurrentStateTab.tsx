import { useState, useEffect, useMemo } from 'react'
import { MapPin, Package, Plus, X, Heart, Skull, Footprints, History } from 'lucide-react'
import type { Character } from '@/types'
import { useResolvedCharacterSnapshot, useBestSnapshots, useCharacterSnapshots, upsertSnapshot } from '@/db/hooks/useSnapshots'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { computeSortKeySync } from '@/lib/sortKey'
import { removeItemPlacement } from '@/db/hooks/useItemPlacements'
import { useItems, createItem } from '@/db/hooks/useItems'
import { useLocationMarkers, useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useRootMapLayers } from '@/db/hooks/useMapLayers'
import { useTravelModes } from '@/db/hooks/useTravelModes'
import { useActiveEventId } from '@/store'
import { useGate } from '@/db/hooks/ReadingGateContext'
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
  const snapshot = useResolvedCharacterSnapshot(character.id, character.worldId, activeEventId)
  const isInherited = !!snapshot && snapshot.eventId !== activeEventId
  const chapterSnapshots = useBestSnapshots(character.worldId, activeEventId)
  const items = useItems(character.worldId)
  const maps = useRootMapLayers(character.worldId)
  const firstMapId = maps[0]?.id ?? null
  const locationMarkers = useLocationMarkers(firstMapId)
  const travelModes = useTravelModes(character.worldId)
  const allMarkers = useAllLocationMarkers(character.worldId)
  const gate = useGate()

  /*
    Does the record already have them dying, before the moment being edited?
    That is what makes "they came back" a sentence rather than a stray control,
    so it decides whether the checkbox is offered at all. `sortKey` is the
    global order every snapshot carries — chapter × 10_000 + scene — and the
    hook is already cut at the reading cursor, so this cannot see ahead.
  */
  const ownSnapshots = useCharacterSnapshots(character.id)
  const worldEvents = useWorldEvents(character.worldId)
  const worldChapters = useWorldChapters(character.worldId)
  const diedEarlier = useMemo(() => {
    if (!activeEventId) return false
    const here = computeSortKeySync(
      activeEventId,
      new Map(worldEvents.map((e) => [e.id, e])),
      new Map(worldChapters.map((c) => [c.id, c.number])),
    )
    if (here < 0) return false
    /*
      Strictly before, and the *last* one — not "is there a death anywhere".
      Strictly, so that once the writer has saved the revival here the control
      stays put and can be un-ticked; last, so that a death followed by a
      recorded return does not keep offering it forever.
    */
    const before = ownSnapshots
      .filter((sn) => (sn.sortKey ?? -1) < here)
      .sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0))
    return before.length > 0 && !before[before.length - 1].isAlive
  }, [ownSnapshots, activeEventId, worldEvents, worldChapters])

  const [isAlive, setIsAlive] = useState(true)
  const [revived, setRevived] = useState(false)
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
      setRevived(!!snapshot.revived)
      setLocationId(snapshot.currentLocationMarkerId ?? '')
      setInventoryIds(snapshot.inventoryItemIds)
      setStatusNotes(snapshot.statusNotes)
      setInventoryNotes(snapshot.inventoryNotes)
      setTravelModeId(snapshot.travelModeId ?? '')
      setDirty(false)
    } else {
      setIsAlive(true)
      setRevived(false)
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
        <p>Select a scene from the timeline bar to view and edit state.</p>
      </div>
    )
  }

  // The whole tab is a form, so reading mode gets its own rendering of the same
  // snapshot rather than a disabled copy of the editor. It reads from the
  // record, not the form state, which is what a reader is actually asking for:
  // where this character stands at the moment they have read to.
  if (gate.active) {
    const locationName = snapshot?.currentLocationMarkerId
      ? allMarkers.find((m) => m.id === snapshot.currentLocationMarkerId)?.name ?? null
      : null
    const travelName = snapshot?.travelModeId
      ? travelModes.find((m) => m.id === snapshot.travelModeId)?.name ?? null
      : null
    const inventory = (snapshot?.inventoryItemIds ?? [])
      .map((id) => ({ id, item: items.find((i) => i.id === id) ?? null }))

    if (!snapshot) {
      return (
        <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Nothing recorded for {character.name} at this point in the story.
        </p>
      )
    }

    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <span className="flex w-fit items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 py-1 text-sm">
            {snapshot.isAlive
              ? <><Heart className="h-3.5 w-3.5 text-green-400" aria-hidden="true" /> Alive</>
              : <><Skull className="h-3.5 w-3.5 text-red-400" aria-hidden="true" /> Deceased</>}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Current Location
          </Label>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {locationName ?? <span className="italic">Unknown</span>}
          </p>
        </div>

        {travelName && (
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              <Footprints className="h-3.5 w-3.5" aria-hidden="true" /> Arrived by
            </Label>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{travelName}</p>
          </div>
        )}

        {snapshot.statusNotes && (
          <div className="flex flex-col gap-1.5">
            <Label>Status Notes</Label>
            <p className="whitespace-pre-wrap text-sm text-[hsl(var(--muted-foreground))]">{snapshot.statusNotes}</p>
          </div>
        )}

        {inventory.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" aria-hidden="true" /> Inventory
            </Label>
            <div className="flex flex-col gap-1">
              {inventory.map(({ id, item }) => (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-1.5"
                >
                  <PortraitImage
                    imageId={item?.imageId ?? null}
                    fallbackIcon={Package}
                    className="h-6 w-6 rounded object-cover shrink-0"
                    fallbackClassName="h-6 w-6 rounded shrink-0"
                  />
                  <span className="flex-1 text-sm">{item?.name ?? id}</span>
                </div>
              ))}
            </div>
            {snapshot.inventoryNotes && (
              <p className="whitespace-pre-wrap text-xs text-[hsl(var(--muted-foreground))]">
                {snapshot.inventoryNotes}
              </p>
            )}
          </div>
        )}
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
      // Only alive people come back, so the flag cannot outlive the state it
      // qualifies — marking somebody deceased clears it rather than leaving a
      // record that says they are dead and were revived here.
      revived: isAlive && revived,
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
      {isInherited && (
        <div className="flex items-start gap-2 rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
          <History className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            This state is{' '}
            <strong className="font-medium text-[hsl(var(--foreground))]">carried forward</strong>{' '}
            from an earlier chapter — nothing has been recorded here yet. Editing and saving will pin it to this chapter.
          </span>
        </div>
      )}

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
            onClick={() => mark(() => { setIsAlive(false); setRevived(false) })}
          >
            <Skull className="h-3.5 w-3.5" /> Deceased
          </Button>
        </div>
        {/*
          Offered only where it can mean something. "Came back here" on a living
          character who has never died is a control with nothing to do, and on a
          deceased one it contradicts the button next to it — so it appears when
          they are alive and the record already has them dying earlier.

          It is the character's form of an item's *repaired* and a place's
          *rebuilt*: the writer states what happened, and the continuity check
          has nothing to report, instead of reporting it and being told to be
          quiet.
        */}
        {isAlive && diedEarlier && (
          <label className="mt-1 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <input
              type="checkbox"
              checked={revived}
              onChange={(e) => mark(() => setRevived(e.target.checked))}
              className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
            />
            They came back in this scene
          </label>
        )}
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
