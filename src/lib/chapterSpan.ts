/**
 * How a timeline's chapters are labelled in its header (MT-4).
 *
 * *The Road to Mordor (10 chapters)* opens at **Ch. 12**, and "10 chapters"
 * starting at twelve reads as missing data rather than as the second half of a
 * book.
 *
 * The finding blamed global numbering across timelines. That is not what the
 * app does: a new chapter is suggested one past the highest in its *own*
 * timeline, so a new timeline starts at one. But the writer can type any
 * number — a second volume starting at chapter twelve is a thing to be able to
 * say — the shipped examples are authored with the book's own numbering, and an
 * import carries whatever it was given. So the header has to describe what is
 * there rather than assume where it came from.
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
