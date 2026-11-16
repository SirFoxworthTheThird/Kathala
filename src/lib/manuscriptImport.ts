import { isVerse, verseFromMarkdown } from './manuscriptParagraphs'

/**
 * Parse a plain-text or Markdown manuscript into an ordered structure of
 * chapters and scenes that mirrors Kathala's model (Chapter → scenes/events →
 * prose). Pure and side-effect free so it can be unit-tested and previewed
 * before anything is written to the database.
 *
 * Heuristics (documented so the behaviour is predictable):
 *  - A **chapter boundary** is a Markdown `#`/`##` heading, or a line starting
 *    with `Chapter` / `Prologue` / `Epilogue` / `Part`. Deeper headings
 *    (`###`+) are left inside the prose.
 *  - **`##` is a scene title under `#` chapters.** When the manuscript has
 *    chapters at `#` — more than a book title — a `##` heading starts a scene
 *    with that title, which is how Kathala's own Markdown export writes a book
 *    and how its Page shows one, so a book exported and brought back keeps its
 *    shape. A `##` that reads as a chapter ("Chapter 3", "Part Two") is still
 *    one. Without `#` chapters, `##` is a chapter, as many manuscripts use it.
 *  - A leading `#` heading immediately followed by another heading (no prose
 *    between) is treated as the **book title**, not a chapter — unless it reads
 *    as a chapter itself ("Chapter 1", or the export's "Ch. 1 — Title").
 *  - A **scene break** is a line of only symbols — `***`, `* * *`, `---`, a lone
 *    `#`, `⁂`, etc. Prose between breaks becomes one scene.
 *  - Prose before the first chapter boundary becomes an untitled leading chapter.
 */

export interface ParsedScene {
  text: string
  /** The scene's own title, from a `##` heading; absent for a scene made by a break. */
  title?: string
}

export interface ParsedChapter {
  /** Empty string when the source gives no descriptive title (shows as Untitled). */
  title: string
  scenes: ParsedScene[]
}

export interface ParsedManuscript {
  /** The book title, if the source led with one; otherwise null. */
  title: string | null
  chapters: ParsedChapter[]
}

type LineKind = 'chapter' | 'scene' | 'sep' | 'text' | 'blank'

interface ClassifiedLine {
  kind: LineKind
  /** Original source line (for text) — preserves prose formatting. */
  line: string
  /** Chapter or scene title (for `chapter` and `scene` lines). */
  title?: string
  /** The Markdown heading level, for a Markdown heading. */
  level?: number
  /** The heading's text as written, for a Markdown heading. */
  heading?: string
}

const MD_HEADING = /^(#{1,6})\s+(.*\S)\s*$/
/** A heading that names a chapter: "Chapter 3", "Prologue", "Part Two", or the export's "Ch. 3 — Title". */
const KEYWORD_HEADING = /^(?:(?:chapter|prologue|epilogue|part)\b|ch\.\s*\d)/i

/** A chapter's or a part's number: in figures, a numeral, in words, or an ordinal ("the First"). */
const NUMBER_WORD = '(?:\\d+|[ivxlcdm]+|(?:the\\s+)?(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\\s-](?:one|two|three|four|five|six|seven|eight|nine))?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last))'
/**
 * A line that reads as a chapter heading on its own, unmarked: the word, then its
 * number (none for a Prologue or an Epilogue), then, optionally, a separator and
 * a title, and short. Any line *opening* with the word was a chapter (issue #697,
 * D-5): "Part of the house was dark, and she went on." became one, titled with
 * that sentence, in a text file as in a Word one, where every paragraph is a line.
 */
const BARE_HEADING = new RegExp(
  // Its title after a separator, or straight after the number where it starts as a title does: not "Chapter one of the book was…".
  `^(?:(?:chapter|part)\\s+${NUMBER_WORD}\\b\\.?|prologue\\b|epilogue\\b|ch\\.\\s*\\d+)(?:\\s*[:.\\-–—]\\s*\\S.*|\\s+(\\S.*))?$`,
  'i',
)
/** A title straight after the number starts as one does; tested apart, since a case-blind match finds a capital in any letter. */
const TITLE_START = /^[\p{Lu}\p{N}"“‘'(]/u
/** "Chapter 21", "Part the First: The Sea": the word and its number, then what titles it, if anything. */
const NUMBERED_HEADING = new RegExp(`^(?:chapter|part)\\s+${NUMBER_WORD}\\b\\.?\\s*(?:[:.\\-–—]+\\s*)?(.*)$`, 'i')
/** At most this long, a bare line can be a heading: a paragraph of prose is longer. */
const BARE_HEADING_MAX = 80
export const isBareHeading = (t: string) => {
  if (t.length > BARE_HEADING_MAX) return false
  const m = BARE_HEADING.exec(t)
  return !!m && (m[1] === undefined || TITLE_START.test(m[1]))
}

/** Strip a "Chapter N" / "Part N" prefix, returning the descriptive title (or ''
 *  when the heading is only a chapter number). Prologue/Epilogue and plain
 *  headings are returned as-is. */
function headingTitle(text: string): string {
  const t = text.trim()
  // The number first, whole: "Chapter Twenty-One" was titled "One", its hyphen read as the separator before a title.
  const numbered = NUMBERED_HEADING.exec(t)
  if (numbered) return numbered[1].trim()
  const withTitle = t.match(/^(?:chapter|part)\b\s*[^\s:.\-–—]*\s*[:.\-–—]+\s*(.+)$/i)
  if (withTitle) return withTitle[1].trim()
  if (/^(?:chapter|part)\b[\s\w'-]*$/i.test(t)) return '' // bare "Chapter 5" / "Part One"
  // The Markdown export's own form, "Ch. 3 — Title".
  const exported = t.match(/^ch\.\s*\d+\s*(?:[:.\-–—]+\s*(.*))?$/i)
  if (exported) return (exported[1] ?? '').trim()
  return t
}

/** A line of only separator symbols (no letters or digits) marks a scene break. */
function isSeparator(trimmed: string): boolean {
  if (!trimmed) return false
  if (/[\p{L}\p{N}]/u.test(trimmed)) return false
  return /^[\s*#•·⁂—–\-~✦✧.=_]+$/.test(trimmed)
}

function classify(line: string): ClassifiedLine {
  const trimmed = line.trim()
  if (!trimmed) return { kind: 'blank', line }

  const md = trimmed.match(MD_HEADING)
  if (md) {
    const level = md[1].length
    if (level <= 2) return { kind: 'chapter', line, title: headingTitle(md[2]), level, heading: md[2].trim() }
    return { kind: 'text', line } // deeper headings stay in the prose
  }

  if (isBareHeading(trimmed)) {
    return { kind: 'chapter', line, title: headingTitle(trimmed) }
  }

  if (isSeparator(trimmed)) return { kind: 'sep', line }
  return { kind: 'text', line }
}

/**
 * Split a chapter body (already-classified lines) into scenes: on separators,
 * and at each scene heading, which starts a scene with its title. A titled
 * scene is kept even with no prose — it is a scene still to be written — and an
 * untitled one only when it has some.
 */
function splitScenes(body: ClassifiedLine[]): ParsedScene[] {
  const scenes: ParsedScene[] = []
  let buf: string[] = []
  let title: string | undefined
  const flush = () => {
    // Verse written with Markdown's `\` line breaks comes in as verse (`verseFromMarkdown`).
    const raw = verseFromMarkdown(buf.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, ''))
    // A scene that opens with verse keeps its first line's indentation: that is what says it is verse.
    const text = isVerse(raw.split(/\n\s*\n/)[0]) ? raw : raw.trim()
    if (title !== undefined) scenes.push({ text, title })
    else if (text) scenes.push({ text })
    buf = []
    title = undefined
  }
  for (const l of body) {
    if (l.kind === 'sep') flush()
    else if (l.kind === 'scene') { flush(); title = l.title }
    else buf.push(l.line)
  }
  flush()
  return scenes
}

export function parseManuscript(raw: string): ParsedManuscript {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const classified = lines.map(classify)

  // ── Book-title detection ──────────────────────────────────────────────────
  let title: string | null = null
  let start = 0
  const firstNonBlank = classified.findIndex((c) => c.kind !== 'blank')
  if (firstNonBlank !== -1) {
    const first = classified[firstNonBlank]
    // Only a top-level (#) heading that is NOT itself a "Chapter/Part …" keyword
    // can be the book title, and only if a chapter follows with no prose in
    // between. Where there are other `#` chapters, a `##` straight after it is
    // a scene, so that `#` is the first chapter, not the book's title.
    if (first.kind === 'chapter' && first.level === 1 && !KEYWORD_HEADING.test(first.heading ?? '')) {
      const otherChapters = classified.some((c, i) => i > firstNonBlank && c.kind === 'chapter' && c.level === 1)
      const next = classified.find((c, i) => i > firstNonBlank && c.kind !== 'blank')
      const chapterNext = next?.kind === 'chapter'
        && (next.level === 1 || !otherChapters || KEYWORD_HEADING.test(next.heading ?? ''))
      if (chapterNext) {
        title = first.heading ?? null
        start = firstNonBlank + 1
      }
    }
  }

  // ── `##` under `#` chapters is a scene ────────────────────────────────────
  if (classified.some((c, i) => i >= start && c.kind === 'chapter' && c.level === 1)) {
    for (let i = start; i < classified.length; i++) {
      const c = classified[i]
      if (c.kind === 'chapter' && c.level === 2 && !KEYWORD_HEADING.test(c.heading ?? '')) {
        classified[i] = { kind: 'scene', line: c.line, title: c.heading }
      }
    }
  }

  // ── Chapter segmentation ──────────────────────────────────────────────────
  const boundaries: number[] = []
  for (let i = start; i < classified.length; i++) {
    if (classified[i].kind !== 'chapter') continue
    /*
      A bare chapter line straight after a chapter's heading, with nothing
      between, is that heading's second line, not a chapter of its own: the
      heading typed again as the first line of the text under it ("Chapter I"
      under a styled "Chapter I — The Science of Deduction"), or a heading on two
      lines ("CHAPTER ONE", then "PROLOGUE"). It was a second chapter, and the
      first was left empty (#697, D-5). The heading's own title stands, or the
      second line's where it had none.
    */
    const prev = boundaries[boundaries.length - 1]
    if (prev !== undefined && classified[i].level === undefined
      && classified.slice(prev + 1, i).every((c) => c.kind === 'blank')) {
      if (!classified[prev].title) classified[prev] = { ...classified[prev], title: classified[i].title }
      continue
    }
    boundaries.push(i)
  }

  const chapters: ParsedChapter[] = []

  if (boundaries.length === 0) {
    const scenes = splitScenes(classified.slice(start))
    if (scenes.length > 0) chapters.push({ title: '', scenes })
    return { title, chapters }
  }

  // Leading prose before the first chapter boundary → an untitled chapter.
  const leadScenes = splitScenes(classified.slice(start, boundaries[0]))
  if (leadScenes.length > 0) chapters.push({ title: '', scenes: leadScenes })

  for (let b = 0; b < boundaries.length; b++) {
    const headingIdx = boundaries[b]
    const bodyStart = headingIdx + 1
    const bodyEnd = b + 1 < boundaries.length ? boundaries[b + 1] : classified.length
    const scenes = splitScenes(classified.slice(bodyStart, bodyEnd))
    chapters.push({ title: classified[headingIdx].title ?? '', scenes })
  }

  return { title, chapters }
}

/** Totals for a parse preview. */
export function manuscriptStats(m: ParsedManuscript): { chapters: number; scenes: number; words: number } {
  let scenes = 0
  let words = 0
  for (const ch of m.chapters) {
    scenes += ch.scenes.length
    for (const s of ch.scenes) {
      const w = s.text.trim() ? s.text.trim().split(/\s+/).length : 0
      words += w
    }
  }
  return { chapters: m.chapters.length, scenes, words }
}
