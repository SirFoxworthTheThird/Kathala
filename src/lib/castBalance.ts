import type { Character, CharacterSnapshot, Chapter, WorldEvent } from '@/types'

/** Per-character presence analytics across the story. */
export interface CastMember {
  character: Character
  /** Events where the character is on-stage (in the cast or the POV). */
  sceneCount: number
  /** Events where they're the POV. */
  povCount: number
  /** Events where they're referenced but not present ("@"-mentions). */
  mentionCount: number
  /** Total words of the scenes they're present in — word-weighted screen time. */
  wordCount: number
  /** wordCount as a fraction of the whole manuscript's words (0–1). */
  wordShare: number
  /** Present-in-chapter flags, one per chapter in narrative order. */
  presenceByChapter: boolean[]
  firstChapterNumber: number | null
  lastChapterNumber: number | null
  /** Chapters between their last appearance and the end of the story. */
  trailingGap: number
  /** Longest run of consecutive chapters with no appearance *between* their
   *  first and last appearance (an on-page character who drops out mid-story). */
  longestDormancy: number
  /** The chapter they die in and stay dead, or null. Their silence after it is the story, not a gap. */
  diedInChapter: number | null
}

export interface CastBalanceResult {
  members: CastMember[]
  chapterCount: number
  /** Total words across all scenes (denominator for wordShare). */
  totalWords: number
}

/**
 * Derives each character's footprint across the story: how many scenes and how
 * many *words* they're present for, how often they hold the POV, how often
 * they're merely mentioned, and where they go quiet. Pure — nothing stored.
 *
 * Word-weighted screen time (via `wordCountByEvent`) is the headline metric; it
 * falls back to scene counts when no prose has been written yet.
 */
export function computeCastBalance({
  characters, chapters, events, wordCountByEvent, snapshots = [],
}: {
  characters: Character[]
  chapters: Chapter[]
  events: WorldEvent[]
  /** Scene word count per event id (from stored scene texts). */
  wordCountByEvent?: Map<string, number>
  /** Character states, for who dies and where: see `diedInChapter`. */
  snapshots?: Pick<CharacterSnapshot, 'characterId' | 'eventId' | 'isAlive'>[]
}): CastBalanceResult {
  const deaths = deathChapters(snapshots, events, chapters)
  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number)
  const eventsByChapter = new Map<string, WorldEvent[]>()
  for (const e of events) {
    const arr = eventsByChapter.get(e.chapterId)
    if (arr) arr.push(e)
    else eventsByChapter.set(e.chapterId, [e])
  }

  const wordsOf = (eventId: string) => wordCountByEvent?.get(eventId) ?? 0
  const totalWords = events.reduce((sum, e) => sum + wordsOf(e.id), 0)

  const isPresent = (charId: string, e: WorldEvent) =>
    e.involvedCharacterIds.includes(charId) || e.povCharacterId === charId

  const members: CastMember[] = characters.map((character) => {
    let sceneCount = 0, povCount = 0, mentionCount = 0, wordCount = 0
    for (const e of events) {
      if (isPresent(character.id, e)) {
        sceneCount++
        wordCount += wordsOf(e.id)
        if (e.povCharacterId === character.id) povCount++
      } else if ((e.mentionedCharacterIds ?? []).includes(character.id)) {
        mentionCount++
      }
    }

    const presenceByChapter = sortedChapters.map((ch) =>
      (eventsByChapter.get(ch.id) ?? []).some((e) => isPresent(character.id, e))
    )
    const firstIdx = presenceByChapter.indexOf(true)
    const lastIdx = presenceByChapter.lastIndexOf(true)

    // Longest interior absence run (between first and last appearance).
    let longestDormancy = 0
    if (firstIdx !== -1) {
      let run = 0
      for (let i = firstIdx + 1; i < lastIdx; i++) {
        if (!presenceByChapter[i]) { run++; longestDormancy = Math.max(longestDormancy, run) }
        else run = 0
      }
    }

    return {
      character,
      sceneCount, povCount, mentionCount, wordCount,
      wordShare: totalWords > 0 ? wordCount / totalWords : 0,
      presenceByChapter,
      firstChapterNumber: firstIdx >= 0 ? sortedChapters[firstIdx].number : null,
      lastChapterNumber: lastIdx >= 0 ? sortedChapters[lastIdx].number : null,
      trailingGap: lastIdx === -1 ? sortedChapters.length : sortedChapters.length - 1 - lastIdx,
      longestDormancy,
      diedInChapter: deaths.get(character.id) ?? null,
    }
  })

  // Headline order: most screen time first (words, then scenes), then name.
  members.sort((a, b) =>
    b.wordCount - a.wordCount ||
    b.sceneCount - a.sceneCount ||
    a.character.name.localeCompare(b.character.name)
  )

  return { members, chapterCount: sortedChapters.length, totalWords }
}

/**
 * The chapter each character dies in and stays dead: the first state of their
 * last run of not-alive states, in story order. Somebody who comes back is not
 * dead, and has no entry.
 *
 * Cast Balance said "quiet 3 chapters" of a character the book had killed —
 * which is what a death is (writer run 5, U5).
 */
export function deathChapters(
  snapshots: readonly Pick<CharacterSnapshot, 'characterId' | 'eventId' | 'isAlive'>[],
  events: readonly WorldEvent[],
  chapters: readonly Chapter[],
): Map<string, number> {
  const number = new Map(chapters.map((c) => [c.id, c.number]))
  const event = new Map(events.map((e) => [e.id, e]))
  const order = (eventId: string) => {
    const e = event.get(eventId)
    return e ? (number.get(e.chapterId) ?? 0) * 1_000_000 + e.sortOrder : Number.NaN
  }
  const byCharacter = new Map<string, Array<{ order: number; eventId: string; isAlive: boolean }>>()
  for (const s of snapshots) {
    const at = order(s.eventId)
    if (Number.isNaN(at)) continue
    const list = byCharacter.get(s.characterId) ?? []
    list.push({ order: at, eventId: s.eventId, isAlive: s.isAlive })
    byCharacter.set(s.characterId, list)
  }
  const out = new Map<string, number>()
  for (const [id, list] of byCharacter) {
    list.sort((a, b) => a.order - b.order)
    let i = list.length - 1
    if (i < 0 || list[i].isAlive) continue
    while (i > 0 && !list[i - 1].isAlive) i--
    const e = event.get(list[i].eventId)
    const n = e ? number.get(e.chapterId) : undefined
    if (n !== undefined) out.set(id, n)
  }
  return out
}
