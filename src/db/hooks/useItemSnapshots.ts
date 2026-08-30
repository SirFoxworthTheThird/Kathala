import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate } from './useOperations'
import type { ItemSnapshot } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey } from '@/lib/sortKey'
import { useWorldEvents, useWorldChapters } from './useTimeline'
import { resolveSnapshot, selectBestSnapshots } from '@/lib/snapshotUtils'
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

/**
 * The best-known snapshot per item at the active moment — the item twin of
 * `useBestSnapshots` and `useBestRelationshipSnapshots`, and the same
 * carry-forward rule.
 *
 * Added for the Items roster (**IT-2**), which needs every item's condition at
 * once. Resolving per item would mean one live query per card, and the roster
 * routinely shows dozens.
 */
export function useBestItemSnapshots(
  worldId: string | null,
  activeEventId: string | null,
): ItemSnapshot[] {
  const all = useLiveQuery(
    () => (worldId ? db.itemSnapshots.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    [],
  )
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)
  return useMemo(
    () => selectBestSnapshots(all, activeEventId, allEvents, allChapters, (s) => s.itemId),
    [all, activeEventId, allEvents, allChapters],
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
    await journalUpdate('itemSnapshot', db.itemSnapshots, existing.id, { ...data, sortKey, updatedAt: now })
    return (await db.itemSnapshots.get(existing.id))!
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
  return journalCreate('itemSnapshot', db.itemSnapshots, snap)
}
