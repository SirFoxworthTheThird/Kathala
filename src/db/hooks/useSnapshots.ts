import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { CharacterSnapshot } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey, computeSortKeySync } from '@/lib/sortKey'
import { useWorldEvents, useWorldChapters } from './useTimeline'

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

/** Returns the best (last-known) snapshot per character for the active event.
 *  When an event is active: for each character, finds the most recent snapshot
 *  at or before that event (by sortKey ordering).
 *  When no event is active: returns the most recently updated snapshot per character.
 *  Memoized for reference stability. */
export function useBestSnapshots(worldId: string | null, activeEventId: string | null): CharacterSnapshot[] {
  const all = useWorldSnapshots(worldId)
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)

  return useMemo(() => {
    if (!all.length) return []

    if (!activeEventId) {
      // No event selected: most recently updated snapshot per character
      const byChar = new Map<string, CharacterSnapshot>()
      for (const snap of all) {
        const current = byChar.get(snap.characterId)
        if (!current || snap.updatedAt > current.updatedAt) {
          byChar.set(snap.characterId, snap)
        }
      }
      return Array.from(byChar.values())
    }

    const eventById = new Map(allEvents.map((e) => [e.id, e]))
    const chapNumById = new Map(allChapters.map((c) => [c.id, c.number]))
    const getOrder = (snap: CharacterSnapshot) =>
      snap.sortKey ?? computeSortKeySync(snap.eventId, eventById, chapNumById)
    const activeOrder = computeSortKeySync(activeEventId, eventById, chapNumById)

    if (activeOrder === -1) {
      // Active event not loaded yet — exact match fallback
      return all.filter((s) => s.eventId === activeEventId)
    }

    // Per character, pick the snapshot with the highest order ≤ activeOrder
    const byChar = new Map<string, CharacterSnapshot>()
    for (const snap of all) {
      const order = getOrder(snap)
      if (order === -1 || order > activeOrder) continue
      const current = byChar.get(snap.characterId)
      if (!current) {
        byChar.set(snap.characterId, snap)
        continue
      }
      const currentOrder = getOrder(current)
      if (snap.eventId === activeEventId) {
        byChar.set(snap.characterId, snap)
      } else if (current.eventId !== activeEventId && order > currentOrder) {
        byChar.set(snap.characterId, snap)
      }
    }
    return Array.from(byChar.values())
  }, [all, activeEventId, allEvents, allChapters])
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

  return useMemo(() => {
    if (!characterId || !activeEventId || !all.length) return undefined

    const eventById = new Map(allEvents.map((e) => [e.id, e]))
    const chapNumById = new Map(allChapters.map((c) => [c.id, c.number]))
    const getOrder = (snap: CharacterSnapshot) =>
      snap.sortKey ?? computeSortKeySync(snap.eventId, eventById, chapNumById)
    const activeOrder = computeSortKeySync(activeEventId, eventById, chapNumById)

    if (activeOrder === -1) {
      return all.find((s) => s.eventId === activeEventId)
    }

    let best: CharacterSnapshot | undefined
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
  }, [characterId, activeEventId, all, allEvents, allChapters])
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
