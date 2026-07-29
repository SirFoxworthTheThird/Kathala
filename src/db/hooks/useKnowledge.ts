import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
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
  data: Omit<KnowledgeFact, 'id' | 'createdAt' | 'updatedAt' | 'readerLearnsAtEventId' | 'originEventId'>
    & { readerLearnsAtEventId?: string | null; originEventId?: string | null },
): Promise<KnowledgeFact> {
  const now = Date.now()
  const fact: KnowledgeFact = { readerLearnsAtEventId: null, originEventId: null, ...data, id: generateId(), createdAt: now, updatedAt: now }
  await journalCreate('knowledgeFact', db.knowledgeFacts, fact)
  return fact
}

export async function updateKnowledgeFact(id: string, data: Partial<Omit<KnowledgeFact, 'id' | 'createdAt'>>) {
  await journalUpdate('knowledgeFact', db.knowledgeFacts, id, { ...data, updatedAt: Date.now() })
}

export async function deleteKnowledgeFact(id: string) {
  await journalDelete('knowledgeFact', db.knowledgeFacts, id, async () => {
    await db.knowledgeReveals.where('factId').equals(id).delete()
    await db.knowledgeFacts.delete(id)
  }, [db.knowledgeReveals])
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
  await journalCreate('knowledgeReveal', db.knowledgeReveals, reveal)
  return reveal
}

export async function updateKnowledgeReveal(id: string, data: Partial<Omit<KnowledgeReveal, 'id' | 'createdAt'>>) {
  await journalUpdate('knowledgeReveal', db.knowledgeReveals, id, { ...data, updatedAt: Date.now() })
}

export async function deleteKnowledgeReveal(id: string) {
  await journalDelete('knowledgeReveal', db.knowledgeReveals, id, async () => {
    await db.knowledgeReveals.delete(id)
  })
}
