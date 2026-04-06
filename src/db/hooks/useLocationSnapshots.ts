import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { LocationSnapshot } from '@/types'
import { generateId } from '@/lib/id'

export function useLocationSnapshot(locationMarkerId: string | null, eventId: string | null) {
  return useLiveQuery(
    () =>
      locationMarkerId && eventId
        ? db.locationSnapshots
            .where('[locationMarkerId+eventId]')
            .equals([locationMarkerId, eventId])
            .first()
        : undefined,
    [locationMarkerId, eventId]
  )
}

export function useEventLocationSnapshots(eventId: string | null) {
  return useLiveQuery(
    () =>
      eventId
        ? db.locationSnapshots.where('eventId').equals(eventId).toArray()
        : [],
    [eventId],
    []
  )
}

/** @deprecated use useEventLocationSnapshots */
export const useChapterLocationSnapshots = useEventLocationSnapshots

export function useMarkerSnapshots(locationMarkerId: string | null) {
  return useLiveQuery(
    () =>
      locationMarkerId
        ? db.locationSnapshots.where('locationMarkerId').equals(locationMarkerId).toArray()
        : [],
    [locationMarkerId],
    []
  )
}

export async function upsertLocationSnapshot(
  data: Omit<LocationSnapshot, 'id' | 'createdAt' | 'updatedAt'>
): Promise<LocationSnapshot> {
  const existing = await db.locationSnapshots
    .where('[locationMarkerId+eventId]')
    .equals([data.locationMarkerId, data.eventId])
    .first()
  const now = Date.now()
  if (existing) {
    const updated = { ...existing, ...data, updatedAt: now }
    await db.locationSnapshots.put(updated)
    return updated
  } else {
    const snap: LocationSnapshot = { id: generateId(), ...data, createdAt: now, updatedAt: now }
    await db.locationSnapshots.add(snap)
    return snap
  }
}
