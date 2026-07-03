import type { WorldEvent, Chapter, Character, CharacterSnapshot, KnowledgeFact } from '@/types'
import { detectMentions } from '@/lib/manuscript'

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

/** Resolves whether a character is dead as of a given narrative order, from the
 *  most recent alive-status snapshot at or before that point. */
function makeIsDeadAtOrder(snapshots: CharacterSnapshot[], eventOrder: (id: string) => number) {
  const byChar = new Map<string, Array<{ order: number; isAlive: boolean }>>()
  for (const s of snapshots) {
    if (!byChar.has(s.characterId)) byChar.set(s.characterId, [])
    byChar.get(s.characterId)!.push({ order: eventOrder(s.eventId), isAlive: s.isAlive })
  }
  for (const arr of byChar.values()) arr.sort((a, b) => a.order - b.order)
  return (charId: string, order: number): boolean => {
    const hist = byChar.get(charId)
    if (!hist) return false
    let lastAlive: boolean | null = null
    for (const entry of hist) {
      if (entry.order > order) break
      lastAlive = entry.isAlive
    }
    return lastAlive === false
  }
}

// ── Prose ↔ cast drift ────────────────────────────────────────────────────────

export interface ProseMentionIssue {
  /** 'dead' = named while dead; 'untagged' = named but not in the event cast. */
  kind: 'dead' | 'untagged'
  eventId: string
  characterId: string
  characterName: string
  /** How many times the name appears in the scene. */
  count: number
}

/**
 * Reconciles each scene's prose against the event's structured cast:
 *  - a character named in the text who is dead at that point ('dead'), or
 *  - a character named in the text but not listed on the event ('untagged').
 * Characters already in the cast are left to the metadata-based checks, so this
 * only surfaces genuine drift between the words and the record. Pure.
 */
export function computeProseMentionIssues({
  events, chapters, characters, snapshots, sceneTextByEvent,
}: {
  events: WorldEvent[]
  chapters: Chapter[]
  characters: Character[]
  snapshots: CharacterSnapshot[]
  sceneTextByEvent: Map<string, string>
}): ProseMentionIssue[] {
  const eventOrder = makeEventOrder(events, chapters)
  const isDeadAtOrder = makeIsDeadAtOrder(snapshots, eventOrder)
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

    for (const m of detectMentions(text, characters)) {
      // Characters the writer already accounts for are covered elsewhere.
      if (acknowledged.has(m.characterId)) continue

      // A dead mention is the stronger, more specific signal. Flashbacks may name
      // the dead deliberately, so only flag 'dead' outside flashbacks.
      if (!ev.isFlashback && isDeadAtOrder(m.characterId, eventOrder(ev.id))) {
        out.push({ kind: 'dead', eventId: ev.id, characterId: m.characterId, characterName: m.name, count: m.count })
      } else {
        out.push({ kind: 'untagged', eventId: ev.id, characterId: m.characterId, characterName: m.name, count: m.count })
      }
    }
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Flags scenes whose prose references a fact *before* the reader is meant to
 * learn it. Only facts with an explicit `readerLearnsAtEventId` are checked
 * (a null clock means "derive from POV" — no fixed reveal point to compare).
 *
 * Matching is deliberately conservative and writer-controlled: a fact's tags
 * (whole word, case-insensitive) or its exact title phrase must literally appear
 * in an earlier scene. Pure.
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

    // Build the matchers: each tag as a whole word, plus the title as a phrase.
    const tagMatchers = fact.tags
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
      .map((t) => ({ term: t, re: new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i') }))
    const titlePhrase = fact.title.trim().toLowerCase()

    for (const ev of events) {
      if (eventOrder(ev.id) >= revealOrder) continue // only strictly-earlier scenes
      const text = sceneTextByEvent.get(ev.id)
      if (!text || !text.trim()) continue

      let matched: string | null = null
      if (titlePhrase.length >= 4 && text.toLowerCase().includes(titlePhrase)) {
        matched = fact.title.trim()
      } else {
        for (const tm of tagMatchers) {
          if (tm.re.test(text)) { matched = tm.term; break }
        }
      }
      if (matched) {
        out.push({ fact, leakEventId: ev.id, revealEventId: fact.readerLearnsAtEventId, matchedTerm: matched })
      }
    }
  }

  return out
}
