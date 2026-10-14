/**
 * Choosing a chapter's number.
 *
 * A chapter's number is not a label here. It is the chapter's **position**:
 * the book is ordered by it, and so is every stored snapshot, whose position is
 * the chapter number plus the scene's place in it. So a writer may type any
 * number, but the answer to "that one is taken" is never a second chapter
 * with it — two chapters sharing a number have their scenes interleaved in the
 * order "last known state" is read along.
 *
 * A taken number means *put it there*: the chapter that had it moves up one,
 * and so does each one after it **until a gap**, which is where the run stops.
 * Chapters 1, 2, 3, 5 with a new chapter 2 become 1, new, 3, 4, 5 — only the
 * two that had to move, move.
 */

export interface NumberedChapter {
  id: string
  number: number
}

export interface ChapterShift {
  id: string
  from: number
  to: number
}

/** What to suggest: one past the highest, or 1 when there is nothing yet. */
export function nextChapterNumber(chapters: readonly NumberedChapter[]): number {
  return chapters.reduce((max, c) => Math.max(max, c.number), 0) + 1
}

/**
 * A typed number, or null when it is not one a chapter can have — a whole
 * number, 0 or more. Zero is allowed on purpose: it is what a prologue is.
 */
export function parseChapterNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isSafeInteger(n) ? n : null
}

/**
 * Who moves, and to what, for a new chapter numbered `wanted`. Empty when the
 * number is free.
 */
export function planChapterInsert(chapters: readonly NumberedChapter[], wanted: number): ChapterShift[] {
  const byNumber = new Map<number, NumberedChapter[]>()
  for (const c of chapters) {
    const list = byNumber.get(c.number) ?? []
    list.push(c)
    byNumber.set(c.number, list)
  }
  const shifts: ChapterShift[] = []
  for (let n = wanted; byNumber.has(n); n++) {
    // Two chapters already sharing a number — older data could hold that —
    // move together: the tie is theirs, and the new chapter does not join it.
    for (const c of byNumber.get(n)!) shifts.push({ id: c.id, from: n, to: n + 1 })
  }
  return shifts
}

/**
 * Said before anything is written, so a renumbering is never a surprise:
 * "Chapter 3 becomes 4", "Chapters 3–7 become 4–8".
 */
export function describeShift(shifts: readonly ChapterShift[]): string {
  if (shifts.length === 0) return ''
  const froms = shifts.map((s) => s.from)
  const lo = Math.min(...froms)
  const hi = Math.max(...froms)
  return lo === hi
    ? `Chapter ${lo} becomes ${lo + 1}`
    : `Chapters ${lo}–${hi} become ${lo + 1}–${hi + 1}`
}

/**
 * Who moves, and to what, when a chapter is moved to another place in its
 * timeline.
 *
 * The numbers stay where they are and the chapters move through them: the
 * chapters in their new order take the old numbers in order. So chapters
 * 1, 2, 4, 5 with 5 moved to the front become 5→1, 1→2, 2→4, 4→5 — a gap in the
 * numbering stays where it was, a prologue's 0 stays the first number, and
 * only the chapters between the old place and the new one change at all.
 *
 * `toIndex` is the chapter's place in the new order, 0-based, and is clamped.
 */
export function planChapterMove(
  chapters: readonly NumberedChapter[],
  id: string,
  toIndex: number,
): ChapterShift[] {
  const order = [...chapters].sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))
  const from = order.findIndex((c) => c.id === id)
  if (from === -1) return []
  const numbers = order.map((c) => c.number)
  const moved = order.splice(from, 1)[0]
  const to = Math.max(0, Math.min(order.length, toIndex))
  order.splice(to, 0, moved)
  const shifts: ChapterShift[] = []
  order.forEach((c, i) => {
    if (c.number !== numbers[i]) shifts.push({ id: c.id, from: c.number, to: numbers[i] })
  })
  return shifts
}

/*
  ── One book, one numbering ───────────────────────────────────────────────
  A book is read in one order however many timelines feed it, so its chapters
  are numbered in one order: the functions above are given the book's
  chapters, every timeline's, not one timeline's
  (docs/records/chapter-numbering-plan.md).
*/

/**
 * The number for a chapter started on a timeline's Page with `# Title`.
 *
 * Typed after the last scene of its timeline's last chapter (`atTimelineEnd`),
 * it goes at the end of the book: a writer drafting a braid adds the next
 * chapter of one era while the others' come after it, and putting it straight
 * after its era's last chapter would cut in front of them. Anywhere else, it
 * goes straight after the chapter it was typed in — or takes the next
 * chapter's number where that is closer — and `planChapterInsert` moves the
 * book's chapters after it up.
 */
export function pageChapterNumber(
  book: readonly NumberedChapter[],
  chapter: NumberedChapter,
  atTimelineEnd: boolean,
): number {
  if (atTimelineEnd) return Math.max(nextChapterNumber(book), chapter.number + 1)
  const next = book
    .filter((c) => c.id !== chapter.id && c.number > chapter.number)
    .reduce<NumberedChapter | null>((best, c) => (!best || c.number < best.number ? c : best), null)
  return next ? Math.min(chapter.number + 1, next.number) : chapter.number + 1
}

/** A chapter with the timeline it belongs to, as the book's numbering needs it. */
export interface TimelinedChapter extends NumberedChapter {
  timelineId: string
}

/** The chapter numbers more than one timeline uses: where the book's order between them is a guess. */
export function sharedChapterNumbers(book: readonly TimelinedChapter[]): number[] {
  const timelinesOf = new Map<number, Set<string>>()
  for (const c of book) {
    const set = timelinesOf.get(c.number) ?? new Set<string>()
    set.add(c.timelineId)
    timelinesOf.set(c.number, set)
  }
  return [...timelinesOf].filter(([, set]) => set.size > 1).map(([n]) => n).sort((a, b) => a - b)
}

/**
 * Who moves, and to what, to number a book whose timelines were numbered
 * apart as one: every chapter in the order the book reads now — by number,
 * ties in the timelines' tab order (`timelineOrder`), then by id — numbered
 * from the book's first number upwards, with no two the same. A prologue's 0
 * stays 0.
 */
export function planNumberAsOneBook(
  book: readonly TimelinedChapter[],
  timelineOrder: readonly string[],
): ChapterShift[] {
  if (book.length === 0) return []
  const rank = (id: string) => { const i = timelineOrder.indexOf(id); return i < 0 ? timelineOrder.length : i }
  const order = [...book].sort((a, b) => a.number - b.number || rank(a.timelineId) - rank(b.timelineId) || a.id.localeCompare(b.id))
  const first = order[0].number
  const shifts: ChapterShift[] = []
  order.forEach((c, i) => { if (c.number !== first + i) shifts.push({ id: c.id, from: c.number, to: first + i }) })
  return shifts
}
