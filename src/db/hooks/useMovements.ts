import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { CharacterMovement } from '@/types'
import { generateId } from '@/lib/id'

export function useEventMovements(worldId: string | null, eventId: string | null): CharacterMovement[] {
  return useLiveQuery(
    () =>
      worldId && eventId
        ? db.characterMovements
            .where('eventId').equals(eventId)
            .filter((m) => m.worldId === worldId)
            .toArray()
        : [],
    [worldId, eventId],
    []
  )
}

/** @deprecated use useEventMovements */
export const useChapterMovements = useEventMovements

export function useCharacterMovement(characterId: string | null, eventId: string | null): CharacterMovement | undefined {
  return useLiveQuery(
    () =>
      characterId && eventId
        ? db.characterMovements
            .where('[characterId+eventId]')
            .equals([characterId, eventId])
            .first()
        : undefined,
    [characterId, eventId]
  )
}

/**
 * Appends a waypoint to the movement for a character in an event, creating it if needed.
 * If `fromMarkerId` is provided and no movement record exists yet, the movement is seeded
 * with [fromMarkerId, markerId] so a trail line can be drawn immediately.
 */
export async function appendWaypoint(
  worldId: string,
  characterId: string,
  eventId: string,
  markerId: string,
  fromMarkerId?: string,
): Promise<void> {
  const existing = await db.characterMovements
    .where('[characterId+eventId]')
    .equals([characterId, eventId])
    .first()

  const now = Date.now()
  if (existing) {
    const last = existing.waypoints[existing.waypoints.length - 1]
    if (last === markerId) return
    await db.characterMovements.update(existing.id, {
      waypoints: [...existing.waypoints, markerId],
      updatedAt: now,
    })
  } else {
    const waypoints =
      fromMarkerId && fromMarkerId !== markerId
        ? [fromMarkerId, markerId]
        : [markerId]
    const movement: CharacterMovement = {
      id: generateId(),
      worldId,
      characterId,
      eventId,
      waypoints,
      createdAt: now,
      updatedAt: now,
    }
    await db.characterMovements.add(movement)
  }
}

export async function clearMovement(characterId: string, eventId: string): Promise<void> {
  await db.characterMovements
    .where('[characterId+eventId]')
    .equals([characterId, eventId])
    .delete()
}

export async function removeLastWaypoint(characterId: string, eventId: string): Promise<void> {
  const existing = await db.characterMovements
    .where('[characterId+eventId]')
    .equals([characterId, eventId])
    .first()
  if (!existing || existing.waypoints.length <= 1) {
    await clearMovement(characterId, eventId)
    return
  }
  await db.characterMovements.update(existing.id, {
    waypoints: existing.waypoints.slice(0, -1),
    updatedAt: Date.now(),
  })
}
