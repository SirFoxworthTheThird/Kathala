import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { CharacterSnapshot } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey } from '@/lib/sortKey'
import { useWorldEvents, useWorldChapters } from './useTimeline'
import { resolveSnapshot, selectBestSnapshots as selectBestSnapshotsGeneric } from '@/lib/snapshotUtils'
import type { EventStub, ChapterStub } from '@/lib/snapshotUtils'

export function useSnapshot(characterId: string | null, eventId: string | null) {
  return useLiveQuery(
    () =>
      characterId && eventId
        ? db.characterSnapshots
            .where('[characterId+eventId]')
            .equals([characterId, eventId])
            .first()
        : undefined,
    [characterId, eventId]
  )
}

export function useCharacterSnapshots(characterId: string | null) {
  return useLiveQuery(
    () =>
      characterId
        ? db.characterSnapshots.where('characterId').equals(characterId).toArray()
        : [],
    [characterId],
    []
  )
}

export function useEventSnapshots(eventId: string | null) {
  return useLiveQuery(
    () =>
      eventId
        ? db.characterSnapshots.where('eventId').equals(eventId).toArray()
        : [],
    [eventId],
    []
  )
}

/** @deprecated use useEventSnapshots */
export const useChapterSnapshots = useEventSnapshots

/** Returns all snapshots for a list of event ids (all events in a chapter). */
export function useChapterEventSnapshots(eventIds: string[]) {
  const key = eventIds.join(',')
  return useLiveQuery(
    () =>
      eventIds.length > 0
        ? db.characterSnapshots.where('eventId').anyOf(eventIds).toArray()
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
    []
  )
}

export function useWorldSnapshots(worldId: string | null) {
  return useLiveQuery(
    () =>
      worldId
        ? db.characterSnapshots.where('worldId').equals(worldId).toArray()
        : [],
    [worldId],
    []
  )
}

/** Pure selection logic — exported for testing.
 *  @param timelineEventIds When provided, only snapshots whose eventId is in this set
 *  are considered. Pass the Set of all event IDs belonging to the active playback
 *  timeline to prevent cross-timeline contamination in frame-narrative worlds. */
export function selectBestCharacterSnapshots(
  all: CharacterSnapshot[],
  activeEventId: string | null,
  allEvents: EventStub[],
  allChapters: ChapterStub[],
  timelineEventIds?: Set<string>
): CharacterSnapshot[] {
  const candidates = timelineEventIds ? all.filter((s) => timelineEventIds.has(s.eventId)) : all
  return selectBestSnapshotsGeneric(candidates, activeEventId, allEvents, allChapters, (s) => s.characterId)
}

/** Pure single-character resolution — exported for testing. */
export function resolveCharacterSnapshot(
  all: CharacterSnapshot[],
  activeEventId: string | null,
  allEvents: EventStub[],
  allChapters: ChapterStub[]
): CharacterSnapshot | undefined {
  return resolveSnapshot(all, activeEventId, allEvents, allChapters)
}

/** Returns the best (last-known) snapshot per character for the active event.
 *  When an event is active: for each character, finds the most recent snapshot
 *  at or before that event (by sortKey ordering).
 *  When no event is active: returns the most recently updated snapshot per character.
 *  Memoized for reference stability.
 *  @param timelineEventIds Optional scope — see selectBestCharacterSnapshots. Caller must
 *  memoize this Set to avoid triggering re-renders on every call. */
export function useBestSnapshots(
  worldId: string | null,
  activeEventId: string | null,
  timelineEventIds?: Set<string>
): CharacterSnapshot[] {
  const all = useWorldSnapshots(worldId)
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)
  return useMemo(
    () => selectBestCharacterSnapshots(all, activeEventId, allEvents, allChapters, timelineEventIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, activeEventId, allEvents, allChapters, timelineEventIds]
  )
}

/** Returns the last-known snapshot for a single character at or before the active event.
 *  Uses only that character's snapshots (cheaper than loading all world snapshots). */
export function useResolvedCharacterSnapshot(
  characterId: string | null,
  worldId: string | null,
  activeEventId: string | null
): CharacterSnapshot | undefined {
  const all = useCharacterSnapshots(characterId)
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)
  return useMemo(
    () => (!characterId ? undefined : resolveCharacterSnapshot(all, activeEventId, allEvents, allChapters)),
    [characterId, activeEventId, all, allEvents, allChapters]
  )
}

export async function fetchSnapshot(characterId: string, eventId: string): Promise<CharacterSnapshot | undefined> {
  return db.characterSnapshots
    .where('[characterId+eventId]')
    .equals([characterId, eventId])
    .first()
}

function charSnapContentEqual(
  a: Omit<CharacterSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>,
  b: CharacterSnapshot
): boolean {
  return (
    a.isAlive === b.isAlive &&
    a.currentLocationMarkerId === b.currentLocationMarkerId &&
    a.currentMapLayerId === b.currentMapLayerId &&
    JSON.stringify([...a.inventoryItemIds].sort()) ===
      JSON.stringify([...b.inventoryItemIds].sort()) &&
    a.inventoryNotes === b.inventoryNotes &&
    a.statusNotes === b.statusNotes &&
    a.travelModeId === b.travelModeId
  )
}

export async function upsertSnapshot(
  data: Omit<CharacterSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'>
): Promise<CharacterSnapshot> {
  const now = Date.now()
  const sortKey = await computeSortKey(data.eventId)

  // If a record already exists for this exact event, update it in-place
  const existing = await db.characterSnapshots
    .where('[characterId+eventId]')
    .equals([data.characterId, data.eventId])
    .first()

  if (existing) {
    const updated = { ...existing, ...data, sortKey, updatedAt: now }
    await db.characterSnapshots.put(updated)
    return updated
  }

  // No record for this event — check last-known to avoid duplicating unchanged state
  const allForChar = await db.characterSnapshots
    .where('characterId').equals(data.characterId)
    .toArray()
  const prevBest = allForChar
    .filter((s) => (s.sortKey ?? 0) < sortKey)
    .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]

  if (prevBest && charSnapContentEqual(data, prevBest)) {
    return prevBest // unchanged — no new record needed
  }

  const snapshot: CharacterSnapshot = {
    id: generateId(),
    ...data,
    sortKey,
    createdAt: now,
    updatedAt: now,
  }
  await db.characterSnapshots.add(snapshot)
  return snapshot
}

export async function deleteSnapshot(id: string) {
  await db.characterSnapshots.delete(id)
}
