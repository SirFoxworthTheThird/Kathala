import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { resolveRecords } from '@/lib/characterIdentity'
import { journalCreate, journalUpdate, journalDelete, journalGroup } from './useOperations'
import { generateId } from '@/lib/id'
import type { KnowledgeFact, KnowledgeReveal } from '@/types'
import type { FactPlan } from '@/lib/sceneHeader'

// ── Facts ──────────────────────────────────────────────────────────────────

export function useKnowledgeFacts(worldId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => (worldId ? db.knowledgeFacts.where('worldId').equals(worldId).sortBy('createdAt') : []),
    [worldId],
    [],
  )
  // `readerLearnsAtEventId` already asks exactly this question, authored per
  // fact: the moment the *reader* is let in on it. A fact withheld until
  // chapter twenty is the definition of a spoiler before then.
  return useMemo(() => all.filter((f) => gate.hasReached(f.readerLearnsAtEventId)), [all, gate])
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
  const gate = useGate()
  const all = useLiveQuery(
    () => (worldId ? db.knowledgeReveals.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    [],
  )
  // Who learns a secret, and when, is the shape of the plot. A reveal placed
  // in a later chapter says that much even without naming what changes there.
  return useMemo(() => knowersAsShown(all.filter((r) => gate.hasReached(r.eventId)), gate), [all, gate])
}

/** For a reader past a reveal, what Hyde learned Jekyll learned: each reveal resolved (Part 2b). */
function knowersAsShown(reveals: KnowledgeReveal[], gate: { active: boolean; identityOf: (id: string) => string }): KnowledgeReveal[] {
  return gate.active ? resolveRecords(reveals, gate.identityOf, (r) => `${r.factId}\u0000${r.eventId}`) : reveals
}

export function useRevealsForFact(factId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => (factId ? db.knowledgeReveals.where('factId').equals(factId).toArray() : []),
    [factId],
    [],
  )
  return useMemo(() => knowersAsShown(all.filter((r) => gate.hasReached(r.eventId)), gate), [all, gate])
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

/**
 * Write what a header's Facts line asks for (`planHeader`), as one undo step:
 * who learns what at this scene, and what the reader learns, or what becomes
 * true, here. A reveal already at this scene is not made twice.
 */
export async function recordFactChanges(worldId: string, eventId: string, plan: FactPlan): Promise<void> {
  const writes = plan.learn.length + plan.unlearn.length + plan.readerHere.length + plan.readerOff.length + plan.originHere.length + plan.originOff.length
  if (writes === 0) return
  await journalGroup(async () => {
    const here = await db.knowledgeReveals.where('eventId').equals(eventId).toArray()
    for (const { factId, characterId } of plan.unlearn) {
      for (const r of here.filter((r) => r.factId === factId && r.characterId === characterId)) await deleteKnowledgeReveal(r.id)
    }
    for (const { factId, characterId } of plan.learn) {
      if (here.some((r) => r.factId === factId && r.characterId === characterId)) continue
      await createKnowledgeReveal({ worldId, factId, characterId, eventId, note: '' })
    }
    for (const id of plan.readerHere) await updateKnowledgeFact(id, { readerLearnsAtEventId: eventId })
    for (const id of plan.readerOff) await updateKnowledgeFact(id, { readerLearnsAtEventId: null })
    for (const id of plan.originHere) await updateKnowledgeFact(id, { originEventId: eventId })
    for (const id of plan.originOff) await updateKnowledgeFact(id, { originEventId: null })
  }, { label: 'Facts at this scene' })
}

/**
 * The amber note's answer for a fact title nothing answers: make the fact.
 * The same title already made — by another scene's note, say — is that fact.
 */
export async function createHeaderFact(worldId: string, title: string): Promise<string> {
  const wanted = title.trim()
  const same = await db.knowledgeFacts.where('worldId').equals(worldId)
    .filter((f) => f.title.trim().toLowerCase() === wanted.toLowerCase()).first()
  return same?.id ?? (await createKnowledgeFact({ worldId, title: wanted, description: '', tags: [] })).id
}
