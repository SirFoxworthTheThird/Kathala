/**
 * How a timeline's chapters are labelled in its header (MT-4).
 *
 * *The Road to Mordor (10 chapters)* opens at **Ch. 12**, and "10 chapters"
 * starting at twelve reads as missing data rather than as the second half of a
 * book.
 *
 * The finding blamed global numbering across timelines. That is not what the
 * app does: `nextNumber` is `chapters.length + 1` for the *current* timeline,
 * so chapters added through the UI restart at one per timeline. A world can
 * still hold any numbering at all — the shipped examples are authored with the
 * book's own, and an import carries whatever it was given — so the header has
 * to describe what is there rather than assume where it came from.
 *
 * The span is only spelled out when the timeline does not start at chapter one,
 * because "10 chapters · Ch. 1–10" tells you nothing you did not already have.
 */
export function describeChapterSpan(numbers: readonly number[]): string {
  if (numbers.length === 0) return 'No chapters'

  const count = `${numbers.length} ${numbers.length === 1 ? 'chapter' : 'chapters'}`
  const first = Math.min(...numbers)
  if (first === 1) return count

  const last = Math.max(...numbers)
  // A single chapter is one number rather than a range of itself.
  return `${count} · Ch. ${first === last ? first : `${first}–${last}`}`
}
