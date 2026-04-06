import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { RelationshipSnapshot } from '@/types'
import { generateId } from '@/lib/id'
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

/** Compute a globally comparable sort key for an event.
 *  Ordering: chapter.number (primary) → event.sortOrder (secondary). */
function globalEventOrder(
  eventId: string,
  eventById: Map<string, EventStub>,
  chapterNumberById: Map<string, number>
): number {
  const ev = eventById.get(eventId)
  if (!ev) return -1
  const chapNum = chapterNumberById.get(ev.chapterId) ?? -1
  return chapNum * 10_000 + ev.sortOrder
}

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

  const getOrder = (eventId: string) => globalEventOrder(eventId, eventById, chapterNumberById)
  const activeOrder = getOrder(activeEventId)

  if (activeOrder === -1) {
    // Active event not loaded yet — fall back to exact match only
    return all.filter((s) => s.eventId === activeEventId)
  }

  // For each relationship, pick the snapshot from the event with the highest global
  // order that is still ≤ the active event's order (most recent known state).
  const byRel = new Map<string, RelationshipSnapshot>()
  for (const snap of all) {
    const snapOrder = getOrder(snap.eventId)
    if (snapOrder === -1 || snapOrder > activeOrder) continue

    const current = byRel.get(snap.relationshipId)
    if (!current) {
      byRel.set(snap.relationshipId, snap)
      continue
    }

    const currentOrder = getOrder(current.eventId)
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

export async function upsertRelationshipSnapshot(
  data: Omit<RelationshipSnapshot, 'id' | 'createdAt' | 'updatedAt'>
): Promise<RelationshipSnapshot> {
  const existing = await db.relationshipSnapshots
    .where('[relationshipId+eventId]')
    .equals([data.relationshipId, data.eventId])
    .first()

  const now = Date.now()
  if (existing) {
    const updated = { ...existing, ...data, updatedAt: now }
    await db.relationshipSnapshots.put(updated)
    return updated
  } else {
    const snapshot: RelationshipSnapshot = {
      id: generateId(),
      ...data,
      createdAt: now,
      updatedAt: now,
    }
    await db.relationshipSnapshots.add(snapshot)
    return snapshot
  }
}

export async function deleteRelationshipSnapshot(id: string) {
  await db.relationshipSnapshots.delete(id)
}

export async function deleteRelationshipSnapshotsForRelationship(relationshipId: string) {
  await db.relationshipSnapshots.where('relationshipId').equals(relationshipId).delete()
}
