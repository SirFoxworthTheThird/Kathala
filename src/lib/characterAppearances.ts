import type { WorldEvent, Chapter } from '@/types'

/** One place a character shows up in the story. */
export interface CharacterAppearance {
  eventId: string
  eventTitle: string
  chapterId: string
  chapterNumber: number | null
  chapterTitle: string
  isFlashback: boolean
  /** true when the character is the POV of this event (implies present). */
  isPov: boolean
}

export interface CharacterAppearances {
  /** Events where the character is on-stage (in the cast or the POV). */
  present: CharacterAppearance[]
  /** Events where the character is referenced but not present ("@"-mentions). */
  mentioned: CharacterAppearance[]
}

/**
 * Splits a character's story appearances into "present" (on-stage: cast or POV)
 * and "mentioned" (referenced but absent). A character present in an event is
 * never also listed as merely mentioned there — presence wins. Both lists are
 * in narrative order (chapter number, then event sortOrder). Pure and derived.
 */
export function computeCharacterAppearances({
  characterId, events, chapters,
}: {
  characterId: string
  events: WorldEvent[]
  chapters: Chapter[]
}): CharacterAppearances {
  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const order = (e: WorldEvent) => (chapterById.get(e.chapterId)?.number ?? 0) * 1_000_000 + e.sortOrder

  const toAppearance = (e: WorldEvent): CharacterAppearance => {
    const ch = chapterById.get(e.chapterId)
    return {
      eventId: e.id,
      eventTitle: e.title,
      chapterId: e.chapterId,
      chapterNumber: ch?.number ?? null,
      chapterTitle: ch?.title ?? '',
      isFlashback: e.isFlashback ?? false,
      isPov: e.povCharacterId === characterId,
    }
  }

  const sorted = [...events].sort((a, b) => order(a) - order(b))
  const present: CharacterAppearance[] = []
  const mentioned: CharacterAppearance[] = []

  for (const e of sorted) {
    const isPresent = e.involvedCharacterIds.includes(characterId) || e.povCharacterId === characterId
    if (isPresent) {
      present.push(toAppearance(e))
    } else if ((e.mentionedCharacterIds ?? []).includes(characterId)) {
      mentioned.push(toAppearance(e))
    }
  }

  return { present, mentioned }
}
