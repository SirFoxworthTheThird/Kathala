import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { ItemSnapshot } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey } from '@/lib/sortKey'
import { useWorldEvents, useWorldChapters } from './useTimeline'
import { resolveSnapshot } from '@/lib/snapshotUtils'
import type { EventStub, ChapterStub } from '@/lib/snapshotUtils'

/** Pure single-item resolution — exported for testing. */
export function resolveItemSnapshot(
  all: ItemSnapshot[],
  activeEventId: string | null,
  allEvents: EventStub[],
  allChapters: ChapterStub[]
): ItemSnapshot | undefined {
  return resolveSnapshot(all, activeEventId, allEvents, allChapters)
}

/** All snapshots for a single item. */
function useItemAllSnapshots(itemId: string | null) {
  return useLiveQuery(
    () =>
      itemId ? db.itemSnapshots.where('itemId').equals(itemId).toArray() : [],
    [itemId],
    []
  )
}

/** Returns the last-known item snapshot at or before the active event. */
export function useItemSnapshot(
  itemId: string | null,
  worldId: string | null,
  activeEventId: string | null
): ItemSnapshot | undefined {
  const all = useItemAllSnapshots(itemId)
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)
  return useMemo(
    () => (!itemId ? undefined : resolveItemSnapshot(all, activeEventId, allEvents, allChapters)),
    [itemId, activeEventId, all, allEvents, allChapters]
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

function itemSnapContentEqual(
  a: Omit<ItemSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>,
  b: ItemSnapshot
): boolean {
  return a.condition === b.condition && a.notes === b.notes
}

export async function upsertItemSnapshot(
  data: Omit<ItemSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>
): Promise<ItemSnapshot> {
  const now = Date.now()
  const sortKey = await computeSortKey(data.eventId)

  const existing = await db.itemSnapshots
    .where('[itemId+eventId]')
    .equals([data.itemId, data.eventId])
    .first()

  if (existing) {
    const updated = { ...existing, ...data, sortKey, updatedAt: now }
    await db.itemSnapshots.put(updated)
    return updated
  }

  // Dedup: skip write if state matches the last-known snapshot
  const allForItem = await db.itemSnapshots
    .where('itemId').equals(data.itemId)
    .toArray()
  const prevBest = allForItem
    .filter((s) => (s.sortKey ?? 0) < sortKey)
    .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]

  if (prevBest && itemSnapContentEqual(data, prevBest)) {
    return prevBest
  }

  const snap: ItemSnapshot = { id: generateId(), ...data, sortKey, createdAt: now, updatedAt: now }
  await db.itemSnapshots.add(snap)
  return snap
}
