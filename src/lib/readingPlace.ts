/**
 * Where a reader is in the book, as a book tells you rather than as a scrollbar
 * does.
 *
 * The reading screen renders the whole novel as one column. *The Count of Monte
 * Cristo* is 459,375 words and 1,918 screens of it — a scrollbar thumb across
 * that is a few pixels tall and says nothing a reader can use. A paperback
 * answers the same question by being thick on one side and thin on the other,
 * and the answer is two-sided: how far through the book, and how much of this
 * chapter is left.
 *
 * Kept pure and away from the DOM so the arithmetic can be tested without a
 * browser; the component hands it measurements it has already taken.
 */

/** One chapter's extent inside the scrolling column. */
export interface ChapterExtent {
  /** The chapter's own number, as the book counts them. */
  number: number
  /** Distance from the top of the column to the top of this chapter, in px. */
  top: number
  /** How tall the chapter is, in px. */
  height: number
  /** How many words it holds, for the estimate of what is left. */
  words: number
}

export interface Place {
  /** How far through the whole book, 0-100. */
  percent: number
  /** Where the reader is within the book's chapters, or null if it cannot be said. */
  chapter: {
    number: number
    /** Words still to come in this chapter, from where the reader is. */
    wordsLeft: number
  } | null
}

/**
 * A reader's place, from measurements of the column.
 *
 * `percent` is of the *scrollable* distance rather than of `scrollHeight`, so
 * reaching the bottom reads 100 rather than stopping short by one screen.
 *
 * A book that fits entirely on screen has nothing to scroll and no progress to
 * report, so it reads 0 rather than 100: the reader is at the beginning of it,
 * not the end, and claiming otherwise on a one-screen book would be the kind of
 * cheerful lie a progress indicator exists to avoid.
 *
 * The chapter is the one containing the top of the viewport — what the reader
 * is looking at now, not how far the spoiler gate has been opened. Those two
 * genuinely differ: turning back to re-read chapter three does not close the
 * gate, and this should still say three.
 */
export function readingPlace(args: {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  chapters: readonly ChapterExtent[]
}): Place {
  const { scrollTop, scrollHeight, clientHeight, chapters } = args

  const scrollable = scrollHeight - clientHeight
  const percent = scrollable <= 0
    ? 0
    : Math.round(Math.min(1, Math.max(0, scrollTop / scrollable)) * 100)

  // The last chapter that has started by the top of the viewport.
  let current: ChapterExtent | undefined
  for (const ch of chapters) {
    if (ch.top <= scrollTop) current = ch
    else break
  }
  // Before the first chapter's top — during the opening lines, or a stray
  // negative scrollTop from an overscroll — the reader is in the first chapter.
  current = current ?? chapters[0]
  if (!current) return { percent, chapter: null }

  const through = current.height <= 0
    ? 1
    : Math.min(1, Math.max(0, (scrollTop - current.top) / current.height))
  return {
    percent,
    chapter: { number: current.number, wordsLeft: Math.round(current.words * (1 - through)) },
  }
}

/**
 * Words as a reader would say them: "about 4 minutes left".
 *
 * 240 words a minute is a common figure for adult silent reading of prose, and
 * it is only ever going to be approximate — hence "about", and hence rounding
 * away anything under a minute rather than promising "0 min".
 */
export function minutesLeft(words: number, wordsPerMinute = 240): number {
  return Math.max(1, Math.round(words / wordsPerMinute))
}
