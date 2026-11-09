import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { readEditedDocx, type EditedDocx } from '@/lib/docxRead'
import { applyHunk, planImport } from '@/lib/docxImport'
import type { DraftBook } from '@/lib/bookDraft'

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, 'fixtures/docx', name)))

const E1 = 'The ferry left at dawn.\n\nMira counted the crates twice, and _twice_ the number came out wrong.'
const E2 = 'The boy waited on the quay.\n\nHe had a ledger under his arm.'
/** The book as marked.docx was made from it: draft DRAFT123, e1 and e2 its scenes 0 and 1. */
const book = (e1 = E1, e2 = E2, extra: Array<{ id: string; title: string; text: string }> = []): DraftBook => ({
  version: 1,
  chapters: [{ id: 'c1', number: 1, title: 'The Weighing House', timelineId: 't', scenes: [{ id: 'e1', title: 'Dawn', text: e1 }, { id: 'e2', title: 'Quay', text: e2 }, ...extra] }],
})
const edited = () => readEditedDocx(fixture('edited-libreoffice.docx'))

describe('planImport', () => {
  it('places each part by its bookmark, through the draft; finds the tracked changes, the untracked edit, and the comment', async () => {
    const plan = planImport(await edited(), book(), book())
    expect(plan.fromDraft).toBe(true)
    expect(plan.unplaced).toEqual([])
    const [e1, e2] = plan.scenes
    expect(e1).toMatchObject({ eventId: 'e1', untracked: [], authors: ['Ana Editor'] })
    expect(e1.tracked.map((h) => [h.before, h.after])).toEqual([['dawn.', 'dawn in the rain.'], ['twice, and ', '']])
    expect(e2.eventId).toBe('e2')
    expect(e2.tracked).toEqual([])
    expect(e2.untracked.map((h) => [h.before, h.after])).toEqual([['had', 'held']])
    expect(e2.comments).toEqual([expect.objectContaining({ quote: 'The boy waited on the quay', author: 'Ana Editor', text: 'Which boy? Name him.', replies: [] })])
  })

  it('without the draft: placed by their paragraphs, tracked changes only — an untracked edit cannot be told from the prose', async () => {
    const plan = planImport(await edited(), null, book())
    expect(plan.fromDraft).toBe(false)
    expect(plan.scenes.map((s) => [s.eventId, s.tracked.length, s.untracked.length])).toEqual([['e1', 2, 0], ['e2', 0, 0]])
  })

  it('a scene the draft names but the book no longer has is placed by its paragraphs; a part that is no scene is unplaced', async () => {
    // e1 is gone, its prose now in e9; e2 is unrecognisable.
    const now: DraftBook = { version: 1, chapters: [{ id: 'c1', number: 1, title: '', timelineId: 't', scenes: [{ id: 'e9', title: 'Dawn', text: E1 }, { id: 'e2', title: 'Quay', text: 'Rewritten entirely.' }] }] }
    const plan = planImport(await edited(), book(), { ...now, chapters: [{ ...now.chapters[0], scenes: [now.chapters[0].scenes[0]] }] })
    expect(plan.scenes.map((s) => s.eventId)).toEqual(['e9'])
    expect(plan.unplaced.map((u) => [u.text, u.comments])).toEqual([['The boy waited on the quay.\n\nHe held a ledger under his arm.', 1]])
  })

  it('a scene the writer has rewritten since it went out is still placed by its bookmark', async () => {
    const plan = planImport(await edited(), book(), book(E1, 'Rewritten entirely.'))
    expect(plan.unplaced).toEqual([])
    expect(plan.scenes.map((s) => [s.eventId, s.untracked.length])).toEqual([['e1', 0], ['e2', 1]])
  })

  it('a comment on a point is on the word it stands before', () => {
    const doc: EditedDocx = {
      draftId: null, worldId: null,
      paragraphs: [{ scene: null, style: 'Normal', pieces: [
        { kind: 'same', text: 'He had a ', italic: false }, { kind: 'commentStart', id: '1' }, { kind: 'commentEnd', id: '1' }, { kind: 'same', text: 'ledger under his arm.', italic: false },
      ] }],
      comments: [{ id: '1', author: 'Ana', text: 'What kind?' }],
    }
    const [scene] = planImport(doc, null, book(E1, 'He had a ledger under his arm.')).scenes
    expect(scene.comments.map((c) => c.quote)).toEqual(['ledger'])
  })

  it('a reply is not a note of its own: it answers its comment', () => {
    const doc: EditedDocx = {
      draftId: null, worldId: null,
      paragraphs: [{ scene: null, style: 'Normal', pieces: [
        // Word marks a reply's range too, on the same words.
        { kind: 'commentStart', id: '1' }, { kind: 'commentStart', id: '2' }, { kind: 'same', text: 'He had a ledger under his arm.', italic: false }, { kind: 'commentEnd', id: '1' }, { kind: 'commentEnd', id: '2' },
      ] }],
      comments: [{ id: '1', author: 'Ana', text: 'Whose?' }, { id: '2', author: 'Ines', text: 'His father’s.', parentId: '1' }],
    }
    const [scene] = planImport(doc, null, book(E1, 'He had a ledger under his arm.')).scenes
    expect(scene.comments).toEqual([expect.objectContaining({ text: 'Whose?', replies: [{ author: 'Ines', text: 'His father’s.' }] })])
  })
})

describe('moves (round-trip-plan.md, T1.2)', () => {
  type Pieces = EditedDocx['paragraphs'][number]['pieces']
  const same = (text: string) => ({ kind: 'same' as const, text, italic: false })
  const moveOut = (text: string) => ({ kind: 'del' as const, text, italic: false, author: 'Ana', moved: true as const })
  const moveIn = (text: string) => ({ kind: 'ins' as const, text, italic: false, author: 'Ana', moved: true as const })
  const file = (...scenes: Pieces[][]): EditedDocx => ({
    draftId: null, worldId: null, comments: [],
    paragraphs: scenes.flatMap((paras, i) => paras.map((pieces) => ({ scene: i, style: 'Normal', pieces }))),
  })
  const twoScenes = (a: string, b: string): DraftBook => ({ version: 1, chapters: [{ id: 'c1', number: 1, title: '', timelineId: 't', scenes: [{ id: 'a', title: 'A', text: a }, { id: 'b', title: 'B', text: b }] }] })

  it('a sentence moved within a scene is one move: its two halves, on its own words, and nothing else', () => {
    // As the run's round 2 had it: moved to just before a sentence that starts with the same two words.
    const plan = planImport(file([[same('He had done it well.'), moveIn(' He had come across the marsh.'), same(' He had been sitting there.'), moveOut(' He had come across the marsh.')]]),
      twoScenes('He had done it well. He had been sitting there. He had come across the marsh.', ''), twoScenes('He had done it well. He had been sitting there. He had come across the marsh.', ''))
    const [s] = plan.scenes
    expect(s.tracked).toEqual([])
    expect(s.moves.map((m) => [m.part, m.hunk.before, m.hunk.after])).toEqual([
      ['from', ' He had come across the marsh.', ''],
      ['to', 'well. ', 'well. He had come across the marsh. '],
    ])
    expect(s.moves[0].id).toBe(s.moves[1].id)
  })

  it('a move from one scene to another is one move with a half in each', () => {
    const plan = planImport(file([[same('Rain fell. '), moveOut('The gate shut.')]], [[moveIn('The gate shut. '), same('She waited.')]]),
      twoScenes('Rain fell. The gate shut.', 'She waited.'), twoScenes('Rain fell. The gate shut.', 'She waited.'))
    const halves = plan.scenes.flatMap((s) => s.moves.map((m) => [s.eventId, m.part, m.id]))
    expect(halves).toEqual([['a', 'from', 'move-0'], ['b', 'to', 'move-0']])
  })

  it('a half with no other is a change of its own', () => {
    const plan = planImport(file([[same('Rain fell. '), moveIn('Something else.')]]), twoScenes('Rain fell. ', ''), twoScenes('Rain fell. ', ''))
    const [s] = plan.scenes
    expect(s.moves).toEqual([])
    expect(s.tracked.map((h) => [h.before, h.after])).toEqual([['fell. ', 'fell. Something else.']])
  })
})

describe('a replacement (round-trip-plan.md, T1.3)', () => {
  const book = (text: string): DraftBook => ({ version: 1, chapters: [{ id: 'c1', number: 1, title: '', timelineId: 't', scenes: [{ id: 'a', title: 'A', text }] }] })
  const one = (pieces: EditedDocx['paragraphs'][number]['pieces']): EditedDocx => ({ draftId: null, worldId: null, comments: [], paragraphs: [{ scene: 0, style: 'Normal', pieces }] })
  const same = (text: string) => ({ kind: 'same' as const, text, italic: false })
  const del = (text: string) => ({ kind: 'del' as const, text, italic: false, author: 'Ana' })
  const ins = (text: string) => ({ kind: 'ins' as const, text, italic: false, author: 'Ana' })
  const plan = (doc: EditedDocx, out: string) => planImport(doc, book(out), book(out)).scenes[0]

  it('a deletion beside an insertion is one change, though a word in them is the same', () => {
    const s = plan(one([same('A letter '), del('in his hand'), ins('under his seal'), same('.')]), 'A letter in his hand.')
    expect(s.tracked.map((h) => [h.before, h.after])).toEqual([['in his hand.', 'under his seal.']])
    expect(applyHunk('A letter in his hand.', s.tracked[0])).toBe('A letter under his seal.')
  })

  it('changes with unchanged words between them in the file are two', () => {
    const s = plan(one([same('A '), del('long'), ins('short'), same(' letter in his '), del('hand'), ins('seal'), same('.')]), 'A long letter in his hand.')
    expect(s.tracked.map((h) => [h.before, h.after])).toEqual([['long', 'short'], ['hand.', 'seal.']])
  })

  it('edits made with tracking off, one word apart in a sentence, are one; further apart, or across a stop, two', () => {
    const doc = (text: string): EditedDocx => ({ draftId: 'D', worldId: null, comments: [], paragraphs: [{ scene: 0, style: 'Normal', pieces: [same(text)] }] })
    expect(planImport(doc('A letter under his seal.'), book('A letter in his hand.'), book('A letter in his hand.')).scenes[0].untracked.map((h) => [h.before, h.after]))
      .toEqual([['in his hand.', 'under his seal.']])
    expect(planImport(doc('A note under his own seal.'), book('A letter under his own hand.'), book('A letter under his own hand.')).scenes[0].untracked.map((h) => [h.before, h.after]))
      .toEqual([['letter', 'note'], ['hand.', 'seal.']])
    expect(planImport(doc('He held. It fell.'), book('He had. It dropped.'), book('He had. It dropped.')).scenes[0].untracked.map((h) => [h.before, h.after]))
      .toEqual([['had.', 'held.'], ['dropped.', 'fell.']])
  })
})

describe('a scene that writes its italics with asterisks (round-trip-plan.md, T2.1)', () => {
  const book = (text: string): DraftBook => ({ version: 1, chapters: [{ id: 'c1', number: 1, title: '', timelineId: 't', scenes: [{ id: 'a', title: 'A', text }] }] })
  const doc = (pieces: EditedDocx['paragraphs'][number]['pieces']): EditedDocx => ({ draftId: 'D', worldId: null, comments: [], paragraphs: [{ scene: 0, style: 'Normal', pieces }] })

  it('gets its italics back as asterisks: no edit where there was none, and a change in its own markup', () => {
    const out = 'She was *so* tired.'
    const plan = planImport(doc([
      { kind: 'same', text: 'She was ', italic: false }, { kind: 'same', text: 'so', italic: true },
      { kind: 'del', text: ' tired', italic: false, author: 'Ana' }, { kind: 'ins', text: ' weary', italic: false, author: 'Ana' },
      { kind: 'same', text: '.', italic: false },
    ]), book(out), book(out))
    const [s] = plan.scenes
    // Read as underscores, every italic in the scene came back as an edit made with tracking off.
    expect(s.untracked).toEqual([])
    expect(applyHunk(out, s.tracked[0])).toBe('She was *so* weary.')
  })

  it('a scene in underscores keeps them', () => {
    const plan = planImport(doc([{ kind: 'same', text: 'She was ', italic: false }, { kind: 'same', text: 'so', italic: true }, { kind: 'same', text: ' tired.', italic: false }]), book('She was _so_ tired.'), book('She was _so_ tired.'))
    expect(plan.scenes[0].untracked).toEqual([])
  })
})

describe('applyHunk', () => {
  it('applies each change to the prose as it is now, even with the writer’s edits around it since', async () => {
    const [e1, e2] = planImport(await edited(), book(), book()).scenes
    const since = 'Fog. ' + E1
    const once = applyHunk(since, e1.tracked[0])!
    expect(once).toBe('Fog. The ferry left at dawn in the rain.\n\nMira counted the crates twice, and _twice_ the number came out wrong.')
    expect(applyHunk(once, e1.tracked[1])).toBe('Fog. The ferry left at dawn in the rain.\n\nMira counted the crates _twice_ the number came out wrong.')
    expect(applyHunk(E2, e2.untracked[0])).toBe('The boy waited on the quay.\n\nHe held a ledger under his arm.')
  })

  it('applies nothing where the writer has rewritten that passage since', async () => {
    const [e1] = planImport(await edited(), book(), book()).scenes
    expect(applyHunk('The ferry was gone before anyone woke.\n\nMira counted the crates twice, and _twice_ the number came out wrong.', e1.tracked[0])).toBeNull()
  })

  it('a paragraph taken out leaves one blank line between its neighbours', () => {
    const prose = 'One.\n\nTwo.\n\nThree.'
    expect(applyHunk(prose, { before: 'Two.', after: '', prefix: 'One.\n\n', suffix: '\n\nThree.' })).toBe('One.\n\nThree.')
  })
})
