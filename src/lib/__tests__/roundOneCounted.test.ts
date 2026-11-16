import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { readEditedDocx } from '@/lib/docxRead'
import { applyHunk, byRuns, planImport } from '@/lib/docxImport'
import { locatedAt } from '@/lib/docxEdits'
import type { DraftBook } from '@/lib/bookDraft'

/*
  The third loop's round 1, counted (round-trip-plan-4.md, T21.3).

  S11. The editor made 67 edits; the import counted 66. The file has 67 runs
  of tracked changes, one for each. Two of them, in "The North Quay", are a
  clause cut and, a full stop later, a sentence taken out to be put earlier:
  *all and had never once in his life managed to. In the lamplight his face
  was grey.* made *all.* The stop between them is unchanged, but the words kept
  compare as well with it at the end, and the comparison found one deletion
  across both. Now cut as the file has them.

  S12. The copy the editor kept, saved by LibreOffice with tracking on, has an
  empty insertion at each of its 40 comments, and read as 65, one fewer than
  the file sent. Compared change by change, it is another copy of the edits,
  not the same edits read differently: *its* made *their* is not in it, and two
  cuts of a beat between two quotations keep the quotation marks the file sent
  joins. The empty insertions are read as nothing.
*/

const F = path.join(__dirname, 'fixtures/docx/run-2026-11-14-loop3')
const draft = (n: string) => (JSON.parse(readFileSync(path.join(F, `draft-${n}.json`), 'utf8')) as { book: DraftBook }).book
const sent = draft('sent-1')

async function changes(file: string) {
  const read = await readEditedDocx(new Uint8Array(readFileSync(path.join(F, file))))
  const plan = planImport(read, sent, draft('before-1'))
  return { plan, all: plan.scenes.flatMap((s) => [...s.tracked, ...s.untracked].map((h) => ({ eventId: s.eventId, ...h }))) }
}

describe('round 1 as the editor made it: 67 changes', () => {
  it('the clause cut and the sentence taken out a stop later are two, each its own', async () => {
    const { all } = await changes('round1-from-editor.docx')
    expect(all).toHaveLength(67)
    const quay = sent.chapters.flatMap((c) => c.scenes).find((s) => s.text.includes('and had never once in his life managed to'))!
    const here = all.filter((h) => h.eventId === quay.id).map((h) => [h.before, h.after])
    expect(here).toContainEqual([' and had never once in his life managed to', ''])
    expect(here).toContainEqual([' In the lamplight his face was grey.', ''])
    // Either alone can be made, and leaves the other's words where they were.
    const cut = all.find((h) => h.before === ' and had never once in his life managed to')!
    expect(applyHunk(quay.text, cut)).toContain('all. In the lamplight his face was grey.')
  })

  it('every change made, each scene is the editor’s', async () => {
    const { plan } = await changes('round1-from-editor.docx')
    const prose = new Map(sent.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text]))
    for (const s of plan.scenes) {
      let text = prose.get(s.eventId)!
      for (const h of s.tracked) text = applyHunk(text, h) ?? text
      expect(text, s.eventId).toBe(s.edited)
    }
  })
})

describe('a change across runs, cut along them', () => {
  const a = 'all and had never once. In the lamp his face. Then'
  const b = 'all. Then'
  const one = locatedAt(a, b, 3, a.length - 5, 3, 4)
  const runs = [{ base: [3, 22] as [number, number], edited: [3, 3] as [number, number] }, { base: [23, a.length - 5] as [number, number], edited: [4, 4] as [number, number] }]
  it('one per run, where made in turn they give what the one gives', () => {
    expect(byRuns(a, b, one, runs).map((l) => [l.hunk.before, l.hunk.after])).toEqual([[' and had never once', ''], [' In the lamp his face.', '']])
  })
  it('kept whole where they do not, or where one is an insertion alone, or it meets one run', () => {
    // Runs that, made, would not give the text the change gives: the stop between them put elsewhere.
    expect(byRuns(a, b, one, [runs[0], { base: [22, a.length - 5], edited: [4, 4] }])).toEqual([one])
    expect(byRuns(a, b, one, [runs[0], { base: [23, 23], edited: [4, 4] }])).toEqual([one])
    expect(byRuns(a, b, one, [runs[0]])).toEqual([one])
  })
})

describe('the copy saved with an empty insertion at each comment (S12)', () => {
  it('is another copy of the edits: 66, the difference three changes, and no empty insertion read as one', async () => {
    const sentOne = (await changes('round1-from-editor.docx')).all
    const { all: copy, plan } = await changes('round1-from-editor-comments-tracked.docx')
    expect(copy).toHaveLength(66)
    expect(copy.every((h) => h.before !== h.after && `${h.before}${h.after}`.trim() !== '')).toBe(true)
    // Its 40 comments, all read: the insertions at them are not changes, and do not move them.
    expect(plan.scenes.reduce((n, s) => n + s.comments.length, 0)).toBe(40)
    const key = (h: { eventId: string; before: string; after: string }) => `${h.eventId}|${h.before}|${h.after}`
    const inSent = new Set(sentOne.map(key))
    const inCopy = new Set(copy.map(key))
    expect(sentOne.filter((h) => !inCopy.has(key(h))).map((h) => [h.before, h.after])).toEqual([
      ['had." She looked down at the water. "I', 'had. I'],
      ['me." Tobin looked at his hand. "Sefa.', 'me. Sefa.'],
      ['its', 'their'],
    ])
    expect(copy.filter((h) => !inSent.has(key(h))).map((h) => [h.before, h.after])).toEqual([
      ['She looked down at the water. ', ''],
      ['Tobin looked at his hand. ', ''],
    ])
  })
})
