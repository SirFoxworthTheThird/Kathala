/**
 * The book as one document of plain text, for the Timeline's Page view.
 *
 *     # Chapter title
 *
 *     ## Scene title
 *
 *     The scene's prose, exactly as stored.
 *
 * A blank line separates every part. `composeDraft` writes it and says where
 * each heading starts; `readDraft` takes the text and those positions and gives
 * back each heading's title and each scene's prose. The two are exact inverses
 * on anything `composeDraft` produced — the prose of every scene comes back
 * byte for byte — and `readDraft` also tolerates the blank line on either
 * side of a heading having been deleted, which the editor allows. A blank line
 * added there is the writer's, and is kept as prose.
 *
 * Headings are found by position, never by reading `#` off a line: a line of
 * prose that happens to start with `## ` is prose. Which lines are headings is
 * decided by the records, and the editor carries the positions.
 */

export type HeadingKind = 'chapter' | 'scene'

export const HEADING_PREFIX: Record<HeadingKind, string> = { chapter: '# ', scene: '## ' }

export interface DraftScene { id: string; title: string; text: string }
export interface DraftChapter { id: string; title: string; scenes: DraftScene[] }

/** A heading in the document: the record it stands for, and where its line starts. */
export interface DraftHeading { id: string; kind: HeadingKind; pos: number }

/** What a heading reads as now: its title, and — for a scene — its prose. */
export interface DraftSegment { id: string; kind: HeadingKind; title: string; text: string }

/** A title is one line. A stored one with a line break in it is shown on one. */
export function oneLine(title: string): string {
  return title.replace(/\r?\n/g, ' ')
}

export function composeDraft(chapters: DraftChapter[]): { text: string; headings: DraftHeading[] } {
  const parts: string[] = []
  const headings: DraftHeading[] = []
  let length = 0
  const push = (part: string) => {
    if (parts.length > 0) length += 2
    parts.push(part)
    length += part.length
  }
  for (const chapter of chapters) {
    headings.push({ id: chapter.id, kind: 'chapter', pos: parts.length > 0 ? length + 2 : 0 })
    push(HEADING_PREFIX.chapter + oneLine(chapter.title))
    for (const scene of chapter.scenes) {
      headings.push({ id: scene.id, kind: 'scene', pos: length + 2 })
      push(HEADING_PREFIX.scene + oneLine(scene.title))
      if (scene.text) push(scene.text)
    }
  }
  return { text: parts.join('\n\n'), headings }
}

/** The document, as `readDraft` needs it: a string, or CodeMirror's `Text`. */
export interface DraftSource {
  readonly length: number
  sliceString(from: number, to?: number): string
}

function source(doc: DraftSource | string): DraftSource {
  return typeof doc === 'string' ? { length: doc.length, sliceString: (from, to) => doc.slice(from, to) } : doc
}

/** Where the line starting at `pos` ends. */
export function lineEndAt(input: DraftSource | string, pos: number): number {
  const doc = source(input)
  // Titles are short; read ahead in chunks rather than slicing to the end.
  for (let from = pos; from < doc.length; from += 256) {
    const chunk = doc.sliceString(from, Math.min(doc.length, from + 256))
    const at = chunk.indexOf('\n')
    if (at >= 0) return from + at
  }
  return doc.length
}

/**
 * Up to two line breaks off one end: the one that ends the heading's line (or
 * starts the next heading's) and the blank line beside it. The editor keeps the
 * first and lets the writer delete or add the second, so neither is prose.
 */
function trimBreaks(s: string, end: 'start' | 'end'): string {
  let out = s
  for (let i = 0; i < 2; i++) {
    if (end === 'start' ? out.startsWith('\n') : out.endsWith('\n')) {
      out = end === 'start' ? out.slice(1) : out.slice(0, -1)
    }
  }
  return out
}

export function readDraft(input: DraftSource | string, headings: readonly DraftHeading[]): DraftSegment[] {
  const doc = source(input)
  return headings.map((h, i) => {
    const titleFrom = h.pos + HEADING_PREFIX[h.kind].length
    const lineEnd = lineEndAt(doc, h.pos)
    const next = headings[i + 1]
    let text = ''
    if (h.kind === 'scene') {
      const region = doc.sliceString(lineEnd, next ? next.pos : doc.length)
      text = trimBreaks(region, 'start')
      if (next) text = trimBreaks(text, 'end')
    }
    return { id: h.id, kind: h.kind, title: doc.sliceString(titleFrom, lineEnd), text }
  })
}

/**
 * Where a scene's prose starts, for putting the caret there: after the heading
 * line and the blank line under it. A scene with no prose between two headings
 * has only that blank line, and the caret goes on it; `null` when there is no
 * line to go on at all — a scene with no prose at the very end of the book.
 */
export function proseStart(input: DraftSource | string, headings: readonly DraftHeading[], index: number): number | null {
  const doc = source(input)
  const lineEnd = lineEndAt(doc, headings[index].pos)
  const next = headings[index + 1]
  const two = doc.sliceString(lineEnd, lineEnd + 2)
  if (next) {
    // Strictly before the next heading: its own start is not a place to type.
    if (lineEnd + 2 < next.pos && two === '\n\n') return lineEnd + 2
    if (lineEnd + 1 < next.pos) return lineEnd + 1
    return null
  }
  if (two === '\n\n') return lineEnd + 2
  if (two.startsWith('\n')) return lineEnd + 1
  return null
}
