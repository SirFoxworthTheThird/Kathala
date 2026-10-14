/**
 * How a chapter is headed in an exported book. Every export headed every
 * chapter `Ch. 1 — Flat 114`; writer run 9 wanted the headings a printed
 * novel has. And 302 of the library's 1,755 chapters (in 10 of its 47 books)
 * are titled "Chapter I" and the like already, so the export printed
 * `Ch. 1 — Chapter I` — for those, the title alone is the right heading.
 *
 * Markdown keeps `# Ch. N — Title` whatever the style: the import reads that
 * form back (`manuscriptImport`), and the round trip is its job.
 */

export type ChapterHeadingStyle = 'ch-title' | 'chapter-words-title' | 'chapter-figures-title' | 'number-title' | 'title' | 'chapter-words'

/** The styles, in the order offered, each with an example for the chooser. */
export const CHAPTER_HEADING_STYLES: ReadonlyArray<{ id: ChapterHeadingStyle; example: string }> = [
  { id: 'ch-title', example: 'Ch. 1 — Flat 114' },
  { id: 'chapter-words-title', example: 'Chapter One / Flat 114' },
  { id: 'chapter-figures-title', example: 'Chapter 1 / Flat 114' },
  { id: 'number-title', example: '1 / Flat 114' },
  { id: 'title', example: 'Flat 114' },
  { id: 'chapter-words', example: 'Chapter One' },
]

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

/**
 * A chapter number in words, as a heading writes it: "One", "Twenty-One",
 * "One Hundred and Fifty-Three". To 999, which is past the library's highest
 * chapter number (153); past that, and for anything not a whole number, the
 * figures.
 */
export function numberInWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) return String(n)
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')
  const rest = n % 100
  return `${ONES[Math.floor(n / 100)]} Hundred${rest ? ` and ${numberInWords(rest)}` : ''}`
}

/** A chapter's heading, line by line: one line, or the number above the title. */
export function chapterHeadingLines(style: ChapterHeadingStyle, number: number, title: string): string[] {
  const t = title.trim()
  switch (style) {
    case 'chapter-words-title': return [`Chapter ${numberInWords(number)}`, ...(t ? [t] : [])]
    case 'chapter-figures-title': return [`Chapter ${number}`, ...(t ? [t] : [])]
    case 'number-title': return [String(number), ...(t ? [t] : [])]
    // A chapter with no title has nothing else to be headed by.
    case 'title': return [t || `Chapter ${numberInWords(number)}`]
    case 'chapter-words': return [`Chapter ${numberInWords(number)}`]
    default: return [`Ch. ${number} — ${t || 'Untitled'}`]
  }
}

/** The heading on one line, for a book's contents and a chapter's own title: "Chapter One: Flat 114". */
export function chapterHeadingLabel(style: ChapterHeadingStyle, number: number, title: string): string {
  return chapterHeadingLines(style, number, title).join(': ')
}
