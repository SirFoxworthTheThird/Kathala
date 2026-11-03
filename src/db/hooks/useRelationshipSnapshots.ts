import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import type { RelationshipSnapshot } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey } from '@/lib/sortKey'
import { type Story } from '@/lib/stateEngine'
import { stateAt } from '@/lib/stateAt'
import { stateBefore, useStory } from './useStory'

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

/** Pure selection logic — exported for testing. */
export function selectBestSnapshots(
  all: RelationshipSnapshot[],
  activeEventId: string | null,
  story: Story,
): RelationshipSnapshot[] {
  if (all.length === 0) return all
  return stateAt({ relationships: all }, activeEventId, story).relationships
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
  const story = useStory(worldId)
  return useMemo(
    () => selectBestSnapshots(all, activeEventId, story),
    [all, activeEventId, story]
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
    await journalUpdate('relationshipSnapshot', db.relationshipSnapshots, existing.id, { ...data, sortKey, updatedAt: now })
    return (await db.relationshipSnapshots.get(existing.id))!
  }

  // Dedup: skip write if state matches the last-known snapshot
  const allForRel = await db.relationshipSnapshots
    .where('relationshipId').equals(data.relationshipId)
    .toArray()
  const prevBest = await stateBefore(allForRel, data.eventId, data.worldId)

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
  return journalCreate('relationshipSnapshot', db.relationshipSnapshots, snapshot)
}

export async function deleteRelationshipSnapshot(id: string) {
  await journalDelete('relationshipSnapshot', db.relationshipSnapshots, id, async () => {
    await db.relationshipSnapshots.delete(id)
  })
}

export async function deleteRelationshipSnapshotsForRelationship(relationshipId: string) {
  await db.relationshipSnapshots.where('relationshipId').equals(relationshipId).delete()
}
