import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import { generateId } from '@/lib/id'
import type { CharacterGoal } from '@/types'

/** Every goal in a world — used by the Arc View and the Writer's Brief, which
 *  need goals for many characters at once. */
export function useCharacterGoals(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.characterGoals.where('worldId').equals(worldId).sortBy('createdAt') : []),
    [worldId],
    [],
  )
}

/** One character's goals, for their Goals tab. */
export function useGoalsForCharacter(characterId: string | null) {
  return useLiveQuery(
    () => (characterId ? db.characterGoals.where('characterId').equals(characterId).sortBy('createdAt') : []),
    [characterId],
    [],
  )
}

export async function createCharacterGoal(
  data: Pick<CharacterGoal, 'worldId' | 'characterId' | 'type' | 'text'>
    & { startEventId?: string | null; endEventId?: string | null },
): Promise<CharacterGoal> {
  const now = Date.now()
  const goal: CharacterGoal = {
    startEventId: null,
    endEventId: null,
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }
  await journalCreate('characterGoal', db.characterGoals, goal)
  return goal
}

export async function updateCharacterGoal(
  id: string,
  data: Partial<Omit<CharacterGoal, 'id' | 'worldId' | 'characterId' | 'createdAt'>>,
) {
  await journalUpdate('characterGoal', db.characterGoals, id, { ...data, updatedAt: Date.now() })
}

export async function deleteCharacterGoal(id: string) {
  await journalDelete('characterGoal', db.characterGoals, id, async () => { await db.characterGoals.delete(id) })
}
