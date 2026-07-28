/**
 * Parse a plain-text or Markdown manuscript into an ordered structure of
 * chapters and scenes that mirrors PlotWeave's model (Chapter → scenes/events →
 * prose). Pure and side-effect free so it can be unit-tested and previewed
 * before anything is written to the database.
 *
 * Heuristics (documented so the behaviour is predictable):
 *  - A **chapter boundary** is a Markdown `#`/`##` heading, or a line starting
 *    with `Chapter` / `Prologue` / `Epilogue` / `Part`. Deeper headings
 *    (`###`+) are left inside the prose.
 *  - A leading `#` heading immediately followed by another chapter boundary
 *    (no prose between) is treated as the **book title**, not a chapter.
 *  - A **scene break** is a line of only symbols — `***`, `* * *`, `---`, a lone
 *    `#`, `⁂`, etc. Prose between breaks becomes one scene.
 *  - Prose before the first chapter boundary becomes an untitled leading chapter.
 */

export interface ParsedScene {
  text: string
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

type LineKind = 'chapter' | 'sep' | 'text' | 'blank'

interface ClassifiedLine {
  kind: LineKind
  /** Original source line (for text) — preserves prose formatting. */
  line: string
  /** Chapter title (for `chapter` lines). */
  title?: string
}

const MD_HEADING = /^(#{1,6})\s+(.*\S)\s*$/
const KEYWORD_HEADING = /^(?:chapter|prologue|epilogue|part)\b/i

/** Strip a "Chapter N" / "Part N" prefix, returning the descriptive title (or ''
 *  when the heading is only a chapter number). Prologue/Epilogue and plain
 *  headings are returned as-is. */
function headingTitle(text: string): string {
  const t = text.trim()
  const withTitle = t.match(/^(?:chapter|part)\b\s*[^\s:.\-–—]*\s*[:.\-–—]+\s*(.+)$/i)
  if (withTitle) return withTitle[1].trim()
  if (/^(?:chapter|part)\b[\s\w'-]*$/i.test(t)) return '' // bare "Chapter 5" / "Part One"
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
    if (level <= 2) return { kind: 'chapter', line, title: headingTitle(md[2]) }
    return { kind: 'text', line } // deeper headings stay in the prose
  }

  if (KEYWORD_HEADING.test(trimmed)) {
    return { kind: 'chapter', line, title: headingTitle(trimmed) }
  }

  if (isSeparator(trimmed)) return { kind: 'sep', line }
  return { kind: 'text', line }
}

/** Split a chapter body (already-classified lines) into scenes on separators. */
function splitScenes(body: ClassifiedLine[]): ParsedScene[] {
  const scenes: ParsedScene[] = []
  let buf: string[] = []
  const flush = () => {
    const text = buf.join('\n').replace(/^\s*\n/, '').replace(/\n\s*$/, '').trim()
    if (text) scenes.push({ text })
    buf = []
  }
  for (const l of body) {
    if (l.kind === 'sep') flush()
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
    const md = lines[firstNonBlank].trim().match(MD_HEADING)
    // Only a top-level (#) heading that is NOT itself a "Chapter/Part …" keyword
    // can be the book title, and only if a chapter boundary follows with no
    // prose in between.
    if (first.kind === 'chapter' && md && md[1].length === 1 && !KEYWORD_HEADING.test(md[2])) {
      const nextNonBlank = classified.findIndex((c, i) => i > firstNonBlank && c.kind !== 'blank')
      if (nextNonBlank !== -1 && classified[nextNonBlank].kind === 'chapter') {
        title = md[2].trim()
        start = firstNonBlank + 1
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
