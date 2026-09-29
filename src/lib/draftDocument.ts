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
 *
 * A scene may also show its **header line** — `[#The Kitchen @@Wren]`, drawn
 * from its records (`sceneHeader.ts`) — as the first line under its title:
 *
 *     ## Scene title
 *
 *     [#The Kitchen @@Wren]
 *
 *     The scene's prose.
 *
 * It is never prose. Which scenes show one is the editor's to say (`headers`),
 * like the headings, so a scene whose stored prose happens to start with a
 * bracketed line keeps that line as prose.
 */

import { compareByPosition } from '@/lib/fractionalOrder'
import { splitSceneHeader } from '@/lib/sceneHeader'
import type { Chapter, SceneText, WorldEvent } from '@/types'

export type HeadingKind = 'chapter' | 'scene'

export const HEADING_PREFIX: Record<HeadingKind, string> = { chapter: '# ', scene: '## ' }

export interface DraftScene {
  id: string
  title: string
  text: string
  /** The header line drawn from the scene's records; absent or empty for none. */
  header?: string
}
export interface DraftChapter { id: string; title: string; scenes: DraftScene[] }

/** A heading in the document: the record it stands for, and where its line starts. */
export interface DraftHeading { id: string; kind: HeadingKind; pos: number }

/** What a heading reads as now: its title, and — for a scene — its prose and header line. */
export interface DraftSegment { id: string; kind: HeadingKind; title: string; text: string; header: string | null }

/** A title is one line. A stored one with a line break in it is shown on one. */
export function oneLine(title: string): string {
  return title.replace(/\r?\n/g, ' ')
}

export function composeDraft(chapters: DraftChapter[]): { text: string; headings: DraftHeading[]; headers: string[] } {
  const parts: string[] = []
  const headings: DraftHeading[] = []
  const headers: string[] = []
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
      if (scene.header) { headers.push(scene.id); push(scene.header) }
      if (scene.text) push(scene.text)
    }
  }
  return { text: parts.join('\n\n'), headings, headers }
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

/** A scene's part of the document under its title: its header line, if it shows one, and its prose. */
export interface SceneRegion {
  /** The header line, when the scene shows one and it still reads as one. */
  header: string | null
  /** Where the header line starts, or null with no header. */
  headerFrom: number | null
  /** Where the prose starts. */
  bodyFrom: number
  /** The prose. */
  text: string
}

/**
 * Scene `index`'s header line and prose. `headers` is the scenes that show a
 * header line; for them the first line under the title — past any blank lines
 * — is the header if it still reads as one (`splitSceneHeader`), and prose if
 * it no longer does, as a scene card's draft box treats it.
 */
export function sceneRegion(
  input: DraftSource | string,
  headings: readonly DraftHeading[],
  index: number,
  headers?: ReadonlySet<string>,
): SceneRegion {
  const doc = source(input)
  const h = headings[index]
  const lineEnd = lineEndAt(doc, h.pos)
  const next = headings[index + 1]
  const region = doc.sliceString(lineEnd, next ? next.pos : doc.length)
  const trimmed = trimBreaks(region, 'start')
  const textFrom = lineEnd + region.length - trimmed.length
  const text = next ? trimBreaks(trimmed, 'end') : trimmed
  if (headers?.has(h.id)) {
    const lead = text.length - text.replace(/^\n+/, '').length
    const split = splitSceneHeader(text.slice(lead))
    if (split.header) {
      return { header: split.header, headerFrom: textFrom + lead, bodyFrom: textFrom + text.length - split.body.length, text: split.body }
    }
    // Blank lines where the header line was — deleted, say — are not prose either.
    return { header: null, headerFrom: null, bodyFrom: textFrom + lead, text: text.slice(lead) }
  }
  return { header: null, headerFrom: null, bodyFrom: textFrom, text }
}

/**
 * Scene `index`'s header line alone — where it starts and what it says — read
 * no further than it, for the checks that run on every keystroke or save and
 * must not read the whole scene to do it. Agrees with `sceneRegion`.
 */
export function sceneHeaderLine(
  input: DraftSource | string,
  headings: readonly DraftHeading[],
  index: number,
  headers?: ReadonlySet<string>,
): { header: string; from: number } | null {
  const h = headings[index]
  if (h.kind !== 'scene' || !headers?.has(h.id)) return null
  const doc = source(input)
  const lineEnd = lineEndAt(doc, h.pos)
  const end = headings[index + 1]?.pos ?? doc.length
  const head = doc.sliceString(lineEnd, Math.min(end, lineEnd + 1024))
  const lead = head.length - head.replace(/^\n+/, '').length
  if (lineEnd + lead >= end) return null
  const { header } = splitSceneHeader(head.slice(lead).split('\n')[0])
  return header ? { header, from: lineEnd + lead } : null
}

export function readDraft(input: DraftSource | string, headings: readonly DraftHeading[], headers?: ReadonlySet<string>): DraftSegment[] {
  const doc = source(input)
  return headings.map((h, i) => {
    const titleFrom = h.pos + HEADING_PREFIX[h.kind].length
    const title = doc.sliceString(titleFrom, lineEndAt(doc, h.pos))
    if (h.kind !== 'scene') return { id: h.id, kind: h.kind, title, text: '', header: null }
    const { text, header } = sceneRegion(doc, headings, i, headers)
    return { id: h.id, kind: h.kind, title, text, header }
  })
}

/**
 * Where a scene's prose starts, for putting the caret there: after the heading
 * line and the blank line under it. A scene with no prose between two headings
 * has only that blank line, and the caret goes on it; `null` when there is no
 * line to go on at all — a scene with no prose at the very end of the book.
 */
export function proseStart(
  input: DraftSource | string,
  headings: readonly DraftHeading[],
  index: number,
  headers?: ReadonlySet<string>,
): number | null {
  const doc = source(input)
  // Under the header line, where a scene shows one: the prose is below it.
  const { headerFrom } = headings[index].kind === 'scene' ? sceneRegion(doc, headings, index, headers) : { headerFrom: null }
  const lineEnd = lineEndAt(doc, headerFrom ?? headings[index].pos)
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

/**
 * One timeline's records as the book to compose — or `null` until all three
 * have answered. A book composed before its prose arrived would show every
 * scene empty, and the first keystroke in one would save over the prose it
 * really has; so a query still loading is `undefined`, and nothing is built.
 */
export function draftBook(
  chapters: Chapter[] | undefined,
  events: WorldEvent[] | undefined,
  texts: SceneText[] | undefined,
  /** Each scene's header line, drawn from its records. */
  headerOf: (event: WorldEvent) => string = () => '',
): DraftChapter[] | null {
  if (!chapters || !events || !texts) return null
  const prose = new Map(texts.map((t) => [t.eventId, t.text]))
  const byChapter = new Map<string, WorldEvent[]>()
  for (const e of events) {
    const list = byChapter.get(e.chapterId) ?? []
    list.push(e)
    byChapter.set(e.chapterId, list)
  }
  return [...chapters]
    .sort((a, b) => a.number - b.number)
    .map((c) => ({
      id: c.id,
      title: c.title,
      scenes: [...(byChapter.get(c.id) ?? [])].sort(compareByPosition)
        .map((e) => {
          const header = headerOf(e)
          return { id: e.id, title: e.title, text: prose.get(e.id) ?? '', ...(header ? { header } : {}) }
        }),
    }))
}
