import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { readEditedDocx, type DocParagraph, type EditedDocx } from '@/lib/docxRead'
import { withLostBookmarks } from '@/lib/docxEdits'
import { MOVE_ORDER, applyHunk, planImport, rendered } from '@/lib/docxImport'
import type { DraftBook } from '@/lib/bookDraft'

/*
  A scene's bookmark when an edit takes out its opening words, or joins across
  a `#` (round-trip-plan-4.md, T21.3, S10; the editor's S-1 in the third loop:
  "untested in three rounds"). Each file was made in LibreOffice from the
  third loop's round-1 file (`scripts/lo-scene-openings.py`). With tracking on,
  every bookmark stays and every change came in. With it off, LibreOffice drops
  the scene's bookmark with its opening words: the scene was matched by its
  words, and every change in it made with tracking off was dropped without a
  word; where the break went too, its prose came in as words added to the scene
  before, and made, it was in the book twice.
*/

const F = path.join(__dirname, 'fixtures/docx')
const sent = (JSON.parse(readFileSync(path.join(F, 'run-2026-11-14-loop3/draft-sent-1.json'), 'utf8')) as { book: DraftBook }).book
const scenes = sent.chapters.flatMap((c) => c.scenes)
const [S0, S1] = [rendered(scenes[0].text), rendered(scenes[1].text)]
const FIRST = 'The fog came in with the evening tide, as it did most nights in the last month of the year, rolling over the flats in a low white wall that swallowed the marker poles one by one. '
const [P1, P2] = S1.split('\n\n')

/** Each scene of the book with every change brought in made: the moves, then the rest, as the Changes panel makes them. */
async function made(name: string) {
  const read = await readEditedDocx(new Uint8Array(readFileSync(path.join(F, 's10-scene-openings', `${name}.docx`))))
  const plan = planImport(read, sent, sent)
  const out = new Map(scenes.map((s) => [s.id, rendered(s.text)]))
  for (const s of plan.scenes) {
    let text = out.get(s.eventId)!
    const moves = [...s.moves].sort((a, b) => MOVE_ORDER[a.part] - MOVE_ORDER[b.part])
    for (const h of [...moves.map((m) => m.hunk), ...s.untracked, ...s.tracked]) {
      const next = applyHunk(text, h)
      expect(next, `${name}: ${h.before} → ${h.after}`).not.toBeNull()
      text = next!
    }
    out.set(s.eventId, text)
  }
  return { plan, at: (k: number) => out.get(scenes[k].id)! }
}

describe('a scene’s opening words taken out, in LibreOffice: each change comes in, tracked or not', () => {
  for (const how of ['tracked', 'plain']) {
    it(`its first sentence (${how})`, async () => {
      const { at } = await made(`first-sentence-${how}`)
      expect(S1.startsWith(FIRST)).toBe(true)
      expect(at(1)).toBe(S1.slice(FIRST.length))
      expect(at(0)).toBe(S0)
    })
    it(`its first paragraph (${how})`, async () => {
      const { at } = await made(`first-paragraph-${how}`)
      expect(at(1)).toBe(S1.slice(P1.length + 2))
      expect(at(0)).toBe(S0)
    })
    it(`its first sentence moved to the end of its second paragraph (${how})`, async () => {
      const { at } = await made(`opening-moved-${how}`)
      expect(at(1)).toBe(S1.replace(FIRST, '').replace(P2, `${P2} ${FIRST.trim()}`))
    })
    it(`the break and its first sentence, the rest joined to the scene before (${how}): every word once`, async () => {
      const { at } = await made(`opening-and-break-${how}`)
      const rest = P1.slice(FIRST.length)
      if (how === 'plain') {
        // As the file has it: the rest of its first paragraph is the scene before's last, and the scene's prose is not in the book twice.
        expect(at(0)).toBe(`${S0} ${rest}`)
        expect(at(1)).toBe(S1.slice(P1.length + 2))
      } else {
        // Tracked, the bookmark stays, and so does the scene's first paragraph, without its first sentence; the break is the writer's to take out.
        expect(at(1)).toBe(S1.slice(FIRST.length))
      }
      expect(`${at(0)}\n\n${at(1)}`.split(rest.slice(0, 40)).length - 1).toBe(1)
    })
  }

  it('with tracking off, the file has lost the scene’s bookmark, and only then is it given back', async () => {
    const plain = await readEditedDocx(new Uint8Array(readFileSync(path.join(F, 's10-scene-openings/first-sentence-plain.docx'))))
    const tracked = await readEditedDocx(new Uint8Array(readFileSync(path.join(F, 's10-scene-openings/first-sentence-tracked.docx'))))
    const draft = scenes.map((s) => rendered(s.text).split('\n\n'))
    expect(plain.paragraphs.some((p) => p.scene === 1)).toBe(false)
    expect(withLostBookmarks(plain, draft).paragraphs.some((p) => p.scene === 1)).toBe(true)
    expect(tracked.paragraphs.some((p) => p.scene === 1)).toBe(true)
    expect(withLostBookmarks(tracked, draft)).toBe(tracked)
  })
})

describe('across a scene break, in LibreOffice', () => {
  it('the paragraphs either side joined: the bookmark holds, and with tracking off the line joined comes to the scene after', async () => {
    const plain = await made('join-across-plain')
    const last = S0.split('\n\n').at(-1)!
    expect(plain.at(0)).toBe(S0.slice(0, -(last.length + 2)))
    expect(plain.at(1)).toBe(`${last} ${S1}`)
    const tracked = await made('join-across-tracked')
    expect(tracked.at(1)).toBe(S1)
    // The break taken out, tracked, is said: a scene break is the writer's to take out (T15).
    expect(tracked.plan.outside.length).toBe(1)
  })
  it('the break alone taken out: no prose changed', async () => {
    for (const how of ['plain', 'tracked']) {
      const { at } = await made(`break-out-${how}`)
      expect([at(0), at(1)]).toEqual([S0, S1])
    }
  })
})

describe('giving a scene back its prose: only where there is no doubt which scene', () => {
  const para = (scene: number | null, text: string, style = 'Normal'): DocParagraph => ({ scene, style, pieces: [{ kind: 'same', text, italic: false }] })
  const brk = para(null, '#', 'SceneBreak')
  const doc = (paragraphs: DocParagraph[]): EditedDocx => ({ draftId: 'd', worldId: 'w', paragraphs, comments: [] })
  const draft = [
    ['The harbour slept under its lamps.'],
    ['Wind came off the marshes, bending reeds toward the town.', 'Gulls wheeled over the boatsheds, crying.'],
    ['Morning brought carts and fishwives shouting prices.'],
    ['Evening, and the tavern filled with sailors.'],
  ]
  const scenesOf = (d: EditedDocx) => d.paragraphs.filter((p) => p.style === 'Normal').map((p) => p.scene)

  it('by place: one scene missing between two, and its words', () => {
    const file = doc([para(0, draft[0][0]), brk, para(null, 'Bending reeds toward the town.'), para(null, draft[1][1]), brk, para(2, draft[2][0]), brk, para(3, draft[3][0])])
    expect(scenesOf(withLostBookmarks(file, draft))).toEqual([0, 1, 1, 2, 3])
  })
  it('not where two are missing between the scenes either side, nor where the words are another’s', () => {
    const two = doc([para(0, draft[0][0]), brk, para(null, draft[1][1]), brk, para(null, draft[2][0]), brk, para(3, draft[3][0])])
    expect(scenesOf(withLostBookmarks(two, draft))).toEqual([0, null, null, 3])
    const theirs = doc([para(0, draft[0][0]), brk, para(null, 'A new scene the editor wrote, entirely their own invention here.'), brk, para(2, draft[2][0]), brk, para(3, draft[3][0])])
    expect(scenesOf(withLostBookmarks(theirs, draft))).toEqual([0, null, 2, 3])
  })
  it('run on: the missing scene’s own paragraphs at the end of the scene before, from the first of them', () => {
    const file = doc([para(0, `${draft[0][0]} Reeds toward the town.`), para(0, draft[1][1]), brk, para(2, draft[2][0]), brk, para(3, draft[3][0])])
    expect(scenesOf(withLostBookmarks(file, draft))).toEqual([0, 1, 2, 3])
    // Not a scene before made all of the missing one's paragraphs: its first is its own.
    const all = doc([para(0, draft[1][1]), brk, para(2, draft[2][0]), brk, para(3, draft[3][0])])
    expect(scenesOf(withLostBookmarks(all, draft))).toEqual([0, 2, 3])
    // Nor one the scene before has too.
    const both = [[draft[0][0], draft[1][1]], draft[1], draft[2], draft[3]]
    expect(scenesOf(withLostBookmarks(file, both))).toEqual([0, 0, 2, 3])
  })
})
