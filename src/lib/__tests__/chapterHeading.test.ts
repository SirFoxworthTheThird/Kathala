import { describe, it, expect } from 'vitest'
import { CHAPTER_HEADING_STYLES, chapterHeadingLabel, chapterHeadingLines, headingExample, numberInWords } from '@/lib/chapterHeading'
import { compileManuscript, type BuiltManuscript } from '@/lib/manuscriptCompile'
import { compileDocx, compileEpub } from '@/lib/manuscriptExport'

/** Chapter headings in an exported book (writer run 9; `docs/records/run-9-wishes-plan.md` §4). */

const dec = new TextDecoder('utf-8')
const manuscript: BuiltManuscript = {
  totalWords: 6, totalScenes: 2, writtenScenes: 2,
  chapters: [
    { id: 'c1', number: 1, title: 'Flat 114', synopsis: '', wordCount: 4, wordGoal: null, writtenScenes: 1,
      scenes: [{ eventId: 'e1', title: 'Flat 114', text: 'The lift worked on alternate days.', wordCount: 6, written: true, status: 'draft' }] },
    { id: 'c2', number: 21, title: 'Ash', synopsis: '', wordCount: 2, wordGoal: null, writtenScenes: 1,
      scenes: [{ eventId: 'e2', title: 'Ash', text: 'It was over.', wordCount: 3, written: true, status: 'draft' }] },
  ],
}

describe('numberInWords', () => {
  it('writes a chapter number out, to 999, and leaves the rest in figures', () => {
    expect([1, 12, 20, 21, 45, 100, 153, 999].map(numberInWords)).toEqual([
      'One', 'Twelve', 'Twenty', 'Twenty-One', 'Forty-Five', 'One Hundred', 'One Hundred and Fifty-Three', 'Nine Hundred and Ninety-Nine',
    ])
    expect([1000, 2.5].map(numberInWords)).toEqual(['1000', '2.5'])
  })
})

describe('chapterHeadingLines', () => {
  it('reads each style', () => {
    expect(chapterHeadingLines('ch-title', 1, 'Flat 114')).toEqual(['Ch. 1 — Flat 114'])
    expect(chapterHeadingLines('chapter-words-title', 21, 'Ash')).toEqual(['Chapter Twenty-One', 'Ash'])
    expect(chapterHeadingLines('chapter-figures-title', 21, 'Ash')).toEqual(['Chapter 21', 'Ash'])
    expect(chapterHeadingLines('number-title', 21, 'Ash')).toEqual(['21', 'Ash'])
    expect(chapterHeadingLines('title', 1, 'Chapter I')).toEqual(['Chapter I'])
    expect(chapterHeadingLines('chapter-words', 1, 'Flat 114')).toEqual(['Chapter One'])
  })
  it('a chapter with no title: no empty line under the number, and a heading even when it is all there is', () => {
    expect(chapterHeadingLines('chapter-words-title', 3, '  ')).toEqual(['Chapter Three'])
    expect(chapterHeadingLines('title', 3, '')).toEqual(['Chapter Three'])
    expect(chapterHeadingLines('ch-title', 3, '')).toEqual(['Ch. 3 — Untitled'])
  })
  it('on one line, for a contents page', () => {
    expect(chapterHeadingLabel('chapter-words-title', 21, 'Ash')).toBe('Chapter Twenty-One: Ash')
    expect(chapterHeadingLabel('ch-title', 21, 'Ash')).toBe('Ch. 21 — Ash')
  })
})

describe('the exports, headed', () => {
  it('HTML and plain text take the style; Markdown keeps the form an import reads back', () => {
    const style = { chapterHeading: 'chapter-words-title' as const }
    expect(compileManuscript(manuscript, 'html', style)).toContain('<h2>Chapter Twenty-One<br />Ash</h2>')
    expect(compileManuscript(manuscript, 'text', style)).toContain('Chapter Twenty-One\nAsh')
    const md = compileManuscript(manuscript, 'markdown', style)
    expect(md).toContain('# Ch. 21 — Ash')
    expect(md).not.toContain('Twenty-One')
    // Paired: with no style, as before.
    expect(compileManuscript(manuscript, 'html')).toContain('<h2>Ch. 21 — Ash</h2>')
  })
  it('EPUB: the heading on its page, and on one line in the contents', () => {
    const epub = dec.decode(compileEpub(manuscript, { chapterHeading: 'chapter-words-title' }))
    expect(epub).toContain('<h2>Chapter Twenty-One<br/>Ash</h2>')
    expect(epub).toContain('<a href="ch2.xhtml">Chapter Twenty-One: Ash</a>')
    expect(epub).not.toContain('Ch. 21')
  })
  it('Word: the number opens the page, and the title is a line of its own', () => {
    const docx = dec.decode(compileDocx(manuscript, { chapterHeading: 'chapter-words-title' }))
    expect(docx).toContain('>Chapter Twenty-One</w:t>')
    expect(docx).toContain('>Ash</w:t>')
    expect(docx).not.toContain('Ch. 21')
    expect(dec.decode(compileDocx(manuscript))).toContain('Ch. 21 — Ash')
  })
})

describe('headingExample', () => {
  it('heads the book’s own first titled chapter, as the chooser shows each style (writer run 11)', () => {
    const chapters = [{ number: 1, title: '' }, { number: 2, title: 'The Furnace Goes Cold' }]
    expect(CHAPTER_HEADING_STYLES.map((s) => headingExample(s, chapters))).toEqual([
      'Ch. 2 — The Furnace Goes Cold',
      'Chapter Two / The Furnace Goes Cold',
      'Chapter 2 / The Furnace Goes Cold',
      '2 / The Furnace Goes Cold',
      'The Furnace Goes Cold',
      'Chapter Two',
    ])
  })
  it('a placeholder, with no titled chapter to show', () => {
    expect(headingExample('chapter-words-title', [])).toBe('Chapter One / Title')
  })
})
