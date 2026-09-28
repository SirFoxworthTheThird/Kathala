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

/** Strip a "Chapter N" / "Part N" prefix, returning the descriptive title (or ''
 *  when the heading is only a chapter number). Prologue/Epilogue and plain
 *  headings are returned as-is. */
function headingTitle(text: string): string {
  const t = text.trim()
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

  if (KEYWORD_HEADING.test(trimmed)) {
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
    const text = buf.join('\n').replace(/^\s*\n/, '').replace(/\n\s*$/, '').trim()
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
    if (classified[i].kind === 'chapter') boundaries.push(i)
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
