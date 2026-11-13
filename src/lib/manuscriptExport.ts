import type { EventStatus } from '@/types'
import type { BuiltManuscript, CompileOptions } from './manuscriptCompile'
import { scenesForExport } from './manuscriptCompile'
import { zipStore, type ZipEntry } from './zip'
import { paragraphBlocks, type Paragraph } from '@/lib/manuscriptParagraphs'
import { emphasisMarkup, emphasisSpans } from '@/lib/proseEmphasis'
import { chapterHeadingLabel, chapterHeadingLines, type ChapterHeadingStyle } from '@/lib/chapterHeading'
import { headingLine, initials, markedParagraphs, rewrittenLine, settleBreaks, type MarkedParagraph } from '@/lib/markedDocx'

/**
 * Compile a built manuscript to a binary book file — Word (`.docx`) or EPUB —
 * as a ZIP container built in the browser with no dependency. Pure: returns the
 * archive bytes; the caller wraps them in a Blob to download.
 */

const enc = new TextEncoder()
const file = (name: string, text: string): ZipEntry => ({ name, data: enc.encode(text) })

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}


export interface BookExportOptions extends CompileOptions {
  author?: string
  cover?: { data: Uint8Array; mimeType: string }
  /** Word only: standard manuscript format, for this writer, in place of the book's layout. */
  submission?: SubmissionOptions
  /** Word only: marked for an editor's changes to come back (R4, `editingMarks`). */
  forEditing?: EditingMarks
}

/**
 * What lets an editor's Word file come back into the book (editorial-plan.md,
 * R4). Each scene's paragraphs are inside a bookmark, `KathalaScene_<n>`, where
 * `n` is the scene's place in the draft saved as the file was made (R3) — a
 * scene's own id has characters a bookmark's name may not. The file says which
 * draft, and which book, as custom document properties, which Word and
 * LibreOffice keep. The draft then says which scene each bookmark is, and what
 * its prose was when it went out.
 */
export interface EditingMarks {
  draftId: string
  worldId: string
  /** A scene's place in the draft, by its id. */
  sceneIndex: (eventId: string) => number | undefined
  /**
   * The writer's changes, marked (round-trip-plan-2.md, T5.1): each scene's
   * prose written as tracked changes against `base`, the text the editor sent
   * back (D-4), signed `author` — the byline (D-6). `base` is null for a scene
   * the editor's file did not have.
   */
  marked?: {
    author: string; date: string; base: (eventId: string) => string | null; threads?: MarkedThread[]; against?: string
    /** What the editor's file says of the book's length on its title page: where the count has changed since, it is a change (T8.4). */
    titleCount?: string
  }
}

/**
 * One of the editor's comments, with the writer's replies under it, going back
 * with the marked book (round-trip-plan-2.md, T5.2, D-5): on `quote`, the words
 * as the writer's text now has them; the first comment the editor's, the rest
 * replies, in order; and whether the thread is resolved.
 */
export interface MarkedThread {
  eventId: string
  quote: string
  /**
   * Where the comment was made on a line outside the scenes (T9.4): it goes
   * back on the title page, or on the heading of the chapter `eventId` is in.
   * `quote` is that line as the editor's file had it.
   */
  outside?: 'title page' | 'heading'
  done: boolean
  /** `date` is when it was said, where known: without one a comment carries the export's. */
  comments: Array<{ author: string; initials: string; text: string; date?: string }>
}

/** A scene's bookmark, as an edited file brings it back. */
export const SCENE_BOOKMARK = /^KathalaScene_(\d+)$/

function coverExtension(mimeType: string): 'png' | 'jpg' | null {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg'
  return null
}

/** Chapters that have prose to include, with their kept scenes. */
function includedChapters(m: BuiltManuscript, onlyWritten: boolean, minStatus?: EventStatus | null) {
  return m.chapters
    .map((ch) => ({ ch, scenes: scenesForExport(ch.scenes, { onlyWritten, minStatus }) }))
    .filter((b) => b.scenes.length > 0)
}


// ── DOCX ──────────────────────────────────────────────────────────────────────

/*
  Word, in one of two layouts (editorial-plan.md, R2).

  - **Book**: the book as it reads, title page to the last chapter.
  - **Submission**: standard manuscript format, as agents and editors ask for
    it (William Shunn's layout): 12-point Times New Roman or Courier,
    double-spaced, one-inch margins, each paragraph's first line set in half
    an inch; a running header of *Surname / TITLE / page*; a title page with
    the writer's name and contact details top left, the word count rounded
    top right, and the title and byline centred; every chapter on a new page;
    `#` between scenes; *END* at the close.

  Either way the formatting is in named paragraph styles (`styles.xml`), not
  on each paragraph, so an editor restyles the whole file by changing a style:
  *Normal* for prose, *Title* and *Byline*, *Heading 1* for the line a
  chapter opens with and *Heading 2* for its title beneath, *Scene Break*,
  *Verse*, and on a submission's title page *Contact*.
*/

/** The writer, on a submission: kept on this device, and put in the file only. */
export interface SubmissionOptions {
  /** The name on the byline, and the surname in the running header. */
  name: string
  /** The name a contract is made out to, where it is not the byline's: first in the contact block. */
  legalName?: string
  /** Address, email, telephone: a line each, under the name. */
  contact?: string
  /** What the title page says of the length, where the writer says it: "about 12,700 words", or a number. Else the count, rounded. */
  wordCount?: string
  font?: 'times' | 'courier'
  paper?: 'letter' | 'a4'
}

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
const INCH = 1440
const PAPER = { letter: { w: 12240, h: 15840 }, a4: { w: 11906, h: 16838 } } as const

/**
 * A submission's word count, as the title page gives it: the nearest hundred
 * under 20,000, else the nearest thousand. Under 20,000 is a novella or a
 * story, and "about 13,000" for 12,724 was nearer the next draft than this
 * one: an editor and the writer both wanted "about 12,700" (writer run
 * 2026-11-09, RT-4; round-trip-plan.md, T2.2).
 */
export function roundedWordCount(words: number): string {
  const n = words < 20_000 ? Math.max(100, Math.round(words / 100) * 100) : Math.round(words / 1000) * 1000
  return `about ${n.toLocaleString('en-US')} words`
}

/** The title page's word count: what the writer says, a bare number said as words, or the count rounded. */
export function titlePageWordCount(words: number, said?: string): string {
  const own = said?.trim()
  if (!own) return roundedWordCount(words)
  const n = /^[\d,. ]+$/.test(own) ? Number(own.replace(/[^\d]/g, '')) : NaN
  return Number.isFinite(n) && n > 0 ? `about ${n.toLocaleString('en-US')} words` : own
}

/**
 * The contact block's lines under the name, without the name again: writers
 * put their name at the top of their contact details, and the title page
 * printed it twice (editor run 2026-11-09, E-6).
 */
export function contactLines(name: string, contact?: string): string[] {
  const lines = (contact ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  return lines[0] && lines[0].toLowerCase() === name.trim().toLowerCase() ? lines.slice(1) : lines
}

/** The surname the running header carries: the byline's last word. */
export function surnameOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words[words.length - 1] ?? ''
}

/** The styles every Word export is set in, for the layout it is in. */
export function docxStyles(sub?: SubmissionOptions): string {
  const font = sub?.font === 'courier' ? 'Courier New' : 'Times New Roman'
  const fonts = `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/>`
  const style = (id: string, name: string, pPr: string, rPr = '', next = 'Normal') =>
    // Normal is the default paragraph style, said so: a tool that reads styles found no style on a body paragraph without it (editor run 2026-11-09, E-9).
    `<w:style w:type="paragraph"${id === 'Normal' ? ' w:default="1"' : ''} w:customStyle="${['Byline', 'SceneBreak', 'Verse', 'Contact'].includes(id) ? 1 : 0}" w:styleId="${id}">` +
    `<w:name w:val="${name}"/>${id === 'Normal' ? '' : '<w:basedOn w:val="Normal"/>'}<w:next w:val="${next}"/><w:qFormat/>` +
    `<w:pPr>${pPr}</w:pPr>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}</w:style>`
  // A submission is one size throughout, double-spaced, no gap between paragraphs, and indented; a book reads as one.
  const normal = sub
    ? '<w:spacing w:after="0" w:line="480" w:lineRule="auto"/><w:ind w:firstLine="720"/>'
    : '<w:spacing w:after="160" w:line="276" w:lineRule="auto"/>'
  const flat = '<w:ind w:firstLine="0"/>'
  const centred = `<w:jc w:val="center"/>${flat}`
  const big = (half: number) => (sub ? '' : `<w:sz w:val="${half}"/><w:szCs w:val="${half}"/>`)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults><w:rPrDefault><w:rPr>${fonts}<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr>${normal}</w:pPr></w:pPrDefault></w:docDefaults>` +
    style('Normal', 'Normal', normal) +
    // A submission's title sits halfway down its page; a book's opens it.
    style('Title', 'Title', `<w:keepNext/>${sub ? '<w:spacing w:before="4320" w:after="0"/>' : '<w:spacing w:after="240"/>'}${centred}`, `${sub ? '' : '<w:b/>'}${big(56)}`, 'Byline') +
    style('Byline', 'Byline', centred, big(28)) +
    // A chapter opens a page; on a submission, a third of the way down it.
    style('Heading1', 'heading 1', `<w:keepNext/><w:pageBreakBefore/>${sub ? '<w:spacing w:before="2880" w:after="0"/>' : '<w:spacing w:before="240" w:after="240"/>'}${centred}<w:outlineLvl w:val="0"/>`, `${sub ? '' : '<w:b/>'}${big(32)}`) +
    style('Heading2', 'heading 2', `<w:keepNext/>${sub ? '<w:spacing w:after="0"/>' : '<w:spacing w:after="240"/>'}${centred}<w:outlineLvl w:val="1"/>`, `${sub ? '' : '<w:b/>'}${big(28)}`) +
    style('SceneBreak', 'Scene Break', `<w:keepNext/>${centred}`) +
    style('Verse', 'Verse', '<w:ind w:left="720" w:firstLine="0"/>') +
    // The contact block is single-spaced, with the word count against the right margin.
    style('Contact', 'Contact', `<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>${flat}`) +
    `</w:styles>`
}

/**
 * One Word paragraph, in a style.
 *
 * `emphasis` splits the text into runs so `_like this_` arrives in Word as
 * italics rather than as underscores. Only prose asks for it: the title page,
 * the chapter headings and the scene separator are the app's own text, and
 * `* * *` in particular has no business being parsed for markup.
 */
function docPara(text: string, o: { style?: string; emphasis?: boolean; tabRight?: number; pageBreakBefore?: boolean; lead?: string; tail?: string } = {}): string {
  const pPr: string[] = []
  if (o.style && o.style !== 'Normal') pPr.push(`<w:pStyle w:val="${o.style}"/>`)
  if (o.pageBreakBefore) pPr.push('<w:pageBreakBefore/>')
  if (o.tabRight) pPr.push(`<w:tabs><w:tab w:val="right" w:pos="${o.tabRight}"/></w:tabs>`)
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''

  // An empty paragraph still needs its run, or Word sees no paragraph at all.
  const parsed = o.emphasis ? emphasisSpans(text) : []
  const spans = parsed.length ? parsed : [{ text, em: false }]
  const line = (l: string) => l.split('\t').map((part) => `<w:t xml:space="preserve">${xml(part)}</w:t>`).join('<w:tab/>')

  const runs = spans
    .map((s) => `<w:r>${s.em ? '<w:rPr><w:i/></w:rPr>' : ''}${s.text.split('\n').map(line).join('<w:br/>')}</w:r>`)
    .join('')
  return `<w:p>${pPrXml}${o.lead ?? ''}${runs}${o.tail ?? ''}</w:p>`
}

/**
 * A paragraph of a scene marked against the editor's text: its runs the same,
 * put in or taken out, each change signed; and its paragraph mark put in or
 * taken out with it where the paragraph is new or gone, so that rejecting every
 * change gives the editor's text back and accepting every one gives the
 * writer's (round-trip-plan-2.md, T5.1).
 */
function markedPara(p: MarkedParagraph, o: { lead?: string; pageBreakBefore?: boolean; sign: (kind: 'ins' | 'del') => string; anchors?: Array<{ at: number; xml: string }> }): string {
  const pPr: string[] = []
  if (p.verse) pPr.push('<w:pStyle w:val="Verse"/>')
  if (o.pageBreakBefore) pPr.push('<w:pageBreakBefore/>')
  if (p.breakMark !== 'same') pPr.push(`<w:rPr><w:${p.breakMark} ${o.sign(p.breakMark)}/></w:rPr>`)
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''
  const words = (text: string, tag: 't' | 'delText') => text.split('\n')
    .map((l) => l.split('\t').map((part) => `<w:${tag} xml:space="preserve">${xml(part)}</w:${tag}>`).join('<w:tab/>')).join('<w:br/>')
  const one = (r: MarkedParagraph['runs'][number], text: string) => {
    const run = `<w:r>${r.em ? '<w:rPr><w:i/></w:rPr>' : ''}${words(text, r.kind === 'del' ? 'delText' : 't')}</w:r>`
    return r.kind === 'same' ? run : `<w:${r.kind} ${o.sign(r.kind)}>${run}</w:${r.kind}>`
  }
  /*
    Comment ranges, placed by where they fall in the paragraph as the writer
    has it now — words kept and put in, not those taken out — a run cut where
    one starts or ends inside it (T5.2).
  */
  const pending = [...(o.anchors ?? [])].sort((a, b) => a.at - b.at)
  const out: string[] = []
  let cur = 0
  const due = () => { while (pending.length && pending[0].at <= cur) out.push(pending.shift()!.xml) }
  /*
    The scene's bookmark after any comment marks at its start, just before its
    first words: with the comments' marks after it at the same point,
    LibreOffice dropped the bookmark on saving, and the scene was lost to the
    file coming back (npm run probe:marked, T5.2).
  */
  due()
  if (o.lead) out.push(o.lead)
  for (const r of p.runs) {
    due()
    if (r.kind === 'del') { out.push(one(r, r.text)); continue }
    let from = 0
    while (from < r.text.length) {
      const next = pending.length ? pending[0].at - cur : Infinity
      const take = next > 0 && next < r.text.length - from ? next : r.text.length - from
      out.push(one(r, r.text.slice(from, from + take)))
      from += take
      cur += take
      due()
    }
  }
  due()
  for (const a of pending) out.push(a.xml)
  const runs = out.join('')
  // A paragraph with no runs is still one: Word needs a run to see it.
  return `<w:p>${pPrXml}${runs || '<w:r/>'}</w:p>`
}

/** A submission's running header: *Surname / TITLE / page*, against the right margin, the page a field Word fills in. */
function submissionHeader(sub: SubmissionOptions, title: string): string {
  const lead = [surnameOf(sub.name), title.toUpperCase()].filter(Boolean).join(' / ')
  const run = (inner: string) => `<w:r>${inner}</w:r>`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:hdr ${W_NS}><w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/></w:pPr>` +
    run(`<w:t xml:space="preserve">${xml(lead)} / </w:t>`) +
    run('<w:fldChar w:fldCharType="begin"/>') + run('<w:instrText xml:space="preserve"> PAGE </w:instrText>') +
    run('<w:fldChar w:fldCharType="separate"/>') + run('<w:t>1</w:t>') + run('<w:fldChar w:fldCharType="end"/>') +
    `</w:p></w:hdr>`
}

/** The draft and book an edited file came from, as custom document properties. */
function editingProperties(marks: EditingMarks): string {
  const prop = (pid: number, name: string, value: string) =>
    `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${pid}" name="${name}"><vt:lpwstr>${xml(value)}</vt:lpwstr></property>`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    prop(2, 'KathalaDraft', marks.draftId) + prop(3, 'KathalaWorld', marks.worldId) +
    // Marked: whose changes are the writer's, and what they were measured against, for the file coming back (T5.3).
    (marks.marked ? prop(4, 'KathalaMarkedBy', marks.marked.author) + (marks.marked.against ? prop(5, 'KathalaMarkedAgainst', marks.marked.against) : '') : '') +
    `</Properties>`
}

export function compileDocx(m: BuiltManuscript, opts: BookExportOptions = {}): Uint8Array {
  const sub = opts.submission?.name.trim() ? opts.submission : undefined
  const chapterTitles = opts.chapterTitles ?? true
  const onlyWritten = opts.onlyWritten ?? true
  // A submission's scene break is the one an editor's eye is trained on.
  const sep = sub ? '#' : opts.sceneSeparator ?? '* * *'
  const title = opts.title?.trim() || 'Manuscript'
  // A submission carries no cover: what goes to an agent is the text.
  const coverExt = !sub && opts.cover ? coverExtension(opts.cover.mimeType) : null
  const paper = PAPER[sub?.paper ?? 'letter']
  const textWidth = paper.w - 2 * INCH

  const blocks = includedChapters(m, onlyWritten, opts.minStatus)
  const body: string[] = []
  // Each tracked change's own id, apart from the bookmarks'.
  let changeId = 1000
  const marked = opts.forEditing?.marked
  const sign = () => `w:id="${changeId++}" w:author="${xml(marked!.author)}" w:date="${marked!.date}"`
  // The comments going back, each with its own id and paragraph id; a reply's parent is its thread's first.
  const comments: Array<{ id: number; para: string; parent?: string; author: string; initials: string; text: string; date: string; done: boolean }> = []
  let paraId = 0x10000001
  /** A thread's comments entered, in order, and the marks that open and close them all on whatever the thread is on. */
  const enter = (t: MarkedThread, said: MarkedThread['comments']) => {
    const ids = said.map((c, j) => {
      const id = comments.length
      const para = (paraId++).toString(16).toUpperCase().padStart(8, '0')
      comments.push({ id, para, ...(j > 0 ? { parent: comments[comments.length - j].para } : {}), author: c.author, initials: c.initials, text: c.text, date: c.date ?? marked!.date, done: t.done })
      return id
    })
    return {
      ids,
      open: ids.map((id) => `<w:commentRangeStart w:id="${id}"/>`).join(''),
      close: ids.map((id) => `<w:commentRangeEnd w:id="${id}"/><w:r><w:commentReference w:id="${id}"/></w:r>`).join(''),
    }
  }
  const outsideThreads = (marked?.threads ?? []).filter((t) => t.outside && t.comments.length > 0)

  /*
    A thread on the title page goes back on the line it was made on, where
    that line is still there word for word; on the line of the name and the
    count, whatever the count now is; and on the title otherwise, which every
    title page has (T9.4). Each once: two lines may say the same words.
  */
  const titleThreads = new Set(outsideThreads.filter((t) => t.outside === 'title page'))
  const legal = sub ? sub.legalName?.trim() || sub.name.trim() : null
  const titleLines = sub
    ? [...contactLines(legal!, sub.contact), title, `by ${sub.name.trim()}`]
    : [title, ...(opts.author?.trim() ? [opts.author.trim()] : [])]
  const titleMarks = (on: (t: MarkedThread) => boolean) => {
    const marks = [...titleThreads].filter(on).map((t) => { titleThreads.delete(t); return enter(t, t.comments) })
    return { lead: marks.map((m) => m.open).join(''), tail: marks.map((m) => m.close).join('') }
  }
  const onCount = (t: MarkedThread) => legal !== null && t.quote.startsWith(`${legal}\t`)
  const onTitlePage = (text: string, style: string) =>
    docPara(text, { style, ...titleMarks((t) => (titleLines.includes(t.quote) ? t.quote === text : style === 'Title' && !onCount(t))) })

  // Title page.
  if (sub) {
    const words = blocks.reduce((n, b) => n + b.scenes.reduce((k, s) => k + s.wordCount, 0), 0)
    const first = sub.legalName?.trim() || sub.name.trim()
    const count = titlePageWordCount(words, sub.wordCount)
    const was = marked?.titleCount?.trim()
    const here = titleMarks(onCount)
    if (was && was !== count) {
      /*
        The count on the editor's file, and the count now: a change like any
        other. Written plain, it changed without a mark in both marked rounds of
        the second loop, and rejecting every change did not give the editor back
        the file they had sent (editor-run-2026-11-10-loop2.md, E-6).
      */
      body.push(`<w:p><w:pPr><w:pStyle w:val="Contact"/><w:tabs><w:tab w:val="right" w:pos="${textWidth}"/></w:tabs></w:pPr>` +
        `${here.lead}<w:r><w:t xml:space="preserve">${xml(first)}</w:t><w:tab/></w:r>` +
        `<w:del ${sign()}><w:r><w:delText xml:space="preserve">${xml(was)}</w:delText></w:r></w:del>` +
        `<w:ins ${sign()}><w:r><w:t xml:space="preserve">${xml(count)}</w:t></w:r></w:ins>${here.tail}</w:p>`)
    } else body.push(docPara(`${first}\t${count}`, { style: 'Contact', tabRight: textWidth, ...here }))
    for (const lineText of contactLines(first, sub.contact)) body.push(onTitlePage(lineText, 'Contact'))
    body.push(onTitlePage(title, 'Title'))
    body.push(onTitlePage(`by ${sub.name.trim()}`, 'Byline'))
  } else {
    if (opts.cover && coverExt) {
      body.push(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="3429000" cy="5143500"/><wp:docPr id="1" name="Book cover"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="cover.${coverExt}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdCover"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3429000" cy="5143500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`)
    }
    body.push(onTitlePage(title, 'Title'))
    if (opts.author?.trim()) body.push(onTitlePage(opts.author.trim(), 'Byline'))
  }

  const headingStyle = opts.chapterHeading ?? 'ch-title'
  let bookmarkId = 0
  blocks.forEach(({ ch, scenes }, n) => {
    if (chapterTitles) {
      // The first line opens the page; a title under a number is a line of its own beneath it.
      /*
        A thread on this chapter's heading goes back on it (T9.4): on the line
        that still says what it was on, where the heading is a number over a
        title, and on the first line otherwise, whatever the heading now says.
      */
      const lines = chapterHeadingLines(headingStyle, ch.number, ch.title)
      const here = outsideThreads.filter((t) => t.outside === 'heading' && scenes.some((sc) => sc.eventId === t.eventId))
      lines.forEach((lineText, i) => {
        const marks = here.filter((t) => Math.max(0, lines.indexOf(t.quote)) === i).map((t) => enter(t, t.comments))
        body.push(docPara(lineText, { style: i === 0 ? 'Heading1' : 'Heading2', lead: marks.map((m) => m.open).join(''), tail: marks.map((m) => m.close).join('') }))
      })
    }
    scenes.forEach((s, i) => {
      if (i > 0) body.push(docPara(sep, { style: 'SceneBreak' }))
      const paras: Paragraph[] = s.written ? paragraphBlocks(s.text) : [{ text: '[No prose yet]', verse: false }]
      /*
        Marked for an editor: a bookmark where the scene starts, opened and
        closed at its first word. A bookmark around the scene's paragraphs came
        back from LibreOffice broken — a second start under the same name at
        the scene's last paragraph, the end paired with that one — for 16 of a
        run's 18 scenes on a save with no edits; one at a point came back whole
        (round-trip-plan.md, T1.6). Bringing a file in reads a bookmark as
        where its scene starts, so a point is all it needs.
      */
      const index = opts.forEditing?.sceneIndex(s.eventId)
      const mark = index === undefined ? null : bookmarkId++
      const lead = mark !== null ? `<w:bookmarkStart w:id="${mark}" w:name="KathalaScene_${index}"/><w:bookmarkEnd w:id="${mark}"/>` : ''
      const base = marked ? marked.base(s.eventId) : null
      if (marked && (s.written || base)) {
        // Marked: the scene as the writer has it, against what the editor sent back.
        const paras = markedParagraphs(base, s.written ? s.text : '')
        const anchors = paras.map(() => [] as Array<{ at: number; xml: string }>)
        // The threads on this scene's words; and one on its chapter's heading, in a file made without headings.
        for (const t of (marked.threads ?? []).filter((x) => x.eventId === s.eventId && x.comments.length > 0 && (!x.outside || (x.outside === 'heading' && !chapterTitles)))) {
          // On its words as the writer has them now; where they are gone, at the scene's start, quoted.
          const words = emphasisSpans(t.quote).map((x) => x.text).join('') || t.quote
          let k = t.outside ? -1 : paras.findIndex((p) => p.mark !== 'del' && p.runs.filter((r) => r.kind !== 'del').map((r) => r.text).join('').includes(words))
          const placed = k >= 0
          /*
            Not placed: at the start of the scene's first paragraph that was
            there before, and of its first paragraph only where every one is
            new. On a paragraph put in first in its scene, LibreOffice's
            reject-all took the words and left the paragraph, empty
            (npm run probe:marked, T9.4).
          */
          if (!placed) {
            const standing = paras.findIndex((p) => p.mark === 'same')
            k = standing >= 0 ? standing : Math.max(0, paras.findIndex((p) => p.mark !== 'del'))
          }
          const at = placed ? paras[k].runs.filter((r) => r.kind !== 'del').map((r) => r.text).join('').indexOf(words) : 0
          // Where its words are gone, the words it was on are said in a reply of the writer's, first under it: not in the editor's own comment (T9.2).
          const line = t.outside ? headingLine(t.quote) : rewrittenLine(t.quote)
          const said = placed ? t.comments : [t.comments[0], { author: marked.author, initials: initials(marked.author), text: line }, ...t.comments.slice(1)]
          const { ids } = enter(t, said)
          for (const id of ids) anchors[k].push({ at, xml: `<w:commentRangeStart w:id="${id}"/>` })
          for (const id of ids) anchors[k].push({ at: placed ? at + words.length : at, xml: `<w:commentRangeEnd w:id="${id}"/><w:r><w:commentReference w:id="${id}"/></w:r>` })
        }
        // Where a new paragraph follows one with a comment in it, which break carries its mark.
        settleBreaks(paras, (k) => anchors[k].length > 0)
        paras.forEach((p, k) => {
          const opens = sub && !chapterTitles && n === 0 && i === 0 && k === 0
          body.push(markedPara(p, { lead: k === 0 ? lead : '', pageBreakBefore: !!opens, sign, anchors: anchors[k] }))
        })
        return
      }
      paras.forEach((p, k) => {
        // Without chapter headings a submission's text still starts on the page after its title page.
        const opens = sub && !chapterTitles && n === 0 && i === 0 && k === 0
        body.push(docPara(p.text, {
          style: p.verse ? 'Verse' : 'Normal', emphasis: true, pageBreakBefore: opens,
          lead: k === 0 ? lead : '',
        }))
      })
    })
  })
  if (sub) body.push(docPara('END', { style: 'SceneBreak' }))

  // A submission's header is on every page but the title page (`titlePg`, with no first-page header).
  const sectPr = sub
    ? `<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:pgSz w:w="${paper.w}" w:h="${paper.h}"/>` +
      `<w:pgMar w:top="${INCH}" w:right="${INCH}" w:bottom="${INCH}" w:left="${INCH}" w:header="720" w:footer="720" w:gutter="0"/><w:titlePg/></w:sectPr>`
    : '<w:sectPr/>'
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document ${W_NS}><w:body>` + body.join('') + sectPr + `</w:body></w:document>`

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    (coverExt === 'png' ? `<Default Extension="png" ContentType="image/png"/>` : '') +
    (coverExt === 'jpg' ? `<Default Extension="jpg" ContentType="image/jpeg"/>` : '') +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    (sub ? `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` : '') +
    (opts.forEditing ? `<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>` : '') +
    (comments.length ? `<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>` +
      `<Override PartName="/word/commentsExtended.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.commentsExtended+xml"/>` : '') +
    `</Types>`

  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    (opts.forEditing ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/>` : '') +
    `</Relationships>`

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    (sub ? `<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>` : '') +
    (coverExt ? `<Relationship Id="rIdCover" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/cover.${coverExt}"/>` : '') +
    (comments.length ? `<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>` +
      `<Relationship Id="rIdCommentsEx" Type="http://schemas.microsoft.com/office/2011/relationships/commentsExtended" Target="commentsExtended.xml"/>` : '') +
    `</Relationships>`

  const entries = [
    file('[Content_Types].xml', contentTypes),
    file('_rels/.rels', rels),
    file('word/document.xml', documentXml),
    file('word/styles.xml', docxStyles(sub)),
    file('word/_rels/document.xml.rels', documentRels),
    ...(sub ? [file('word/header1.xml', submissionHeader(sub, title))] : []),
    ...(opts.forEditing ? [file('docProps/custom.xml', editingProperties(opts.forEditing))] : []),
    /*
      The threads, in the shape Word writes them (T5.0's fixture): each comment
      in comments.xml with its paragraph's w14:paraId, and commentsExtended.xml
      linking a reply to its thread's first by w15:paraIdParent, done on every
      one. LibreOffice keeps both (npm run probe:marked).
    */
    ...(comments.length ? [
      file('word/comments.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments ${W_NS} xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">` +
        comments.map((c) => `<w:comment w:id="${c.id}" w:author="${xml(c.author)}" w:date="${xml(c.date)}" w:initials="${xml(c.initials)}">` +
          c.text.split(/\n\s*\n/).map((para, j, all) => `<w:p${j === all.length - 1 ? ` w14:paraId="${c.para}" w14:textId="77777777"` : ''}><w:r><w:t xml:space="preserve">${xml(para)}</w:t></w:r></w:p>`).join('') +
          `</w:comment>`).join('') + `</w:comments>`),
      file('word/commentsExtended.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w15:commentsEx xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml">` +
        comments.map((c) => `<w15:commentEx w15:paraId="${c.para}"${c.parent ? ` w15:paraIdParent="${c.parent}"` : ''} w15:done="${c.done ? 1 : 0}"/>`).join('') + `</w15:commentsEx>`),
    ] : []),
    ...(coverExt && opts.cover ? [{ name: `word/media/cover.${coverExt}`, data: opts.cover.data }] : []),
  ]
  return zipStore(entries)
}

// ── EPUB ──────────────────────────────────────────────────────────────────────

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch { /* fall through */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const EPUB_CSS =
  `body{font-family:Georgia,serif;line-height:1.6;margin:1em}` +
  `h1{text-align:center;margin:2em 0}h2{margin:2em 0 1em;font-size:1.3em}` +
  `p{margin:0 0 1em;text-indent:1.5em}p.first{text-indent:0}p.verse{text-indent:0;margin-left:2em}` +
  `hr.sep{border:0;margin:1.5em 0;text-align:center}hr.sep:after{content:"* * *"}`

function chapterXhtml(style: ChapterHeadingStyle, number: number, title: string, scenesHtml: string, showHeading: boolean): string {
  const head = showHeading ? `<h2>${chapterHeadingLines(style, number, title).map(xml).join('<br/>')}</h2>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/>` +
    `<title>${xml(chapterHeadingLabel(style, number, title))}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>` +
    `<body>${head}${scenesHtml}</body></html>`
}

export function compileEpub(m: BuiltManuscript, opts: BookExportOptions = {}): Uint8Array {
  const chapterTitles = opts.chapterTitles ?? true
  const headingStyle = opts.chapterHeading ?? 'ch-title'
  const onlyWritten = opts.onlyWritten ?? true
  const title = opts.title?.trim() || 'Manuscript'
  const author = opts.author?.trim() || 'Unknown'
  const bookId = `urn:uuid:${uuid()}`
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const coverExt = opts.cover ? coverExtension(opts.cover.mimeType) : null

  const blocks = includedChapters(m, onlyWritten, opts.minStatus)
  const chapterFiles = blocks.map(({ ch, scenes }, idx) => {
    const scenesHtml = scenes
      .map((s) => (s.written ? paragraphBlocks(s.text) : [{ text: '[No prose yet]', verse: false }])
        .map((p, i) => (p.verse
          ? `<p class="verse">${emphasisMarkup(p.text, xml).replace(/\n/g, '<br/>')}</p>`
          : `<p${i === 0 ? ' class="first"' : ''}>${emphasisMarkup(p.text, xml)}</p>`)).join(''))
      .join('<hr class="sep"/>')
    return {
      id: `ch${idx + 1}`,
      href: `ch${idx + 1}.xhtml`,
      label: chapterHeadingLabel(headingStyle, ch.number, ch.title),
      content: chapterXhtml(headingStyle, ch.number, ch.title, scenesHtml, chapterTitles),
    }
  })

  const titleXhtml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><title>${xml(title)}</title>` +
    `<link rel="stylesheet" type="text/css" href="style.css"/></head>` +
    `<body>${coverExt ? `<img src="cover.${coverExt}" alt="${xml(title)} cover" style="display:block;max-width:100%;max-height:70vh;margin:0 auto 2em"/>` : ''}<h1>${xml(title)}</h1><p style="text-align:center" class="first">${xml(author)}</p></body></html>`

  const navItems = chapterFiles.map((c) => `<li><a href="${c.href}">${xml(c.label)}</a></li>`).join('')
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><meta charset="utf-8"/><title>Contents</title></head>` +
    `<body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${navItems}</ol></nav></body></html>`

  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="style.css" media-type="text/css"/>`,
    `<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>`,
    ...(coverExt ? [`<item id="cover" href="cover.${coverExt}" media-type="${opts.cover!.mimeType}" properties="cover-image"/>`] : []),
    ...chapterFiles.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`),
  ].join('')
  const spineItems = [`<itemref idref="title"/>`, ...chapterFiles.map((c) => `<itemref idref="${c.id}"/>`)].join('')

  const opf = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">` +
    `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    `<dc:identifier id="bookid">${xml(bookId)}</dc:identifier>` +
    `<dc:title>${xml(title)}</dc:title><dc:creator>${xml(author)}</dc:creator><dc:language>en</dc:language>` +
    `<meta property="dcterms:modified">${modified}</meta></metadata>` +
    `<manifest>${manifestItems}</manifest><spine>${spineItems}</spine></package>`

  const container = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">` +
    `<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`

  // The mimetype entry MUST come first and be stored uncompressed.
  return zipStore([
    file('mimetype', 'application/epub+zip'),
    file('META-INF/container.xml', container),
    file('OEBPS/style.css', EPUB_CSS),
    file('OEBPS/content.opf', opf),
    file('OEBPS/nav.xhtml', navXhtml),
    file('OEBPS/title.xhtml', titleXhtml),
    ...(opts.cover && coverExt ? [{ name: `OEBPS/cover.${coverExt}`, data: opts.cover.data }] : []),
    ...chapterFiles.map((c) => file(`OEBPS/${c.href}`, c.content)),
  ])
}
