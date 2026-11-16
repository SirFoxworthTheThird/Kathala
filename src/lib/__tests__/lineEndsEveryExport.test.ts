import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { compileManuscript, type BuiltManuscript } from '@/lib/manuscriptCompile'
import { compileEpub } from '@/lib/manuscriptExport'
import { readStoredZip } from '@/lib/zip'

/*
  A single line end in every export (round-trip-plan-3.md, T13, S7). T12.1 made
  Word read one Enter as Read does, and said what each other format does with
  it; only Word was tested. These hold the rest:
  - Markdown and plain text keep the line as typed, as those formats do;
  - HTML and EPUB join it to the line before with one space, as Read does;
  - verse keeps its lines in all four.
*/

const LAMP = readFileSync(path.join(__dirname, 'fixtures/docx/run-2026-11-12-loop2/lamp-room-typed.txt'), 'utf8').trim()
const PROSE = 'The ladder was cold.  \n  He climbed it anyway.'
const VERSE = '  The tide goes out,\n  the tide comes in,\n  and nobody minds the ladder.'

const book = (text: string): BuiltManuscript => ({
  totalWords: 100, totalScenes: 1, writtenScenes: 1,
  chapters: [{
    id: 'c1', number: 1, title: 'The Lamp', synopsis: '', wordCount: 100, wordGoal: null, writtenScenes: 1,
    scenes: [{ eventId: 'e1', title: 'The lamp-room', text, wordCount: 100, written: true, status: 'draft' }],
  }],
})
const epubChapter = (text: string) => new TextDecoder().decode(readStoredZip(compileEpub(book(text))).get('OEBPS/ch1.xhtml'))
/** The `<p>` elements of a page, each as its inner markup. */
const paragraphs = (html: string) => [...html.matchAll(/<p(?: class="(\w+)")?>(.*?)<\/p>/gs)].map((m) => ({ cls: m[1] ?? '', inner: m[2] }))
const scenesOf = (html: string) => paragraphs(html).filter((p) => p.inner.includes('ladder') || p.inner.includes('lamp') || p.inner.includes('tide'))

describe('one Enter in prose, in each export', () => {
  it('Markdown keeps the line as typed', () => {
    const md = compileManuscript(book(PROSE), 'markdown')
    expect(md).toContain('The ladder was cold.  \n  He climbed it anyway.')
  })

  it('plain text keeps the line as typed', () => {
    const txt = compileManuscript(book(PROSE), 'text')
    expect(txt).toContain('The ladder was cold.  \n  He climbed it anyway.')
  })

  it('HTML joins it to the line before with one space, as Read does', () => {
    const ps = scenesOf(compileManuscript(book(PROSE), 'html'))
    expect(ps).toEqual([{ cls: '', inner: 'The ladder was cold. He climbed it anyway.' }])
  })

  it('EPUB joins it the same way', () => {
    const ps = scenesOf(epubChapter(PROSE))
    expect(ps).toEqual([{ cls: 'first', inner: 'The ladder was cold. He climbed it anyway.' }])
  })

  it("the run's scene: twelve lines, one paragraph with no line end in HTML and EPUB, twelve lines in Markdown and text", () => {
    expect(LAMP.split('\n')).toHaveLength(12)
    for (const html of [compileManuscript(book(LAMP), 'html'), epubChapter(LAMP)]) {
      const ps = paragraphs(html).filter((p) => p.inner.length > 200)
      expect(ps).toHaveLength(1)
      expect(ps[0].inner).not.toMatch(/\n|<br/)
    }
    for (const f of ['markdown', 'text'] as const) {
      expect(compileManuscript(book(LAMP), f)).toContain(LAMP)
    }
  })
})

describe('verse keeps its lines, in each export', () => {
  const text = `The ladder was cold.\n\n${VERSE}`
  it('Markdown, with a line break at each line', () => {
    const md = compileManuscript(book(text), 'markdown')
    expect(md).toMatch(/The tide goes out,\\\n\s*the tide comes in,\\\n\s*and nobody minds the ladder\./)
  })

  it('plain text, as written', () => {
    expect(compileManuscript(book(text), 'text')).toContain(VERSE)
  })

  it('HTML and EPUB, a line break between lines', () => {
    for (const html of [compileManuscript(book(text), 'html'), epubChapter(text)]) {
      const verse = paragraphs(html).filter((p) => p.cls === 'verse')
      expect(verse).toHaveLength(1)
      expect(verse[0].inner.split(/<br ?\/>/).map((l) => l.trim())).toEqual(['The tide goes out,', 'the tide comes in,', 'and nobody minds the ladder.'])
    }
  })
})
