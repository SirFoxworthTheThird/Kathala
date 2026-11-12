import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { markedParagraphs, markedPlan, type MarkedParagraph } from '@/lib/markedDocx'
import { paragraphBlocks } from '@/lib/manuscriptParagraphs'
import { readEditedDocx } from '@/lib/docxRead'
import { hunks } from '@/lib/docxEdits'
import type { DraftBook } from '@/lib/bookDraft'

/*
  The second loop's two marked files, as the export makes them today
  (round-trip-plan-3.md, T8.0; loop-2026-11-12.md, finding 1).

  The editor could not read them where the writer had rewritten: one paragraph
  carried 113 one-word marks, and the paragraph it should have been compared
  with came back whole, as new. Nothing here changes the export. It remakes the
  two files from the drafts they were made from, shows they are the files the
  run sent, and writes down what they cost, so that T8.1–T8.3 are measured
  against numbers and not against a memory of them.

  The numbers are the export's as it is. A part that makes them better turns
  the test that holds them red, and that test is then rewritten as a ceiling.
  The three `it.fails` are what T8 is for: each fails today, and goes red the
  day it stops failing, to be made a plain test.
*/

const F = path.join(__dirname, 'fixtures/docx/run-2026-11-12-loop2')
const draft = (n: string) => JSON.parse(readFileSync(path.join(F, `draft-${n}.json`), 'utf8')) as { id: string; name: string; book: DraftBook }

/** A round of the run: the book as the editor sent it back, the book as it went out marked, and the file that went. */
const ROUNDS = [
  { name: 'round 2', back: 'back-1', marked: 'marked-2', file: 'round2-from-writer.docx' },
  { name: 'round 3', back: 'back-2', marked: 'marked-3', file: 'round3-from-writer.docx' },
] as const

function made(round: (typeof ROUNDS)[number]) {
  const base = new Map(draft(round.back).book.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text]))
  const scenes = draft(round.marked).book.chapters.flatMap((c) => c.scenes)
  return { base, scenes, paras: scenes.map((s) => markedParagraphs(base.get(s.id) ?? null, s.text)) }
}

/** A paragraph as its mark and its stretches, neighbours of a kind run together: what a file holds, however it cut its runs. */
const shape = (breakMark: string, runs: ReadonlyArray<{ kind: string; text: string }>) => {
  const out: string[] = []
  let last = ''
  for (const r of runs) {
    if (r.kind === last) out[out.length - 1] += r.text
    else out.push(`${r.kind}:${r.text}`)
    last = r.kind
  }
  return `${breakMark}/${out.join('|')}`
}

const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean)
/** How alike two paragraphs are: their words in common, as a bag, over the longer. A measure for these tests only. */
function likeness(a: string, b: string): number {
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
function displaced(round: (typeof ROUNDS)[number]): string[] {
  const { base, scenes, paras } = made(round)
  const out: string[] = []
  scenes.forEach((s, i) => {
    const was = plainParas(base.get(s.id) ?? '')
    const now = plainParas(s.text)
    for (const p of paras[i]) {
      if (p.mark === 'ins' && Math.max(0, ...was.map((w) => likeness(w, after(p)))) >= 0.6) out.push(after(p).slice(0, 40))
      if (p.mark === 'del' && Math.max(0, ...now.map((w) => likeness(w, before(p)))) >= 0.6) out.push(before(p).slice(0, 40))
    }
  })
  return out
}

const mostMarks = (round: (typeof ROUNDS)[number]) => Math.max(...made(round).paras.flat().map((p) => p.runs.filter((r) => r.kind !== 'same').length))
const dialogCount = (round: (typeof ROUNDS)[number]) => {
  const { scenes } = made(round)
  return markedPlan({ sentBack: { id: draft(round.back).id }, base: draft(round.back).book, scenes: scenes.map((s) => ({ eventId: s.id, text: s.text })), notes: [], author: 'Elin Ashgrove', now: 0 }).changes
}
/** The changes between the two texts as bringing a file in counts them (`hunks`, T1.3). */
const asBroughtIn = (round: (typeof ROUNDS)[number]) => {
  const { base, scenes } = made(round)
  return scenes.reduce((n, s) => n + hunks(base.get(s.id) ?? '', s.text).length, 0)
}

describe('the second loop’s marked files, remade (round-trip-plan-3.md, T8.0)', () => {
  // Holds while the export marks as it did in the run. T8.1 changes the marks, and this then gives way to the
  // reader's test: every change rejected is the editor's text, every one accepted the writer's.
  it('the drafts in the fixtures make the files the run sent, mark for mark, in every scene', async () => {
    for (const round of ROUNDS) {
      const { scenes, paras } = made(round)
      const doc = await readEditedDocx(new Uint8Array(readFileSync(path.join(F, round.file))))
      const inFile = new Map<number, string[]>()
      for (const p of doc.paragraphs) {
        if (p.scene === null || p.scene === undefined || p.style !== 'Normal') continue
        const runs = p.pieces.filter((x): x is Extract<typeof x, { text: string }> => 'text' in x)
        inFile.set(p.scene, [...(inFile.get(p.scene) ?? []), shape(p.mark?.kind ?? 'same', runs)])
      }
      expect(scenes.length, round.name).toBe(16)
      scenes.forEach((s, i) => expect(paras[i].map((p) => shape(p.breakMark, p.runs)), `${round.name}, ${s.title}`).toEqual(inFile.get(i)))
    }
  })

  it('what they cost, in numbers: the most marks in one paragraph, the dialog’s count, and the paragraphs displaced', () => {
    // The editor counted 113 and 95 in the files: a run cut in two by a comment's mark is two there, and one here.
    expect(ROUNDS.map(mostMarks)).toEqual([112, 94])
    // What the dialog told the writer: "160 changes", then "134".
    expect(ROUNDS.map(dialogCount)).toEqual([160, 134])
    // The same two texts, as bringing a file in would count their difference.
    expect(ROUNDS.map(asBroughtIn)).toEqual([49, 42])
    expect(ROUNDS.map(displaced)).toEqual([
      ['There was a message waiting for her at t', 'Then she held out the warehouseman\'s boo'],
      ['She was halfway through the second when ', 'They went in at slack water on the top o'],
    ])
  })
})

describe('what T8 is for: each of these fails today', () => {
  it.fails('T8.1: a new paragraph before one barely changed is one insertion, and the changed one keeps its words', () => {
    const base = 'The fog came in.\n\nWren read the note twice and put it in her sleeve.\n\nThe bell rang.'
    const now = 'The fog came in.\n\nNessa had brought three lanterns from the chandler.\n\nWren read the note twice, slowly, and put it in her sleeve.\n\nThe bell rang.'
    expect(markedParagraphs(base, now).map((p) => shape(p.mark, p.runs))).toEqual([
      'same/same:The fog came in.',
      'ins/ins:Nessa had brought three lanterns from the chandler.',
      // As the words are compared today: "twice" made "twice,", and "slowly, " put in.
      'same/same:Wren read the note |del:twice|ins:twice,|same: |ins:slowly, |same:and put it in her sleeve.',
      'same/same:The bell rang.',
    ])
  })

  it.fails('T8.1: in the run’s files, no paragraph is put in or taken out whole while one like it stands on the other side', () => {
    expect(ROUNDS.flatMap(displaced)).toEqual([])
  })

  it.fails('T8.3: the dialog’s count is what bringing the file in would say', () => {
    expect(ROUNDS.map(dialogCount)).toEqual(ROUNDS.map(asBroughtIn))
  })
})
