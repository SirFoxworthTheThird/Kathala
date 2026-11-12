import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { markedParagraphs, hasMarks, markedPlan, likeness, changeCount, settleBreaks } from '@/lib/markedDocx'
import { compileDocx } from '@/lib/manuscriptExport'
import { readEditedDocx, type DocParagraph, type EditedDocx } from '@/lib/docxRead'
import { docScenes, outsideScenes, titlePageCount, withChangesMade } from '@/lib/docxEdits'
import { rendered } from '@/lib/docxImport'
import type { BuiltManuscript } from '@/lib/manuscriptCompile'
import type { DraftBook } from '@/lib/bookDraft'
import type { ProseNote } from '@/types'

/** The book as the writer sends it back, marked against what the editor sent (round-trip-plan-2.md, T5.1). */

const shown = (paras: ReturnType<typeof markedParagraphs>) =>
  paras.map((p) => `${p.mark}:${p.runs.map((r) => (r.kind === 'same' ? r.text : `[${r.kind} ${r.em ? '_' : ''}${r.text}${r.em ? '_' : ''}]`)).join('')}`)

describe('markedParagraphs', () => {
  it('a scene as the editor left it is unmarked', () => {
    const paras = markedParagraphs('The fog came in.\n\nShe counted.', 'The fog came in.\n\nShe counted.')
    expect(hasMarks(paras)).toBe(false)
    expect(shown(paras)).toEqual(['same:The fog came in.', 'same:She counted.'])
  })

  it('a word replaced is a deletion beside an insertion, in its paragraph', () => {
    expect(shown(markedParagraphs('like wet wool.', 'like sodden wool.'))).toEqual(['same:like [del wet][ins sodden] wool.'])
  })

  it('a paragraph put in or taken out is so whole, its mark with it; the others are untouched', () => {
    expect(shown(markedParagraphs('One.\n\nThree.', 'One.\n\nTwo.\n\nThree.'))).toEqual(['same:One.', 'ins:[ins Two.]', 'same:Three.'])
    expect(shown(markedParagraphs('One.\n\nTwo.\n\nThree.', 'One.\n\nThree.'))).toEqual(['same:One.', 'del:[del Two.]', 'same:Three.'])
  })

  it('a scene the editor’s file did not have is all put in', () => {
    expect(shown(markedParagraphs(null, 'New.\n\nAll of it.'))).toEqual(['ins:[ins New.]', 'ins:[ins All of it.]'])
  })

  it('italics are carried on each run, the marks themselves never written as text', () => {
    expect(shown(markedParagraphs('The _Constant_ sailed.', 'The _Constance_ sailed.'))).toEqual(['same:The [del _Constant_][ins _Constance_] sailed.'])
  })
})

/*
  In the XML Word itself writes, which the app's reader is kinder than: it
  drops an empty paragraph, and reads deleted words whatever they are wrapped
  in. Word does neither. A paragraph put in or taken out carries its mark
  (`w:pPr/w:rPr/w:ins|w:del`), or rejecting it leaves an empty line; deleted
  words are `w:delText`, as Word writes them, never `w:t`.
*/
describe('the marked file, as Word reads it (round-trip-plan-2.md, T5.1)', () => {
  const one: BuiltManuscript = {
    totalWords: 0, totalScenes: 1, writtenScenes: 1,
    chapters: [{ id: 'c', number: 1, title: 'C', synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: 1,
      scenes: [{ eventId: 'e', title: 'S', text: 'One.\n\nTwo, sodden.\n\nFour.', wordCount: 0, written: true, status: 'draft' }] }],
  }
  const xmlOf = async (base: string) => {
    const bytes = compileDocx(one, { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: () => 0, marked: { author: 'Nell Garrow', date: '2026-11-10T09:00:00Z', base: () => base } } })
    const { readZip } = await import('@/lib/zip')
    return new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'))
  }

  it('a paragraph put in, and one taken out, each carry their paragraph mark, signed', async () => {
    const doc = await xmlOf('One.\n\nTwo, wet.\n\nThree.\n\nFour.')
    const paras = doc.match(/<w:p>.*?<\/w:p>/g)!.filter((p) => /Two|Three|One|Four/.test(p))
    const of = (word: string) => paras.find((p) => p.includes(word))!
    expect(of('Three')).toMatch(/<w:pPr><w:rPr><w:del w:id="\d+" w:author="Nell Garrow" w:date="[^"]+"\/><\/w:rPr><\/w:pPr>/)
    expect(of('One')).not.toMatch(/<w:rPr><w:(ins|del) /)
    // A paragraph put in after one in both: as Word marks one typed there, the break put in is that paragraph's, and the new one keeps the break it had.
    const added = (await xmlOf('One.\n\nFour.')).match(/<w:p>.*?<\/w:p>/g)!
    expect(added.find((p) => p.includes('One'))).toMatch(/<w:pPr><w:rPr><w:ins w:id="\d+" w:author="Nell Garrow"/)
    expect(added.find((p) => p.includes('Two'))).not.toMatch(/<w:pPr><w:rPr><w:(ins|del) /)
    // One put in at the scene's start, with nothing before it in the scene, carries its own.
    const first = (await xmlOf('Two, sodden.\n\nFour.')).match(/<w:p>.*?<\/w:p>/g)!
    expect(first.find((p) => p.includes('One'))).toMatch(/<w:pPr><w:rPr><w:ins w:id="\d+" w:author="Nell Garrow"/)
  })

  it('deleted words are w:delText inside w:del, and put-in words w:t inside w:ins, each with its own id', async () => {
    const doc = await xmlOf('One.\n\nTwo, wet.\n\nFour.')
    const dels = doc.match(/<w:del [^>]*>.*?<\/w:del>/g) ?? []
    expect(dels.length).toBeGreaterThan(0)
    for (const d of dels) { expect(d).toContain('<w:delText'); expect(d).not.toContain('<w:t ') }
    // The full stop the two share is kept, not marked.
    expect(doc).toMatch(/<w:ins [^>]*><w:r><w:t xml:space="preserve">sodden<\/w:t><\/w:r><\/w:ins>/)
    const ids = [...doc.matchAll(/<w:(?:ins|del) w:id="(\d+)"/g)].map((m) => m[1])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

/*
  A marked file an editor can read (round-trip-plan-3.md, T8.1–T8.3). The
  second loop's editor could not: paragraphs were paired in order, so a new
  one was compared word by word with an old one it had nothing to do with.
  The cases are the run's, and the numbers in `likeness` are set between them
  (`t8-1-readable-marks.md`).
*/
describe('which paragraph is compared with which (T8.1)', () => {
  it('a paragraph changed keeps half its words or more, in order; two with nothing in common but small words are not alike', () => {
    expect(likeness('Wren read the note twice and put it in her sleeve.', 'Wren read the note twice, slowly, and put it in her sleeve.')).toBeGreaterThan(0.9)
    // Rewritten by half, and still the same paragraph.
    expect(likeness('Vane looked at Agathe Sorrel. Everyone in the hall looked with him.', 'Vane turned his head toward Agathe Sorrel, and everyone in the hall turned with him.')).toBeGreaterThanOrEqual(0.5)
    expect(likeness('The fog came off the estuary before dawn and lay on the quay like wet wool.', 'She did not know the man at the door, and he did not give his name to her.')).toBe(0)
  })

  it('one kept whole inside another is its pair, though most of the longer is new: a sentence that gained three, a paragraph cut to its opening', () => {
    // The run's: 0.17 by words over the longer, and the same paragraph to any reader.
    expect(likeness('So he knew that too.', 'So he knew that too. Thale’s men had been to the chandler’s before she had, and to the Gull, and they had asked the same questions in the same order.')).toBeGreaterThan(0)
    expect(likeness('"Hale," he said.', '"Hale," he said. "Mell swore it wasn’t on him."')).toBeGreaterThan(0)
    expect(likeness('Then they took him along the Walk toward the gate, past the chandler’s and the rope store, and nobody on the Walk looked at him, and the gate shut behind them.', 'Then they took him along the Walk toward the gate, and the gate shut.')).toBeGreaterThan(0)
  })

  it('a short line is not paired with a long paragraph that merely has its words somewhere, in order', () => {
    // Four of its five words are there, in order, and no three of them together.
    const long = 'Brother Hale turned to the third sheet, and read the entry for the fifteenth aloud, and then the one under it, slowly. "So," said the clerk at last, and Corin looked up.'
    expect(likeness('"And the Gannet?" said Corin.', long)).toBe(0)
    // Nor two one-word lines that are not the same word.
    expect(likeness('"No."', '"Yes," she said.')).toBe(0)
  })

  it('a new paragraph before one barely changed is one insertion, and the changed one keeps its words', () => {
    const base = 'The fog came in.\n\nWren read the note twice and put it in her sleeve.\n\nThe bell rang.'
    const now = 'The fog came in.\n\nNessa had brought three lanterns from the chandler.\n\nWren read the note twice, slowly, and put it in her sleeve.\n\nThe bell rang.'
    expect(shown(markedParagraphs(base, now))).toEqual([
      'same:The fog came in.',
      'ins:[ins Nessa had brought three lanterns from the chandler.]',
      'same:Wren read the note twice[ins , slowly,] and put it in her sleeve.',
      'same:The bell rang.',
    ])
  })

  it('a paragraph split in two is compared with the half more like it, and the other is new; one with no like is taken out whole beside its replacement', () => {
    const whole = 'She went down the stair with the lamp held low. The water had come up over the third step, and it was still rising, and she counted the steps she could not see.'
    const first = 'She went down the stair with the lamp held low.'
    const rest = 'The water had come up over the third step, and it was still rising, and she counted the steps she could not see.'
    expect(shown(markedParagraphs(`Before.\n\n${whole}\n\nAfter.`, `Before.\n\n${first}\n\n${rest}\n\nAfter.`))).toEqual([
      'same:Before.',
      `ins:[ins ${first}]`,
      `same:[del ${first} ]${rest}`,
      'same:After.',
    ])
    expect(shown(markedParagraphs('Before.\n\nThe harbourmaster kept no dog.\n\nAfter.', 'Before.\n\nNobody had seen the lugger come in that night.\n\nAfter.'))).toEqual([
      'same:Before.',
      'del:[del The harbourmaster kept no dog.]',
      'ins:[ins Nobody had seen the lugger come in that night.]',
      'same:After.',
    ])
  })
})

describe('a change as a reader counts it (T8.2, T8.3)', () => {
  const one = (base: string, now: string) => shown(markedParagraphs(base, now))[0]

  it('two changes a word or two apart are one stretch out and one in; further apart, or in two sentences, they are two', () => {
    expect(one('She went down the stair with the lamp. She did not know afterwards why she felt calm.', 'She went down the stair with the lamp. She did not see until later why she was calm.'))
      .toBe('same:She went down the stair with the lamp. She did not [del know afterwards why she felt][ins see until later why she was] calm.')
    expect(one('Thale looked up at the sky. The fog had burnt off at noon, and the sun was out.', 'Thale looked up at the sky. The fog was burning off as he spoke, and the sun was out.'))
      .toBe('same:Thale looked up at the sky. The fog [del had burnt off at noon][ins was burning off as he spoke], and the sun was out.')
    // Three words kept between them.
    expect(one('The old wall stood by the north gate.', 'The ancient wall stood by the south gate.')).toBe('same:The [del old][ins ancient] wall stood by the [del north][ins south] gate.')
    // Two words between them, and a sentence's end.
    expect(one('It was late, she said. She left the room.', 'It was early, she said. He left the room.')).toBe('same:It was [del late][ins early], she said. [del She][ins He] left the room.')
  })

  it('what a change’s two sides share at either end is kept: an insertion puts in only what it adds', () => {
    expect(one('Wren read the note twice and put it away.', 'Wren read the note twice, slowly, and put it away.')).toBe('same:Wren read the note twice[ins , slowly,] and put it away.')
    expect(one('He left at dawn.', 'He left at dawn in the rain.')).toBe('same:He left at dawn[ins  in the rain].')
  })

  it('counts a stretch once: a word replaced, paragraphs put in one after another, a paragraph and the change beside it', () => {
    const count = (base: string | null, now: string) => changeCount(markedParagraphs(base, now))
    expect(count('The fog came in.', 'The fog came in.')).toBe(0)
    expect(count('like wet wool, she said.', 'like sodden wool, she said.')).toBe(1)
    expect(count('The old wall stood by the north gate.', 'The ancient wall stood by the south gate.')).toBe(2)
    // Two new paragraphs together are one change; apart, two.
    expect(count('One.\n\nFour.', 'One.\n\nTwo is new.\n\nThree is new.\n\nFour.')).toBe(1)
    expect(count('One.\n\nThree.\n\nFive.', 'One.\n\nTwo is new.\n\nThree.\n\nFour is new.\n\nFive.')).toBe(2)
    // A paragraph taken out and another put in its place.
    expect(count('Before.\n\nThe harbourmaster kept no dog.\n\nAfter.', 'Before.\n\nNobody had seen the lugger come in that night.\n\nAfter.')).toBe(1)
    // A scene the file did not have.
    expect(count(null, 'New.\n\nAll of it.')).toBe(1)
  })
})

/*
  Which break a new paragraph's mark goes on, and the title page's count
  (round-trip-plan-3.md, T8.4). LibreOffice's reject-all left an empty
  paragraph where a new paragraph followed one with a comment in it, and with
  the mark on the new paragraph's own break it joins two paragraphs where the
  one before ends in words put in. CI has no LibreOffice: `npm run probe:marked`
  holds what it does with each form, and these hold which form is written.
*/
describe('a new paragraph after one with a comment in it (T8.4)', () => {
  const A = 'The ninth bell had already gone when she climbed the back stair.'
  const B = 'Somewhere below, a door was shut with more care than a door needs.'
  const B2 = 'Nobody on the stair said anything about it.'
  const C = 'Low water was at a quarter past.'
  const breaks = (base: string, now: string, commented: number[]) => {
    const paras = markedParagraphs(base, now)
    settleBreaks(paras, (k) => commented.includes(k))
    return paras.map((p) => `${p.mark}/${p.breakMark}`)
  }

  it('the mark goes on the new paragraph’s own break, and the last of several; with no comment, on the break before, as Word marks it', () => {
    expect(breaks(`${A}\n\n${C}`, `${A}\n\n${B}\n\n${C}`, [])).toEqual(['same/ins', 'ins/same', 'same/same'])
    expect(breaks(`${A}\n\n${C}`, `${A}\n\n${B}\n\n${C}`, [0])).toEqual(['same/same', 'ins/ins', 'same/same'])
    expect(breaks(`${A}\n\n${C}`, `${A}\n\n${B}\n\n${B2}\n\n${C}`, [0])).toEqual(['same/same', 'ins/ins', 'ins/ins', 'same/same'])
    // A comment on another paragraph changes nothing.
    expect(breaks(`${A}\n\n${C}`, `${A}\n\n${B}\n\n${C}`, [1, 2])).toEqual(['same/ins', 'ins/same', 'same/same'])
  })

  it('not where the paragraph before ends in words put in: there Word’s form stays, comment or none', () => {
    expect(breaks(`${A}\n\n${C}`, `${A} She counted them twice.\n\n${B}\n\n${C}`, [0])).toEqual(['same/ins', 'ins/same', 'same/same'])
    // Ending in words taken out is no such case.
    expect(breaks(`${A} She counted them twice.\n\n${C}`, `${A}\n\n${B}\n\n${C}`, [0])).toEqual(['same/same', 'ins/ins', 'same/same'])
  })

  const book = (text: string): BuiltManuscript => ({
    totalWords: 0, totalScenes: 1, writtenScenes: 1,
    chapters: [{ id: 'c', number: 1, title: 'C', synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: 1, scenes: [{ eventId: 'e', title: 'S', text, wordCount: 0, written: true, status: 'draft' }] }],
  })
  const file = (base: string, now: string, quote: string | null) => compileDocx(book(now), { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: () => 0, marked: {
    author: 'Elin Ashgrove', date: '2026-11-12T09:00:00Z', base: () => base,
    threads: quote ? [{ eventId: 'e', quote, done: false, comments: [{ author: 'Ines Marlowe', initials: 'IM', text: 'Which stair?' }, { author: 'Elin Ashgrove', initials: 'EA', text: 'The back one.' }] }] : [],
  } } })

  it('the file is written so: the commented paragraph’s break plain and the new one’s marked; and read back, rejected is the editor’s text and accepted the writer’s', async () => {
    const { readZip } = await import('@/lib/zip')
    const base = `${A}\n\n${C}`
    const now = `${A}\n\n${B}\n\n${C}`
    const paragraphs = async (bytes: Uint8Array) => (new TextDecoder().decode((await readZip(bytes)).get('word/document.xml')).match(/<w:p>.*?<\/w:p>/gs) ?? []).filter((x) => /ninth bell|Somewhere below/.test(x))
    const marked = (x: string) => /<w:pPr>(?:(?!<\/w:pPr>).)*<w:rPr><w:ins [^>]*\/><\/w:rPr>/.test(x)
    // With the comment: the first paragraph's break is plain, the new paragraph's its own.
    const commented = await paragraphs(file(base, now, 'climbed the back stair'))
    expect(commented.map(marked)).toEqual([false, true])
    expect(commented[0]).toContain('<w:commentReference')
    // Without: as Word marks it.
    expect((await paragraphs(file(base, now, null))).map(marked)).toEqual([true, false])
    for (const quote of ['climbed the back stair', null]) {
      const [part] = docScenes(await readEditedDocx(file(base, now, quote)))
      expect(part.original, `rejected, ${quote}`).toBe(base)
      expect(part.edited, `accepted, ${quote}`).toBe(now)
    }
  })
})

describe('the title page’s count (T8.4)', () => {
  const m: BuiltManuscript = {
    totalWords: 1320, totalScenes: 1, writtenScenes: 1,
    chapters: [{ id: 'c', number: 1, title: 'C', synopsis: '', wordCount: 1320, wordGoal: null, writtenScenes: 1, scenes: [{ eventId: 'e', title: 'S', text: 'The fog came in.', wordCount: 1320, written: true, status: 'draft' }] }],
  }
  const file = (titleCount?: string) => compileDocx(m, { submission: { name: 'Elin Ashgrove' }, forEditing: { draftId: 'D', worldId: 'W', sceneIndex: () => 0, marked: { author: 'Elin Ashgrove', date: '2026-11-12T09:00:00Z', base: () => 'The fog came in.', ...(titleCount ? { titleCount } : {}) } } })

  it('changed since the editor’s file, it is a change like any other: the old count out, the new one in, signed', async () => {
    const doc = await readEditedDocx(file('about 1,200 words'))
    expect(outsideScenes(doc).map((o) => [o.where, o.before, o.after])).toEqual([['title page', 'Elin Ashgrove\tabout 1,200 words', 'Elin Ashgrove\tabout 1,300 words']])
    const marks = doc.paragraphs[0].pieces.filter((x) => 'text' in x && x.kind !== 'same').map((x) => ('text' in x ? [x.kind, x.text, x.author] : []))
    expect(marks).toEqual([['del', 'about 1,200 words', 'Elin Ashgrove'], ['ins', 'about 1,300 words', 'Elin Ashgrove']])
    // Coming back, the writer's own changes made, it is no change, and the count is the new one.
    const made = withChangesMade(doc, 'Elin Ashgrove')
    expect(outsideScenes(made)).toEqual([])
    expect(titlePageCount(made)).toBe('about 1,300 words')
  })

  it('the same as the editor’s file, or with no count known, it is written plain', async () => {
    for (const count of ['about 1,300 words', undefined]) {
      const doc = await readEditedDocx(file(count))
      expect(outsideScenes(doc), String(count)).toEqual([])
      // Not a count struck and put in again the same: no mark at all on the line.
      expect(doc.paragraphs[0].pieces.filter((x) => 'text' in x).map((x) => ('text' in x ? x.kind : '')), String(count)).toEqual(['same'])
      expect(titlePageCount(doc)).toBe('about 1,300 words')
    }
  })

  it('is read from an editor’s file as it now says, and is null for a file with no title page', async () => {
    const loop = path.join(__dirname, 'fixtures/docx/run-2026-11-12-loop2')
    const read = async (f: string) => readEditedDocx(new Uint8Array(readFileSync(path.join(loop, f))))
    expect(titlePageCount(await read('round1-from-editor.docx'))).toBe('about 12,400 words')
    expect(titlePageCount(await read('round2-from-editor.docx'))).toBe('about 13,400 words')
    const plain = compileDocx(m, { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: () => 0 } })
    expect(titlePageCount(await readEditedDocx(plain))).toBeNull()
  })

  it('goes from the plan to the file: the count on the editor’s file is what the dialog’s plan is given', () => {
    const base: DraftBook = { version: 1, chapters: [{ id: 'c', number: 1, title: 'C', timelineId: 't', scenes: [{ id: 'e', title: 'S', text: 'The fog came in.' }] }] }
    const plan = (titleCount?: string) => markedPlan({ sentBack: { id: 'D', ...(titleCount ? { titleCount } : {}) }, base, scenes: [{ eventId: 'e', text: 'The fog came in.' }], notes: [], author: 'Elin Ashgrove', now: 0 })
    expect(plan('about 1,200 words').marked.titleCount).toBe('about 1,200 words')
    expect('titleCount' in plan().marked).toBe(false)
  })
})

/*
  The loop's own book: the writer's second draft, as it went back to the editor
  (draft-round2.json), marked against the editor's round-1 file as he sent it,
  every change of his taken — D-4. Read back with the app's own reader, each
  scene must be the editor's text with every change rejected and the writer's
  with every change accepted.
*/
describe('the loop’s revision, marked against the editor’s file (round-trip-plan-2.md, T5.1)', () => {
  const loop = path.join(__dirname, 'fixtures/docx/run-2026-11-10-loop')
  const draft = (r: 1 | 2) => JSON.parse(readFileSync(path.join(loop, `draft-round${r}.json`), 'utf8')) as { id: string; book: DraftBook }
  // Italics are compared apart (above): the reader writes `_`, the writer may have typed `*`.
  const words = (s: string) => rendered(s).replace(/[*_]/g, '')

  it('rejecting every change gives the editor’s text, and accepting every one gives the writer’s, scene by scene; signed with her name', async () => {
    // What the editor sent back: his round-1 file, every change taken, by the scene its bookmark names.
    const one = draft(1)
    const theirs = await readEditedDocx(new Uint8Array(readFileSync(path.join(loop, 'round1-from-editor.docx'))))
    const sentBack = new Map(docScenes(theirs).map((s) => [one.book.chapters.flatMap((c) => c.scenes)[s.index!].id, s.edited]))
    expect(sentBack.size).toBe(13)

    const two = draft(2)
    const scenes = two.book.chapters.flatMap((c) => c.scenes)
    const m: BuiltManuscript = {
      totalWords: 0, totalScenes: scenes.length, writtenScenes: scenes.length,
      chapters: two.book.chapters.map((c) => ({
        id: c.id, number: c.number, title: c.title, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: c.scenes.length,
        scenes: c.scenes.map((s) => ({ eventId: s.id, title: s.title, text: s.text, wordCount: 0, written: !!s.text.trim(), status: 'draft' as const })),
      })),
    }
    const index = new Map(scenes.map((s, i) => [s.id, i]))
    const bytes = compileDocx(m, {
      submission: { name: 'Nell Garrow' },
      forEditing: {
        draftId: two.id, worldId: 'W', sceneIndex: (id) => index.get(id),
        marked: { author: 'Nell Garrow', date: '2026-11-10T09:00:00Z', base: (id) => sentBack.get(id) ?? null },
      },
    })

    const back = await readEditedDocx(bytes)
    const parts = docScenes(back)
    expect(parts.length).toBe(13)
    let changed = 0
    for (const part of parts) {
      const scene = scenes[part.index!]
      expect(words(part.original), `${scene.title}: rejected`).toBe(words(sentBack.get(scene.id) ?? ''))
      expect(words(part.edited), `${scene.title}: accepted`).toBe(words(scene.text))
      if (part.original !== part.edited) changed++
      for (const a of part.authors) expect(a).toBe('Nell Garrow')
    }
    // She revised every scene of the book after his first pass (13 scenes changed, by Compare).
    expect(changed).toBe(13)

    // With the writer's changes made — as the file reads coming back with nothing turned back — it is the writer's text, whichever way it is read (T5.3).
    const made = docScenes(withChangesMade(back, 'Nell Garrow'))
    expect(made.length).toBe(13)
    for (const part of made) {
      const scene = scenes[part.index!]
      expect(words(part.original), `${scene.title}: the writer’s made`).toBe(words(scene.text))
      expect(part.original).toBe(part.edited)
      expect(part.authors).toEqual([])
    }
    // Another's changes are left as they are.
    expect(docScenes(withChangesMade(back, 'Jonah Pryce')).map((p) => p.original)).toEqual(parts.map((p) => p.original))
  })
})

/*
  The editor's comments going back, the writer's replies under them
  (round-trip-plan-2.md, T5.2, D-5), in the shape Word writes them (T5.0).
*/
describe('the threads going back (round-trip-plan-2.md, T5.2)', () => {
  const book: BuiltManuscript = {
    totalWords: 0, totalScenes: 1, writtenScenes: 1,
    chapters: [{ id: 'c', number: 1, title: 'C', synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: 1,
      scenes: [{ eventId: 'e', title: 'S', text: 'The fog came off the estuary before dawn.\n\nTamsin counted hulls by the sound of them.', wordCount: 0, written: true, status: 'draft' }] }],
  }
  const file = () => compileDocx(book, { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: () => 0, marked: {
    author: 'Nell Garrow', date: '2026-11-10T09:00:00Z',
    base: () => 'The fog came off the estuary at dawn.\n\nTamsin counted hulls by the sound of them.',
    threads: [
      { eventId: 'e', quote: 'counted hulls', done: false, comments: [{ author: 'Jonah Pryce', initials: 'JP', text: 'Lovely. Keep.' }, { author: 'Nell Garrow', initials: 'NG', text: 'Thank you.' }] },
      { eventId: 'e', quote: 'the fog lifted at noon', done: true, comments: [{ author: 'Jonah Pryce', initials: 'JP', text: 'Which hour?' }, { author: 'Nell Garrow', initials: 'NG', text: 'Before dawn now.' }] },
    ],
  } } })

  it('each comment goes back with its replies under it, by their authors, read so by the app’s own reader', async () => {
    const doc = await readEditedDocx(file())
    const roots = doc.comments.filter((c) => !c.parentId)
    expect(roots.map((c) => [c.author, c.text, doc.comments.filter((r) => r.parentId === c.id).map((r) => `${r.author}: ${r.text}`)])).toEqual([
      ['Jonah Pryce', 'Lovely. Keep.', ['Nell Garrow: Thank you.']],
      // Its two paragraphs, as the reader joins a comment's: one line apart.
      ['Jonah Pryce', 'On words since rewritten: “the fog lifted at noon”\nWhich hour?', ['Nell Garrow: Before dawn now.']],
    ])
  })

  it('a thread is on its words as the writer has them now; one whose words are gone is at the scene’s start', async () => {
    const [part] = docScenes(await readEditedDocx(file()))
    const on = part.comments.map((c) => part.edited.slice(c.start, c.end))
    // In the order of the page: the two at the scene's start first.
    expect(on).toEqual(['', '', 'counted hulls', 'counted hulls'])
    const start = part.comments.filter((c) => c.start === c.end).map((c) => c.start)
    expect(start).toEqual([0, 0])
  })

  it('the scene’s bookmark comes after the comment marks at its start, just before its first words, where LibreOffice keeps it', async () => {
    const { readZip } = await import('@/lib/zip')
    const doc = new TextDecoder().decode((await readZip(file())).get('word/document.xml'))
    const first = doc.match(/<w:p>(?:(?!<\/w:p>).)*KathalaScene_0(?:(?!<\/w:p>).)*<\/w:p>/)![0]
    const bookmark = first.indexOf('<w:bookmarkStart')
    expect(bookmark).toBeGreaterThan(first.lastIndexOf('<w:commentRangeStart', first.indexOf('The fog')))
    expect(first.slice(bookmark).replace(/^<w:bookmarkStart[^>]*\/><w:bookmarkEnd[^>]*\/>/, '')).toMatch(/^<w:r><w:t xml:space="preserve">The /)
  })

  it('done is said for every comment of a resolved thread, and not of an open one; replies linked by paragraph id', async () => {
    const { readZip } = await import('@/lib/zip')
    const zip = await readZip(file())
    const ex = new TextDecoder().decode(zip.get('word/commentsExtended.xml'))
    const rows = [...ex.matchAll(/<w15:commentEx w15:paraId="([0-9A-F]{8})"(?: w15:paraIdParent="([0-9A-F]{8})")? w15:done="([01])"\/>/g)].map((m) => [m[1], m[2] ?? null, m[3]])
    expect(rows.length).toBe(4)
    expect(rows.map((r) => r[2])).toEqual(['0', '0', '1', '1'])
    expect(rows[1][1]).toBe(rows[0][0])
    expect(rows[3][1]).toBe(rows[2][0])
    // No file of comments where there are none.
    const plain = compileDocx(book, { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: () => 0, marked: { author: 'N', date: '2026-11-10T09:00:00Z', base: () => null } } })
    expect([...(await readZip(plain)).keys()].some((n) => n.includes('comments'))).toBe(false)
  })
})

describe('withChangesMade (round-trip-plan-2.md, T5.3)', () => {
  const doc = (paragraphs: DocParagraph[]): EditedDocx => ({ draftId: null, worldId: null, comments: [], paragraphs })
  const text = (d: EditedDocx) => d.paragraphs.map((p) => p.pieces.map((x) => ('text' in x ? (x.kind === 'same' ? x.text : `[${x.kind}${x.text}]`) : '')).join(''))

  it('makes one person’s changes: an insertion plain, a deletion gone, a deleted break joining its paragraph to the next', () => {
    const file = doc([
      { scene: 0, style: 'Normal', pieces: [{ kind: 'same', text: 'One', italic: false }, { kind: 'ins', text: ' more', italic: false, author: 'Ruth' }, { kind: 'del', text: ' less', italic: false, author: 'Ruth' }, { kind: 'same', text: '.', italic: false }], mark: { kind: 'del', author: 'Ruth' } },
      { scene: 0, style: 'Normal', pieces: [{ kind: 'same', text: ' Two.', italic: false }], mark: { kind: 'ins', author: 'Ruth' } },
      { scene: 0, style: 'Normal', pieces: [{ kind: 'same', text: 'Three', italic: false }, { kind: 'ins', text: ' too', italic: false, author: 'Ana' }] },
    ])
    expect(text(withChangesMade(file, 'Ruth'))).toEqual(['One more. Two.', 'Three[ins too]'])
    expect(withChangesMade(file, 'Ruth').paragraphs.map((p) => p.mark ?? null)).toEqual([null, null])
    // Another's are left as they are.
    expect(text(withChangesMade(file, 'Ana'))).toEqual(['One[ins more][del less].', ' Two.', 'Three too'])
  })
})


describe('markedPlan: what the dialog offers to send back (round-trip-plan-2.md, T5.4)', () => {
  const base: DraftBook = { version: 1, chapters: [{ id: 'c', number: 1, title: 'C', timelineId: 't', scenes: [
    { id: 'e1', title: 'One', text: 'The fog came off the estuary at dawn.\n\nTamsin counted hulls by the sound of them.' },
    { id: 'e2', title: 'Two', text: 'The tide turned.' },
  ] }] }
  const scenes = [
    { eventId: 'e1', text: 'The fog came off the estuary before dawn.\n\nTamsin counted hulls by the sound of them.' },
    { eventId: 'e2', text: 'The tide turned.' },
    { eventId: 'e3', text: 'A new scene.' },
  ]
  const note = (id: string, o: Partial<ProseNote>): ProseNote => ({
    id, worldId: 'w', kind: 'query', author: { kind: 'editor', name: 'Ana Editor' }, body: 'Which hour?', status: 'open', replies: [],
    eventId: 'e1', quote: 'counted hulls', prefix: 'Tamsin ', suffix: ' by', createdAt: 1, updatedAt: 1, ...o,
  })
  const notes = [
    note('n1', { replies: [{ id: 'r1', author: { kind: 'me' }, body: 'Fixed.', createdAt: 2 }, { id: 'r2', author: { kind: 'editor', name: 'Ana Editor' }, body: 'Good.', createdAt: 3 }], status: 'resolved' }),
    note('n2', { author: { kind: 'editor', name: 'Jonah Pryce' }, body: 'Another editor’s.' }),
    note('n3', { author: { kind: 'me' }, body: 'My own note.' }),
    note('n4', { author: { kind: 'reader', name: 'Bea' }, body: 'A reader’s.' }),
    note('n5', { quote: 'the fog lifted at noon', prefix: '', suffix: '', body: 'Words gone.' }),
    note('n6', { eventId: 'gone', quote: 'nowhere at all', prefix: '', suffix: '', body: 'A scene since deleted.' }),
  ]
  const plan = (author = 'Nell Garrow', editors: string[] = ['Ana Editor']) =>
    markedPlan({ sentBack: { id: 'D', editors }, base, scenes, notes, author, now: Date.UTC(2026, 10, 10, 9) })

  it('only that file’s editor’s threads go back, with the writer’s replies signed by the byline, and done where resolved', () => {
    const p = plan()
    expect(p.marked.threads.map((t) => [t.eventId, t.quote, t.done, t.comments.map((c) => `${c.initials} ${c.author}: ${c.text}`)])).toEqual([
      ['e1', 'counted hulls', true, ['AE Ana Editor: Which hour?', 'NG Nell Garrow: Fixed.', 'AE Ana Editor: Good.']],
      // On words since rewritten: in its own scene, with the words it was made on.
      ['e1', 'the fog lifted at noon', false, ['AE Ana Editor: Words gone.']],
    ])
    expect(p.threads).toBe(2)
    expect(p.marked).toMatchObject({ author: 'Nell Garrow', against: 'D', date: '2026-11-10T09:00:00.000Z' })
  })

  it('a file whose editors are not known sends every editor’s threads back; never the writer’s own or a reader’s', () => {
    const p = plan('Nell Garrow', [])
    expect(p.marked.threads.map((t) => t.comments[0].text)).toEqual(['Which hour?', 'Another editor’s.', 'Words gone.'])
  })

  it('counts each change once, a word replaced as one; a scene the file did not have is new; and an unsigned byline is still signed', () => {
    const p = plan('  ')
    // "at" → "before" in scene one, and the whole of scene three.
    expect(p.changes).toBe(2)
    expect(p.marked.base('e1')).toBe(base.chapters[0].scenes[0].text)
    expect(p.marked.base('e3')).toBeNull()
    expect(p.marked.author).toBe('The author')
    expect(p.marked.threads[0].comments[1].author).toBe('The author')
  })
})
