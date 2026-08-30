import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import type { ItemPlacement } from '@/types'
import { generateId } from '@/lib/id'
import { upsertSnapshot } from './useSnapshots'
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
