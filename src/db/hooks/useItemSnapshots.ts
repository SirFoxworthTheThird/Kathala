import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { ItemSnapshot } from '@/types'
import { generateId } from '@/lib/id'

export function useItemSnapshot(itemId: string | null, eventId: string | null) {
  return useLiveQuery(
    () =>
      itemId && eventId
        ? db.itemSnapshots
            .where('[itemId+eventId]')
            .equals([itemId, eventId])
            .first()
        : undefined,
    [itemId, eventId]
  )
}

export function useEventItemSnapshots(eventId: string | null) {
  return useLiveQuery(
    () =>
      eventId
        ? db.itemSnapshots.where('eventId').equals(eventId).toArray()
        : [],
    [eventId],
    []
  )
}

/** @deprecated use useEventItemSnapshots */
export const useChapterItemSnapshots = useEventItemSnapshots

export async function upsertItemSnapshot(
  data: Omit<ItemSnapshot, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ItemSnapshot> {
  const existing = await db.itemSnapshots
    .where('[itemId+eventId]')
    .equals([data.itemId, data.eventId])
    .first()
  const now = Date.now()
  if (existing) {
    const updated = { ...existing, ...data, updatedAt: now }
    await db.itemSnapshots.put(updated)
    return updated
  } else {
    const snap: ItemSnapshot = { id: generateId(), ...data, createdAt: now, updatedAt: now }
    await db.itemSnapshots.add(snap)
    return snap
  }
}
