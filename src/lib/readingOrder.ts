/** The parts of an event that decide where it falls in the read. */
interface OrderableEvent {
  chapterId: string
  sortOrder: number
}

/** The parts of a chapter that decide where it falls in the read. */
interface OrderableChapter {
  id: string
  number: number
}

/**
 * Every event in the order they are read: by chapter number, then by position
 * within the chapter.
 *
 * The hooks hand events back in Dexie's order, which is by primary key and so
 * has nothing to do with the story. Anything showing a writer a list of scenes
 * has to sort first, and **W-3** is what happens when one of them does not:
 * Knowledge's three "when did they learn it" pickers listed the raw array, so
 * on the shipped *Dracula* chapters 1 to 3 sat at positions 12, 23, 34, 45, 56,
 * 67, 78 and 84 of 84.
 *
 * A chapter with no number sorts as 0, which puts an unnumbered chapter first
 * rather than dropping its scenes out of the list — the same choice the five
 * other copies of this comparison already make.
 *
 * Does not mutate its input.
 */
export function eventsInReadingOrder<T extends OrderableEvent>(
  events: readonly T[],
  chapters: readonly OrderableChapter[],
): T[] {
  const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))
  return [...events].sort((a, b) => {
    const byChapter = (chapterNumber.get(a.chapterId) ?? 0) - (chapterNumber.get(b.chapterId) ?? 0)
    return byChapter !== 0 ? byChapter : a.sortOrder - b.sortOrder
  })
}
