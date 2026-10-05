import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { resolveRecords } from '@/lib/characterIdentity'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import { generateId } from '@/lib/id'
import type { CharacterGoal } from '@/types'

/** Every goal in a world — used by the Arc View and the Writer's Brief, which
 *  need goals for many characters at once. */
export function useCharacterGoals(worldId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => (worldId ? db.characterGoals.where('worldId').equals(worldId).sortBy('createdAt') : []),
    [worldId],
    [],
  )
  // For a reader past a reveal, Hyde's goals are on Jekyll's row (Part 2b).
  return useMemo(() => (gate.active ? resolveRecords(all, gate.identityOf) : all), [all, gate])
}

/** One character's goals, for their Goals tab. */
/**
 * A character's goals, as the reader has reached them.
 *
 * Gated here rather than in the tab, because two readers of the same list
 * disagreed: the tab filtered by `hasReached` and the detail view built its
 * count from the unfiltered hook, so a blind reader run met a tab badge reading
 * **Goals 2** above a panel reading *No goals yet*. The gate was right in both
 * books — Anne's one goal showed as 1 — and only the count was wrong.
 *
 * Putting it in the hook is what stops that recurring: a caller cannot forget a
 * filter it never has to apply. Outside a world the gate is open, so a goal
 * shown somewhere without a provider behaves as it always did.
 */
export function useGoalsForCharacter(characterId: string | null) {
  const gate = useGate()
  // For a reader, the whole person's: Jekyll's goals and Hyde's (Part 2b).
  const selves = characterId ? gate.selves(characterId) : []
  const key = selves.join(',')
  const all = useLiveQuery(
    () => (selves.length > 0 ? db.characterGoals.where('characterId').anyOf(selves).sortBy('createdAt') : []),
    [key],
    [],
  )
  return useMemo(() => all.filter((g) => gate.hasReached(g.startEventId)), [all, gate])
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
