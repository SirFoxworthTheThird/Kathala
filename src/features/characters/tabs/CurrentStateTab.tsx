import { useState, useEffect, useMemo } from 'react'
import { MapPin, Package, Plus, X, Heart, Skull, Footprints, History } from 'lucide-react'
import type { Character } from '@/types'
import { useResolvedCharacterSnapshot, useBestSnapshots, useCharacterSnapshots, upsertSnapshot, carryFieldForward } from '@/db/hooks/useSnapshots'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { computeSortKeySync } from '@/lib/sortKey'
import { removeItemPlacement } from '@/db/hooks/useItemPlacements'
import { useItems, createItem } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useTravelModes } from '@/db/hooks/useTravelModes'
import { useActiveEventId, useAppStore } from '@/store'
import {
  carryForwardPlan, describeCarryForward, sameFieldValue,
  type CarryField, type CarryForwardPlan,
} from '@/lib/carryForward'
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
  /*
    N2: this used to offer, and display, only the markers on the world's *first
    root map* — and `useRootMapLayers` returns an unordered `toArray()`, so
    which map that was had nothing to do with the writer either. In the shipped
    Monte Cristo, 373 of 417 character snapshots (89.4%) point at a marker on
    some other layer, so this tab read "Unknown / not set" for nine records in
    ten while the History tab beside it named the place correctly.

    Every marker in the world is offered now, sorted by name rather than left in
    Dexie's primary-key order, which for nanoid ids is arbitrary.
  */
  const allMarkers = useAllLocationMarkers(character.worldId)
  const markerOptions = useMemo(
    () => [...allMarkers].sort((a, b) => a.name.localeCompare(b.name)),
    [allMarkers],
  )
  const travelModes = useTravelModes(character.worldId)
  const gate = useGate()

  /*
    Does the record already have them dying, before the moment being edited?
    That is what makes "they came back" a sentence rather than a stray control,
    so it decides whether the checkbox is offered at all. `sortKey` is the
    global order every snapshot carries — `chapter.number + sortOrder / 1_000_000`,
    which is what `computeSortKeySync` below returns — and the hook is already cut
    at the reading cursor, so this cannot see ahead.
  */
  const ownSnapshots = useCharacterSnapshots(character.id)
  const worldEvents = useWorldEvents(character.worldId)
  const worldChapters = useWorldChapters(character.worldId)
  const pushToast = useAppStore((s) => s.pushToast)
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

  /*
    F2: a snapshot is a whole state record, so what is saved here reaches
    forward only until the next scene that recorded anything at all — and the
    most natural draft-two edit, "actually she has had this since chapter one",
    stops there with nothing said. The record at that later scene is the
    writer's statement about it and is not overwritten; what was missing is
    being told, and being offered the choice.
  */
  function noticeWhereThisStops(before: typeof snapshot) {
    if (!before || !activeEventId) return
    type Change = { field: CarryField; previous: unknown; next: unknown }
    const changes: Change[] = ([
      { field: 'inventoryItemIds', previous: before.inventoryItemIds, next: inventoryIds },
      { field: 'currentLocationMarkerId', previous: before.currentLocationMarkerId, next: locationId || null },
      { field: 'isAlive', previous: before.isAlive, next: isAlive },
      { field: 'statusNotes', previous: before.statusNotes, next: statusNotes },
      { field: 'inventoryNotes', previous: before.inventoryNotes, next: inventoryNotes },
      { field: 'travelModeId', previous: before.travelModeId, next: travelModeId || null },
    ] as Change[]).filter((c) => !sameFieldValue(c.previous, c.next))

    const planned = changes
      .map((c) => ({ ...c, plan: carryForwardPlan({
        snapshots: ownSnapshots, fromEventId: activeEventId, field: c.field,
        previousValue: c.previous, events: worldEvents, chapters: worldChapters,
      }) }))
      .filter((c) => c.plan.targets.length > 0)

    if (planned.length === 0) return

    // The sentence names one field, so it names the one with most to say.
    const primary = [...planned].sort((a, b) => b.plan.targets.length - a.plan.targets.length)[0]
    const message = describeCarryForward(primary.plan as CarryForwardPlan, character.name, primary.field)
    if (!message) return

    pushToast({
      message,
      actionLabel: 'Carry it forward',
      onAction: () => {
        // Every changed field, not just the one named: the sentence is a
        // summary, the action is the whole edit.
        void Promise.all(planned.map((c) =>
          carryFieldForward(c.plan.targets.map((t) => t.snapshot), c.field, c.next as never)))
      },
    })
  }

  async function save() {
    // Read before writing: `snapshot` is a live query and will have moved on.
    const before = snapshot
    /*
      An item has one holder, so taking it here takes it from whoever had it —
      **recorded at this scene**, not written back over the scene where they
      last held it.

      `useBestSnapshots` resolves each character's *last known* record at or
      before the cursor, so for someone untouched since Chapter 1 it hands back
      their Chapter 1 row. Spreading that row carried its `eventId` with it, and
      `upsertSnapshot` dutifully updated the record it named: handing an item
      over deleted the previous holder's evidence of ever having held it. The
      Whereabouts chain then showed the shortened history and looked right.

      Forcing `eventId` writes a new row here instead, carrying the rest of
      their last-known state forward — the same rule as everywhere else: a
      record at a scene is an assertion about that scene and is never rewritten
      from somewhere later. The identity fields are dropped rather than spread,
      because an `id` reaching `upsertSnapshot` would name a row that already
      exists.
    */
    const others = chapterSnapshots.filter(
      (s) => s.characterId !== character.id && s.inventoryItemIds.some((id) => inventoryIds.includes(id))
    )
    await Promise.all(
      others.map(({ id: _id, sortKey: _sortKey, createdAt: _createdAt, updatedAt: _updatedAt, ...held }) =>
        upsertSnapshot({
          ...held,
          eventId: activeEventId!,
          inventoryItemIds: held.inventoryItemIds.filter((id) => !inventoryIds.includes(id)),
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
      // The layer the chosen marker actually lives on. This wrote the first root
      // map unconditionally, so saving *any* edit — a typo in a status note —
      // left the marker and the layer disagreeing, which cost a travel route on
      // the following scene.
      currentMapLayerId: allMarkers.find((m) => m.id === locationId)?.mapLayerId ?? null,
      inventoryItemIds: inventoryIds,
      inventoryNotes,
      statusNotes,
      travelModeId: travelModeId || null,
    })
    setDirty(false)
    noticeWhereThisStops(before)
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
            from an earlier scene — nothing has been recorded here yet. Editing and saving will pin it to this scene.
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
            {markerOptions.map((m) => (
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
            <Select onValueChange={(v) => mark(() => setInventoryIds((ids) => [...ids, v]))} value="">
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
