import { readZip } from '@/lib/zip'
import { readComments, type DocComment } from '@/lib/docxRead'
import { parseManuscript, isBareHeading, type ParsedManuscript } from '@/lib/manuscriptImport'

/*
  A writer's own Word draft, read for Import Manuscript (issue #697). Any
  `.docx`, not only one Kathala made: `docxRead.ts` reads Kathala's own files by
  the scene bookmarks it puts in them, and a draft written in Word has none.

  The draft is written out as the lines `manuscriptImport.ts` reads — a
  heading as `#`, a scene's title as `##`, a scene break as `* * *` — so one
  set of rules decides a book's shape, whether it came as Markdown, as text or
  from Word. What Word says that a line cannot is read here first:

  - **Headings by their style's name**, `heading 1`, or outline level, never its
    id: Word writes `Titre1` in French and `Überschrift1` in German, with the
    same name. Without the styles, three of the ten drafts measured came in as
    one chapter (docs/records/docx-import-measure.md).
  - **Parts** (D-3): where the top heading level is all *Part …* or *Book …*,
    the chapters are the level under it, and a part's name is given to its first
    chapter, for its notes.
  - **A title page** (D-4): what stands before the first chapter, where none of
    it is a paragraph of prose. The book's title, from Word's *Title* style or
    its first centred line, is the book's; the rest, and an *END* at the close,
    is left out and listed.
  - **Tracked changes** (D-1) as accepted: what Word shows with *No markup*.
  - **Comments** (D-2): each one's range carried through the parse as marks in
    the text, then taken out, so that each comment is a note on its words in the
    scene it fell in, or on its chapter's heading, or on the title page.
*/

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const dec = new TextDecoder()

/** A part's name, given to the chapter it begins (D-3). */
export interface DraftPart { chapter: number; name: string }

/** A comment of the draft's, on its words: a scene's by offsets in its text, or a line outside every scene. */
export interface DraftComment {
  chapter: number
  scene: number
  /** The words it is on, in the scene's text; for a heading or the title page, the line it is on. */
  from: number
  to: number
  outside?: 'heading' | 'title page'
  quote: string
  comment: DocComment
  replies: DocComment[]
}

export interface DraftDocx {
  manuscript: ParsedManuscript
  parts: DraftPart[]
  comments: DraftComment[]
  /** Tracked changes in the draft, taken as accepted (D-1). */
  tracked: number
  leftOut: {
    /** A title page's lines other than the title, and an END (D-4). */
    lines: string[]
    images: number
    tables: number
    footnotes: number
    endnotes: number
    /** Bold or underlined words, which come in as plain words. */
    formatting: boolean
  }
}

/** A file that is not a Word document, or one that cannot be read. */
export class DraftDocxError extends Error {}

interface StyleInfo { level: number | null; sceneBreak: boolean; italic: boolean }

interface Para {
  /** Its words, with italics as `_…_`, and comment marks. */
  text: string
  level: number | null
  centred: boolean
  pageBreakBefore: boolean
  sceneBreak: boolean
  /** Its mark is deleted, so it joins the paragraph after it (D-1). */
  joinsNext: boolean
}

// A comment's start and end, as marks in the text the parse reads: private-use characters, no letter or digit among them.
const START = '\uE000'
const END = '\uE001'
const markOf = (n: number) => String.fromCharCode(0xE100 + n)
// \u2026and a comment that was on the title page, carried on the first chapter's heading (TITLE_PAGE).
const MARKS = /[\uE000\uE001\uE004][\uE100-\uF8FF]/g
const unmarked = (s: string) => s.replace(MARKS, '')

/** Words that make a top-level heading a part rather than a chapter. */
const PART = /^(?:part|book|volume)\b/i
const CONTACT = /@|\bwords?\b|\d{3}/i

export async function readDraftDocx(bytes: Uint8Array): Promise<DraftDocx> {
  let zip: Map<string, Uint8Array>
  try {
    zip = await readZip(bytes)
  } catch {
    throw new DraftDocxError('This is not a Word document (.docx), or it is damaged.')
  }
  const main = zip.get('word/document.xml')
  if (!main) throw new DraftDocxError('This is not a Word document (.docx): it has no document in it.')
  const parse = (s: string) => new DOMParser().parseFromString(s, 'application/xml')
  const doc = parse(dec.decode(main))
  if (doc.getElementsByTagName('parsererror').length) throw new DraftDocxError('This Word document is damaged: its text cannot be read.')
  const text = (name: string) => { const b = zip.get(name); return b ? dec.decode(b) : null }
  const styles = readStyles(text('word/styles.xml'), parse)
  const allComments = readComments(text('word/comments.xml'), text('word/commentsExtended.xml'), parse)

  const leftOut: DraftDocx['leftOut'] = { lines: [], images: 0, tables: 0, footnotes: 0, endnotes: 0, formatting: false }
  let tracked = 0
  const body = doc.getElementsByTagNameNS(W, 'body')[0]
  if (!body) throw new DraftDocxError('This Word document has no body.')
  // Each comment's number, in the order its range opens; where a range has no start, its reference starts it.
  const commentIndex = new Map<string, number>()
  const indexOf = (id: string) => {
    if (!commentIndex.has(id)) commentIndex.set(id, commentIndex.size)
    return commentIndex.get(id)!
  }

  const paras: Para[] = []
  let breakPending = false
  const visit = (node: Element) => {
    for (const child of [...node.children]) {
      const name = child.localName
      if (name === 'p') {
        const p = readParagraph(child, styles, indexOf, leftOut, () => tracked++)
        p.pageBreakBefore ||= breakPending
        breakPending = p.breakAfter
        paras.push(p)
      } else if (name === 'tbl') leftOut.tables++
      else if (name === 'sdt' || name === 'sdtContent' || name === 'customXml') visit(child)
    }
  }
  visit(body)
  // Deleted paragraph marks, accepted: the paragraph runs on into the next.
  for (let k = paras.length - 2; k >= 0; k--) {
    if (paras[k].joinsNext) { paras[k] = { ...paras[k], text: paras[k].text + paras[k + 1].text, joinsNext: false }; paras.splice(k + 1, 1) }
  }

  /*
    Kathala's own Word export marks each scene with a bookmark, `KathalaScene_`;
    a draft written in Word has none (docs/records/ux-fix-part0.md). Only in a
    file of ours is the heading under a bare "Chapter One" its title (D-2).
  */
  const ours = [...doc.getElementsByTagNameNS(W, 'bookmarkStart')].some((b) => (b.getAttributeNS(W, 'name') ?? b.getAttribute('w:name') ?? '').startsWith('KathalaScene_'))
  const { lines, parts, title, frontLines } = toLines(paras, leftOut, ours)
  const manuscript = parseManuscript(lines.join('\n\n'))
  if (title && !manuscript.title) manuscript.title = title
  leftOut.lines.push(...frontLines)

  // Parts out of the chapters' titles, comments out of everything.
  const partsFound: DraftPart[] = []
  manuscript.chapters.forEach((c, k) => {
    const m = PART_MARK.exec(c.title)
    if (m) { partsFound.push({ chapter: k, name: unmarked(parts[Number(m[1])]) }); c.title = c.title.replace(PART_MARK, '').trim() }
  })
  const comments = placeComments(manuscript, allComments, commentIndex)
  return { manuscript, parts: partsFound, comments, tracked, leftOut }
}

function readStyles(xml: string | null, parse: (s: string) => Document): Map<string, StyleInfo> {
  const out = new Map<string, StyleInfo>()
  if (!xml) return out
  const raw = new Map<string, { name: string; type: string; outline: number | null; italic: boolean; basedOn?: string }>()
  for (const s of [...parse(xml).getElementsByTagNameNS(W, 'style')]) {
    const id = s.getAttributeNS(W, 'styleId') ?? s.getAttribute('w:styleId') ?? ''
    const val = (tag: string) => { const e = s.getElementsByTagNameNS(W, tag)[0]; return e ? e.getAttributeNS(W, 'val') ?? e.getAttribute('w:val') : null }
    const outline = val('outlineLvl')
    const rPr = s.getElementsByTagNameNS(W, 'rPr')[0]
    const i = rPr?.getElementsByTagNameNS(W, 'i')[0]
    raw.set(id, {
      name: (val('name') ?? id).toLowerCase(), type: s.getAttributeNS(W, 'type') ?? s.getAttribute('w:type') ?? 'paragraph',
      outline: outline === null ? null : Number(outline), italic: !!i && !['0', 'false'].includes(i.getAttributeNS(W, 'val') ?? ''),
      basedOn: val('basedOn') ?? undefined,
    })
  }
  const resolve = (id: string, seen = new Set<string>()): StyleInfo => {
    const s = raw.get(id)
    if (!s || seen.has(id)) return { level: null, sceneBreak: false, italic: false }
    seen.add(id)
    const base = s.basedOn ? resolve(s.basedOn, seen) : { level: null, sceneBreak: false, italic: false }
    const heading = /^heading (\d)$/.exec(s.name)
    const level = s.name === 'title' ? 0 : heading ? Number(heading[1]) : s.outline !== null && s.outline < 9 ? s.outline + 1 : base.level
    return { level, sceneBreak: /scene ?break/.test(s.name) || base.sceneBreak, italic: s.italic || base.italic }
  }
  for (const id of raw.keys()) out.set(id, resolve(id))
  return out
}

const off = (el: Element | undefined) => !!el && ['0', 'false'].includes(el.getAttributeNS(W, 'val') ?? el.getAttribute('w:val') ?? '')

function readParagraph(
  p: Element, styles: Map<string, StyleInfo>, indexOf: (id: string) => number,
  leftOut: DraftDocx['leftOut'], change: () => void,
): Para & { breakAfter: boolean } {
  const pPr = [...p.children].find((c) => c.localName === 'pPr')
  const kid = (el: Element | undefined, name: string) => el ? [...el.children].find((c) => c.localName === name) : undefined
  const styleId = kid(pPr, 'pStyle')?.getAttributeNS(W, 'val') ?? ''
  const style = styles.get(styleId)
  const ownOutline = kid(pPr, 'outlineLvl')?.getAttributeNS(W, 'val')
  const level = ownOutline != null && Number(ownOutline) < 9 ? Number(ownOutline) + 1 : style?.level ?? null
  const markChange = kid(kid(pPr, 'rPr'), 'del') ?? kid(kid(pPr, 'rPr'), 'moveFrom')
  if (markChange || kid(kid(pPr, 'rPr'), 'ins') || kid(kid(pPr, 'rPr'), 'moveTo')) change()

  const segs: Array<{ text: string; italic: boolean }> = []
  let pageBefore = !!kid(pPr, 'pageBreakBefore') && !off(kid(pPr, 'pageBreakBefore'))
  let pageAfter = false
  // Field codes: an instruction (begin to separate) is not the text; its result (separate to end) is.
  const fields: Array<'instruction' | 'result'> = []
  const put = (t: string, italic: boolean) => {
    if (!t) return
    const last = segs[segs.length - 1]
    if (last && last.italic === italic) last.text += t
    else segs.push({ text: t, italic })
  }
  const walk = (node: Element, gone: boolean) => {
    for (const c of [...node.children]) {
      const n = c.localName
      if (n === 'pPr' || n === 'rPr') continue
      if (n === 'del' || n === 'moveFrom') { change(); walk(c, true); continue }
      if (n === 'ins' || n === 'moveTo') { change(); walk(c, gone); continue }
      if (n === 'commentRangeStart') { put(START + markOf(indexOf(c.getAttributeNS(W, 'id') ?? '')), false); continue }
      if (n === 'commentRangeEnd') { put(END + markOf(indexOf(c.getAttributeNS(W, 'id') ?? '')), false); continue }
      if (n === 'r') { if (!gone) readRun(c); continue }
      if (['hyperlink', 'smartTag', 'sdt', 'sdtContent', 'fldSimple', 'customXml', 'bdo', 'dir'].includes(n)) walk(c, gone)
    }
  }
  const readRun = (r: Element) => {
    const rPr = [...r.children].find((c) => c.localName === 'rPr')
    const i = kid(rPr, 'i')
    const rStyle = kid(rPr, 'rStyle')?.getAttributeNS(W, 'val')
    const italic = i ? !off(i) : !!(rStyle && styles.get(rStyle)?.italic)
    if ((kid(rPr, 'b') && !off(kid(rPr, 'b'))) || (kid(rPr, 'u') && kid(rPr, 'u')!.getAttributeNS(W, 'val') !== 'none')) leftOut.formatting = true
    for (const c of [...r.children]) {
      const n = c.localName
      if (n === 'fldChar') {
        const t = c.getAttributeNS(W, 'fldCharType')
        if (t === 'begin') fields.push('instruction')
        else if (t === 'separate' && fields.length) fields[fields.length - 1] = 'result'
        else if (t === 'end') fields.pop()
        continue
      }
      if (n === 'instrText' || fields.includes('instruction')) continue
      if (n === 't') put(c.textContent ?? '', italic)
      else if (n === 'tab') put(segs.length ? ' ' : '', italic)
      else if (n === 'br' || n === 'cr') {
        if (c.getAttributeNS(W, 'type') === 'page') { if (segs.some((s) => unmarked(s.text).trim())) pageAfter = true; else pageBefore = true }
        else if (c.getAttributeNS(W, 'type') !== 'column') put('\n', italic)
      } else if (n === 'noBreakHyphen') put('-', italic)
      else if (n === 'drawing' || n === 'pict' || n === 'object') leftOut.images++
      else if (n === 'footnoteReference') leftOut.footnotes++
      else if (n === 'endnoteReference') leftOut.endnotes++
      else if (n === 'commentReference') {
        // A comment with no range is at the point it is referred to (as docxRead reads it, T9.1).
        const k = indexOf(c.getAttributeNS(W, 'id') ?? '')
        put(START + markOf(k) + END + markOf(k), false)
      }
    }
  }
  walk(p, false)

  // Italics as the book writes them, the spaces at their edges left outside the marks.
  const words = segs.map(({ text, italic }) => {
    if (!italic || !unmarked(text).trim()) return text
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!
    return `${m[1]}_${m[2]}_${m[3]}`
  }).join('')
  const jc = kid(pPr, 'jc')?.getAttributeNS(W, 'val')
  return {
    text: words.replace(/[ \t]+\n/g, '\n'),
    level,
    centred: jc === 'center',
    pageBreakBefore: pageBefore,
    sceneBreak: !!style?.sceneBreak,
    joinsNext: !!markChange,
    breakAfter: pageAfter,
  }
}

// A part's name, carried on its first chapter's heading line through the parse.
const PART_OPEN = '\uE002'
const PART_CLOSE = '\uE003'
const PART_MARK = new RegExp(`${PART_OPEN}(\\d+)${PART_CLOSE}`)

/**
 * The draft as lines for `parseManuscript`, its title page taken out (D-4)
 * and its parts carried on the chapters they begin (D-3).
 */
function toLines(paras: Para[], leftOut: DraftDocx['leftOut'], ours = false): { lines: string[]; parts: string[]; title: string | null; frontLines: string[] } {
  const plain = (p: Para) => unmarked(p.text).replace(/_/g, '').trim()
  const isEmpty = (p: Para) => !plain(p)
  // An END at the close is the manuscript's, not the book's.
  const last = paras.map((p, k) => (isEmpty(p) ? -1 : k)).filter((k) => k >= 0).pop()
  if (last !== undefined && /^end\.?$/i.test(plain(paras[last]))) { leftOut.lines.push(plain(paras[last])); paras = paras.filter((_, k) => k !== last) }

  // Which heading level holds the chapters: the top one, or the one under it where the top is all parts.
  const levels = [...new Set(paras.filter((p) => p.level !== null && p.level > 0 && !isEmpty(p)).map((p) => p.level!))].sort((a, b) => a - b)
  const top = levels[0]
  const topAllParts = top !== undefined && levels.length > 1 && paras.filter((p) => p.level === top && !isEmpty(p)).every((p) => PART.test(plain(p)))
  const partLevel = topAllParts ? top : undefined
  const chapterLevel = topAllParts ? levels[1] : top
  const sceneLevel = levels[levels.indexOf(chapterLevel) + 1]
  const styledChapters = chapterLevel !== undefined
  /** A chapter's start, where the draft has no heading styles: a heading-like line, or a short line after a page break. */
  const unstyledChapter = (p: Para) => !styledChapters && (isBareHeading(plain(p)) || (p.pageBreakBefore && plain(p).length <= 80 && !/[.,;:!?]$/.test(plain(p)) && !/\n/.test(plain(p))))
  const starts = (p: Para) => (p.level !== null && (p.level === chapterLevel || p.level === partLevel)) || unstyledChapter(p)

  // The title page: what stands before the first chapter, if none of it is a paragraph of prose.
  const first = paras.findIndex((p) => !isEmpty(p) && starts(p))
  const front = first > 0 ? paras.slice(0, first).filter((p) => !isEmpty(p)) : []
  // A paragraph of prose: long, or two sentences, or one sentence of two words or more. A title page's lines end on no
  // stop ("About 9,000 words", "12 Any Street"); a short opening of the book's own, "She walked.", was taken for one.
  const prose = (p: Para) => plain(p).length > 100 || /[.!?]["”’)]?\s+\S/.test(plain(p)) || /\S\s+\S.*[.!?…]["”’)]?$/.test(plain(p))
  let title: string | null = null
  const frontLines: string[] = []
  let body = paras
  if (front.length && !front.some((p) => p.level === null && prose(p))) {
    const titled = front.find((p) => p.level === 0) ?? front.find((p) => p.centred && !/^by\s/i.test(plain(p)) && !CONTACT.test(plain(p)))
    title = titled ? plain(titled) : null
    for (const p of front) if (p !== titled) frontLines.push(plain(p))
    // A comment on the title page stays with the first chapter's first line, said to be the title page's.
    const marks = front.map((p) => [...p.text.matchAll(MARKS)].filter((m) => m[0][0] === START).map((m) => TITLE_PAGE + m[0][1]).join('')).join('')
    body = paras.slice(first)
    if (marks) body = [{ ...body[0], text: body[0].text + marks }, ...body.slice(1)]
  } else {
    const titled = paras.slice(0, first < 0 ? paras.length : first).find((p) => p.level === 0)
    if (titled) { title = plain(titled); body = paras.filter((p) => p !== titled) }
  }

  /*
    Empty paragraphs between paragraphs, as the draft usually leaves them
    (none, or one where a writer spaces paragraphs with Enter): more than that
    is a scene break. Counted over every pair of paragraphs, those with nothing
    between them too: counted over the gaps alone, a draft whose only empty
    paragraphs were its breaks took two as the usual, and found no break.
  */
  const gaps: number[] = []
  let run = 0
  let seenText = false
  for (const p of body) { if (isEmpty(p)) run++; else { if (seenText) gaps.push(run); seenText = true; run = 0 } }
  const breakAt = (mode(gaps) ?? 0) + 1

  const lines: string[] = []
  const parts: string[] = []
  let pendingPart: number | null = null
  // A comment on a line that is not prose (a scene break, a part's heading, an empty paragraph) goes on with the next line that is.
  let carried = ''
  let blanks = 0
  const skip = new Set<Para>()
  for (const p of body) {
    if (skip.has(p)) continue
    if (isEmpty(p) && !p.sceneBreak) { carried += p.text.match(MARKS)?.join('') ?? ''; blanks++; continue }
    if (blanks >= breakAt && lines.length) lines.push('* * *')
    blanks = 0
    const own = p.text.trim()
    if (p.sceneBreak || isSeparatorLine(unmarked(own))) { carried += own.match(MARKS)?.join('') ?? ''; lines.push('* * *'); continue }
    if (partLevel !== undefined && p.level === partLevel) { carried += own.match(MARKS)?.join('') ?? ''; parts.push(unmarked(own)); pendingPart = parts.length - 1; continue }
    const t = carried + own
    carried = ''
    // A heading's comment marks after its words: a mark before "Chapter 1: The Road" kept it from reading as a chapter's number and title.
    const asHeading = `${unmarked(t).replace(/\n/g, ' ')}${t.match(MARKS)?.join('') ?? ''}`
    const partMark = pendingPart !== null ? `${PART_OPEN}${pendingPart}${PART_CLOSE}` : ''
    if (p.level !== null && p.level === chapterLevel) {
      /*
        "Chapter One" with its title as the heading under it, "Short Weight", as
        Kathala's own Word export writes them: the second is the chapter's title,
        not a scene's. The next paragraph, where it is that heading — in a file
        Kathala wrote. In a draft written in Word the heading under "Chapter
        One" is its first scene's: "The Wreck" became the chapter's title, and
        the scene was left "Scene 1" (UX-1-9, D-2).
      */
      const next = body[body.indexOf(p) + 1]
      const subtitle = ours && next && next.level === sceneLevel && isBareHeading(plain(p)) && !/[:.\-–—]\s*\S/.test(plain(p).replace(/^\S+\s+\S+/, '')) ? next : null
      lines.push(`# ${unmarked(t).replace(/\n/g, ' ')}${subtitle ? `: ${unmarked(subtitle.text).trim().replace(/\n/g, ' ')}` : ''}${t.match(MARKS)?.join('') ?? ''}${subtitle?.text.match(MARKS)?.join('') ?? ''}${partMark}`)
      if (subtitle) skip.add(subtitle)
      pendingPart = null
      continue
    }
    if (unstyledChapter(p)) {
      // A line the parse reads as a chapter itself, it is given as it is, so that one straight after another ("CHAPTER ONE", "PROLOGUE") joins it (D-5).
      lines.push(isBareHeading(plain(p)) && !partMark ? t : `# ${asHeading}${partMark}`)
      pendingPart = null
      continue
    }
    if (p.level !== null && p.level === sceneLevel) { lines.push(`## ${asHeading}`); continue }
    lines.push(t)
  }
  if (carried && lines.length) lines[lines.length - 1] += carried
  return { lines, parts, title, frontLines }
}

/** Marks a comment that was on the title page, carried on the first chapter's heading. */
const TITLE_PAGE = '\uE004'

function isSeparatorLine(t: string): boolean {
  return !!t && !/[\p{L}\p{N}]/u.test(t) && /^[\s*#•·⁂—–\-~✦✧.=_]+$/.test(t)
}

function mode(xs: number[]): number | null {
  if (!xs.length) return null
  const n = new Map<number, number>()
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1)
  return [...n].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
}

/**
 * The comments, each on its words: its marks found in the parsed scenes, its
 * chapters' titles or the title page, then taken out of the text. One whose
 * range runs out of its scene ends where the scene does. Replies go with the
 * comment they answer.
 */
function placeComments(m: ParsedManuscript, all: DocComment[], index: Map<string, number>): DraftComment[] {
  const byIndex = new Map<number, DocComment>()
  for (const [id, k] of index) { const c = all.find((x) => x.id === id); if (c) byIndex.set(k, c) }
  const out: DraftComment[] = []
  const found = new Set<number>()
  const repliesOf = (c: DocComment) => all.filter((x) => x.parentId === c.id)

  m.chapters.forEach((ch, ci) => {
    // On the title page, or on the chapter's heading: the line, and the chapter's first scene.
    const titleMarks = [...ch.title.matchAll(MARKS)].map((x) => x[0])
    ch.title = unmarked(ch.title).trim()
    const seen = new Set<number>()
    for (const mark of titleMarks) {
      if (mark[0] === END) continue
      const n = mark.charCodeAt(1) - 0xE100
      const c = byIndex.get(n)
      if (!c || c.parentId || seen.has(n)) continue
      seen.add(n)
      found.add(n)
      const outside = mark[0] === TITLE_PAGE ? 'title page' as const : 'heading' as const
      // A bare "Chapter 3" leaves no title: the line is said by its number.
      const heading = ch.title || `Chapter ${ci + 1}`
      out.push({ chapter: ci, scene: 0, from: 0, to: 0, outside, quote: outside === 'heading' ? heading : m.title ?? '', comment: c, replies: repliesOf(c) })
    }
    ch.scenes.forEach((s, si) => {
      if (s.title) s.title = unmarked(s.title).trim()
      // The first start of each comment, and every end: a comment's reference comes after its range, and makes a point of its own.
      const starts = new Map<number, number>()
      const ends = new Map<number, number[]>()
      let clean = ''
      for (let k = 0; k < s.text.length; k++) {
        const ch2 = s.text[k]
        if ((ch2 === START || ch2 === END) && k + 1 < s.text.length) {
          const n = s.text.charCodeAt(k + 1) - 0xE100
          if (n >= 0 && n < 0x1800) {
            if (ch2 === START) { if (!starts.has(n)) starts.set(n, clean.length) } else ends.set(n, [...(ends.get(n) ?? []), clean.length])
            k++
            continue
          }
        }
        clean += ch2
      }
      s.text = clean
      for (const [n, from] of starts) {
        const c = byIndex.get(n)
        if (!c || c.parentId || found.has(n)) continue
        found.add(n)
        const to = (ends.get(n) ?? []).find((e) => e >= from) ?? clean.length
        out.push({ chapter: ci, scene: si, from, to: Math.max(from, to), quote: clean.slice(from, Math.max(from, to)), comment: c, replies: repliesOf(c) })
      }
    })
  })
  if (m.title) m.title = unmarked(m.title).trim()
  return out
}
