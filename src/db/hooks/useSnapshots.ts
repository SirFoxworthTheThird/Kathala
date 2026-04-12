import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { CharacterSnapshot } from '@/types'
import { generateId } from '@/lib/id'

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

/** Returns snapshots for the active event only. When no event is selected,
 *  returns the most recently updated snapshot per character.
 *  Memoised so the returned array reference is stable between renders when
 *  neither the underlying data nor the active event has changed. */
export function useBestSnapshots(worldId: string | null, activeEventId: string | null): CharacterSnapshot[] {
  const all = useWorldSnapshots(worldId)
  return useMemo(() => {
    if (!all.length) return []

    if (activeEventId) {
      return all.filter((s) => s.eventId === activeEventId)
    }

    // No event selected: show the most recently updated snapshot per character.
    const byChar = new Map<string, CharacterSnapshot>()
    for (const snap of all) {
      const current = byChar.get(snap.characterId)
      if (!current || snap.updatedAt > current.updatedAt) {
        byChar.set(snap.characterId, snap)
      }
    }
    return Array.from(byChar.values())
  }, [all, activeEventId])
}

export async function fetchSnapshot(characterId: string, eventId: string): Promise<CharacterSnapshot | undefined> {
  return db.characterSnapshots
    .where('[characterId+eventId]')
    .equals([characterId, eventId])
    .first()
}

export async function upsertSnapshot(
  data: Omit<CharacterSnapshot, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CharacterSnapshot> {
  const existing = await db.characterSnapshots
    .where('[characterId+eventId]')
    .equals([data.characterId, data.eventId])
    .first()

  const now = Date.now()
  if (existing) {
    const updated = { ...existing, ...data, updatedAt: now }
    await db.characterSnapshots.put(updated)
    return updated
  } else {
    const snapshot: CharacterSnapshot = {
      id: generateId(),
      ...data,
      createdAt: now,
      updatedAt: now,
    }
    await db.characterSnapshots.add(snapshot)
    return snapshot
  }
}

export async function deleteSnapshot(id: string) {
  await db.characterSnapshots.delete(id)
}
