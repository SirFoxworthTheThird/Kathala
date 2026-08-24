import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete, journalGroup } from './useOperations'
import type { CharacterSnapshot } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey } from '@/lib/sortKey'
import { useWorldEvents, useWorldChapters } from './useTimeline'
import { useGate } from './ReadingGateContext'
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
  const gate = useGate()
  const all = useLiveQuery(
    () =>
      characterId
        ? db.characterSnapshots.where('characterId').equals(characterId).toArray()
        : [],
    [characterId],
    []
  )
  // A character's snapshot list is their whole future — where they end up, what
  // they carry, whether they are still alive. Cut it at the cursor: resolving
  // the *current* state only ever looks backwards, so nothing else loses out.
  return useMemo(() => all.filter((s) => gate.hasReached(s.eventId)), [all, gate])
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
     
    [key],
    []
  )
}

export function useWorldSnapshots(worldId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () =>
      worldId
        ? db.characterSnapshots.where('worldId').equals(worldId).toArray()
        : [],
    [worldId],
    []
  )
  return useMemo(() => all.filter((s) => gate.hasReached(s.eventId)), [all, gate])
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
    await journalUpdate('characterSnapshot', db.characterSnapshots, existing.id, { ...data, sortKey, updatedAt: now })
    return (await db.characterSnapshots.get(existing.id))!
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
    ...data,
    // After the spread, not before: callers build `data` by spreading an
    // existing snapshot, and an `id` riding along would name a row that already
    // exists — so a *new* record would be created under an old primary key.
    id: generateId(),
    sortKey,
    createdAt: now,
    updatedAt: now,
  }
  return journalCreate('characterSnapshot', db.characterSnapshots, snapshot)
}

export async function deleteSnapshot(id: string) {
  await journalDelete('characterSnapshot', db.characterSnapshots, id, async () => {
    await db.characterSnapshots.delete(id)
  })
}

/**
 * Record a character at a scene's setting, keeping everything else they had.
 *
 * This is the continuity checker's "Move to <place>" fix, and it used to look
 * for the state to carry forward with `sn.eventId === eventId` — a snapshot at
 * the very scene being fixed. But that fix is only ever offered when no such
 * snapshot exists (an assertion there is the writer's word, not a gap), so the
 * lookup found nothing every time and every fallback fired: the character was
 * written alive, empty-handed, with no notes and no travel mode. Applied over
 * an ensemble from "Fix all", it emptied eight characters' hands at once and
 * revived anyone who had died, and the checker then reported the resurrection
 * it had just performed. Undo recovered it, but the label said only "Added
 * character state" — and the point of a fix-it button is that you stop looking.
 *
 * The state to carry forward is the last one at or before this scene, which is
 * what `resolveSnapshot` returns. `MapExplorerView` already did it this way.
 */
export async function moveCharacterToScene(
  args: { worldId: string; characterId: string; eventId: string; markerId: string },
  allEvents: EventStub[],
  allChapters: ChapterStub[]
): Promise<void> {
  const marker = await db.locationMarkers.get(args.markerId)
  if (!marker) return

  const own = await db.characterSnapshots
    .where('characterId').equals(args.characterId)
    .toArray()
  const carried = resolveSnapshot(own, args.eventId, allEvents, allChapters)

  await upsertSnapshot({
    worldId: args.worldId,
    characterId: args.characterId,
    eventId: args.eventId,
    isAlive: carried?.isAlive ?? true,
    currentLocationMarkerId: marker.id,
    currentMapLayerId: marker.mapLayerId,
    inventoryItemIds: carried?.inventoryItemIds ?? [],
    inventoryNotes: carried?.inventoryNotes ?? '',
    statusNotes: carried?.statusNotes ?? '',
    travelModeId: carried?.travelModeId ?? null,
  })
}

/**
 * Apply one field of a state to later records that merely inherited the value
 * it replaced (**F2**).
 *
 * Offered, never automatic. A tool that silently rewrites six later scenes
 * because you edited one is worse than one that stops — so the app says where
 * the change stopped and this runs only if the writer asks for it.
 *
 * The targets are chosen by `carryForwardPlan`, which stops at the first later
 * record holding something else: that is a decision already taken, and an
 * earlier edit does not get to overwrite it.
 *
 * One `journalGroup`, so undo puts every scene back together rather than
 * leaving the run half-applied.
 */
export async function carryFieldForward<K extends keyof CharacterSnapshot>(
  targets: CharacterSnapshot[],
  field: K,
  value: CharacterSnapshot[K],
): Promise<void> {
  if (targets.length === 0) return
  await journalGroup(() => Promise.all(
    targets.map((s) => upsertSnapshot({ ...s, [field]: value })),
  ))
}
