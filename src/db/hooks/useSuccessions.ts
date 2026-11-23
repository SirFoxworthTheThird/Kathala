import { useLiveQuery } from 'dexie-react-hooks'
import { db, bibleOf } from '@/db/database'
import { generateId } from '@/lib/id'
import type { Succession, SuccessionRule } from '@/types'
import { journalCreate, journalDelete, journalUpdate } from './useOperations'

/*
  Successions (issue #702, D-3): what is inherited, from whom, by what rule.
  The series' in a series, as the family is. Read at the cursor by
  `successionAt` (`src/lib/family.ts`).
*/

const NONE: Succession[] = []

export function useSuccessions(worldId: string | null | undefined): Succession[] {
  return useLiveQuery(
    async () => (worldId ? (await db.successions.where('worldId').equals(bibleOf(worldId)).toArray()).sort((a, b) => a.createdAt - b.createdAt) : NONE),
    [worldId],
    NONE,
  )
}

export async function createSuccession(worldId: string, data: { title: string; founderId: string; rule?: SuccessionRule; line?: string[] }): Promise<Succession> {
  const title = data.title.trim()
  if (!title) throw new Error('A succession needs a name: what is inherited.')
  if (!(await db.characters.get(data.founderId))) throw new Error('A succession needs a founder.')
  const now = Date.now()
  return journalCreate('succession', db.successions, {
    id: generateId(),
    worldId: bibleOf(worldId),
    title,
    founderId: data.founderId,
    rule: data.rule ?? 'eldest',
    line: (data.line ?? []).filter((id) => id !== data.founderId),
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateSuccession(id: string, patch: Partial<Pick<Succession, 'title' | 'founderId' | 'rule' | 'line'>>): Promise<void> {
  const s = await db.successions.get(id)
  if (!s) return
  if (patch.title !== undefined && !patch.title.trim()) throw new Error('A succession needs a name: what is inherited.')
  const founderId = patch.founderId ?? s.founderId
  const next = { ...patch, ...(patch.title !== undefined ? { title: patch.title.trim() } : {}) }
  if (patch.line || patch.founderId) next.line = (patch.line ?? s.line).filter((x) => x !== founderId)
  await journalUpdate('succession', db.successions, id, { ...next, updatedAt: Date.now() })
}

export async function deleteSuccession(id: string): Promise<void> {
  await journalDelete('succession', db.successions, id, async () => { await db.successions.delete(id) })
}

/**
 * What a character's delete does to successions (`deleteCharacter`): one they
 * founded goes; from any other's hand-ordered line, they are taken out.
 * Journalled, inside the delete's group, so its undo brings them back.
 */
export async function dropFromSuccessions(worldId: string, characterId: string): Promise<void> {
  for (const s of await db.successions.where('worldId').equals(bibleOf(worldId)).toArray()) {
    if (s.founderId === characterId) await deleteSuccession(s.id)
    else if (s.line.includes(characterId)) await journalUpdate('succession', db.successions, s.id, { line: s.line.filter((x) => x !== characterId), updatedAt: Date.now() })
  }
}
