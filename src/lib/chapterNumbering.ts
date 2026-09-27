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
