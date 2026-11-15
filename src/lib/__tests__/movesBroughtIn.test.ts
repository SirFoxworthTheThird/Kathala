import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { readEditedDocx } from '@/lib/docxRead'
import { withChangesMade } from '@/lib/docxEdits'
import { MOVE_ORDER, applyHunk, placeRun, planImport, tryChange } from '@/lib/docxImport'
import type { DraftBook } from '@/lib/bookDraft'

/*
  Bringing in a move (round-trip-plan-4.md, T19; loop-2026-11-14.md, finding
  8). The third loop's editor made three moves in round 2, and LibreOffice
  wrote each as a real move, the first in any loop. One came in as three
  changes, two reading as nonsense (`Hanne grunted. "WhenThe gate's at…`). One
  was refused as running two sentences together, and the two spaces the editor
  put right beside it as words changed since, in a scene nobody had touched.
*/

const F = path.join(__dirname, 'fixtures/docx/run-2026-11-14-loop3')
const draft = (n: string) => (JSON.parse(readFileSync(path.join(F, `draft-${n}.json`), 'utf8')) as { book: DraftBook }).book

async function roundTwo() {
  const read = await readEditedDocx(new Uint8Array(readFileSync(path.join(F, 'round2-from-editor.docx'))))
  const doc = withChangesMade(read, read.markedBy!)
  // Against the book as it was when the file came in.
  const book = draft('before-2')
  const plan = planImport(doc, draft('marked-2'), book)
  const prose = new Map(book.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text]))
  const moves = new Map<string, Array<{ eventId: string; part: keyof typeof MOVE_ORDER; before: string; after: string; prefix: string; suffix: string }>>()
  for (const s of plan.scenes) for (const m of s.moves) moves.set(m.id, [...(moves.get(m.id) ?? []), { eventId: s.eventId, part: m.part, ...m.hunk }])
  for (const rows of moves.values()) rows.sort((a, b) => MOVE_ORDER[a.part] - MOVE_ORDER[b.part])
  return { plan, prose, moves: [...moves.values()] }
}

describe('the third loop’s round 2: three moves, each one change that can be made', () => {
  it('the move whose space fell on the other side is one change, its words placed whole; none of the three is in pieces', async () => {
    const { plan, moves } = await roundTwo()
    expect(moves).toHaveLength(3)
    const gate = moves.find((rows) => rows.some((r) => r.after.includes('The gate\'s at the cellar end')))!
    expect(gate.map((r) => r.part)).toEqual(['from', 'to'])
    expect(gate[1].after).toContain('"The gate\'s at the cellar end, the slip beside it where the barges came up, and the culvert runs out from behind the gate. ')
    // No change of its own is left with the move's words in it, nor the nonsense the comparison made of them.
    const tracked = plan.scenes.flatMap((s) => s.tracked)
    expect(tracked.filter((h) => `${h.before}${h.after}`.includes('The gate\'s at') || h.before === '"When ')).toEqual([])
  })

  it('the move with the spaces put right beside it: made with them, as one change, and it can be made', async () => {
    const { plan, prose, moves } = await roundTwo()
    const vael = moves.find((rows) => rows.some((r) => r.before.includes('Vael set the lamp')))!
    expect(vael.map((r) => [r.part, r.before, r.after])).toEqual([
      ['from', '" Vael set the lamp down on a pallet. "', ''],
      ['to', 'ring. ', 'ring. " Vael set the lamp down on a pallet. "'],
      ['with', 'coat.I ', 'coat. I '],
      ['with', 'ring. "', 'ring."'],
    ])
    expect(plan.scenes.flatMap((s) => s.tracked).filter((h) => h.before === 'coat.I ' || h.before === 'ring. "')).toEqual([])
    const tried = tryChange(vael, (id) => prose.get(id) ?? '')
    expect(tried.result).toBe('ok')
    const made = tried.result === 'ok' ? tried.after.get(vael[0].eventId)! : ''
    expect(made).toContain('dressed up in a Harl coat. I had the man who brings it in')
    expect(made).toContain('get a look at his ring." Vael set the lamp down on a pallet. "All they needed')
  })

  it('every move made, each scene is the editor’s, and so is every change made in turn', async () => {
    const { plan, prose, moves } = await roundTwo()
    for (const rows of moves) expect(tryChange(rows, (id) => prose.get(id) ?? '').result).toBe('ok')
    // Every scene with a move in it: its changes made in the order the file has them, the moves first, is the editor's text.
    for (const s of plan.scenes.filter((x) => x.moves.length)) {
      let text = prose.get(s.eventId)!
      for (const rows of moves.filter((r) => r[0].eventId === s.eventId)) for (const r of rows) text = applyHunk(text, r) ?? text
      for (const h of s.tracked) text = applyHunk(text, h) ?? text
      expect(text, s.eventId).toBe(s.edited)
    }
  })
})

describe('placeRun', () => {
  it('a move’s words, with the space on whichever side leaves what the other text has there', () => {
    const text = 'Hanne grunted. "The gate is shut. When the river turned."'
    expect(placeRun(text, 'The gate is shut.', 'Hanne grunted. "When the river turned."')).toEqual([16, 34])
    expect(placeRun('A word. The gate is shut. B word.', 'The gate is shut.', 'A word. B word.')).toEqual([8, 26])
  })
  it('across a line break, as its words; not where the other text is not what is left; not where it is twice', () => {
    expect(placeRun('One two\nthree four.', 'two three', 'One four.')).toEqual([4, 14])
    expect(placeRun('A word. The gate. B word.', 'The gate.', 'Something else.')).toBeNull()
    expect(placeRun('The gate. The gate.', 'The gate.', 'The gate.')).toBeNull()
    expect(placeRun('No such words.', 'The gate.', 'No such words.')).toBeNull()
  })
})
