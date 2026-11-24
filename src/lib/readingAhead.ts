/**
 * What the chapter bar may say about a chapter the reader has not reached, and
 * when moving there should ask first.
 *
 * **R14.** The bar dimmed unread chapters to 0.42 opacity and titled them in
 * full, all the way to chapter 27 — and every scene inside them was a
 * `<button title={event.title}>`, so the whole book's beats sat in the
 * accessible names of the controls along the bottom of every screen. Dimming a
 * title you can still read is not hiding it. Everything else in reading mode is
 * gated; this was the one surface that was not.
 *
 * The reader's own report: one click on the dimmed *"9 · Mina Murray's
 * Journal"* moved them from chapter 7 to a scene called *"Jonathan and Mina
 * Marry"* — and the reveal was the click itself, not the screen it landed on. A
 * confirm alone would not have helped, because by the time it appeared the
 * title had already been read.
 *
 * So a number is still shown, and the position in the book is still shown: what
 * is withheld is the wording an author chose to describe what happens.
 */

/** A chapter as the bar knows it. */
export interface BarChapter {
  number: number
  title?: string
}

/**
 * The title to draw beside a chapter's number, and the tooltip behind the block.
 *
 * The number always survives. It is what makes the bar navigable — a reader
 * moving their place needs to know which chapter they are pointing at — and it
 * gives away nothing the book's own contents page does not.
 */
export function chapterBlockLabel(
  chapter: BarChapter,
  revealed: boolean,
): { title: string | null; tooltip: string } {
  const n = String(chapter.number)
  if (!revealed) return { title: null, tooltip: `Ch. ${n} — not yet reached` }
  return {
    title: chapter.title || null,
    tooltip: `Ch. ${n}${chapter.title ? ` — ${chapter.title}` : ''}`,
  }
}

/**
 * The accessible name of one scene tick.
 *
 * Unreached ticks are named by where they are rather than by what they are, so
 * they stay distinguishable to a screen reader. A bar of identical "not yet
 * reached" buttons would be gated and unusable, which is a different way of
 * failing the same reader.
 */
export function sceneTickLabel(
  args: { chapterNumber: number; index: number; title: string; revealed: boolean; linked?: boolean },
): string {
  const { chapterNumber, index, title, revealed, linked } = args
  if (!revealed) return `Chapter ${chapterNumber}, moment ${index + 1} — not yet reached`
  return linked ? `${title} — paired with a moment on the other track` : title
}

/**
 * Whether moving the cursor there should ask first.
 *
 * The next chapter is ordinary reading and must never be interrupted; nor is
 * any move backwards, which only re-hides what was already seen. Two or more
 * chapters forward is a deliberate skip, and it is the one move that shows a
 * reader something they were saving.
 *
 * Nothing here is about damage. Reveals are computed from the cursor, so moving
 * back restores exactly what moving forward showed — what cannot be restored is
 * not having seen it, which is why the question is asked before the move rather
 * than offered as an undo after it.
 */
export function asksBeforeJumping(from: number | null, to: number): boolean {
  if (from === null) return false
  return to > from + 1
}

/**
 * A run of moves of the reader's place close together: a fling, read as one
 * move from where it began (UX-1-7).
 *
 * The skip notice judged each step of the observer alone. A long fling arrives
 * as 1→2, 2→4, 4→5 … 9→10: the one step of two chapters raised *"Moved on to
 * chapter 4"* with an Undo back to chapter 2, and the six one-chapter steps
 * after it said nothing, so the place ended on the last page while the notice
 * named chapter 4, and Undo did not go back to where the reader was.
 *
 * So a move within `windowMs` of the last one continues the burst, and the
 * notice is about the burst: from its start to where the place is now. A
 * fling's steps come tens of milliseconds apart; a reader's, seconds. The
 * window sits between, short enough that reading a short scene and moving on
 * is a move of its own.
 */
export interface DriftBurst {
  /** Where the place was before the burst's first move, for Undo. */
  from: string
  fromChapter: number
  /** When its last move was. */
  at: number
}

export const DRIFT_BURST_MS = 800

export function continueBurst(
  burst: DriftBurst | null,
  before: { id: string; chapter: number },
  now: number,
  windowMs = DRIFT_BURST_MS,
): DriftBurst {
  if (burst && now - burst.at <= windowMs) return { ...burst, at: now }
  return { from: before.id, fromChapter: before.chapter, at: now }
}
