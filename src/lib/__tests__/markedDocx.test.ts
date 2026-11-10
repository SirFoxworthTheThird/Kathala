import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { markedParagraphs, hasMarks } from '@/lib/markedDocx'
import { compileDocx } from '@/lib/manuscriptExport'
import { readEditedDocx } from '@/lib/docxRead'
import { docScenes } from '@/lib/docxEdits'
import { rendered } from '@/lib/docxImport'
import type { BuiltManuscript } from '@/lib/manuscriptCompile'
import type { DraftBook } from '@/lib/bookDraft'

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
    const added = await xmlOf('One.\n\nFour.')
    expect(added.match(/<w:p>.*?<\/w:p>/g)!.find((p) => p.includes('Two'))).toMatch(/<w:pPr><w:rPr><w:ins w:id="\d+" w:author="Nell Garrow"/)
  })

  it('deleted words are w:delText inside w:del, and put-in words w:t inside w:ins, each with its own id', async () => {
    const doc = await xmlOf('One.\n\nTwo, wet.\n\nFour.')
    const dels = doc.match(/<w:del [^>]*>.*?<\/w:del>/g) ?? []
    expect(dels.length).toBeGreaterThan(0)
    for (const d of dels) { expect(d).toContain('<w:delText'); expect(d).not.toContain('<w:t ') }
    expect(doc).toMatch(/<w:ins [^>]*><w:r><w:t xml:space="preserve">sodden\.<\/w:t><\/w:r><\/w:ins>/)
    const ids = [...doc.matchAll(/<w:(?:ins|del) w:id="(\d+)"/g)].map((m) => m[1])
    expect(new Set(ids).size).toBe(ids.length)
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
  })
})
