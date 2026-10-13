/**
 * How a scene's prose becomes paragraphs.
 *
 * A **blank line** starts a new paragraph; a single newline does not. That rule
 * is deliberate — prose pasted from a text file or a PDF arrives hard-wrapped
 * at some column, and treating every newline as a break would turn a pasted
 * chapter into one paragraph per line.
 *
 * W23-8: the rule lived as `text.split(/\n\s*\n/)` written out three times —
 * `ManuscriptView`, `manuscriptCompile`, `manuscriptExport` — so the screen, the
 * compiler and the exporter each re-stated it and could each have drifted. It
 * is one function now, and the scene editor counts with it too, so the number a
 * writer is shown while typing is produced by the same split that will make
 * their pages.
 */
export function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}

/** A paragraph of a scene, and whether it is verse. */
export interface Paragraph {
  /** The text; for verse, its lines with the indentation taken off, one to a line. */
  text: string
  verse: boolean
}

/**
 * Whether a paragraph, as written, is verse: two or more lines, every one of
 * them indented.
 *
 * A single newline is a space in prose (see `splitParagraphs`), so a song or a
 * poem ran its lines together; writer run 8 gave each line of a ballad its own
 * paragraph to keep them. Indenting the lines is how the Library's books
 * already set verse — 85 of their 86,719 paragraphs are indented on every
 * line, and those sampled are verse, while none uses a Markdown hard break —
 * and it is a thing a writer can see on the page.
 */
export function isVerse(raw: string): boolean {
  const lines = raw.replace(/^\n+|\n+$/g, '').split('\n')
  return lines.length > 1 && lines.every((l) => /^[ \t]+\S/.test(l))
}

/** `splitParagraphs`, with each paragraph said to be verse or prose. */
export function paragraphBlocks(text: string): Paragraph[] {
  return text.split(/\n\s*\n/).flatMap((raw): Paragraph[] => {
    if (!raw.trim()) return []
    if (isVerse(raw)) return [{ text: raw.replace(/^\n+|\n+$/g, '').split('\n').map((l) => l.trim()).join('\n'), verse: true }]
    return [{ text: raw.trim(), verse: false }]
  })
}

/**
 * Verse as Markdown writes it: its lines with a `\` hard break between them.
 * Four spaces of indentation would make a code block of it, and two would be
 * joined into one line by any Markdown reader.
 */
export function verseToMarkdown(text: string): string {
  return text.split(/(\n\s*\n)/).map((part) => (isVerse(part) ? paragraphBlocks(part)[0].text.split('\n').join('\\\n') : part)).join('')
}

/** And back: a paragraph whose lines end in `\` is verse, written indented. */
export function verseFromMarkdown(text: string): string {
  return text.split(/(\n\s*\n)/).map((part) => {
    const lines = part.split('\n')
    if (lines.length < 2 || !lines.slice(0, -1).every((l) => l.endsWith('\\'))) return part
    return lines.map((l) => `  ${l.replace(/\\$/, '').trim()}`).join('\n')
  }).join('')
}
