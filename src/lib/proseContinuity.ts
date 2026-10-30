import { factMatches, type FactMatch } from './spoilerWords'
import type { WorldEvent, Chapter, Character, KnowledgeFact } from '@/types'
import { detectMentions } from '@/lib/manuscript'
import { positionLookup } from '@/lib/bookOrder'

// Book order, shared with the checker and everything else: see `bookOrder.ts`.
const makeEventOrder = positionLookup

/**
 * How many times a name must appear before the scene is worth asking about.
 *
 * One is the common case and the least informative: a letter, a memory, someone
 * addressed in their absence. Two is where a name starts to behave like a
 * person in the room.
 */
const MIN_MENTIONS = 2

// ── Prose ↔ cast drift ────────────────────────────────────────────────────────

export interface ProseMentionIssue {
  eventId: string
  /** Everyone named in the prose of this scene who is not in its cast. */
  characters: Array<{ characterId: string; characterName: string; count: number }>
}

/**
 * Names in a scene's prose that its cast does not account for — **one issue per
 * scene, not one per name.**
 *
 * Run across the forty-six shipped books this check produced **4,894 warnings,
 * three quarters of everything the continuity checker had to say**: 426 in *The
 * Count of Monte Cristo*, 368 in the *Iliad*, where Homer names gods in
 * epithets. That is what per-name means in a finished novel, because characters
 * are talked about far more often than they are present.
 *
 * Two bounds, both measured rather than guessed:
 *
 * - **Once per scene.** The writer's question is *does this scene's cast match
 *   what I wrote*, which is asked once and answered once. Twelve rows for
 *   twelve names is the same question twelve times.
 * - **Twice in the text.** A name that appears once is usually a reference —
 *   someone remembered, addressed in absence, named in a letter. A name that
 *   recurs is likelier to be someone in the room.
 *
 * It does not flag the dead. A separate check used to, and on *Treasure Island*
 * it reported Billy Bones thirty-eight times: he dies in chapter three and the
 * entire plot is his map and his chest. `dead-in-event` asks the precise
 * version — is a dead character in the scene's *cast* — and fires 45 times
 * across all forty-six books.
 *
 * Pure.
 */
export function computeProseMentionIssues({
  events, characters, sceneTextByEvent, others = [],
}: {
  events: WorldEvent[]
  characters: Character[]
  sceneTextByEvent: Map<string, string>
  /** The world's places and items, by name: a word of a character's name inside one is not them (see `detectMentions`). */
  others?: readonly string[]
}): ProseMentionIssue[] {
  const out: ProseMentionIssue[] = []

  for (const ev of events) {
    const text = sceneTextByEvent.get(ev.id)
    if (!text || !text.trim()) continue

    // "Acknowledged" = on-stage cast, POV, or an explicit "@"-mention. Any of
    // these means the writer already accounts for the character in this scene.
    const acknowledged = new Set([
      ...ev.involvedCharacterIds,
      ...(ev.povCharacterId ? [ev.povCharacterId] : []),
      ...(ev.mentionedCharacterIds ?? []),
    ])

    const unaccounted = detectMentions(text, characters, others)
      // Characters the writer already accounts for are covered elsewhere.
      .filter((m) => !acknowledged.has(m.characterId))
      .filter((m) => m.count >= MIN_MENTIONS)
      .map((m) => ({ characterId: m.characterId, characterName: m.name, count: m.count }))

    if (unaccounted.length > 0) out.push({ eventId: ev.id, characters: unaccounted })
  }

  return out
}

// ── Reader knowledge leaks ──────────────────────────────────────────────────

export interface KnowledgeLeakIssue {
  fact: KnowledgeFact
  /** Earlier event whose prose references the fact. */
  leakEventId: string
  /** The event where the reader is supposed to learn it. */
  revealEventId: string
  /** The tag or title phrase that matched in the prose. */
  matchedTerm: string
}

/**
 * Flags scenes whose prose references a fact *before* the reader is meant to
 * learn it. Only facts with an explicit `readerLearnsAtEventId` are checked
 * (a null clock means "derive from POV" — no fixed reveal point to compare).
 *
 * Matching is deliberately conservative and writer-controlled: a fact's
 * spoiler words or tags (`matchTerms`, whole word, case-insensitive) or its
 * exact title phrase must literally appear in an earlier scene. Pure.
 */
export function computeKnowledgeLeaks({
  facts, events, chapters, sceneTextByEvent,
}: {
  facts: KnowledgeFact[]
  events: WorldEvent[]
  chapters: Chapter[]
  sceneTextByEvent: Map<string, string>
}): KnowledgeLeakIssue[] {
  const eventOrder = makeEventOrder(events, chapters)
  const out: KnowledgeLeakIssue[] = []

  for (const fact of facts) {
    if (!fact.readerLearnsAtEventId) continue
    const revealOrder = eventOrder(fact.readerLearnsAtEventId)
    if (revealOrder < 0) continue

    for (const ev of events) {
      if (eventOrder(ev.id) >= revealOrder) continue // only strictly-earlier scenes
      const text = sceneTextByEvent.get(ev.id)
      if (!text || !text.trim()) continue

      // The title as a phrase, then each spoiler word and tag as a whole word (`factMatches`): the first found is named.
      const [first] = factMatches(text, fact)
      if (first) out.push({ fact, leakEventId: ev.id, revealEventId: fact.readerLearnsAtEventId, matchedTerm: first.term })
    }
  }

  return out
}

/** A place in the prose of one scene that gives a fact away before the reader is set to learn it. */
export interface SceneLeak extends FactMatch {
  fact: KnowledgeFact
  /** The scene where the reader is set to learn it. */
  revealEventId: string
}

/**
 * Everywhere scene `sceneId`'s prose gives a fact away before the reader is
 * set to learn it — `computeKnowledgeLeaks`, for one scene and with where:
 * what the Page underlines as it is written (Part E1). `order` places a scene
 * in the book (`positionLookup`), over every timeline, since a reveal may be
 * in another era's chapter. In order through the prose.
 */
export function sceneLeaks(text: string, sceneId: string, facts: readonly KnowledgeFact[], order: (id: string) => number): SceneLeak[] {
  const here = order(sceneId)
  if (here < 0 || !text.trim()) return []
  const out: SceneLeak[] = []
  for (const fact of facts) {
    if (!fact.readerLearnsAtEventId) continue
    const reveal = order(fact.readerLearnsAtEventId)
    if (reveal < 0 || here >= reveal) continue
    for (const m of factMatches(text, fact)) out.push({ ...m, fact, revealEventId: fact.readerLearnsAtEventId })
  }
  return out.sort((a, b) => a.from - b.from || b.to - a.to)
}
