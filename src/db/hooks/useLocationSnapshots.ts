import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { LocationSnapshot } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey, computeSortKeySync } from '@/lib/sortKey'
import { useWorldEvents, useWorldChapters } from './useTimeline'

type EventStub = { id: string; chapterId: string; sortOrder: number }
type ChapterStub = { id: string; number: number }

/** Pure single-marker resolution — exported for testing. */
export function resolveLocationSnapshot(
  all: LocationSnapshot[],
  activeEventId: string | null,
  allEvents: EventStub[],
  allChapters: ChapterStub[]
): LocationSnapshot | undefined {
  if (!activeEventId || !all.length) return undefined

  const eventById = new Map(allEvents.map((e) => [e.id, e]))
  const chapNumById = new Map(allChapters.map((c) => [c.id, c.number]))
  const getOrder = (snap: LocationSnapshot) =>
    snap.sortKey ?? computeSortKeySync(snap.eventId, eventById, chapNumById)
  const activeOrder = computeSortKeySync(activeEventId, eventById, chapNumById)

  if (activeOrder === -1) {
    return all.find((s) => s.eventId === activeEventId)
  }

  let best: LocationSnapshot | undefined
  let bestOrder = -1
  for (const snap of all) {
    const order = getOrder(snap)
    if (order === -1 || order > activeOrder) continue
    if (!best || order > bestOrder || (order === bestOrder && snap.eventId === activeEventId)) {
      best = snap
      bestOrder = order
    }
  }
  return best
}

/** Returns the last-known location snapshot at or before the active event. */
export function useLocationSnapshot(
  locationMarkerId: string | null,
  worldId: string | null,
  activeEventId: string | null
): LocationSnapshot | undefined {
  const all = useMarkerSnapshots(locationMarkerId)
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)
  return useMemo(
    () => (!locationMarkerId ? undefined : resolveLocationSnapshot(all, activeEventId, allEvents, allChapters)),
    [locationMarkerId, activeEventId, all, allEvents, allChapters]
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

/** Returns all location snapshots for a world (used by bulk operations). */
export function useWorldLocationSnapshots(worldId: string | null) {
  return useLiveQuery(
    () =>
      worldId
        ? db.locationSnapshots.where('worldId').equals(worldId).toArray()
        : [],
    [worldId],
    []
  )
}

/** Pure world-level selection logic — exported for testing. */
export function selectBestLocationSnapshots(
  all: LocationSnapshot[],
  activeEventId: string | null,
  allEvents: EventStub[],
  allChapters: ChapterStub[]
): LocationSnapshot[] {
  if (!all.length) return all

  if (!activeEventId) {
    const byMarker = new Map<string, LocationSnapshot>()
    for (const snap of all) {
      const current = byMarker.get(snap.locationMarkerId)
      if (!current || snap.updatedAt > current.updatedAt) {
        byMarker.set(snap.locationMarkerId, snap)
      }
    }
    return Array.from(byMarker.values())
  }

  const eventById = new Map(allEvents.map((e) => [e.id, e]))
  const chapNumById = new Map(allChapters.map((c) => [c.id, c.number]))
  const getOrder = (snap: LocationSnapshot) =>
    snap.sortKey ?? computeSortKeySync(snap.eventId, eventById, chapNumById)
  const activeOrder = computeSortKeySync(activeEventId, eventById, chapNumById)

  if (activeOrder === -1) {
    return all.filter((s) => s.eventId === activeEventId)
  }

  const byMarker = new Map<string, LocationSnapshot>()
  for (const snap of all) {
    const order = getOrder(snap)
    if (order === -1 || order > activeOrder) continue
    const current = byMarker.get(snap.locationMarkerId)
    if (!current) {
      byMarker.set(snap.locationMarkerId, snap)
      continue
    }
    const currentOrder = getOrder(current)
    if (snap.eventId === activeEventId) {
      byMarker.set(snap.locationMarkerId, snap)
    } else if (current.eventId !== activeEventId && order > currentOrder) {
      byMarker.set(snap.locationMarkerId, snap)
    }
  }
  return Array.from(byMarker.values())
}

/** Returns the best (last-known) location snapshot per marker for the active event. */
export function useBestLocationSnapshots(
  worldId: string | null,
  activeEventId: string | null
): LocationSnapshot[] {
  const all = useWorldLocationSnapshots(worldId)
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)
  return useMemo(
    () => selectBestLocationSnapshots(all, activeEventId, allEvents, allChapters),
    [all, activeEventId, allEvents, allChapters]
  )
}

function locSnapContentEqual(
  a: Omit<LocationSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>,
  b: LocationSnapshot
): boolean {
  return a.status === b.status && a.notes === b.notes
}

export async function upsertLocationSnapshot(
  data: Omit<LocationSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>
): Promise<LocationSnapshot> {
  const now = Date.now()
  const sortKey = await computeSortKey(data.eventId)

  const existing = await db.locationSnapshots
    .where('[locationMarkerId+eventId]')
    .equals([data.locationMarkerId, data.eventId])
    .first()

  if (existing) {
    const updated = { ...existing, ...data, sortKey, updatedAt: now }
    await db.locationSnapshots.put(updated)
    return updated
  }

  // Dedup: skip write if state matches the last-known snapshot
  const allForMarker = await db.locationSnapshots
    .where('locationMarkerId').equals(data.locationMarkerId)
    .toArray()
  const prevBest = allForMarker
    .filter((s) => (s.sortKey ?? 0) < sortKey)
    .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]

  if (prevBest && locSnapContentEqual(data, prevBest)) {
    return prevBest
  }

  const snap: LocationSnapshot = { id: generateId(), ...data, sortKey, createdAt: now, updatedAt: now }
  await db.locationSnapshots.add(snap)
  return snap
}
