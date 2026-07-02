import type {
  KnowledgeFact, KnowledgeReveal, WorldEvent, Chapter, Character, CharacterSnapshot,
} from '@/types'

/** A fact the app proposes from a significant state change (currently deaths). */
export interface FactSuggestion {
  title: string
  originEventId: string
  /** Characters present at the origin event (candidate first knowers). */
  presentCharacterIds: string[]
  chapterNumber: number | null
}

/** A proposed reveal: a character who shared a scene with someone who already
 *  knew the fact, but who has no reveal of their own. */
export interface RevealSuggestion {
  characterId: string
  eventId: string
  viaCharacterId: string
  chapterNumber: number | null
}

function orderMap(events: WorldEvent[], chapters: Chapter[]) {
  const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))
  const ordered = [...events].sort((a, b) => {
    const byChapter = (chapterNumber.get(a.chapterId) ?? 0) - (chapterNumber.get(b.chapterId) ?? 0)
    return byChapter !== 0 ? byChapter : a.sortOrder - b.sortOrder
  })
  return { ordered, order: new Map(ordered.map((e, i) => [e.id, i])), chapterNumber }
}

function presentAt(ev: WorldEvent): string[] {
  const ids = new Set(ev.involvedCharacterIds)
  if (ev.povCharacterId) ids.add(ev.povCharacterId)
  return [...ids]
}

/**
 * Proposes a "<name> is dead" fact for each character's first death, unless a
 * fact already originates at that event. Origin is set so the anachronism check
 * works out of the box.
 */
export function suggestDeathFacts({
  characters, snapshots, events, chapters, existingFacts,
}: {
  characters: Character[]
  snapshots: CharacterSnapshot[]
  events: WorldEvent[]
  chapters: Chapter[]
  existingFacts: KnowledgeFact[]
}): FactSuggestion[] {
  const { order, chapterNumber } = orderMap(events, chapters)
  const eventById = new Map(events.map((e) => [e.id, e]))
  const takenOrigins = new Set(existingFacts.map((f) => f.originEventId).filter(Boolean) as string[])
  const charName = new Map(characters.map((c) => [c.id, c.name]))

  const snapsByChar = new Map<string, CharacterSnapshot[]>()
  for (const s of snapshots) {
    const arr = snapsByChar.get(s.characterId)
    if (arr) arr.push(s)
    else snapsByChar.set(s.characterId, [s])
  }

  const out: FactSuggestion[] = []
  for (const [charId, snaps] of snapsByChar) {
    const sorted = [...snaps].sort((a, b) => (order.get(a.eventId) ?? 0) - (order.get(b.eventId) ?? 0))
    const death = sorted.find((s) => !s.isAlive)
    if (!death || takenOrigins.has(death.eventId)) continue
    const ev = eventById.get(death.eventId)
    if (!ev) continue
    out.push({
      title: `${charName.get(charId) ?? 'A character'} is dead`,
      originEventId: death.eventId,
      presentCharacterIds: presentAt(ev),
      chapterNumber: chapterNumber.get(ev.chapterId) ?? null,
    })
  }
  return out
}

/**
 * For one fact, proposes reveals for characters who shared a scene with someone
 * who already knew it (at or before that scene) but who have no reveal yet.
 * One suggestion per character — the earliest such co-presence.
 */
export function suggestReveals({
  fact, reveals, events, chapters,
}: {
  fact: KnowledgeFact
  reveals: KnowledgeReveal[]
  events: WorldEvent[]
  chapters: Chapter[]
}): RevealSuggestion[] {
  const { ordered, order, chapterNumber } = orderMap(events, chapters)

  const learnedOrder = new Map<string, number>()
  for (const r of reveals) {
    if (r.factId !== fact.id) continue
    const o = order.get(r.eventId)
    if (o === undefined) continue
    const prev = learnedOrder.get(r.characterId)
    if (prev === undefined || o < prev) learnedOrder.set(r.characterId, o)
  }
  if (learnedOrder.size === 0) return [] // nobody knows it yet — nothing to spread

  const suggested = new Set<string>()
  const out: RevealSuggestion[] = []
  for (const ev of ordered) {
    const evOrder = order.get(ev.id)!
    const present = presentAt(ev)
    const knowerHere = present.find((id) => {
      const l = learnedOrder.get(id)
      return l !== undefined && l <= evOrder
    })
    if (!knowerHere) continue
    for (const id of present) {
      if (id === knowerHere) continue
      if (learnedOrder.has(id) || suggested.has(id)) continue
      suggested.add(id)
      out.push({ characterId: id, eventId: ev.id, viaCharacterId: knowerHere, chapterNumber: chapterNumber.get(ev.chapterId) ?? null })
    }
  }
  return out
}
