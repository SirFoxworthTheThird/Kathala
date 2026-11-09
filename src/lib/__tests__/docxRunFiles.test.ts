import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { readEditedDocx, type EditedDocx } from '@/lib/docxRead'
import { applyHunk, planImport, rendered, runTogether } from '@/lib/docxImport'
import { breakChange, docScenes, showBreaks, shownChange } from '@/lib/docxEdits'
import type { DraftBook } from '@/lib/bookDraft'

/*
  The files of the first writer and editor run (writer-run-2026-11-09-blind-editor.md,
  editor-run-2026-11-09.md): the book as it went out twice, as the drafts the
  app saved (draft-round1.json, draft-round2.json), and the editor's file back
  each time, edited in LibreOffice with tracking on throughout. She made three
  paragraph splits in round 1, and nothing with tracking off.
*/
const dir = path.join(__dirname, 'fixtures/docx/run-2026-11-09')
const round = async (r: 1 | 2) => {
  const doc = await readEditedDocx(new Uint8Array(readFileSync(path.join(dir, `round${r}-from-editor.docx`))))
  const draft = JSON.parse(readFileSync(path.join(dir, `draft-round${r}.json`), 'utf8')) as { id: string; book: DraftBook }
  return { doc, draft }
}
const count = (plan: ReturnType<typeof planImport>, k: 'tracked' | 'untracked' | 'comments' | 'moves') => plan.scenes.reduce((n, s) => n + s[k].length, 0)
const movesOf = (plan: ReturnType<typeof planImport>) => {
  const all = plan.scenes.flatMap((s) => s.moves.map((m) => ({ ...m, eventId: s.eventId })))
  return [...new Set(all.map((m) => m.id))].map((id) => ({ from: all.find((m) => m.id === id && m.part === 'from')!, to: all.find((m) => m.id === id && m.part === 'to')! }))
}

describe('the run’s files (round-trip-plan.md, T1.1)', () => {
  it('round 1: every scene placed, no edit with tracking off, and each of the three splits one change', async () => {
    const { doc, draft } = await round(1)
    expect(doc.draftId).toBe(draft.id)
    const plan = planImport(doc, draft.book, draft.book)
    expect([plan.scenes.length, plan.unplaced.length]).toEqual([18, 0])
    // Before the paragraph mark was read, the three splits came in as three "untracked" edits beside three tracked ones.
    expect(count(plan, 'untracked')).toBe(0)
    expect(count(plan, 'comments')).toBe(40)
    const splits = plan.scenes.flatMap((s) => s.tracked).filter((h) => breakChange(h.before, h.after) === 'split')
    expect(splits.map((h) => [h.before, h.after])).toEqual([['time. ', 'time.\n\n'], ['cloves. ', 'cloves.\n\n'], ['teeth. ', 'teeth.\n\n']])
  })

  it('round 2: no edit with tracking off either', async () => {
    const { doc, draft } = await round(2)
    const plan = planImport(doc, draft.book, draft.book)
    expect([plan.scenes.length, count(plan, 'untracked'), count(plan, 'comments')]).toEqual([18, 0, 16])
  })

  it.each([1, 2] as const)('round %i: a scene’s changes all accepted, first to last or last to first, make it read as the file does', async (r) => {
    const { doc, draft } = await round(r)
    const plan = planImport(doc, draft.book, draft.book)
    const scenes = draft.book.chapters.flatMap((c) => c.scenes)
    const parts = docScenes(doc)
    for (const s of plan.scenes) {
      const part = parts.find((p) => p.index !== null && scenes[p.index]?.id === s.eventId)!
      for (const reversed of [false, true]) {
        const changes = [...s.untracked, ...s.tracked, ...s.moves.map((m) => m.hunk)]
        if (reversed) changes.reverse()
        let text = scenes.find((x) => x.id === s.eventId)!.text
        for (const h of changes) {
          const next = applyHunk(text, h)
          expect(next, `${s.eventId}: "${h.before}"`).not.toBeNull()
          text = next!
        }
        expect(rendered(text), `${s.eventId}${reversed ? ', last first' : ''}`).toBe(part.edited)
        expect(runTogether(text)).toBe(runTogether(part.edited))
      }
    }
  })
})

describe('the run’s replacements (round-trip-plan.md, T1.3)', () => {
  it.each([[1, 64], [2, 14]] as const)('round %i: one change for each the editor made, %i in all', async (r, edits) => {
    const { doc, draft } = await round(r)
    const plan = planImport(doc, draft.book, draft.book)
    // Her own count: 66 edits in round 1, 2 of them on the title page; 14 in round 2. A move is one.
    expect(count(plan, 'tracked') + count(plan, 'moves') / 2).toBe(edits)
  })

  it('a word-for-words replacement is one change, not its words apart', async () => {
    const { doc, draft } = await round(1)
    const shown = planImport(doc, draft.book, draft.book).scenes.flatMap((s) => s.tracked).map((h) => shownChange(h.before, h.after)).map((x) => [x.out, x.in])
    expect(shown).toContainEqual(['in his hand', 'under his seal'])
    expect(shown).not.toContainEqual(['in', 'under'])
  })
})

describe('the run’s restyled scene break (round-trip-plan.md, T1.5)', () => {
  it('the editor’s first save, whose cut paragraph left the # after it in Normal style, brings in no # and no edit with tracking off', async () => {
    // round1-restyled-break.docx: her round-1 file as first saved, kept by her as the evidence for E-3.
    const doc = await readEditedDocx(new Uint8Array(readFileSync(path.join(dir, 'round1-restyled-break.docx'))))
    expect(doc.paragraphs.filter((p) => p.style === 'Normal' && p.pieces.map((x) => ('text' in x ? x.text : '')).join('').trim() === '#')).toHaveLength(1)
    const { draft } = await round(1)
    const plan = planImport(doc, draft.book, draft.book)
    expect([plan.scenes.length, plan.unplaced.length, count(plan, 'untracked')]).toEqual([18, 0, 0])
    const changes = plan.scenes.flatMap((s) => [...s.tracked, ...s.moves.map((m) => m.hunk)]).map((h) => shownChange(h.before, h.after))
    expect(changes.filter((c) => c.in.includes('#') || c.out.includes('#'))).toEqual([])
  })
})

describe('the run’s title page (round-trip-plan.md, T1.4)', () => {
  it('round 1: the editor’s two title-page edits are listed, as she made them; round 2 has none', async () => {
    const one = await round(1)
    expect(planImport(one.doc, one.draft.book, one.draft.book).outside).toEqual([
      { where: 'title page', before: 'Ruth Callan\tabout 12,000 words', after: 'Ruth Callan\tabout 12,300 words', comments: 0 },
      { where: 'title page', before: 'Ruth Callan', after: '', comments: 0 },
    ])
    const two = await round(2)
    expect(planImport(two.doc, two.draft.book, two.draft.book).outside).toEqual([])
  })
})

describe('the run’s moves (round-trip-plan.md, T1.2)', () => {
  it('round 1: the one sentence moved is one move, its halves in its scene', async () => {
    const { doc, draft } = await round(1)
    const moves = movesOf(planImport(doc, draft.book, draft.book))
    expect(moves).toHaveLength(1)
    const [m] = moves
    expect(m.from.eventId).toBe(m.to.eventId)
    expect(shownChange(m.from.hunk.before, m.from.hunk.after).out.trim()).toBe('It was the oldest honest thing in the city.')
    expect(shownChange(m.to.hunk.before, m.to.hunk.after).in.trim()).toBe('It was the oldest honest thing in the city.')
  })

  it('round 2: two moves, each as the editor made it — the Black Mare’s paragraph moved up, not Ilse’s moved down; the sentence on its own words', async () => {
    const { doc, draft } = await round(2)
    const plan = planImport(doc, draft.book, draft.book)
    const moves = movesOf(plan)
    expect(moves).toHaveLength(2)
    const words = moves.map((m) => shownChange(m.from.hunk.before, m.from.hunk.after).out.trim().slice(0, 40))
    expect(words).toEqual(['He had come across the marsh on his back', 'The Black Mare did not wait. They saw he'])
    // Each move's halves are the same words: the sentence's insertion is on them, not found a few words off ("come across … He had").
    for (const m of moves) {
      expect(shownChange(m.to.hunk.before, m.to.hunk.after).in.replace(/\s+/g, ' ').trim()).toBe(shownChange(m.from.hunk.before, m.from.hunk.after).out.replace(/\s+/g, ' ').trim())
    }
    // Ilse's paragraph, which the letter praised, is no change at all.
    expect(plan.scenes.flatMap((s) => [...s.tracked, ...s.moves.map((m) => m.hunk)]).some((h) => shownChange(h.before, h.after).out.includes('Ilse found that she was holding'))).toBe(false)
  })
})

describe('a change that touches another (round-trip-plan.md, T1.1)', () => {
  const book = (text: string): DraftBook => ({ version: 1, chapters: [{ id: 'c1', number: 1, title: '', timelineId: 't', scenes: [{ id: 'e1', title: 'S', text }] }] })
  const doc = (pieces: EditedDocx['paragraphs'][number]['pieces']): EditedDocx => ({ draftId: 'D', worldId: null, comments: [], paragraphs: [{ scene: 0, style: 'Normal', pieces }] })

  it('an edit made with tracking off and a tracked one on the same words are one change, from the scene as it went out to the file', () => {
    // Out: "He had a ledger." The editor changed "had" with tracking off, then put " tight" after it with tracking on.
    const plan = planImport(doc([
      { kind: 'same', text: 'He held', italic: false },
      { kind: 'ins', text: ' tight', italic: false, author: 'Ana' },
      { kind: 'same', text: ' a ledger.', italic: false },
    ]), book('He had a ledger.'), book('He had a ledger.'))
    const [s] = plan.scenes
    expect(s.untracked).toEqual([])
    expect(s.tracked.map((h) => [h.before, h.after])).toEqual([['had ', 'held tight ']])
    expect(applyHunk('He had a ledger.', s.tracked[0])).toBe('He held tight a ledger.')
  })

  it('changes apart from each other are left apart', () => {
    const plan = planImport(doc([
      { kind: 'same', text: 'He held a ledger under his ', italic: false },
      { kind: 'del', text: 'arm', italic: false, author: 'Ana' },
      { kind: 'ins', text: 'coat', italic: false, author: 'Ana' },
      { kind: 'same', text: '.', italic: false },
    ]), book('He had a ledger under his arm.'), book('He had a ledger under his arm.'))
    const [s] = plan.scenes
    expect(s.untracked.map((h) => [h.before, h.after])).toEqual([['had', 'held']])
    expect(s.tracked.map((h) => [h.before, h.after])).toEqual([['arm.', 'coat.']])
  })
})

describe('a paragraph break, shown', () => {
  it('a change of whitespace alone is a split or a join; one with words changed is neither', () => {
    expect(breakChange('time. ', 'time.\n\n')).toBe('split')
    expect(breakChange('waited.\n\nRain', 'waited. Rain')).toBe('join')
    expect(breakChange('time. ', 'times.\n\n')).toBeNull()
    expect(breakChange('a  b', 'a b')).toBeNull()
  })

  it('a break is a pilcrow, which a space would hide', () => {
    expect(showBreaks('the rain.\n\nIlse found')).toBe('the rain. ¶ Ilse found')
    expect(showBreaks('no break')).toBe('no break')
  })

  it('a sentence run into the next is counted; an abbreviation in capitals, or a space, is not one', () => {
    expect(runTogether('every time.At the edge')).toBe(1)
    expect(runTogether('“Go.”She went. He came.Then')).toBe(2)
    expect(runTogether('the U.S. Navy, and time. At')).toBe(0)
  })
})
