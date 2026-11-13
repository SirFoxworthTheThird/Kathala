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

/**
 * `splitParagraphs`, with each paragraph said to be verse or prose, as every
 * reading of the book has it: verse its lines, prose one line, a single line
 * end in it a space.
 *
 * The Page shows a single Enter as a new line; Read, HTML and EPUB always ran
 * it into the line before. Word did not: it kept it as a line break inside the
 * paragraph, so a scene typed with one Enter between paragraphs went to an
 * editor as one paragraph with eleven breaks in it, and read as paragraphs
 * there and nowhere else (round-trip-plan-3.md, T12.1, D-11). Joining it here
 * is joining it in every reading at once — Word, the marked file, and bringing
 * a file back, which compares the file with the scene as it went.
 */
export function paragraphBlocks(text: string): Paragraph[] {
  return text.split(/\n\s*\n/).flatMap((raw): Paragraph[] => {
    if (!raw.trim()) return []
    if (isVerse(raw)) return [{ text: raw.replace(/^\n+|\n+$/g, '').split('\n').map((l) => l.trim()).join('\n'), verse: true }]
    return [{ text: oneLine(raw), verse: false }]
  })
}

/**
 * Where `oneLine` will join: the place of each single line end inside a prose
 * paragraph of `text`. Not one between paragraphs, at a paragraph's start or
 * end, or in verse. The Page marks them, since there a single line end looks
 * like a paragraph and is read as a space everywhere else (T12.1).
 */
export function loneLineEnds(text: string): number[] {
  const out: number[] = []
  const between = /\n\s*\n/g
  let start = 0
  const look = (from: number, to: number) => {
    const raw = text.slice(from, to)
    if (!raw.trim() || isVerse(raw)) return
    const lead = raw.length - raw.trimStart().length
    const body = raw.trim()
    for (let i = body.indexOf('\n'); i >= 0; i = body.indexOf('\n', i + 1)) out.push(from + lead + i)
  }
  for (let m = between.exec(text); m; m = between.exec(text)) { look(start, m.index); start = m.index + m[0].length }
  look(start, text.length)
  return out
}

/** Prose as one line: each single line end in it, with the spaces either side, one space. */
export function oneLine(raw: string): string {
  return raw.trim().replace(/[ \t]*\n[ \t]*/g, ' ')
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
