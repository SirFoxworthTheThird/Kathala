import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete, journalGroup } from './useOperations'
import type { CharacterSnapshot, ItemPlacement, ItemSnapshot } from '@/types'
import type { ItemPlan } from '@/lib/sceneHeader'
import { generateId } from '@/lib/id'
import { upsertSnapshot } from './useSnapshots'
import { upsertItemSnapshot } from './useItemSnapshots'
import { computeSortKey } from '@/lib/sortKey'
import { resolveSnapshot } from '@/lib/snapshotUtils'

export function useItemPlacement(itemId: string | null, eventId: string | null) {
  return useLiveQuery(
    () =>
      itemId && eventId
        ? db.itemPlacements.where('[itemId+eventId]').equals([itemId, eventId]).first()
        : undefined,
    [itemId, eventId]
  )
}

export function useLocationItemPlacements(locationMarkerId: string | null, eventId: string | null) {
  return useLiveQuery(
    () =>
      locationMarkerId && eventId
        ? db.itemPlacements
            .where('locationMarkerId').equals(locationMarkerId)
            .filter((p) => p.eventId === eventId)
            .toArray()
        : [],
    [locationMarkerId, eventId],
    []
  )
}

export function useEventItemPlacements(eventId: string | null) {
  return useLiveQuery(
    () =>
      eventId
        ? db.itemPlacements.where('eventId').equals(eventId).toArray()
        : [],
    [eventId],
    []
  )
}

/** @deprecated use useEventItemPlacements */
export const useChapterItemPlacements = useEventItemPlacements

export function useWorldItemPlacements(worldId: string | null) {
  return useLiveQuery(
    () =>
      worldId
        ? db.itemPlacements.where('worldId').equals(worldId).toArray()
        : [],
    [worldId],
    []
  )
}

/**
 * Place an item at a location for an event, taking it out of whoever is holding
 * it at that moment.
 *
 * "Whoever is holding it" is the resolved holder, not a literal record at this
 * event. State is last-known, so the ordinary holder is somebody recorded
 * chapters earlier with nothing since — and this used to look them up with
 * `where('eventId').equals(eventId)`, which cannot see them. The item then sat
 * at the location *and* in their hands at the same moment, and the continuity
 * checker's `dup-item` rule could not report it, because that rule compares
 * literal records at one scene as well. A blind run tried four times to make
 * `dup-item` fire and concluded it might be unreachable; this was the half of
 * the picture that was actually broken.
 *
 * The picker on the location panel already had it right: it reads resolved
 * snapshots and offers a held item as *"(move from elsewhere)"*. Only the write
 * disagreed.
 *
 * The earlier record is left exactly as written — it is the writer's statement
 * about that scene. What is written instead is a new record **here**, carrying
 * the rest of their last-known state, which is the same rule the Current State
 * panel's hand-off follows.
 */
export async function placeItemAtLocation(
  worldId: string,
  itemId: string,
  eventId: string,
  locationMarkerId: string,
  notes = '',
): Promise<void> {
  await db.transaction(
    'rw',
    [db.itemPlacements, db.characterSnapshots, db.events, db.chapters, db.operations, db.tombstones],
    async () => {
      const allEvents = await db.events.where('worldId').equals(worldId).toArray()
      const allChapters = await db.chapters.where('worldId').equals(worldId).toArray()

      // Anyone who has ever held it is a candidate; whether they still do at
      // this moment is what `resolveSnapshot` decides.
      const everHeld = await db.characterSnapshots
        .where('worldId').equals(worldId)
        .filter((s) => s.inventoryItemIds.includes(itemId))
        .toArray()
      for (const characterId of new Set(everHeld.map((s) => s.characterId))) {
        const own = await db.characterSnapshots.where('characterId').equals(characterId).toArray()
        const held = resolveSnapshot(own, eventId, allEvents, allChapters)
        if (!held?.inventoryItemIds.includes(itemId)) continue
        // Identity fields dropped rather than spread, and `eventId` named: a
        // resolved snapshot's own `eventId` is usually an earlier scene, and
        // letting it ride along would rewrite that scene instead of this one.
        const { id: _id, sortKey: _sortKey, createdAt: _createdAt, updatedAt: _updatedAt, ...carried } = held
        await upsertSnapshot({
          ...carried,
          // Spelled out, not shorthand: the rule in snapshotWriteScenes.test.ts
          // wants the scene named at every spreading call, and a destructured
          // shorthand is exactly where the wrong one could hide.
          eventId: eventId,
          inventoryItemIds: carried.inventoryItemIds.filter((id) => id !== itemId),
        })
      }

      // Upsert the placement
      const existing = await db.itemPlacements
        .where('[itemId+eventId]').equals([itemId, eventId]).first()
      const now = Date.now()
      if (existing) {
        await journalUpdate('itemPlacement', db.itemPlacements, existing.id, { locationMarkerId, notes, updatedAt: now })
      } else {
        const placement: ItemPlacement = {
          id: generateId(),
          worldId,
          itemId,
          eventId,
          locationMarkerId,
          notes,
          createdAt: now,
          updatedAt: now,
        }
        await journalCreate('itemPlacement', db.itemPlacements, placement)
      }
    },
  )
}

/** Remove an item's location placement (item becomes "nowhere" / untracked). */
export async function removeItemPlacement(itemId: string, eventId: string): Promise<void> {
  const existing = await db.itemPlacements.where('[itemId+eventId]').equals([itemId, eventId]).first()
  if (!existing) return
  await journalDelete('itemPlacement', db.itemPlacements, existing.id, async () => {
    await db.itemPlacements.delete(existing.id)
  })
}

/**
 * `^Ash Ledger:@Sabine Varro` in a scene's header: the item is Sabine's from
 * this scene.
 *
 * The same hand-off the Current State panel makes. Whoever holds it at this
 * moment — resolved, not only a record at this scene — gets a state here
 * without it; a placement here goes; and Sabine's state here lists it. A state
 * made here carries the rest of her last one, with every field named and the
 * scene given as this one: her last state is an earlier scene's record.
 */
export async function handItemTo(worldId: string, itemId: string, eventId: string, characterId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.itemPlacements, db.characterSnapshots, db.events, db.chapters, db.operations, db.tombstones],
    async () => {
      const allEvents = await db.events.where('worldId').equals(worldId).toArray()
      const allChapters = await db.chapters.where('worldId').equals(worldId).toArray()
      const everHeld = await db.characterSnapshots
        .where('worldId').equals(worldId)
        .filter((s) => s.inventoryItemIds.includes(itemId))
        .toArray()
      for (const other of new Set(everHeld.map((s) => s.characterId))) {
        if (other === characterId) continue
        const own = await db.characterSnapshots.where('characterId').equals(other).toArray()
        const held = resolveSnapshot(own, eventId, allEvents, allChapters)
        if (!held?.inventoryItemIds.includes(itemId)) continue
        const { id: _id, sortKey: _sortKey, createdAt: _createdAt, updatedAt: _updatedAt, ...carried } = held
        await upsertSnapshot({
          ...carried,
          eventId: eventId,
          inventoryItemIds: carried.inventoryItemIds.filter((id) => id !== itemId),
        })
      }
      await removeItemPlacement(itemId, eventId)

      const own = await db.characterSnapshots.where('characterId').equals(characterId).toArray()
      const here = own.find((s) => s.eventId === eventId)
      if (here) {
        if (!here.inventoryItemIds.includes(itemId)) {
          await journalUpdate('characterSnapshot', db.characterSnapshots, here.id, { inventoryItemIds: [...here.inventoryItemIds, itemId], updatedAt: Date.now() })
        }
        return
      }
      const prev = resolveSnapshot(own, eventId, allEvents, allChapters)
      await upsertSnapshot({
        worldId,
        characterId,
        eventId: eventId,
        isAlive: prev?.isAlive ?? true,
        currentLocationMarkerId: prev?.currentLocationMarkerId ?? null,
        currentMapLayerId: prev?.currentMapLayerId ?? null,
        inventoryItemIds: (prev?.inventoryItemIds ?? []).filter((id) => id !== itemId).concat(itemId),
        inventoryNotes: prev?.inventoryNotes ?? '',
        statusNotes: '',
        travelModeId: prev?.travelModeId ?? null,
      }, { confirmUnchanged: true })
    },
  )
}

/**
 * The item goes back to whoever had it before this scene, where that is one
 * person: somebody whose state here lacks it and whose state before had it is
 * who a hand-off or a placement here took it from. With nobody, or with
 * several, it is left where it is — guessing which of two people would be the
 * app deciding.
 */
async function giveBackToLastHolder(itemId: string, eventId: string): Promise<void> {
  const here = await db.characterSnapshots.where('eventId').equals(eventId).toArray()
  const lost: CharacterSnapshot[] = []
  for (const s of here) {
    if (s.inventoryItemIds.includes(itemId)) return
    const before = (await db.characterSnapshots.where('characterId').equals(s.characterId).toArray())
      .filter((b) => (b.sortKey ?? 0) < (s.sortKey ?? 0))
      .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]
    if (before?.inventoryItemIds.includes(itemId)) lost.push(s)
  }
  if (lost.length !== 1) return
  await journalUpdate('characterSnapshot', db.characterSnapshots, lost[0].id, { inventoryItemIds: [...lost[0].inventoryItemIds, itemId], updatedAt: Date.now() })
}

/** A hand-off at this scene taken back: out of their state here, and back to whoever had it before. */
export async function takeItemBack(itemId: string, eventId: string, characterId: string): Promise<void> {
  const here = await db.characterSnapshots.where('[characterId+eventId]').equals([characterId, eventId]).first()
  if (here?.inventoryItemIds.includes(itemId)) {
    await journalUpdate('characterSnapshot', db.characterSnapshots, here.id, { inventoryItemIds: here.inventoryItemIds.filter((id) => id !== itemId), updatedAt: Date.now() })
  }
  await giveBackToLastHolder(itemId, eventId)
}

/**
 * Write what a header's Items line asks for (`planHeader`), as one undo step:
 * what is taken off it first, so an item moved from one person to another is
 * taken back and then given.
 */
export async function recordItemChanges(
  worldId: string,
  eventId: string,
  plan: Pick<ItemPlan, 'give' | 'put' | 'takeBack' | 'unput'> & Partial<Pick<ItemPlan, 'condition' | 'uncondition'>>,
): Promise<void> {
  const condition = plan.condition ?? []
  const uncondition = plan.uncondition ?? []
  if (!plan.give.length && !plan.put.length && !plan.takeBack.length && !plan.unput.length && !condition.length && !uncondition.length) return
  await journalGroup(async () => {
    for (const itemId of uncondition) await takeConditionBack(itemId, eventId)
    for (const { itemId, condition: c } of condition) await setItemConditionAt(worldId, itemId, eventId, c)
    for (const { itemId, characterId } of plan.takeBack) await takeItemBack(itemId, eventId, characterId)
    for (const itemId of plan.unput) {
      await removeItemPlacement(itemId, eventId)
      await giveBackToLastHolder(itemId, eventId)
    }
    for (const { itemId, characterId } of plan.give) await handItemTo(worldId, itemId, eventId, characterId)
    for (const { itemId, placeId } of plan.put) await placeItemAtLocation(worldId, itemId, eventId, placeId)
  }, { label: 'Items at this scene' })
}

/** The item's state before scene `eventId`, by the stored order. */
async function itemStateBefore(itemId: string, eventId: string): Promise<ItemSnapshot | undefined> {
  const sortKey = await computeSortKey(eventId)
  return (await db.itemSnapshots.where('itemId').equals(itemId).toArray())
    .filter((s) => (s.sortKey ?? 0) < sortKey)
    .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]
}

/**
 * Record an item's condition at a scene, as the Items line's `^Ash
 * Ledger:damaged` says: the state here takes it, or — with none here — one is
 * made, carrying the notes of the state before. The condition it already had
 * by then needs no state, and gets none.
 */
export async function setItemConditionAt(worldId: string, itemId: string, eventId: string, condition: string): Promise<void> {
  const here = await db.itemSnapshots.where('[itemId+eventId]').equals([itemId, eventId]).first()
  if (here) {
    if (here.condition !== condition) await journalUpdate('itemSnapshot', db.itemSnapshots, here.id, { condition, updatedAt: Date.now() })
    return
  }
  // `upsertItemSnapshot` writes nothing for a state the same as the one before.
  const before = await itemStateBefore(itemId, eventId)
  await upsertItemSnapshot({ worldId, itemId, eventId, condition, notes: before?.notes ?? '' })
}

/**
 * A condition taken off the Items line: the state here goes back to the
 * condition before it. A state that said nothing else — its notes the ones it
 * carried on — goes altogether; one with notes of its own written here keeps
 * them.
 */
export async function takeConditionBack(itemId: string, eventId: string): Promise<void> {
  const here = await db.itemSnapshots.where('[itemId+eventId]').equals([itemId, eventId]).first()
  if (!here) return
  const before = await itemStateBefore(itemId, eventId)
  if (here.notes === (before?.notes ?? '')) {
    await journalDelete('itemSnapshot', db.itemSnapshots, here.id, async () => { await db.itemSnapshots.delete(here.id) })
    return
  }
  await journalUpdate('itemSnapshot', db.itemSnapshots, here.id, { condition: before?.condition ?? '', updatedAt: Date.now() })
}
