import type { Chapter, Timeline } from '@/types'

/**
 * Every timeline at once, where a timeline id is asked for: the Manuscript's
 * *All timelines* tab, and the reader's one book.
 */
export const ALL_TIMELINES = '__all__'

/**
 * The reader's book: one book, however many timelines the story bible keeps.
 *
 * Timelines are how a story bible keeps a frame narrative straight — *The
 * Odyssey*'s homecoming and the wanderings Odysseus recounts at the Phaeacian
 * court — but the book they belong to takes turns between them, and its
 * chapter numbers run across both. Split by timeline, a reader opening *The
 * Odyssey* read Books 1 to 8 and then 13: the four books of the wanderings were
 * behind a tab, and *The Time Machine*'s whole journey behind another.
 *
 * So in reading mode, where there is more than one timeline, the Manuscript and
 * its binder have no tabs: the book is every timeline's chapters in number
 * order, each saying which timeline it is in. A writer keeps the tabs, a
 * chapter belonging to the one timeline it is written into.
 */
export function isReadersBook(readingMode: boolean, timelineCount: number): boolean {
  return readingMode && timelineCount > 1
}

/** Each chapter's timeline, by chapter id, for saying it beside the chapter. */
export function chapterTimelines(
  chapters: readonly Pick<Chapter, 'id' | 'timelineId'>[],
  timelines: readonly Timeline[],
): Map<string, Timeline> {
  const byId = new Map(timelines.map((t) => [t.id, t]))
  const out = new Map<string, Timeline>()
  for (const c of chapters) {
    const t = byId.get(c.timelineId)
    if (t) out.set(c.id, t)
  }
  return out
}
