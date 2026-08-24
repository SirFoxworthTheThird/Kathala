/**
 * Does a search query name this chapter by its number?
 *
 * In a 117-chapter book, `74` and `Chapter 74` both returned "No results": the
 * palette matched a chapter's title and synopsis, and the number was printed in
 * the result label but never searched. The alternative was the chapter bar,
 * which for that world is 6,500px of 47–64px segments in a 1,066px strip —
 * about six screen-widths of horizontal scrolling to reach one chapter.
 *
 * Matches a bare number, and the forms a writer actually types: `ch 7`, `ch.7`,
 * `chapter 7`. Anchored to the whole query, so `7` finds chapter 7 and not
 * chapters 17, 27 and 70 — a chapter number is an exact thing, unlike a title.
 */
const CHAPTER_NUMBER = /^\s*(?:ch(?:apter)?\.?\s*)?(\d{1,4})\s*$/i

export function chapterNumberQuery(query: string): number | null {
  const m = CHAPTER_NUMBER.exec(query)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}
