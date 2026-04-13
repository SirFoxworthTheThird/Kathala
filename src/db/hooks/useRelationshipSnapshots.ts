import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { RelationshipSnapshot } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey, computeSortKeySync } from '@/lib/sortKey'
import { useWorldChapters, useWorldEvents } from './useTimeline'

export function useRelationshipSnapshot(relationshipId: string | null, eventId: string | null) {
  return useLiveQuery(
    () =>
      relationshipId && eventId
        ? db.relationshipSnapshots
            .where('[relationshipId+eventId]')
            .equals([relationshipId, eventId])
            .first()
        : undefined,
    [relationshipId, eventId]
  )
}

export function useEventRelationshipSnapshots(eventId: string | null) {
  return useLiveQuery(
    () =>
      eventId
        ? db.relationshipSnapshots.where('eventId').equals(eventId).toArray()
        : [],
    [eventId],
    []
  )
}

/** @deprecated use useEventRelationshipSnapshots */
export const useChapterRelationshipSnapshots = useEventRelationshipSnapshots

export function useWorldRelationshipSnapshots(worldId: string | null) {
  return useLiveQuery(
    () =>
      worldId
        ? db.relationshipSnapshots.where('worldId').equals(worldId).toArray()
        : [],
    [worldId],
    []
  )
}

type EventStub = { id: string; chapterId: string; sortOrder: number }
type ChapterStub = { id: string; number: number }

/** Pure selection logic — exported for testing. */
export function selectBestSnapshots(
  all: RelationshipSnapshot[],
  activeEventId: string | null,
  allEvents: EventStub[],
  allChapters: ChapterStub[]
): RelationshipSnapshot[] {
  if (!all.length) return all

  if (!activeEventId) {
    // No event active — most recently updated snapshot per relationship
    const byRel = new Map<string, RelationshipSnapshot>()
    for (const snap of all) {
      const current = byRel.get(snap.relationshipId)
      if (!current || snap.updatedAt > current.updatedAt) {
        byRel.set(snap.relationshipId, snap)
      }
    }
    return Array.from(byRel.values())
  }

  const eventById = new Map(allEvents.map((e) => [e.id, e]))
  const chapterNumberById = new Map(allChapters.map((c) => [c.id, c.number]))
  const getOrder = (snap: RelationshipSnapshot) =>
    snap.sortKey ?? computeSortKeySync(snap.eventId, eventById, chapterNumberById)
  const activeOrder = computeSortKeySync(activeEventId, eventById, chapterNumberById)

  if (activeOrder === -1) {
    // Active event not loaded yet — fall back to exact match only
    return all.filter((s) => s.eventId === activeEventId)
  }

  // For each relationship, pick the snapshot with the highest order ≤ activeOrder
  const byRel = new Map<string, RelationshipSnapshot>()
  for (const snap of all) {
    const snapOrder = getOrder(snap)
    if (snapOrder === -1 || snapOrder > activeOrder) continue

    const current = byRel.get(snap.relationshipId)
    if (!current) {
      byRel.set(snap.relationshipId, snap)
      continue
    }

    const currentOrder = getOrder(current)
    // Exact match for the active event always wins; otherwise prefer higher order
    if (snap.eventId === activeEventId) {
      byRel.set(snap.relationshipId, snap)
    } else if (current.eventId !== activeEventId && snapOrder > currentOrder) {
      byRel.set(snap.relationshipId, snap)
    }
  }

  return Array.from(byRel.values())
}

/** Returns the best snapshot per relationship for the active event.
 *  When an event is active: uses that event's snapshot if it exists, otherwise
 *  inherits the most recent snapshot from any earlier event (by global order).
 *  When no event is active: returns the most recently updated snapshot per relationship.
 *  Memoized to keep the array reference stable. */
export function useBestRelationshipSnapshots(
  worldId: string | null,
  activeEventId: string | null
): RelationshipSnapshot[] {
  const all = useWorldRelationshipSnapshots(worldId)
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)
  return useMemo(
    () => selectBestSnapshots(all, activeEventId, allEvents, allChapters),
    [all, activeEventId, allEvents, allChapters]
  )
}

function relSnapContentEqual(
  a: Omit<RelationshipSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>,
  b: RelationshipSnapshot
): boolean {
  return (
    a.label === b.label &&
    a.strength === b.strength &&
    a.sentiment === b.sentiment &&
    a.description === b.description &&
    a.isActive === b.isActive
  )
}

export async function upsertRelationshipSnapshot(
  data: Omit<RelationshipSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>
): Promise<RelationshipSnapshot> {
  const now = Date.now()
  const sortKey = await computeSortKey(data.eventId)

  const existing = await db.relationshipSnapshots
    .where('[relationshipId+eventId]')
    .equals([data.relationshipId, data.eventId])
    .first()

  if (existing) {
    const updated = { ...existing, ...data, sortKey, updatedAt: now }
    await db.relationshipSnapshots.put(updated)
    return updated
  }

  // Dedup: skip write if state matches the last-known snapshot
  const allForRel = await db.relationshipSnapshots
    .where('relationshipId').equals(data.relationshipId)
    .toArray()
  const prevBest = allForRel
    .filter((s) => (s.sortKey ?? 0) < sortKey)
    .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]

  if (prevBest && relSnapContentEqual(data, prevBest)) {
    return prevBest
  }

  const snapshot: RelationshipSnapshot = {
    id: generateId(),
    ...data,
    sortKey,
    createdAt: now,
    updatedAt: now,
  }
  await db.relationshipSnapshots.add(snapshot)
  return snapshot
}

export async function deleteRelationshipSnapshot(id: string) {
  await db.relationshipSnapshots.delete(id)
}

export async function deleteRelationshipSnapshotsForRelationship(relationshipId: string) {
  await db.relationshipSnapshots.where('relationshipId').equals(relationshipId).delete()
}
