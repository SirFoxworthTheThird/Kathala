import { readZip } from '@/lib/zip'
import { SCENE_BOOKMARK } from '@/lib/manuscriptExport'

/*
  An edited Word file, read (editorial-plan.md, R4): its paragraphs, each with
  the scene bookmark it falls under, its style, and its text in pieces —
  unchanged, inserted or deleted (a tracked change), with where each comment
  starts and ends — and the comments themselves.

  Read with the browser's own `DOMParser` and `readZip`: no dependency.

  What the files do, as LibreOffice was seen to write them
  (`fixtures/docx/edited-libreoffice.docx`) and as the OOXML standard has Word
  write them:
  - A scene's bookmark may lose its end, and turn up again under the same name
    on a later paragraph. So a bookmark is read as where a scene *starts*, and
    a scene runs until another scene's bookmark, or a paragraph that is not
    prose (a heading, a scene break).
  - Text is split across runs at every change of formatting or revision, so
    runs are joined; a run in italics is `_like this_`, the book's own markup,
    as the export wrote it.
  - A moved paragraph is a deletion where it was (`w:moveFrom`) and an
    insertion where it went (`w:moveTo`), each marked moved, so that the two
    can be made one change (round-trip-plan.md, T1.2). LibreOffice writes no
    name to pair them by (`w:moveFromRangeStart`): they are paired by their
    words (`docxImport.ts`).
  - A tracked change to formatting alone (`w:rPrChange`, `w:pPrChange`) is
    not a change to the words, and is read as the text it formats.
  - A paragraph's mark — the break that ends it — is tracked on its own, in
    the paragraph's properties (`w:pPr/w:rPr/w:ins`, or `w:del`). An inserted
    mark is a paragraph split: before the change, this paragraph and the next
    were one. A deleted mark is two paragraphs joined. A writer run's editor
    split three paragraphs this way, and with the mark unread each split came
    in as a tracked change to the space beside it and, found against the
    draft, an "untracked" new paragraph: taking the first alone ran two
    sentences together (round-trip-plan.md, T1.1).
*/

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

export type Piece =
  | { kind: 'same' | 'ins' | 'del'; text: string; italic: boolean; author?: string; moved?: true }
  | { kind: 'commentStart' | 'commentEnd'; id: string }

export interface DocParagraph {
  /** The scene bookmark it falls under, by its number; null outside any. */
  scene: number | null
  style: string
  pieces: Piece[]
  /** Its mark, where that is a tracked change: inserted (a split after it) or deleted (joined to the next), moved where it moved with its paragraph. */
  mark?: { kind: 'ins' | 'del'; author?: string; moved?: true }
}

export interface DocComment {
  id: string
  author: string
  text: string
  /** The comment this one answers (Word's replies), where it is one. */
  parentId?: string
  /** Marked done (resolved), where the file says so; no flag is open, as LibreOffice writes it (round-trip-plan-2.md, T5.0). */
  done?: true
}

export interface EditedDocx {
  /** The draft and book the file was made from, where it says (`EditingMarks`). */
  draftId: string | null
  worldId: string | null
  /**
   * For a file the writer sent back marked (round-trip-plan-2.md, T5.3): whose
   * tracked changes are the writer's, by name, and the draft they were measured
   * against — the book as the editor had sent it back. Null otherwise.
   */
  markedBy?: string | null
  markedAgainst?: string | null
  paragraphs: DocParagraph[]
  comments: DocComment[]
}

/** Styles whose paragraphs are the export's own, not the book's prose. */
const NOT_PROSE = new Set(['Title', 'Byline', 'Heading1', 'Heading2', 'SceneBreak', 'Contact'])

/**
 * Whether a paragraph is the book's prose, not the export's own. By its style,
 * and, whatever its style, not a paragraph that is nothing but a submission's
 * scene break or its END: LibreOffice saved a `#` as Normal, with no record of
 * the change, when the paragraph before it was cut (editor run 2026-11-09,
 * E-3), and as prose it would have come in as a `#` added to a scene
 * (round-trip-plan.md, T1.5).
 */
export function isProse(p: DocParagraph): boolean {
  if (NOT_PROSE.has(p.style)) return false
  const text = p.pieces.map((x) => ('text' in x ? x.text : '')).join('').trim()
  return text !== '#' && text !== 'END'
}

const dec = new TextDecoder()

export async function readEditedDocx(bytes: Uint8Array): Promise<EditedDocx> {
  let zip: Map<string, Uint8Array>
  try { zip = await readZip(bytes) } catch { throw new Error('This is not a Word file (.docx).') }
  const part = (name: string) => { const b = zip.get(name); return b ? dec.decode(b) : null }
  const documentXml = part('word/document.xml')
  if (!documentXml) throw new Error('This is not a Word file (.docx): it has no document.')
  const parse = (s: string) => new DOMParser().parseFromString(s, 'application/xml')

  const props = part('docProps/custom.xml')
  const propOf = (name: string) => {
    if (!props) return null
    const el = [...parse(props).getElementsByTagName('*')].find((e) => e.localName === 'property' && e.getAttribute('name') === name)
    return el?.textContent?.trim() || null
  }

  return {
    draftId: propOf('KathalaDraft'),
    worldId: propOf('KathalaWorld'),
    markedBy: propOf('KathalaMarkedBy'),
    markedAgainst: propOf('KathalaMarkedAgainst'),
    paragraphs: readParagraphs(parse(documentXml)),
    comments: readComments(part('word/comments.xml'), part('word/commentsExtended.xml'), parse),
  }
}

function readParagraphs(doc: Document): DocParagraph[] {
  const body = doc.getElementsByTagNameNS(W, 'body')[0]
  if (!body) return []
  const out: DocParagraph[] = []
  let scene: number | null = null
  // Each place a comment is referred to: the paragraph's pieces, and where in them.
  const references: Array<{ pieces: Piece[]; at: number; id: string }> = []
  const startScene = (el: Element) => {
    const m = SCENE_BOOKMARK.exec(attr(el, 'name') ?? '')
    if (m) scene = Number(m[1])
  }

  const paragraph = (p: Element) => {
    const pPr = [...p.children].find((c) => c.localName === 'pPr')
    const styleEl = pPr && [...pPr.children].find((c) => c.localName === 'pStyle')
    const style = (styleEl && attr(styleEl, 'val')) || 'Normal'
    // The mark's own revision, in the paragraph's run properties; a moved paragraph's mark moves with it.
    const markPr = pPr && [...pPr.children].find((c) => c.localName === 'rPr')
    const markChange = markPr && [...markPr.children].find((c) => ['ins', 'del', 'moveTo', 'moveFrom'].includes(c.localName))
    const mark = markChange
      ? {
          kind: (markChange.localName === 'ins' || markChange.localName === 'moveTo' ? 'ins' : 'del') as 'ins' | 'del',
          ...(attr(markChange, 'author') ? { author: attr(markChange, 'author') } : {}),
          ...(markChange.localName.startsWith('move') ? { moved: true as const } : {}),
        }
      : undefined
    const pieces: Piece[] = []
    const walk = (node: Element, kind: 'same' | 'ins' | 'del', author?: string, moved = false) => {
      for (const child of node.children) {
        const name = child.localName
        if (name === 'bookmarkStart') startScene(child)
        else if (name === 'ins' || name === 'moveTo') walk(child, 'ins', attr(child, 'author'), name === 'moveTo')
        else if (name === 'del' || name === 'moveFrom') walk(child, 'del', attr(child, 'author'), name === 'moveFrom')
        else if (name === 'commentRangeStart' || name === 'commentRangeEnd') {
          pieces.push({ kind: name === 'commentRangeStart' ? 'commentStart' : 'commentEnd', id: attr(child, 'id') ?? '' })
        } else if (name === 'r') {
          const rPr = [...child.children].find((c) => c.localName === 'rPr')
          const off = (c: Element) => ['0', 'false'].includes(attr(c, 'val') ?? '')
          const italic = !!rPr && [...rPr.children].some((c) => c.localName === 'i' && !off(c))
          let text = ''
          for (const t of child.children) {
            if (t.localName === 't' || t.localName === 'delText') text += t.textContent ?? ''
            else if (t.localName === 'tab') text += '\t'
            else if (t.localName === 'br' || t.localName === 'cr') text += '\n'
            // Where a comment is referred to: all that says where it is, if it has no range (below).
            else if (t.localName === 'commentReference') references.push({ pieces, at: pieces.length, id: attr(t, 'id') ?? '' })
          }
          if (text) pieces.push({ kind, text, italic, ...(author ? { author } : {}), ...(moved ? { moved: true as const } : {}) })
        } else if (['hyperlink', 'smartTag', 'sdt', 'sdtContent', 'fldSimple', 'customXml'].includes(name)) {
          walk(child, kind, author, moved)
        }
        // pPr, proofErr, and changes to formatting alone say nothing about the words.
      }
    }
    walk(p, 'same')
    const read: DocParagraph = { scene, style, pieces, ...(mark ? { mark } : {}) }
    out.push(read)
    // A scene does not run on past the export's own paragraphs: a heading or a scene break ends it.
    if (!isProse(read)) scene = null
  }

  /*
    The body in document order: a bookmark may stand between paragraphs as
    well as in one, and a table's cells hold paragraphs. Comments and text
    boxes are not the body's prose.
  */
  const visit = (node: Element) => {
    for (const child of node.children) {
      if (child.localName === 'p') paragraph(child)
      else if (child.localName === 'bookmarkStart') startScene(child)
      else if (!['txbxContent', 'sectPr'].includes(child.localName)) visit(child)
    }
  }
  visit(body)
  /*
    A comment with no range is a comment at the point it is referred to
    (round-trip-plan-3.md, T9.1). Word gives every comment a range. LibreOffice
    does not: one made with nothing selected is saved as a reference alone, and
    so is one it reads on no words — the thread the marked export puts at a
    scene's start, where its words were rewritten. Read by its range only, such
    a comment was never read: 5 threads of the second loop's round 2 and 10 of
    round 3, and any comment an editor made in LibreOffice without selecting.
    Last first, so that each place still holds.
  */
  const ranged = new Set(out.flatMap((p) => p.pieces.flatMap((x) => (x.kind === 'commentStart' ? [x.id] : []))))
  for (const r of [...references].reverse()) {
    if (!r.id || ranged.has(r.id)) continue
    r.pieces.splice(r.at, 0, { kind: 'commentStart', id: r.id }, { kind: 'commentEnd', id: r.id })
  }
  return out
}

function attr(el: Element, name: string): string | undefined {
  return el.getAttributeNS(W, name) ?? el.getAttribute(`w:${name}`) ?? undefined
}

function readComments(xml: string | null, extended: string | null, parse: (s: string) => Document): DocComment[] {
  if (!xml) return []
  const doc = parse(xml)
  // Word's replies: commentsExtended links a comment's last paragraph (its paraId) to its parent's.
  const parentOfPara = new Map<string, string>()
  const donePara = new Set<string>()
  if (extended) {
    for (const ex of parse(extended).getElementsByTagName('*')) {
      if (ex.localName !== 'commentEx') continue
      const para = ex.getAttribute('w15:paraId')
      const parent = ex.getAttribute('w15:paraIdParent')
      if (para && parent) parentOfPara.set(para, parent)
      if (para && ex.getAttribute('w15:done') === '1') donePara.add(para)
    }
  }
  const comments = [...doc.getElementsByTagNameNS(W, 'comment')]
  const idOfPara = new Map<string, string>()
  for (const c of comments) {
    const paras = c.getElementsByTagNameNS(W, 'p')
    const last = paras[paras.length - 1]
    const para = last?.getAttribute('w14:paraId')
    if (para) idOfPara.set(para, attr(c, 'id') ?? '')
  }
  return comments.map((c) => {
    const paras = [...c.getElementsByTagNameNS(W, 'p')]
    const text = paras.map((p) => [...p.getElementsByTagNameNS(W, 't')].map((t) => t.textContent ?? '').join('')).join('\n').trim()
    const lastPara = paras[paras.length - 1]?.getAttribute('w14:paraId')
    const parentPara = lastPara ? parentOfPara.get(lastPara) : undefined
    const parentId = parentPara ? idOfPara.get(parentPara) : undefined
    return { id: attr(c, 'id') ?? '', author: attr(c, 'author') ?? '', text, ...(parentId ? { parentId } : {}), ...(lastPara && donePara.has(lastPara) ? { done: true as const } : {}) }
  })
}
