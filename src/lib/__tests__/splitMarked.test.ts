import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { basesFor, changeCount, editTally, markedParagraphs, markedPlan, sceneLineage, type MarkedParagraph } from '@/lib/markedDocx'
import { compileDocx } from '@/lib/manuscriptExport'
import { readEditedDocx } from '@/lib/docxRead'
import { docScenes } from '@/lib/docxEdits'
import { rendered } from '@/lib/docxImport'
import { readStoredZip } from '@/lib/zip'
import { paragraphBlocks } from '@/lib/manuscriptParagraphs'
import type { DraftBook } from '@/lib/bookDraft'
import type { EditorChange, ProseNote } from '@/types'

/*
  A split scene in the marked file (round-trip-plan-4.md, T14.0–T14.2;
  loop-2026-11-14.md, finding 1). The third loop's writer split the last scene
  of chapter 6 and put its second half in a new chapter 7. Each scene was marked
  against the same scene in the editor's file, and the new one had none: the
  half that went was struck under the first scene and put in again, unchanged,
  under the second. The editor saw 10 paragraphs struck and 10 put in 30 lower,
  and her "Perfect last line. Don't touch it." was on the struck copy.
*/

const F = path.join(__dirname, 'fixtures/docx/run-2026-11-14-loop3')
type Draft = { id: string; name: string; book: DraftBook; editors?: string[]; editorChanges?: EditorChange[] }
const draft = (n: string) => JSON.parse(readFileSync(path.join(F, `draft-${n}.json`), 'utf8')) as Draft
const texts = (d: Draft) => new Map(d.book.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text]))
const scenesOf = (d: Draft) => d.book.chapters.flatMap((c) => c.scenes)
const listed = (d: Draft) => scenesOf(d).map((s) => ({ eventId: s.id, text: s.text }))

const before = (p: MarkedParagraph) => p.runs.filter((r) => r.kind !== 'ins').map((r) => r.text).join('')
const after = (p: MarkedParagraph) => p.runs.filter((r) => r.kind !== 'del').map((r) => r.text).join('')
const plain = (t: string) => rendered(t).replace(/[*_]/g, '')

/** Round 2 as the export marks it: the book as it went, each scene against the part of the editor's round-1 file it holds. */
function round2() {
  const back = draft('back-1')
  const now = draft('marked-2')
  const base = basesFor(texts(back), listed(now))
  return { back, now, base, paras: scenesOf(now).map((s) => ({ id: s.id, title: s.title, paras: markedParagraphs(base.get(s.id) ?? null, s.text) })) }
}

/** Paragraphs taken out whole in one scene and put in whole, word for word, in another: a passage that moved, shown as cut and written again. */
function struckAndPutIn(paras: ReturnType<typeof round2>['paras']) {
  const out = paras.flatMap((s) => s.paras.filter((p) => p.mark === 'del').map((p) => ({ scene: s.id, text: before(p).trim() })))
  const put = paras.flatMap((s) => s.paras.filter((p) => p.mark === 'ins').map((p) => ({ scene: s.id, text: after(p).trim() })))
  return out.filter((o) => o.text && put.some((p) => p.scene !== o.scene && p.text === o.text)).map((o) => o.text.slice(0, 40))
}

/** The split-off scene's marks: "The Tally Desk" of chapter 7, not the book's first scene, which has its name too. */
const deskOf = (paras: ReturnType<typeof round2>['paras']) => paras.find((s) => s.paras.some((p) => after(p).includes('Now it adds.')))!.paras

/** The marked file itself, with the editor's threads, as the export dialog makes it (`markedPlan`). */
function markedFile() {
  const back = draft('back-1')
  const now = draft('marked-2')
  const notes = JSON.parse(readFileSync(path.join(F, 'notes.json'), 'utf8')) as ProseNote[]
  const asSent = Date.parse('2026-11-14T19:18:35Z')
  const plan = markedPlan({
    sentBack: { id: back.id, editors: back.editors, editorChanges: back.editorChanges },
    base: back.book, went: draft('sent-1').book, scenes: listed(now),
    // The editor's notes as they stood when the writer sent this file: their replies to come were not yet made.
    notes: notes.filter((n) => n.createdAt < asSent).map((n) => ({ ...n, replies: n.replies.filter((r) => r.createdAt < asSent) })),
    author: 'Tamsin Hale', now: asSent,
  })
  const scenes = scenesOf(now)
  const index = new Map(scenes.map((s, i) => [s.id, i]))
  const bytes = compileDocx({
    totalWords: 0, totalScenes: scenes.length, writtenScenes: scenes.length,
    chapters: now.book.chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: c.scenes.length,
      scenes: c.scenes.map((s) => ({ eventId: s.id, title: s.title, text: s.text, wordCount: 0, written: true, status: 'draft' as const })) })),
  }, { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: (id) => index.get(id), marked: plan.marked } })
  return { plan, bytes, scenes }
}

describe('the third loop’s split scene (T14.0)', () => {
  it('the scene split: the end of "The Magistrate" is "The Tally Desk", a scene the editor’s file has not got', () => {
    const back = texts(draft('back-1'))
    const desk = scenesOf(draft('marked-2')).find((s) => s.text.includes('Now it adds.'))!
    expect(desk.title).toBe('The Tally Desk')
    expect(back.has(desk.id)).toBe(false)
    const whole = [...back.keys()].find((id) => back.get(id)!.includes('Now it adds.'))!
    expect(sceneLineage(back, listed(draft('marked-2'))).split.get(whole)).toEqual([desk.id])
  })

  it('marked against its own scene alone, as it was: 9 paragraphs struck in the first and put in again, word for word, in the second', () => {
    const back = texts(draft('back-1'))
    const now = draft('marked-2')
    const paras = scenesOf(now).map((s) => ({ id: s.id, title: s.title, paras: markedParagraphs(back.get(s.id) ?? null, s.text) }))
    expect(struckAndPutIn(paras)).toHaveLength(9)
  })
})

describe('a split scene marked against the scene it came from (T14.1)', () => {
  it('the run’s round 2: no paragraph struck in one scene and put in again in another', () => {
    expect(struckAndPutIn(round2().paras)).toEqual([])
  })

  it('the half that went is marked as it was changed: the boots paragraph within itself, the rest as it stood', () => {
    const desk = deskOf(round2().paras)
    const boots = desk.find((p) => after(p).includes('boots'))!
    expect(boots.mark).toBe('same')
    expect(boots.runs.some((r) => r.kind !== 'same')).toBe(true)
    // The boots paragraph is its first; every other stands as the editor left it.
    expect(desk.slice(1).every((p) => p.mark === 'same')).toBe(true)
    expect(after(desk.at(-1)!)).toContain('Now it adds.')
  })

  it('the paragraphs rewritten into the hearing are taken out of the first scene, where they were, and not the second', () => {
    const { paras } = round2()
    const magistrate = paras.find((s) => s.title === 'The Magistrate')!.paras
    const desk = deskOf(paras)
    expect(magistrate.filter((p) => p.mark === 'del').length).toBeGreaterThan(0)
    expect(desk.some((p) => p.mark === 'del')).toBe(false)
  })

  it('the two scenes rejected are the editor’s one, paragraph for paragraph; accepted, the writer’s two', async () => {
    const { bytes, scenes } = markedFile()
    const parts = docScenes(await readEditedDocx(bytes))
    const back = texts(draft('back-1'))
    const whole = [...back.keys()].find((id) => back.get(id)!.includes('Now it adds.'))!
    const halves = parts.filter((p) => [whole, ...sceneLineage(back, listed(draft('marked-2'))).split.get(whole)!].includes(scenes[p.index!].id))
    expect(halves).toHaveLength(2)
    expect(halves.map((p) => plain(p.original)).join('\n\n')).toBe(plain(back.get(whole)!))
    for (const p of parts) expect(plain(p.edited), scenes[p.index!].title).toBe(plain(scenes[p.index!].text))
    // Every other scene rejected is the editor's own.
    for (const p of parts.filter((x) => !halves.includes(x))) expect(plain(p.original), scenes[p.index!].title).toBe(plain(back.get(scenes[p.index!].id) ?? ''))
  })

  it('"Now it adds." once in the file, and the editor’s "Don’t touch it" on words that stand', () => {
    const xml = new TextDecoder().decode(readStoredZip(markedFile().bytes).get('word/document.xml'))
    expect(xml.split('Now it adds.').length - 1).toBe(1)
    expect(/<w:del [^>]*>(?:(?!<\/w:del>).)*Now it adds\./s.test(xml)).toBe(false)
    const comments = new TextDecoder().decode(readStoredZip(markedFile().bytes).get('word/comments.xml'))
    const id = /<w:comment w:id="(\d+)"[^>]*>(?:(?!<\/w:comment>).)*Don’t touch it|<w:comment w:id="(\d+)"[^>]*>(?:(?!<\/w:comment>).)*Don't touch it/s.exec(comments)
    expect(id).not.toBeNull()
    const n = id![1] ?? id![2]
    // The words between its range marks, none of them struck.
    const range = new RegExp(`<w:commentRangeStart w:id="${n}"/>(.*?)<w:commentRangeEnd w:id="${n}"/>`, 's').exec(xml)!
    expect(range[1]).toContain('Now it adds.')
    expect(range[1]).not.toContain('<w:del ')
  })

  it('the dialog’s count: 51 changes, from 49, because the boots paragraph’s own edits are counted where the whole paragraph was one stretch', () => {
    const { plan } = markedFile()
    // 52 at T14.1; the declined join one change since, not two (round-trip-plan-4.md, T18.2).
    expect(plan.changes).toBe(51)
    const { paras } = round2()
    expect(changeCount(deskOf(paras))).toBe(4)
  })
})

describe('basesFor: each scene against the part of the editor’s text it holds', () => {
  const P = ['The bell went at nine.', 'Nobody on the stair said anything.', 'She counted the sacks twice.', 'Low water was at a quarter past.', 'The ledger was shut.']
  const join = (...ps: string[]) => ps.join('\n\n')
  const base = (m: Record<string, string>) => new Map(Object.entries(m))
  const scenes = (m: Array<[string, string]>) => m.map(([eventId, text]) => ({ eventId, text }))

  it('a split: the scene it came from is cut between the two', () => {
    const b = basesFor(base({ a: join(...P) }), scenes([['a', join(P[0], P[1])], ['b', join(P[2], P[3], P[4])]]))
    expect(b.get('a')).toBe(join(P[0], P[1]))
    expect(b.get('b')).toBe(join(P[2], P[3], P[4]))
  })

  it('a paragraph neither half has, between them, goes to the first: it was rewritten where it stayed', () => {
    const b = basesFor(base({ a: join(...P) }), scenes([['a', join(P[0], 'A new hearing, all of it.')], ['b', join(P[3], P[4])]]))
    expect(b.get('a')).toBe(join(P[0], P[1], P[2]))
    expect(b.get('b')).toBe(join(P[3], P[4]))
  })

  it('a paragraph edited in the half that went goes with it', () => {
    const edited = 'She counted the sacks twice, and then a third time.'
    const b = basesFor(base({ a: join(...P) }), scenes([['a', join(P[0], P[1])], ['b', join(edited, P[3], P[4])]]))
    expect(b.get('b')).toBe(join(P[2], P[3], P[4]))
    expect(markedParagraphs(b.get('b')!, join(edited, P[3], P[4])).map((p) => p.mark)).toEqual(['same', 'same', 'same'])
  })

  it('the half that went, put before the scene it came from, is still its second half', () => {
    const b = basesFor(base({ a: join(...P) }), scenes([['b', join(P[3], P[4])], ['a', join(P[0], P[1], P[2])]]))
    expect(b.get('a')).toBe(join(P[0], P[1], P[2]))
    expect(b.get('b')).toBe(join(P[3], P[4]))
  })

  it('the new scene holding the first half, the scene it came from the second: each its own, in the order they stood', () => {
    const b = basesFor(base({ a: join(...P) }), scenes([['n', join(P[0], P[1])], ['a', join(P[2], P[3], P[4])]]))
    expect(b.get('n')).toBe(join(P[0], P[1]))
    expect(b.get('a')).toBe(join(P[2], P[3], P[4]))
  })

  it('split in three', () => {
    const b = basesFor(base({ a: join(...P) }), scenes([['a', join(P[0], P[1])], ['b', P[2]], ['c', join(P[3], P[4])]]))
    expect([b.get('a'), b.get('b'), b.get('c')]).toEqual([join(P[0], P[1]), P[2], join(P[3], P[4])])
  })

  it('a join: the scene that took the other in is marked against both, and nothing is put in whole', () => {
    const b = basesFor(base({ a: join(P[0], P[1]), b: join(P[2], P[3]) }), scenes([['a', join(P[0], P[1], P[2], P[3])]]))
    expect(b.get('a')).toBe(join(P[0], P[1], P[2], P[3]))
    expect(markedParagraphs(b.get('a')!, join(P[0], P[1], P[2], P[3])).every((p) => p.mark === 'same')).toBe(true)
  })

  it('a scene new to the file and from no other is marked against nothing; one not split, against its own', () => {
    const b = basesFor(base({ a: join(P[0], P[1]) }), scenes([['a', join(P[0], P[1])], ['n', 'Something else entirely, never in the file.']]))
    expect(b.get('n')).toBeNull()
    expect(b.get('a')).toBe(join(P[0], P[1]))
  })

  it('a scene that lost half its paragraphs to nobody is not split: its own text', () => {
    const b = basesFor(base({ a: join(...P) }), scenes([['a', join(P[0], P[1])]]))
    expect(b.get('a')).toBe(join(...P))
  })

  it('the text each part is given is the file’s paragraphs, whole', () => {
    const b = basesFor(base({ a: join(...P) }), scenes([['a', join(P[0], P[1])], ['b', join(P[2], P[3], P[4])]]))
    expect(paragraphBlocks(b.get('b')!).map((p) => p.text)).toEqual([P[2], P[3], P[4]])
  })
})

describe('the tally follows a split (T14.2)', () => {
  const P = ['The bell went at nine.', 'Nobody on the stair said anything.', 'She counted the sacks twice.', 'Low water was at a quarter past.']
  const join = (...ps: string[]) => ps.join('\n\n')
  // The editor changed "twice" to "three times" in the third paragraph; the writer then split the scene before it, and kept the change.
  const went = join(...P)
  const back = join(P[0], P[1], 'She counted the sacks three times.', P[3])
  const change: EditorChange = { eventId: 'a', before: 'twice', after: 'three times', prefix: 'She counted the sacks ', suffix: '.' } as EditorChange
  const book = (t: Record<string, string>): DraftBook => ({ version: 1, chapters: [{ id: 'c', number: 1, title: 'C', timelineId: 't', scenes: Object.entries(t).map(([id, text]) => ({ id, title: id, text })) }] })

  it('a change of the editor’s in the half that went stands, where it was counted rewritten', () => {
    const scenes = [{ eventId: 'a', text: join(P[0], P[1]) }, { eventId: 'b', text: join('She counted the sacks three times.', P[3]) }]
    const plan = markedPlan({ sentBack: { id: 'B', editorChanges: [change] }, base: book({ a: back }), went: book({ a: went }), scenes, notes: [], author: 'W', now: 0 })
    expect(plan.tally).toEqual({ stand: 1, turnedBack: 0, rewritten: 0 })
    // Read against its own scene alone, as it was: rewritten.
    const now = new Map(scenes.map((s) => [s.eventId, s.text]))
    expect(editTally([change], () => went, () => back, (id) => now.get(id) ?? null)).toEqual({ stand: 0, turnedBack: 0, rewritten: 1 })
  })

  it('turned back in the half that went: turned back', () => {
    const scenes = [{ eventId: 'a', text: join(P[0], P[1]) }, { eventId: 'b', text: join(P[2], P[3]) }]
    const plan = markedPlan({ sentBack: { id: 'B', editorChanges: [change] }, base: book({ a: back }), went: book({ a: went }), scenes, notes: [], author: 'W', now: 0 })
    expect(plan.tally).toEqual({ stand: 0, turnedBack: 1, rewritten: 0 })
  })

  it('the run’s round 1: 53 stand, 5 turned back, 8 rewritten: none of the editor’s changes was in the half that went', () => {
    const { plan } = markedFile()
    // 4 and 9 at T14.2: the declined join was read rewritten, its two halves apart, until T18.0.
    expect(plan.tally).toEqual({ stand: 53, turnedBack: 5, rewritten: 8 })
  })
})

describe('a scene’s last paragraphs cut (found by T14.1’s probe)', () => {
  const A = 'The ninth bell had already gone when she climbed the back stair of the Customs House.'
  const B = 'Somewhere below, a door was shut with more care than a door needs.'
  const C = 'Low water was at a quarter past, and the whole city knew it.'

  it('the break taken out is the one at the end of the paragraph that stands; the last cut keeps its own, as Word marks it', () => {
    const one = markedParagraphs([A, B, C].join('\n\n'), A)
    expect(one.map((p) => [p.mark, p.breakMark])).toEqual([['same', 'del'], ['del', 'del'], ['del', 'same']])
    // In the middle of a scene, as before: each cut paragraph's own break.
    const mid = markedParagraphs([A, B, C].join('\n\n'), [A, C].join('\n\n'))
    expect(mid.map((p) => [p.mark, p.breakMark])).toEqual([['same', 'same'], ['del', 'del'], ['same', 'same']])
    // A scene cut whole has no paragraph before to carry it.
    expect(markedParagraphs([A, B].join('\n\n'), '').map((p) => [p.mark, p.breakMark])).toEqual([['del', 'del'], ['del', 'del']])
  })

  it('the file as made reads back: rejected, the editor’s text; accepted, the writer’s, with the scene after it whole', async () => {
    const base = new Map([['e1', [A, B, C].join('\n\n')], ['e2', C]])
    const scenes = [{ eventId: 'e1', text: [A, B].join('\n\n') }, { eventId: 'e2', text: C }]
    const bytes = compileDocx({ totalWords: 0, totalScenes: 2, writtenScenes: 2, chapters: [{ id: 'c', number: 1, title: 'T', synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: 2,
      scenes: scenes.map((s) => ({ eventId: s.eventId, title: s.eventId, text: s.text, wordCount: 0, written: true, status: 'draft' as const })) }] },
    { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: (id) => (id === 'e1' ? 0 : 1), marked: { author: 'W', date: '2026-11-15T09:00:00Z', base: (id) => base.get(id) ?? null } } })
    const parts = docScenes(await readEditedDocx(bytes))
    expect(parts.map((p) => [plain(p.original), plain(p.edited)])).toEqual([[[A, B, C].join('\n\n'), [A, B].join('\n\n')], [C, C]])
  })
})
