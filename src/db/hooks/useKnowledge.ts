import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { resolveRecords } from '@/lib/characterIdentity'
import { journalCreate, journalUpdate, journalDelete, journalGroup } from './useOperations'
import { generateId } from '@/lib/id'
import type { KnowledgeFact, KnowledgeReveal } from '@/types'
import { factPlanWrites, type FactPlan } from '@/lib/sceneHeader'
import { eventsInReadingOrder } from '@/lib/readingOrder'
import { loadStory } from './useStory'

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

/**
 * Change a fact's spoiler words from what they are now in the store, not from
 * a list the screen read a moment ago: a word added straight after another —
 * a suggestion clicked, then one typed — was written over by the second, which
 * started from the list as it was before the first had arrived.
 */
export async function editSpoilerWords(id: string, change: (current: string[]) => string[]): Promise<void> {
  // One transaction: the read and the write are one step, so two edits at once queue rather than overlap.
  await db.transaction('rw', [db.knowledgeFacts, db.operations, db.tombstones], async () => {
    const fact = await db.knowledgeFacts.get(id)
    if (!fact) return
    const current = fact.spoilerWords ?? []
    const next = change(current)
    if (next.length === current.length && next.every((w, i) => w === current[i])) return
    await updateKnowledgeFact(id, { spoilerWords: next })
  })
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
 * Where what somebody knew before the story is filed: the first scene, in
 * reading order, of their era — the era of the scene it was said at
 * (`atEventId`), or else of the first scene that names them. In a book of one
 * era, the book's first scene.
 *
 * It used to be the book's first scene always: in a book braided from eras,
 * writer run 10's `?…:@Isidor Kesh-Amaury:before`, typed in 311 AL, was filed
 * at a scene of 1 BL, three centuries before he was born.
 */
export async function firstSceneOf(worldId: string, opts: { atEventId?: string; characterId?: string } = {}): Promise<string | undefined> {
  const events = await db.events.where('worldId').equals(worldId).toArray()
  const chapters = await db.chapters.where('worldId').equals(worldId).toArray()
  const ordered = eventsInReadingOrder(events, chapters)
  const story = await loadStory(worldId)
  const named = opts.characterId
    ? ordered.find((e) => [...e.involvedCharacterIds, ...(e.remoteCharacterIds ?? []), ...(e.mentionedCharacterIds ?? []), e.povCharacterId].includes(opts.characterId!))
    : undefined
  const at = opts.atEventId ?? named?.id
  if (!at) return ordered[0]?.id
  const era = story.eraOf(at)
  return (ordered.find((e) => story.eraOf(e.id) === era) ?? ordered[0])?.id
}

/**
 * Write what a header's Facts line asks for (`planHeader`), as one undo step:
 * who learns what at this scene, and what the reader learns, or what becomes
 * true, here. A reveal already at this scene is not made twice.
 */
export async function recordFactChanges(worldId: string, eventId: string, plan: FactPlan): Promise<{ filedAt: string | null }> {
  if (factPlanWrites(plan) === 0) return { filedAt: null }
  let filedAt: string | null = null
  await journalGroup(async () => {
    const here = await db.knowledgeReveals.where('eventId').equals(eventId).toArray()
    /*
      Known before the story: filed at the first scene of this scene's era
      (`firstSceneOf`) and marked so, wherever in it the header said it — as
      the Knowledge screen's "Before the story" files it (writer run 9).
    */
    if (plan.knownBefore?.length || plan.knownBeforeOff?.length) {
      const first = await firstSceneOf(worldId, { atEventId: eventId })
      const filed = first ? await db.knowledgeReveals.where('eventId').equals(first).toArray() : []
      for (const { factId, characterId } of plan.knownBeforeOff ?? []) {
        for (const r of filed.filter((r) => r.factId === factId && r.characterId === characterId && r.beforeStory)) await deleteKnowledgeReveal(r.id)
      }
      for (const { factId, characterId } of plan.knownBefore ?? []) {
        if (!first || filed.some((r) => r.factId === factId && r.characterId === characterId && r.beforeStory)) continue
        await createKnowledgeReveal({ worldId, factId, characterId, eventId: first, note: '', beforeStory: true })
        if (first !== eventId) filedAt = first
      }
    }
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
  return { filedAt }
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
