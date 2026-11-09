import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { readEditedDocx, type EditedDocx } from '@/lib/docxRead'
import { applyHunk, planImport, rendered, runTogether } from '@/lib/docxImport'
import { breakChange, docScenes, showBreaks } from '@/lib/docxEdits'
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
const count = (plan: ReturnType<typeof planImport>, k: 'tracked' | 'untracked' | 'comments') => plan.scenes.reduce((n, s) => n + s[k].length, 0)

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
        const changes = [...s.untracked, ...s.tracked]
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
