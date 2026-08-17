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
/**
 * Records that hang off an event — a knowledge reveal, say — in the order those
 * events are read, given the positions `eventsInReadingOrder` produced.
 *
 * `useLiveQuery` hands these back in primary-key order too, so a fact's *Known
 * by* list read "Ch.3, Ch.1, Ch.2" — the same fault **WRUN-3** fixed for the
 * pickers on that screen, in a list beside them (**F-8**). 83 of the 287 facts
 * in the shipped library have three or more knowers.
 *
 * Two records on the same event keep the order they arrived in, since the read
 * cannot separate them and inventing a second key would only make the list
 * shuffle for a reason nobody could see. A record whose event is unknown sorts
 * last rather than being dropped: it is still a thing somebody knows.
 *
 * Does not mutate its input.
 */
export function byReadingPosition<T extends { eventId: string }>(
  records: readonly T[],
  position: ReadonlyMap<string, number>,
): T[] {
  return [...records].sort((a, b) => {
    const pa = position.get(a.eventId)
    const pb = position.get(b.eventId)
    if (pa === undefined) return pb === undefined ? 0 : 1
    if (pb === undefined) return -1
    return pa - pb
  })
}

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
