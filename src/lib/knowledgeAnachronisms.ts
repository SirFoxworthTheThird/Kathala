import type { KnowledgeFact, KnowledgeReveal, WorldEvent, Chapter } from '@/types'

/** Someone knowing a fact before it becomes true/knowable (before its origin). */
export interface KnowledgeAnachronism {
  fact: KnowledgeFact
  /** The character who knows it too early, or null for the reader. */
  characterId: string | null
  /** The event where the too-early knowledge appears. */
  knownAtEventId: string
  originEventId: string
}

/**
 * Flags anachronistic knowledge: a character (via a reveal) or the reader (via
 * an explicit reader-clock) knowing a fact before the fact's origin event —
 * "she mourns the king in Ch. 2, but he doesn't die until Ch. 5". Pure and
 * dependency-free so the continuity checker can call it and it stays testable.
 */
export function computeKnowledgeAnachronisms({
  facts, reveals, events, chapters,
}: {
  facts: KnowledgeFact[]
  reveals: KnowledgeReveal[]
  events: WorldEvent[]
  chapters: Chapter[]
}): KnowledgeAnachronism[] {
  const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))
  const ordered = [...events].sort((a, b) => {
    const byChapter = (chapterNumber.get(a.chapterId) ?? 0) - (chapterNumber.get(b.chapterId) ?? 0)
    return byChapter !== 0 ? byChapter : a.sortOrder - b.sortOrder
  })
  const order = new Map(ordered.map((e, i) => [e.id, i]))

  const revealsByFact = new Map<string, KnowledgeReveal[]>()
  for (const r of reveals) {
    const arr = revealsByFact.get(r.factId)
    if (arr) arr.push(r)
    else revealsByFact.set(r.factId, [r])
  }

  const out: KnowledgeAnachronism[] = []
  for (const fact of facts) {
    if (!fact.originEventId) continue
    const originOrder = order.get(fact.originEventId)
    if (originOrder === undefined) continue

    for (const r of revealsByFact.get(fact.id) ?? []) {
      const o = order.get(r.eventId)
      if (o !== undefined && o < originOrder) {
        out.push({ fact, characterId: r.characterId, knownAtEventId: r.eventId, originEventId: fact.originEventId })
      }
    }

    if (fact.readerLearnsAtEventId) {
      const ro = order.get(fact.readerLearnsAtEventId)
      if (ro !== undefined && ro < originOrder) {
        out.push({ fact, characterId: null, knownAtEventId: fact.readerLearnsAtEventId, originEventId: fact.originEventId })
      }
    }
  }
  return out
}
