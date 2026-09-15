/**
 * Turning back, kept separate from un-revealing.
 *
 * The reading screen binds two jobs to one instrument. Scrolling on advances
 * the spoiler gate, and the chapter bar's scrubber moves the cursor — so a
 * reader who wants to check a name from four chapters ago either scrolls a long
 * way (1,918 screens of it in *The Count of Monte Cristo*) or uses the scrubber
 * and re-hides everything they have learned since.
 *
 * Reading back is safe already: `cursorForScene` never moves the cursor
 * backwards, so scrolling up re-hides nothing. What is missing is a *way* to go
 * back quickly, and a way to return.
 */

/** The least a chapter has to say to be offered. */
export interface ContentsChapter {
  id: string
  number: number
  title?: string
}

/**
 * The chapters a reader may jump to: the ones they have already reached.
 *
 * Chapters ahead are deliberately not offered, and this is the whole of the
 * design. The prose of the entire book is in the column, so scrolling into a
 * later chapter is possible and correctly advances the gate — that is reading
 * on. But a *click* that lands ten chapters ahead would advance the gate ten
 * chapters in one movement, unlocking the cast, the places and the lore of a
 * book the reader has not read. That is R14 exactly: the reveal is the click
 * rather than the screen it lands on.
 *
 * So this list is what it says it is — where you have been. Going forward is
 * done by reading.
 *
 * A `null` gate means the reader chose *all chapters*, a deliberate full
 * reveal, and there is nothing left to withhold.
 */
export function chaptersBehind<T extends ContentsChapter>(
  chapters: readonly T[],
  gateChapterNumber: number | null,
): T[] {
  if (gateChapterNumber === null) return [...chapters]
  return chapters.filter((c) => c.number <= gateChapterNumber)
}

/**
 * Whether to offer the reader their place back.
 *
 * Only once they have actually left it, and only by enough to have meant it:
 * a chapter heading sitting a little above the viewport top is not someone who
 * has wandered off, and a button that appears on every small scroll is noise on
 * a screen whose whole point is to be quiet.
 *
 * Measured against the *top* of the place they were reading, so returning puts
 * that scene back where they left it rather than somewhere near it.
 */
export function shouldOfferReturn(args: {
  scrollTop: number
  placeTop: number | null
  clientHeight: number
}): boolean {
  const { scrollTop, placeTop, clientHeight } = args
  if (placeTop === null) return false
  // Half a screen, which is far enough that the page in front of them is not
  // the page they left.
  return scrollTop < placeTop - clientHeight / 2
}
