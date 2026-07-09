import type { KnowledgeFact, KnowledgeReveal, CharacterSnapshot, WorldEvent, Chapter } from '@/types'

// Global narrative order shared with the continuity checker: chapter.number is
// the major key, event.sortOrder the minor. Keep this in sync with the checker.
function makeEventOrder(events: WorldEvent[], chapters: Chapter[]) {
  const chapNumById = new Map(chapters.map((c) => [c.id, c.number]))
  const eventById = new Map(events.map((e) => [e.id, e]))
  return (eventId: string): number => {
    const ev = eventById.get(eventId)
    if (!ev) return -1
    return (chapNumById.get(ev.chapterId) ?? 0) * 10_000 + ev.sortOrder
  }
}

// ── Knowledge reveal continuity ────────────────────────────────────────────────

export interface DeadKnowerIssue {
  fact: KnowledgeFact
  characterId: string
  /** The reveal event where the already-dead character supposedly learns it. */
  revealEventId: string
}

/**
 * Flags a character who *learns* a fact after they have already died — a reveal
 * attached to an event that comes strictly after the character's death. The
 * knowledge system tracks anachronistic knowledge (knowing before a fact is
 * true) and reader leaks, but has no dead-character guard the way the cast and
 * relationship checks do; this fills that gap.
 *
 * Only "already dead going into the event" counts: a reveal placed *at* the very
 * event where the character dies (a death-bed revelation) is left alone, and so
 * is anything in a flashback. Pure and side-effect free.
 */
export function computeDeadKnowerIssues({
  facts, reveals, snapshots, events, chapters,
}: {
  facts: KnowledgeFact[]
  reveals: KnowledgeReveal[]
  snapshots: CharacterSnapshot[]
  events: WorldEvent[]
  chapters: Chapter[]
}): DeadKnowerIssue[] {
  const eventOrder = makeEventOrder(events, chapters)
  const eventById = new Map(events.map((e) => [e.id, e]))
  const factById = new Map(facts.map((f) => [f.id, f]))

  // Alive-status history per character, in narrative order.
  const aliveHistory = new Map<string, Array<{ order: number; isAlive: boolean }>>()
  for (const s of snapshots) {
    const arr = aliveHistory.get(s.characterId) ?? []
    arr.push({ order: eventOrder(s.eventId), isAlive: s.isAlive })
    aliveHistory.set(s.characterId, arr)
  }
  for (const arr of aliveHistory.values()) arr.sort((a, b) => a.order - b.order)

  /** Whether the character is dead *going into* the given order — the most
   *  recent status from a strictly-earlier event is "not alive". */
  function isDeadBefore(charId: string, order: number): boolean {
    const hist = aliveHistory.get(charId)
    if (!hist) return false
    let lastAlive: boolean | null = null
    for (const entry of hist) {
      if (entry.order >= order) break
      lastAlive = entry.isAlive
    }
    return lastAlive === false
  }

  const out: DeadKnowerIssue[] = []
  for (const r of reveals) {
    const ev = eventById.get(r.eventId)
    if (!ev || ev.isFlashback) continue
    const fact = factById.get(r.factId)
    if (!fact) continue
    if (isDeadBefore(r.characterId, eventOrder(r.eventId))) {
      out.push({ fact, characterId: r.characterId, revealEventId: r.eventId })
    }
  }
  return out
}
