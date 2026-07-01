import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import type { KnowledgeFact, KnowledgeReveal } from '@/types'

// ── Facts ──────────────────────────────────────────────────────────────────

export function useKnowledgeFacts(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.knowledgeFacts.where('worldId').equals(worldId).sortBy('createdAt') : []),
    [worldId],
    [],
  )
}

export function useKnowledgeFact(factId: string | null) {
  return useLiveQuery(
    () => (factId ? db.knowledgeFacts.get(factId) : undefined),
    [factId],
  )
}

export async function createKnowledgeFact(
  data: Omit<KnowledgeFact, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<KnowledgeFact> {
  const now = Date.now()
  const fact: KnowledgeFact = { ...data, id: generateId(), createdAt: now, updatedAt: now }
  await db.knowledgeFacts.add(fact)
  return fact
}

export async function updateKnowledgeFact(id: string, data: Partial<Omit<KnowledgeFact, 'id' | 'createdAt'>>) {
  await db.knowledgeFacts.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteKnowledgeFact(id: string) {
  await db.transaction('rw', [db.knowledgeFacts, db.knowledgeReveals], async () => {
    await db.knowledgeReveals.where('factId').equals(id).delete()
    await db.knowledgeFacts.delete(id)
  })
}

// ── Reveals (who learns a fact, and when) ──────────────────────────────────

export function useKnowledgeReveals(worldId: string | null) {
  return useLiveQuery(
    () => (worldId ? db.knowledgeReveals.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    [],
  )
}

export function useRevealsForFact(factId: string | null) {
  return useLiveQuery(
    () => (factId ? db.knowledgeReveals.where('factId').equals(factId).toArray() : []),
    [factId],
    [],
  )
}

export async function createKnowledgeReveal(
  data: Omit<KnowledgeReveal, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<KnowledgeReveal> {
  const now = Date.now()
  const reveal: KnowledgeReveal = { ...data, id: generateId(), createdAt: now, updatedAt: now }
  await db.knowledgeReveals.add(reveal)
  return reveal
}

export async function updateKnowledgeReveal(id: string, data: Partial<Omit<KnowledgeReveal, 'id' | 'createdAt'>>) {
  await db.knowledgeReveals.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteKnowledgeReveal(id: string) {
  await db.knowledgeReveals.delete(id)
}
