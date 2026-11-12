import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { markedParagraphs, markedPlan, changeCount, type MarkedParagraph } from '@/lib/markedDocx'
import { compileDocx } from '@/lib/manuscriptExport'
import { paragraphBlocks } from '@/lib/manuscriptParagraphs'
import { readEditedDocx } from '@/lib/docxRead'
import { docScenes } from '@/lib/docxEdits'
import { planImport, rendered } from '@/lib/docxImport'
import type { DraftBook } from '@/lib/bookDraft'

/*
  The second loop's two marked revisions, as the export makes them
  (round-trip-plan-3.md, T8; loop-2026-11-12.md, finding 1).

  The editor could not read them where the writer had rewritten. Paragraphs
  were paired in order, so a new one was compared word by word with an old one
  it had nothing to do with — 112 marks in one paragraph of round 2, 94 in
  round 3 — and the old one, barely touched, came back whole as new. The
  dialog said "160 changes", then "134" (`t8-0-measure.md`).

  The drafts each file was made from are fixtures, and these are the numbers
  now: a ceiling on each, so that a change to the marking that makes a file
  harder to read turns one of them red.
*/

const F = path.join(__dirname, 'fixtures/docx/run-2026-11-12-loop2')
const draft = (n: string) => JSON.parse(readFileSync(path.join(F, `draft-${n}.json`), 'utf8')) as { id: string; name: string; book: DraftBook }

/** A round of the run: the book as the editor sent it back, and the book as it went out marked against that. */
const ROUNDS = [
  { name: 'round 2', back: 'back-1', marked: 'marked-2' },
  { name: 'round 3', back: 'back-2', marked: 'marked-3' },
] as const
type Round = (typeof ROUNDS)[number]

function made(round: Round) {
  const base = new Map(draft(round.back).book.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text]))
  const book = draft(round.marked).book
  const scenes = book.chapters.flatMap((c) => c.scenes)
  return { base, book, scenes, paras: scenes.map((s) => markedParagraphs(base.get(s.id) ?? null, s.text)) }
}

/** The marked file itself, as the export writes it. */
function file(round: Round): Uint8Array {
  const { base, book, scenes } = made(round)
  const index = new Map(scenes.map((s, i) => [s.id, i]))
  return compileDocx({
    totalWords: 0, totalScenes: scenes.length, writtenScenes: scenes.length,
    chapters: book.chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: c.scenes.length,
      scenes: c.scenes.map((s) => ({ eventId: s.id, title: s.title, text: s.text, wordCount: 0, written: true, status: 'draft' as const })) })),
  }, { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: (id) => index.get(id), marked: { author: 'Elin Ashgrove', date: '2026-11-12T09:00:00Z', base: (id) => base.get(id) ?? null } } })
}

const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean)
/** How alike two paragraphs are, for this file's own check: their words in common, as a bag, over the longer. Not the export's measure. */
function bagLikeness(a: string, b: string): number {
  const A = words(a)
  const B = words(b)
  const bag = new Map<string, number>()
  for (const w of A) bag.set(w, (bag.get(w) ?? 0) + 1)
  let common = 0
  for (const w of B) {
    const n = bag.get(w) ?? 0
    if (n > 0) { common++; bag.set(w, n - 1) }
  }
  return common / Math.max(A.length, B.length, 1)
}
const before = (p: MarkedParagraph) => p.runs.filter((r) => r.kind !== 'ins').map((r) => r.text).join('')
const after = (p: MarkedParagraph) => p.runs.filter((r) => r.kind !== 'del').map((r) => r.text).join('')
const plainParas = (text: string) => paragraphBlocks(text).map((p) => p.text.replace(/[*_]/g, ''))

/**
 * Paragraphs put in whole, or taken out whole, though one much like them
 * stands on the other side of the same scene: the paragraph the writer barely
 * touched, shown as struck or new because another was compared in its place.
 */
function displaced(round: Round): string[] {
  const { base, scenes, paras } = made(round)
  const out: string[] = []
  scenes.forEach((s, i) => {
    const was = plainParas(base.get(s.id) ?? '')
    const now = plainParas(s.text)
    // One paired with a paragraph is spoken for: only the unpaired on the other side can be the one it was.
    const pairedBefore = new Set(paras[i].filter((p) => p.mark === 'same').map(before))
    const pairedAfter = new Set(paras[i].filter((p) => p.mark === 'same').map(after))
    for (const p of paras[i]) {
      if (p.mark === 'ins' && Math.max(0, ...was.filter((w) => !pairedBefore.has(w)).map((w) => bagLikeness(w, after(p)))) >= 0.6) out.push(after(p).slice(0, 40))
      if (p.mark === 'del' && Math.max(0, ...now.filter((w) => !pairedAfter.has(w)).map((w) => bagLikeness(w, before(p)))) >= 0.6) out.push(before(p).slice(0, 40))
    }
  })
  return out
}

/** The changes in one paragraph: its stretches put in or taken out, one put in for one taken out counted once. */
const changesIn = (p: MarkedParagraph) => p.runs.filter((r, i) => r.kind !== 'same' && !(r.kind === 'ins' && p.runs[i - 1]?.kind === 'del')).length
const dialogCount = (round: Round) => {
  const { scenes } = made(round)
  return markedPlan({ sentBack: { id: draft(round.back).id }, base: draft(round.back).book, scenes: scenes.map((s) => ({ eventId: s.id, text: s.text })), notes: [], author: 'Elin Ashgrove', now: 0 }).changes
}

describe('the second loop’s marked revisions (round-trip-plan-3.md, T8.1–T8.3)', () => {
  // Italics are compared apart (`markedDocx.test.ts`): the reader writes `_`, the writer may have typed `*`.
  const text = (s: string) => rendered(s).replace(/[*_]/g, '')

  it('rejecting every change gives the editor’s text, and accepting every one the writer’s, in all 16 scenes of both', async () => {
    for (const round of ROUNDS) {
      const { base, scenes } = made(round)
      const parts = docScenes(await readEditedDocx(file(round)))
      expect(parts.length, round.name).toBe(16)
      for (const part of parts) {
        const scene = scenes[part.index!]
        expect(text(part.original), `${round.name}, ${scene.title}: rejected`).toBe(text(base.get(scene.id) ?? ''))
        expect(text(part.edited), `${round.name}, ${scene.title}: accepted`).toBe(text(scene.text))
      }
    }
  })

  it('T8.1: no paragraph is put in or taken out whole while one like it stands unpaired on the other side', () => {
    // It was two in each file: "There was a message waiting for her…", "They went in at slack water…" and their fellows.
    expect(ROUNDS.flatMap(displaced)).toEqual([])
  })

  it('T8.1: the paragraph that came back as new is compared with the one it was, and the new one before it is put in whole', () => {
    // Round 3, "The tide-book" scene's fellow in chapter 4: the old opening, kept, behind a new paragraph on waiting for the tides.
    const { paras } = made(ROUNDS[1])
    const all = paras.flat()
    const kept = all.find((p) => after(p).startsWith('They went in at slack water on the top of the tide'))!
    expect(kept.mark).toBe('same')
    expect(bagLikeness(before(kept), after(kept))).toBeGreaterThan(0.9)
    const fresh = all.find((p) => after(p).startsWith('They had to wait for the water.'))!
    expect(fresh.mark).toBe('ins')
    expect(fresh.runs.every((r) => r.kind === 'ins')).toBe(true)
  })

  it('T8.2: the most changes in any one paragraph, where it was 112 marks and 94', () => {
    expect(ROUNDS.map((r) => Math.max(...made(r).paras.flat().map(changesIn)))).toEqual([3, 4])
    // And as marks, each stretch counted, a replacement as its two: what the editor's eye meets.
    expect(ROUNDS.map((r) => Math.max(...made(r).paras.flat().map((p) => p.runs.filter((x) => x.kind !== 'same').length)))).toEqual([4, 6])
  })

  it('T8.3: the dialog’s count, where it said 160 and 134, is what bringing the marked file in would say, scene by scene', async () => {
    expect(ROUNDS.map(dialogCount)).toEqual([36, 31])
    for (const round of ROUNDS) {
      const { base, book, scenes, paras } = made(round)
      // The file's own base, in the book's order: read against it, every change in the file is a tracked one.
      const baseBook: DraftBook = { ...book, chapters: book.chapters.map((c) => ({ ...c, scenes: c.scenes.map((s) => ({ ...s, text: base.get(s.id) ?? '' })) })) }
      const plan = planImport(await readEditedDocx(file(round)), baseBook, baseBook)
      expect(plan.unplaced, round.name).toEqual([])
      scenes.forEach((s, i) => {
        const planned = plan.scenes.find((x) => x.eventId === s.id)
        expect(planned?.untracked ?? [], `${round.name}, ${s.title}: with tracking off`).toEqual([])
        expect(changeCount(paras[i]), `${round.name}, ${s.title}`).toBe((planned?.tracked.length ?? 0) + (planned?.moves.length ?? 0))
      })
    }
  })
})
