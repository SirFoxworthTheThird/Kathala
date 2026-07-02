import type { KnowledgeFact, KnowledgeReveal, WorldEvent, Chapter } from '@/types'

/** irony  = reader knows, a present character doesn't (dramatic irony).
 *  withheld = a present character knows, the reader doesn't (mystery). */
export type GapKind = 'irony' | 'withheld'

export interface SceneKnowledgeGap {
  fact: KnowledgeFact
  readerKnows: boolean
  /** Present character ids who know the fact at the cursor. */
  knownBy: string[]
  /** Present character ids who don't. */
  unknownBy: string[]
  kind: GapKind
}

/**
 * Computes the reader-vs-character (and character-vs-character) knowledge gaps
 * in effect at the active event, for the characters present in the scene.
 *
 * The reader's "learned at" is taken from `fact.readerLearnsAtEventId` when set,
 * otherwise derived from POV: the reader learns a fact at the first event whose
 * POV character already knows it. Everything is read against narrative order.
 */
export function computeSceneKnowledgeGaps({
  facts, reveals, events, chapters, presentCharacterIds, activeEventId,
}: {
  facts: KnowledgeFact[]
  reveals: KnowledgeReveal[]
  events: WorldEvent[]
  chapters: Chapter[]
  presentCharacterIds: string[]
  activeEventId: string | null
}): SceneKnowledgeGap[] {
  if (!activeEventId) return []

  const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))
  const ordered = [...events].sort((a, b) => {
    const byChapter = (chapterNumber.get(a.chapterId) ?? 0) - (chapterNumber.get(b.chapterId) ?? 0)
    return byChapter !== 0 ? byChapter : a.sortOrder - b.sortOrder
  })
  const order = new Map(ordered.map((e, i) => [e.id, i]))
  const cursorOrder = order.get(activeEventId)
  if (cursorOrder === undefined) return []

  // reveals grouped by fact → (characterId → earliest order they learn it)
  const learnedOrder = new Map<string, Map<string, number>>()
  for (const r of reveals) {
    const o = order.get(r.eventId)
    if (o === undefined) continue
    let byChar = learnedOrder.get(r.factId)
    if (!byChar) { byChar = new Map(); learnedOrder.set(r.factId, byChar) }
    const prev = byChar.get(r.characterId)
    if (prev === undefined || o < prev) byChar.set(r.characterId, o)
  }

  /** Order at which the reader learns a fact (explicit, or derived from POV). */
  function readerOrder(fact: KnowledgeFact): number {
    if (fact.readerLearnsAtEventId) return order.get(fact.readerLearnsAtEventId) ?? Infinity
    const byChar = learnedOrder.get(fact.id)
    if (!byChar) return Infinity
    for (const ev of ordered) {
      if (!ev.povCharacterId) continue
      const learned = byChar.get(ev.povCharacterId)
      const evOrder = order.get(ev.id)!
      if (learned !== undefined && learned <= evOrder) return evOrder
    }
    return Infinity
  }

  const present = presentCharacterIds
  const gaps: SceneKnowledgeGap[] = []

  for (const fact of facts) {
    const byChar = learnedOrder.get(fact.id)
    const knownBy: string[] = []
    const unknownBy: string[] = []
    for (const cid of present) {
      const learned = byChar?.get(cid)
      if (learned !== undefined && learned <= cursorOrder) knownBy.push(cid)
      else unknownBy.push(cid)
    }
    const readerKnows = readerOrder(fact) <= cursorOrder

    if (readerKnows && unknownBy.length > 0) {
      gaps.push({ fact, readerKnows, knownBy, unknownBy, kind: 'irony' })
    } else if (!readerKnows && knownBy.length > 0) {
      gaps.push({ fact, readerKnows, knownBy, unknownBy, kind: 'withheld' })
    }
  }

  return gaps
}
