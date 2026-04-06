import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { ItemPlacement } from '@/types'
import { generateId } from '@/lib/id'

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

/** Place an item at a location for an event.
 *  Automatically removes it from any character's inventory in that event. */
export async function placeItemAtLocation(
  worldId: string,
  itemId: string,
  eventId: string,
  locationMarkerId: string,
  notes = '',
): Promise<void> {
  await db.transaction('rw', [db.itemPlacements, db.characterSnapshots], async () => {
    // Remove from any character's inventory in this event
    const snapshotsWithItem = await db.characterSnapshots
      .where('eventId').equals(eventId)
      .filter((s) => s.inventoryItemIds.includes(itemId))
      .toArray()
    for (const snap of snapshotsWithItem) {
      await db.characterSnapshots.update(snap.id, {
        inventoryItemIds: snap.inventoryItemIds.filter((id) => id !== itemId),
        updatedAt: Date.now(),
      })
    }

    // Upsert the placement
    const existing = await db.itemPlacements
      .where('[itemId+eventId]').equals([itemId, eventId]).first()
    const now = Date.now()
    if (existing) {
      await db.itemPlacements.update(existing.id, { locationMarkerId, notes, updatedAt: now })
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
      await db.itemPlacements.add(placement)
    }
  })
}

/** Remove an item's location placement (item becomes "nowhere" / untracked). */
export async function removeItemPlacement(itemId: string, eventId: string): Promise<void> {
  await db.itemPlacements.where('[itemId+eventId]').equals([itemId, eventId]).delete()
}
