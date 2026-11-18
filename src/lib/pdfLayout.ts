import type { BuiltManuscript, CompileOptions } from '@/lib/manuscriptCompile'
import { scenesForExport } from '@/lib/manuscriptCompile'
import { paragraphBlocks } from '@/lib/manuscriptParagraphs'
import { emphasisSpans } from '@/lib/proseEmphasis'
import { chapterHeadingLines } from '@/lib/chapterHeading'
import { surnameOf, contactLines, titlePageWordCount, type SubmissionOptions } from '@/lib/manuscriptExport'

/*
  The PDF's pages, laid out (issue #701; docs/records/pdf-export-measure.md,
  D-2). Pure: the fonts come in as a width function and a splitter, so the
  decisions a print interior is judged on can be tested here with no PDF at all.
  Those decisions are page breaks, a chapter on a right-hand page, running heads,
  and widows and orphans. `pdfWrite.ts` draws what this says.

  Everything is in points, on a baseline grid: a page's body is a whole number
  of lines of the text's leading, and headings, scene breaks and blank lines
  take whole lines of it. Lines sit at the same height on every page, as a
  printed book's do.
*/

/** Which face draws a run: the text's, its italic, or the fallback for what neither has (D-3). */
export type FontKey = 'roman' | 'italic' | 'fallback'

export interface LayoutFonts {
  /** The width of `text` in `font` at `size`, in points. */
  width(text: string, font: FontKey, size: number): number
  /** `text` in runs by the face that has its characters: the style asked for, else the fallback. */
  split(text: string, style: 'roman' | 'italic'): Array<{ text: string; font: FontKey }>
}

/** A piece of a line: text in one face, after a word space or joined to the piece before. */
export interface Piece { text: string; font: FontKey; width: number; space: boolean }

/** A line placed on its page: its baseline, where it starts, its size, and the word space between its pieces. */
export interface PlacedLine {
  x: number
  y: number
  size: number
  pieces: Piece[]
  /** The width of each word space on this line; wider than the font's own on a justified line. */
  gap: number
}

export type PageRole = 'title' | 'copyright' | 'dedication' | 'opening' | 'body' | 'blank'

export interface LaidPage {
  /** 1 for the first page of the file. */
  number: number
  role: PageRole
  lines: PlacedLine[]
  /** The running head, placed, where the page has one. */
  head: PlacedLine | null
  /** The page number, placed, where the page shows one. */
  folio: PlacedLine | null
}

export type PdfKind = 'reading' | 'print' | 'submission'

/** A trim size for a print interior, in points (72 to the inch). */
export interface TrimSize { id: string; label: string; width: number; height: number }

const IN = 72
const MM = 72 / 25.4

export const TRIM_SIZES: readonly TrimSize[] = [
  { id: '5x8', label: '5 × 8 in', width: 5 * IN, height: 8 * IN },
  { id: '5.25x8', label: '5.25 × 8 in', width: 5.25 * IN, height: 8 * IN },
  { id: '5.5x8.5', label: '5.5 × 8.5 in', width: 5.5 * IN, height: 8.5 * IN },
  { id: '6x9', label: '6 × 9 in', width: 6 * IN, height: 9 * IN },
  { id: 'a5', label: 'A5 (148 × 210 mm)', width: 148 * MM, height: 210 * MM },
  { id: 'b-format', label: 'B-format (129 × 198 mm)', width: 129 * MM, height: 198 * MM },
]

export const PAPER_SIZES = {
  a4: { label: 'A4', width: 210 * MM, height: 297 * MM },
  letter: { label: 'US Letter', width: 8.5 * IN, height: 11 * IN },
} as const
export type PaperSize = keyof typeof PAPER_SIZES

/** How a page is set: its size, margins, type and furniture. */
export interface PageSpec {
  kind: PdfKind
  width: number
  height: number
  top: number
  bottom: number
  /** The margin at the spine; the left margin on a right-hand page. Equal to `outer` where the pages are not mirrored. */
  inner: number
  outer: number
  size: number
  leading: number
  /** The first line of a paragraph, set in. */
  indent: number
  justify: boolean
  /** The chapter heading's first line; a second line is set a little smaller. */
  headingSize: number
  /** Lines of the grid left empty above a chapter's heading on its opening page. */
  drop: number
  /** Lines of the grid after the heading, before the text. */
  afterHeading: number
  /** A new chapter starts on a right-hand page (print), or only on a new page. */
  recto: boolean
  sceneBreak: string
  /** Blank lines either side of the scene break. */
  breakSpace: number
  /** Running heads: on left pages and right pages; `null` for none. */
  heads: { verso: string; recto: string } | null
  /** Where the running head sits: centred, or against the outer margin with the page number (submission). */
  headAlign: 'centre' | 'right'
  headSize: number
  /** The page number at the foot, centred. False where the head carries it, or there is none. */
  footFolio: boolean
  /** Lines a paragraph keeps together at a page's foot and head (orphans and widows). */
  keep: number
}

/** The number of grid lines in a page's body. */
export const linesOf = (spec: PageSpec) => Math.floor((spec.height - spec.top - spec.bottom) / spec.leading)

/**
 * The inside margin a print interior needs, by its page count: the minimums
 * print-on-demand services ask for (Amazon KDP's table), with a quarter of an
 * inch more so that no line runs into the fold, and the spine side always the
 * wider of the two (the outside is half an inch).
 */
export function gutterFor(pages: number): number {
  const min = pages <= 150 ? 0.375 : pages <= 300 ? 0.5 : pages <= 500 ? 0.625 : pages <= 700 ? 0.75 : 0.875
  return (min + 0.25) * IN
}

export interface SpecOptions {
  /** Print interior: the trim. */
  trim?: TrimSize
  /** Reading copy and submission: the paper. */
  paper?: PaperSize
  title: string
  author: string
  submission?: SubmissionOptions
  sceneSeparator?: string
  /** Print interior: the page count the inside margin is chosen for (`gutterFor`). */
  pages?: number
}

/** The page spec for each of the three PDFs. */
export function pageSpec(kind: PdfKind, o: SpecOptions): PageSpec {
  if (kind === 'submission') {
    const paper = PAPER_SIZES[o.submission?.paper ?? o.paper ?? 'letter']
    const lead = [surnameOf(o.submission?.name ?? o.author), o.title.toUpperCase()].filter(Boolean).join(' / ')
    return {
      kind, width: paper.width, height: paper.height,
      top: IN, bottom: IN, inner: IN, outer: IN,
      size: 12, leading: 24, indent: 0.5 * IN, justify: false,
      headingSize: 12, drop: 6, afterHeading: 1, recto: false,
      sceneBreak: '#', breakSpace: 0,
      heads: { verso: lead, recto: lead }, headAlign: 'right', headSize: 12, footFolio: false,
      keep: 2,
    }
  }
  if (kind === 'reading') {
    const paper = PAPER_SIZES[o.paper ?? 'a4']
    return {
      kind, width: paper.width, height: paper.height,
      top: IN, bottom: IN, inner: IN, outer: IN,
      size: 12, leading: 17, indent: 1.5 * 12, justify: true,
      headingSize: 20, drop: 6, afterHeading: 3, recto: false,
      sceneBreak: o.sceneSeparator ?? '* * *', breakSpace: 1,
      heads: null, headAlign: 'centre', headSize: 10, footFolio: true,
      keep: 2,
    }
  }
  const trim = o.trim ?? TRIM_SIZES.find((t) => t.id === '6x9')!
  // Smaller trims, smaller type: the measure stays near 60 characters.
  const small = trim.width < 5.4 * IN
  const size = small ? 10.5 : trim.width < 5.9 * IN ? 11 : 11.5
  const leading = small ? 14 : trim.width < 5.9 * IN ? 14.5 : 15
  return {
    kind, width: trim.width, height: trim.height,
    top: 0.75 * IN, bottom: 0.75 * IN, inner: gutterFor(o.pages ?? 0), outer: 0.5 * IN,
    size, leading, indent: 1.5 * size, justify: true,
    headingSize: size * 1.6, drop: 6, afterHeading: 3, recto: true,
    sceneBreak: o.sceneSeparator ?? '* * *', breakSpace: 1,
    heads: { verso: o.author, recto: o.title }, headAlign: 'centre', headSize: size * 0.8, footFolio: true,
    keep: 2,
  }
}

// ── The book, as blocks ──────────────────────────────────────────────────────

export type Block =
  | { kind: 'heading'; lines: string[] }
  | { kind: 'para'; spans: Array<{ text: string; em: boolean }>; first: boolean }
  | { kind: 'verse'; lines: Array<Array<{ text: string; em: boolean }>> }
  | { kind: 'break' }
  | { kind: 'end' }

/** A chapter, or a section of back matter: a heading and what follows it, on a new page. */
export interface Section { blocks: Block[] }

export interface FrontMatter {
  /** Print interior: the copyright page's text, on the back of the title page. */
  copyright?: string
  /** Print interior: the dedication, on a right-hand page of its own. */
  dedication?: string
}

export interface BackSection { title: string; text: string }

export interface BookContent {
  title: string
  author: string
  sections: Section[]
  front?: FrontMatter
  back?: BackSection[]
  /** The words the submission's title page counts. */
  words: number
}

/** A paragraph's runs, as the other exports read it (`paragraphBlocks`, `emphasisSpans`). */
function blocksOfText(text: string): Block[] {
  return paragraphBlocks(text).map((p, i): Block => (p.verse
    ? { kind: 'verse', lines: p.text.split('\n').map((l) => emphasisSpans(l)) }
    : { kind: 'para', spans: emphasisSpans(p.text), first: i === 0 }))
}

/** The book's sections from the compiled manuscript, as the Word and EPUB exports take it. */
export function bookContent(m: BuiltManuscript, opts: CompileOptions & { author?: string; submission?: boolean; back?: BackSection[]; front?: FrontMatter } = {}): BookContent {
  const showHeadings = opts.chapterTitles ?? true
  const style = opts.chapterHeading ?? 'ch-title'
  const sections: Section[] = []
  let words = 0
  for (const ch of m.chapters) {
    const scenes = scenesForExport(ch.scenes, opts)
    if (!scenes.length) continue
    const blocks: Block[] = showHeadings ? [{ kind: 'heading', lines: chapterHeadingLines(style, ch.number, ch.title) }] : []
    scenes.forEach((s, i) => {
      words += s.wordCount
      if (i > 0) blocks.push({ kind: 'break' })
      blocks.push(...(s.written ? blocksOfText(s.text) : [{ kind: 'para', spans: [{ text: '[No prose yet]', em: false }], first: true } as Block]))
    })
    sections.push({ blocks })
  }
  if (opts.submission && sections.length) sections[sections.length - 1].blocks.push({ kind: 'end' })
  for (const b of opts.back ?? []) {
    if (!b.text.trim()) continue
    sections.push({ blocks: [{ kind: 'heading', lines: [b.title] }, ...blocksOfText(b.text)] })
  }
  return {
    title: opts.title?.trim() || 'Manuscript',
    author: opts.author?.trim() || '',
    sections,
    front: opts.front,
    back: opts.back,
    words,
  }
}

// ── Lines ────────────────────────────────────────────────────────────────────

interface Word { pieces: Piece[]; width: number }

/** Spans as words: split at spaces, each word in pieces by face. */
function wordsOf(spans: Array<{ text: string; em: boolean }>, fonts: LayoutFonts, size: number): Word[] {
  const out: Word[] = []
  let cur: Word | null = null
  for (const s of spans) {
    // Keep the spaces as boundaries: "a b" is two words, "a" + "_b_" across spans with no space between is one.
    const parts = s.text.split(/(\s+)/)
    for (const part of parts) {
      if (!part) continue
      if (/^\s+$/.test(part)) { cur = null; continue }
      for (const run of fonts.split(part, s.em ? 'italic' : 'roman')) {
        const width = fonts.width(run.text, run.font, size)
        if (!cur) { cur = { pieces: [], width: 0 }; out.push(cur) }
        cur.pieces.push({ text: run.text, font: run.font, width, space: false })
        cur.width += width
      }
    }
  }
  return out
}

/** A word wider than the whole line, cut by characters so that it fits. Rare: a long address, a run of dashes. */
function cutWord(w: Word, room: number, fonts: LayoutFonts, size: number): Word[] {
  const out: Word[] = []
  let cur: Word = { pieces: [], width: 0 }
  for (const p of w.pieces) {
    for (const ch of p.text) {
      const cw = fonts.width(ch, p.font, size)
      if (cur.width + cw > room && cur.width > 0) { out.push(cur); cur = { pieces: [], width: 0 } }
      const last = cur.pieces[cur.pieces.length - 1]
      if (last && last.font === p.font) { last.text += ch; last.width += cw } else cur.pieces.push({ text: ch, font: p.font, width: cw, space: false })
      cur.width += cw
    }
  }
  if (cur.width > 0) out.push(cur)
  if (out.length) out[0].pieces[0].space = w.pieces[0]?.space ?? false
  return out
}

export interface LineSet { lines: Array<{ pieces: Piece[]; indent: number; natural: number; last: boolean }> }

/**
 * A paragraph broken into lines, greedily: each line takes as many words as fit
 * in the measure. The first line starts `indent` in.
 */
export function breakLines(words: Word[], measure: number, indent: number, space: number, fonts: LayoutFonts, size: number): LineSet {
  const lines: LineSet['lines'] = []
  let pieces: Piece[] = []
  let width = 0
  let count = 0
  const room = () => measure - (lines.length === 0 ? indent : 0)
  const push = (last: boolean) => { lines.push({ pieces, indent: lines.length === 0 ? indent : 0, natural: width, last }); pieces = []; width = 0; count = 0 }
  for (const w0 of words) {
    for (const w of w0.width > measure - indent ? cutWord(w0, measure - indent, fonts, size) : [w0]) {
      const add = (count > 0 ? space : 0) + w.width
      if (count > 0 && width + add > room()) push(false)
      const lead = count > 0 ? space : 0
      w.pieces.forEach((p, i) => pieces.push({ ...p, space: i === 0 && count > 0 }))
      width += lead + w.width
      count++
    }
  }
  if (count > 0) push(true)
  return { lines }
}

// ── Pages ────────────────────────────────────────────────────────────────────

/** What a line of the grid holds, before it is placed. */
type Row =
  | { kind: 'text'; pieces: Piece[]; indent: number; natural: number; last: boolean; justify: boolean; size: number; centre?: boolean }
  | { kind: 'blank' }

export interface Layout {
  pages: LaidPage[]
  spec: PageSpec
  /** Lines stretched so wide to justify that a word space is over three times the font's own. */
  loose: number
}

/**
 * The book laid out on pages.
 *
 * - **A chapter starts a new page**, and in a print interior a right-hand one:
 *   where the page it would start on is a left-hand page, a blank page is put
 *   in before it.
 * - **Its heading is never left alone**: it is at the top of a new page, with
 *   room under it for at least `keep` lines of text.
 * - **Widows and orphans**: a paragraph that does not fit leaves at least
 *   `keep` lines at the foot of the page and carries at least `keep` lines to
 *   the next; where it cannot do both it goes whole to the next page.
 * - **A scene break is never the last thing on a page**: it goes with the
 *   first `keep` lines after it.
 * - **Running heads** are on every page of text but a chapter's opening, a
 *   blank page, and the front matter. A page number is on every page of text
 *   and every opening, and on no blank page.
 */
export function layoutBook(book: BookContent, spec: PageSpec, fonts: LayoutFonts): Layout {
  const L = linesOf(spec)
  const measure = spec.width - spec.inner - spec.outer
  const space = fonts.width(' ', 'roman', spec.size)
  const pages: LaidPage[] = []
  let loose = 0

  // Rows of the page being filled, and its role.
  let rows: Row[] = []
  let role: PageRole = 'body'
  const pageLeft = () => L - rows.length
  const flush = () => {
    pages.push(placePage(rows, role, pages.length + 1))
    rows = []
    role = 'body'
  }
  const isRecto = (n: number) => n % 2 === 1

  const placePage = (rs: Row[], r: PageRole, n: number): LaidPage => {
    const left = spec.inner === spec.outer || isRecto(n) ? spec.inner : spec.outer
    const lines: PlacedLine[] = []
    rs.forEach((row, i) => {
      if (row.kind === 'blank') return
      const y = spec.height - spec.top - spec.size - i * spec.leading
      const gaps = row.pieces.filter((p, k) => k > 0 && p.space).length
      const avail = measure - row.indent
      let gap = fonts.width(' ', 'roman', row.size)
      let x = left + row.indent
      if (row.centre) x = left + (measure - row.natural) / 2
      else if (row.justify && !row.last && gaps > 0) {
        gap += (avail - row.natural) / gaps
        if (gap > 3 * space) loose++
      }
      lines.push({ x, y, size: row.size, pieces: row.pieces, gap })
    })
    return { number: n, role: r, lines, head: null, folio: null }
  }

  const textRow = (t: { pieces: Piece[]; indent: number; natural: number; last: boolean }, o: { size?: number; centre?: boolean; justify?: boolean } = {}): Row =>
    ({ kind: 'text', ...t, size: o.size ?? spec.size, centre: o.centre, justify: o.justify ?? spec.justify })

  const centredLines = (text: string, font: 'roman' | 'italic', size: number): Row[] => {
    const ws = wordsOf([{ text, em: font === 'italic' }], fonts, size)
    return breakLines(ws, measure, 0, fonts.width(' ', 'roman', size), fonts, size).lines.map((l) => textRow(l, { size, centre: true }))
  }

  // A section starts on a new page: a right-hand one where asked, with a blank page before it where it must.
  const newSectionPage = () => {
    if (rows.length) flush()
    if (spec.recto && !isRecto(pages.length + 1)) { role = 'blank'; flush() }
    role = 'opening'
  }

  frontMatter(book, spec, L, pages, (n, r, rs) => placePage(rs, r, n), centredLines)

  // ── Sections ──
  for (const section of book.sections) {
    newSectionPage()
    let firstPara = true
    for (const block of section.blocks) {
      if (block.kind === 'heading') {
        // The drop, then the heading: each line two rows of the grid, a second line smaller and in italic.
        const drop = Math.max(0, Math.min(spec.drop, L - block.lines.length * 2 - spec.afterHeading - spec.keep))
        for (let k = 0; k < drop; k++) rows.push({ kind: 'blank' })
        block.lines.forEach((text, k) => {
          const size = k === 0 ? spec.headingSize : Math.max(spec.size, spec.headingSize * 0.8)
          for (const row of centredLines(text, k === 0 ? 'roman' : 'italic', size)) rows.push(row)
          if (spec.kind !== 'submission') rows.push({ kind: 'blank' })
        })
        for (let k = 0; k < spec.afterHeading - (spec.kind !== 'submission' ? 1 : 0); k++) rows.push({ kind: 'blank' })
        firstPara = true
        continue
      }
      if (block.kind === 'break') {
        const need = 2 * spec.breakSpace + 1 + spec.keep
        if (pageLeft() < need) flush()
        // At the top of a page the space above it is not needed: the page break is the space.
        if (rows.length) for (let k = 0; k < spec.breakSpace; k++) rows.push({ kind: 'blank' })
        rows.push(...centredLines(spec.sceneBreak, 'roman', spec.size))
        for (let k = 0; k < spec.breakSpace; k++) rows.push({ kind: 'blank' })
        firstPara = true
        continue
      }
      if (block.kind === 'end') {
        if (pageLeft() < 1) flush()
        rows.push(...centredLines('END', 'roman', spec.size))
        continue
      }
      // Paragraph or verse: lines, then onto pages with widows and orphans kept.
      const lineRows: Row[] = block.kind === 'para'
        ? breakLines(wordsOf(block.spans, fonts, spec.size), measure, firstPara && spec.kind !== 'submission' ? 0 : spec.indent, space, fonts, spec.size).lines.map((l) => textRow(l))
        : block.lines.flatMap((line) => breakLines(wordsOf(line, fonts, spec.size), measure - 2 * spec.indent, 0, space, fonts, spec.size).lines
          .map((l, i) => textRow({ ...l, indent: spec.indent + (i > 0 ? spec.indent : 0) }, { justify: false })))
      firstPara = false
      let rest = lineRows
      while (rest.length) {
        const left = pageLeft()
        if (rest.length <= left) { rows.push(...rest); break }
        let take = left
        if (take < spec.keep) take = 0
        if (rest.length - take < spec.keep) take = rest.length - spec.keep
        if (take < spec.keep) take = 0
        // A page of nothing but this paragraph's lines can take no fewer: a paragraph longer than a page breaks where it must.
        if (take === 0 && rows.length === 0) take = Math.min(left, rest.length)
        rows.push(...rest.slice(0, take))
        rest = rest.slice(take)
        flush()
      }
    }
  }
  if (rows.length) flush()

  furnish(pages, spec, fonts, measure)
  return { pages, spec, loose }
}

/** The title page and, in a print interior, the copyright and dedication pages. */
function frontMatter(
  book: BookContent, spec: PageSpec, L: number, pages: LaidPage[],
  place: (n: number, role: PageRole, rows: Row[]) => LaidPage,
  centredLines: (text: string, font: 'roman' | 'italic', size: number) => Row[],
) {
  const blank = (): Row => ({ kind: 'blank' })
  const at = (row: number, content: Row[]): Row[] => [...Array.from({ length: Math.max(0, row) }, blank), ...content]
  // A submission's title page is its own (`submissionTitlePage`).
  if (spec.kind === 'submission') return
  // The title page: the title a third of the way down, the author under it.
  const titleRows = [...centredLines(book.title, 'roman', spec.headingSize * 1.4), blank(), ...(book.author ? centredLines(book.author, 'italic', spec.size * 1.2) : [])]
  pages.push(place(pages.length + 1, 'title', at(Math.floor(L / 3), titleRows)))
  if (spec.kind !== 'print') return
  const copyright = book.front?.copyright?.trim()
  const dedication = book.front?.dedication?.trim()
  // The back of the title page: the copyright, at the foot; or nothing.
  if (copyright) {
    const small = spec.size * 0.85
    const crows = copyright.split('\n').flatMap((l) => (l.trim() ? centredLines(l.trim(), 'roman', small) : [blank()]))
    pages.push(place(pages.length + 1, 'copyright', at(L - crows.length, crows)))
  } else if (dedication) pages.push(place(pages.length + 1, 'blank', []))
  if (dedication) {
    if (pages.length % 2 === 1) pages.push(place(pages.length + 1, 'blank', []))
    pages.push(place(pages.length + 1, 'dedication', at(Math.floor(L / 3), dedication.split('\n').flatMap((l) => (l.trim() ? centredLines(l.trim(), 'italic', spec.size) : [blank()])))))
  }
}

/** Running heads and page numbers, by each page's role and side. */
function furnish(pages: LaidPage[], spec: PageSpec, fonts: LayoutFonts, measure: number) {
  for (const p of pages) {
    const recto = p.number % 2 === 1
    const left = spec.inner === spec.outer || recto ? spec.inner : spec.outer
    const text = (s: string, font: 'roman' | 'italic', size: number) => {
      const pieces: Piece[] = []
      for (const [i, w] of s.split(/\s+/).filter(Boolean).entries()) {
        for (const [k, run] of fonts.split(w, font).entries()) pieces.push({ text: run.text, font: run.font, width: fonts.width(run.text, run.font, size), space: i > 0 && k === 0 })
      }
      const gap = fonts.width(' ', 'roman', size)
      const width = pieces.reduce((n, q) => n + q.width + (q.space ? gap : 0), 0)
      return { pieces, width, gap }
    }
    const furnished = p.role === 'body' || p.role === 'opening'
    if (!furnished) continue
    if (spec.footFolio) {
      const f = text(String(p.number), 'roman', spec.headSize)
      p.folio = { x: left + (measure - f.width) / 2, y: spec.bottom / 2, size: spec.headSize, pieces: f.pieces, gap: f.gap }
    }
    // A book's running head is on a page of text, not an opening; a submission's header is on every page but the title page.
    if (spec.heads && (p.role === 'body' || spec.kind === 'submission')) {
      const lead = recto ? spec.heads.recto : spec.heads.verso
      if (spec.headAlign === 'right') {
        const h = text(`${lead} / ${p.number}`, 'roman', spec.headSize)
        p.head = { x: left + measure - h.width, y: spec.height - spec.top / 2, size: spec.headSize, pieces: h.pieces, gap: h.gap }
      } else {
        const h = text(lead, 'italic', spec.headSize)
        p.head = { x: left + (measure - h.width) / 2, y: spec.height - spec.top / 2, size: spec.headSize, pieces: h.pieces, gap: h.gap }
      }
    }
  }
}

// ── The submission's title page ──────────────────────────────────────────────

/**
 * A submission's title page, as the Word file has it: the writer's name and the
 * rounded word count on the first line, the contact block under the name, and
 * the title and byline halfway down.
 */
export function submissionTitlePage(book: BookContent, sub: SubmissionOptions, spec: PageSpec, fonts: LayoutFonts): LaidPage {
  const measure = spec.width - spec.inner - spec.outer
  const single = spec.size * 1.2
  const gap = fonts.width(' ', 'roman', spec.size)
  const line = (text: string, y: number, align: 'left' | 'right' | 'centre', italic = false): PlacedLine => {
    const pieces: Piece[] = []
    for (const [i, w] of text.split(/\s+/).filter(Boolean).entries()) {
      for (const [k, run] of fonts.split(w, italic ? 'italic' : 'roman').entries()) pieces.push({ text: run.text, font: run.font, width: fonts.width(run.text, run.font, spec.size), space: i > 0 && k === 0 })
    }
    const width = pieces.reduce((n, q) => n + q.width + (q.space ? gap : 0), 0)
    const x = align === 'left' ? spec.inner : align === 'right' ? spec.inner + measure - width : spec.inner + (measure - width) / 2
    return { x, y, size: spec.size, pieces, gap }
  }
  const top = spec.height - spec.top - spec.size
  const first = sub.legalName?.trim() || sub.name.trim()
  const lines: PlacedLine[] = [line(first, top, 'left'), line(titlePageWordCount(book.words, sub.wordCount), top, 'right')]
  contactLines(first, sub.contact).forEach((l, i) => lines.push(line(l, top - (i + 1) * single, 'left')))
  const mid = spec.height / 2
  lines.push(line(book.title, mid, 'centre'), line(`by ${sub.name.trim()}`, mid - spec.leading, 'centre'))
  return { number: 1, role: 'title', lines, head: null, folio: null }
}

/** The submission: its title page, then the book from page 2, as Word numbers it. */
export function layoutSubmission(book: BookContent, sub: SubmissionOptions, spec: PageSpec, fonts: LayoutFonts): Layout {
  const body = layoutBook(book, spec, fonts)
  // The book's pages numbered from 2, and their header saying so.
  const pages = [submissionTitlePage(book, sub, spec, fonts), ...body.pages.map((p, i) => ({ ...p, number: i + 2, head: null, folio: null }))]
  furnish(pages.slice(1), spec, fonts, spec.width - spec.inner - spec.outer)
  return { pages, spec, loose: body.loose }
}

/**
 * A print interior: laid out once, then again with the inside margin its page
 * count needs (`gutterFor`), until the count stops crossing a band. Two passes
 * almost always; never more than four.
 */
export function layoutPrint(book: BookContent, o: SpecOptions, fonts: LayoutFonts): Layout {
  let pages = 0
  let laid = layoutBook(book, pageSpec('print', { ...o, pages }), fonts)
  for (let pass = 0; pass < 4; pass++) {
    const next = laid.pages.length
    if (gutterFor(next) === gutterFor(pages)) break
    pages = next
    laid = layoutBook(book, pageSpec('print', { ...o, pages }), fonts)
  }
  return laid
}
