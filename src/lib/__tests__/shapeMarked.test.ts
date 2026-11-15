import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { bookShape, markedPlan, shapeSaid, type ShapeCount } from '@/lib/markedDocx'
import { compileDocx } from '@/lib/manuscriptExport'
import { readEditedDocx, isProse, takenOutWhole, type DocParagraph } from '@/lib/docxRead'
import { docScenes, withChangesMade } from '@/lib/docxEdits'
import { rendered } from '@/lib/docxImport'
import type { DraftBook } from '@/lib/bookDraft'

/*
  The book's shape marked (round-trip-plan-4.md, T15; loop-2026-11-14.md,
  finding 2). The third loop's writer put in a chapter, its title and a scene
  break, and the marked file carried no mark for any of them: rejecting every
  change left Chapter Seven in place. "Chapter Seven appears as if it had
  always been there" (the editor's F-2).
*/

const A = 'The ninth bell had already gone when she climbed the back stair of the Customs House.'
const B = 'Somewhere below, a door was shut with more care than a door needs.'
const C = 'Low water was at a quarter past, and the whole city knew it.'
type Ch = { id: string; number: number; title: string; scenes: Array<{ id: string; title: string; text: string }> }
const book = (chapters: Ch[]): DraftBook => ({ version: 1, chapters: chapters.map((c) => ({ ...c, timelineId: 't' })) })
const listed = (b: DraftBook) => b.chapters.flatMap((c) => c.scenes.map((s) => ({ eventId: s.id, text: s.text, chapterId: c.id })))
const plain = (t: string) => rendered(t).replace(/[*_]/g, '')

/** The marked file of `now` against `base`, as the dialog makes it, and read back by the app. */
async function marked(base: DraftBook, now: DraftBook) {
  const plan = markedPlan({ sentBack: { id: 'B' }, base, scenes: listed(now), chapters: now.chapters, notes: [], author: 'Elin Ashgrove', now: 0 })
  const scenes = now.chapters.flatMap((c) => c.scenes)
  const index = new Map(scenes.map((s, i) => [s.id, i]))
  const bytes = compileDocx({
    totalWords: 0, totalScenes: scenes.length, writtenScenes: scenes.length,
    chapters: now.chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: c.scenes.length,
      scenes: c.scenes.map((s) => ({ eventId: s.id, title: s.title, text: s.text, wordCount: 0, written: true, status: 'draft' as const })) })),
  }, { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: (id) => index.get(id), marked: plan.marked } })
  const doc = await readEditedDocx(bytes)
  /** The export's own lines, each with its mark and how its words are: '+' put in, '-' taken out, '=' as they were. */
  const lines = doc.paragraphs.filter((p) => !isProse(p) && p.style !== 'Title').map((p) => `${p.style}${p.mark ? `(${p.mark.kind})` : ''} ${p.pieces.map((x) => ('text' in x ? `${x.kind === 'ins' ? '+' : x.kind === 'del' ? '-' : '='}${x.text}` : '')).join('')}`)
  return { plan, doc, lines, scenes: docScenes(doc) }
}

describe('the book’s shape against the editor’s file (T15)', () => {
  const ninth: Ch = { id: 'c1', number: 1, title: 'The Ninth Bell', scenes: [{ id: 'e1', title: 'One', text: A }] }

  it('a new chapter: its heading put in, and the scene break it took the place of taken out', async () => {
    const base = book([{ ...ninth, scenes: [{ id: 'e1', title: 'One', text: A }, { id: 'e2', title: 'Two', text: C }] }])
    const now = book([ninth, { id: 'cN', number: 2, title: 'The Hearing', scenes: [{ id: 'e2', title: 'Two', text: C }] }])
    const { lines, plan } = await marked(base, now)
    expect(lines).toEqual(['Heading1 =Ch. 1 — The Ninth Bell', 'SceneBreak(del) -* * *', 'Heading1(ins) +Ch. 2 — The Hearing'])
    expect(plan.shape).toEqual<ShapeCount>({ chaptersIn: 1, chaptersOut: 0, breaksIn: 0, breaksOut: 1, headings: 0 })
  })

  it('a chapter taken out, its scenes run on in the one before: its heading taken out, a scene break put in', async () => {
    const base = book([ninth, { id: 'c2', number: 2, title: 'Low Water', scenes: [{ id: 'e2', title: 'Two', text: C }] }])
    const now = book([{ ...ninth, scenes: [{ id: 'e1', title: 'One', text: A }, { id: 'e2', title: 'Two', text: C }] }])
    const { lines, plan } = await marked(base, now)
    expect(lines).toEqual(['Heading1 =Ch. 1 — The Ninth Bell', 'Heading1(del) -Ch. 2 — Low Water', 'SceneBreak(ins) +* * *'])
    expect(plan.shape).toEqual<ShapeCount>({ chaptersIn: 0, chaptersOut: 1, breaksIn: 1, breaksOut: 0, headings: 0 })
  })

  it('a chapter renamed: its heading marked within the line, its words struck and put in', async () => {
    const base = book([ninth, { id: 'c2', number: 2, title: 'Low Water', scenes: [{ id: 'e2', title: 'Two', text: C }] }])
    const now = book([ninth, { id: 'c2', number: 2, title: 'High Water', scenes: [{ id: 'e2', title: 'Two', text: C }] }])
    const { lines, plan } = await marked(base, now)
    expect(lines).toEqual(['Heading1 =Ch. 1 — The Ninth Bell', 'Heading1 -Ch. 2 — Low Water+Ch. 2 — High Water'])
    expect(plan.shape).toEqual<ShapeCount>({ chaptersIn: 0, chaptersOut: 0, breaksIn: 0, breaksOut: 0, headings: 1 })
  })

  it('a split: the scene break between its halves put in; nothing else of the shape', async () => {
    const base = book([{ ...ninth, scenes: [{ id: 'e1', title: 'One', text: [A, B, C].join('\n\n') }] }])
    const now = book([{ ...ninth, scenes: [{ id: 'e1', title: 'One', text: A }, { id: 'e2', title: 'Two', text: [B, C].join('\n\n') }] }])
    const { lines, plan } = await marked(base, now)
    expect(lines).toEqual(['Heading1 =Ch. 1 — The Ninth Bell', 'SceneBreak(ins) +* * *'])
    expect(plan.shape).toEqual<ShapeCount>({ chaptersIn: 0, chaptersOut: 0, breaksIn: 1, breaksOut: 0, headings: 0 })
  })

  it('a join: the break between the two taken out, as Word marks a paragraph cut after another; read back, one scene of three paragraphs', async () => {
    const base = book([{ ...ninth, scenes: [{ id: 'e1', title: 'One', text: [A, B].join('\n\n') }, { id: 'e2', title: 'Two', text: C }] }])
    const now = book([{ ...ninth, scenes: [{ id: 'e1', title: 'One', text: [A, B, C].join('\n\n') }] }])
    const { lines, plan, doc, scenes } = await marked(base, now)
    // The line's words taken out, its own mark kept; the paragraph before it ends in the break taken out.
    expect(lines).toEqual(['Heading1 =Ch. 1 — The Ninth Bell', 'SceneBreak -* * *'])
    const k = doc.paragraphs.findIndex((p) => p.style === 'SceneBreak')
    expect(doc.paragraphs[k - 1].mark?.kind).toBe('del')
    expect(takenOutWhole(doc.paragraphs[k], doc.paragraphs[k - 1])).toBe(true)
    expect(scenes.map((s) => [plain(s.original), plain(s.edited)])).toEqual([[[A, B, C].join('\n\n'), [A, B, C].join('\n\n')]])
    // With the writer's changes made, as bringing the file in reads it: the book.
    expect(docScenes(withChangesMade(doc, 'Elin Ashgrove')).map((s) => plain(s.original))).toEqual([[A, B, C].join('\n\n')])
    expect(plan.shape).toEqual<ShapeCount>({ chaptersIn: 0, chaptersOut: 0, breaksIn: 0, breaksOut: 1, headings: 0 })
  })

  it('a book as it was: no line marked, and nothing said', async () => {
    const base = book([ninth, { id: 'c2', number: 2, title: 'Low Water', scenes: [{ id: 'e2', title: 'Two', text: C }, { id: 'e3', title: 'Three', text: B }] }])
    const { lines, plan } = await marked(base, base)
    expect(lines).toEqual(['Heading1 =Ch. 1 — The Ninth Bell', 'Heading1 =Ch. 2 — Low Water', 'SceneBreak =* * *'])
    expect(shapeSaid(plan.shape!)).toBeNull()
  })
})

describe('the third loop’s round 2 (T15)', () => {
  const F = path.join(__dirname, 'fixtures/docx/run-2026-11-14-loop3')
  const draft = (n: string) => (JSON.parse(readFileSync(path.join(F, `draft-${n}.json`), 'utf8')) as { book: DraftBook }).book

  it('Chapter Seven put in, the break it took the place of taken out, and the break between the split’s halves put in', async () => {
    const { lines, plan } = await marked(draft('back-1'), draft('marked-2'))
    expect(plan.shape).toEqual<ShapeCount>({ chaptersIn: 1, chaptersOut: 0, breaksIn: 1, breaksOut: 1, headings: 0 })
    expect(lines.filter((l) => l.includes('('))).toEqual(['SceneBreak(del) -* * *', 'Heading1(ins) +Ch. 7 — The Hearing', 'SceneBreak(ins) +* * *'])
    expect(shapeSaid(plan.shape!)).toBe('The book’s shape is marked too: 1 chapter put in, 1 scene break put in and 1 taken out.')
  })

  it('bookShape: before each scene what the file had there, and the split’s second half went on from the first', () => {
    const now = draft('marked-2')
    const shape = bookShape(draft('back-1'), listed(now))
    const scenes = now.chapters.flatMap((c) => c.scenes)
    const desk = scenes.find((s) => s.text.includes('Now it adds.'))!
    const magistrate = scenes[scenes.indexOf(desk) - 1]
    expect(shape.before(desk.id)).toEqual({ kind: 'none' })
    expect(shape.before(magistrate.id)).toEqual({ kind: 'break' })
    expect(shape.before(scenes[0].id)).toEqual({ kind: 'chapter', chapterId: now.chapters[0].id })
  })
})

describe('shapeSaid', () => {
  const n = (o: Partial<ShapeCount>): ShapeCount => ({ chaptersIn: 0, chaptersOut: 0, breaksIn: 0, breaksOut: 0, headings: 0, ...o })
  it('says each kind, one or many', () => {
    expect(shapeSaid(n({ chaptersIn: 1 }))).toBe('The book’s shape is marked too: 1 chapter put in.')
    expect(shapeSaid(n({ chaptersOut: 2, breaksIn: 2 }))).toBe('The book’s shape is marked too: 2 chapters taken out, 2 scene breaks put in.')
    expect(shapeSaid(n({ headings: 3 }))).toBe('The book’s shape is marked too: 3 chapter headings changed.')
    expect(shapeSaid(n({}))).toBeNull()
  })
})

describe('reading the export’s own lines (T15)', () => {
  const para = (style: string, pieces: DocParagraph['pieces'], mark?: DocParagraph['mark']): DocParagraph => ({ scene: 0, style, pieces, ...(mark ? { mark } : {}) })

  it('a * * * a writer typed in a scene is prose; one whose words are taken out, as LibreOffice saves a join’s, is not', () => {
    expect(isProse(para('Normal', [{ kind: 'same', text: '* * *', italic: false }]))).toBe(true)
    expect(isProse(para('Normal', [{ kind: 'del', text: '* * *', italic: false }]))).toBe(false)
  })

  it('a line is taken out whole by its own break, or by the break before it, with its words; not with its words alone', () => {
    const gone = para('SceneBreak', [{ kind: 'del', text: '* * *', italic: false }])
    const before = para('Normal', [{ kind: 'same', text: B, italic: false }], { kind: 'del' })
    expect(takenOutWhole({ ...gone, mark: { kind: 'del' } })).toBe(true)
    expect(takenOutWhole(gone, before)).toBe(true)
    expect(takenOutWhole(gone, para('Normal', [{ kind: 'same', text: B, italic: false }]))).toBe(false)
    expect(takenOutWhole(para('SceneBreak', [{ kind: 'same', text: '* * *', italic: false }], { kind: 'del' }))).toBe(false)
  })
})
