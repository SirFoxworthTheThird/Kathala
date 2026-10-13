import { describe, it, expect } from 'vitest'
import { isVerse, paragraphBlocks, splitParagraphs, verseFromMarkdown, verseToMarkdown } from '@/lib/manuscriptParagraphs'
import { compileManuscript, type BuiltManuscript } from '@/lib/manuscriptCompile'
import { compileDocx, compileEpub } from '@/lib/manuscriptExport'
import { parseManuscript } from '@/lib/manuscriptImport'

/**
 * Verse: a paragraph whose every line is indented keeps its lines (writer run
 * 8 set a ballad one line to a paragraph to keep them). A single newline in
 * prose is still a space, because pasted text arrives hard-wrapped.
 */

const BALLAD = "  There's a bell on the Scaur that was never hung,\n  and it rings with no rope and it rings with no tongue;"
const SCENE = `The tide turned.\n\n${BALLAD}\n\nShe stopped singing.`
const LINES = "There's a bell on the Scaur that was never hung,\nand it rings with no rope and it rings with no tongue;"

const book = (text: string): BuiltManuscript => ({
  totalWords: 30, totalScenes: 1, writtenScenes: 1,
  chapters: [{
    id: 'c1', number: 1, title: 'Slack Water', synopsis: '', wordCount: 30, wordGoal: null, writtenScenes: 1,
    scenes: [{ eventId: 'e1', title: 'The song', text, wordCount: 30, written: true, status: 'draft' }],
  }],
})

describe('telling verse from prose', () => {
  it('is verse when two or more lines are all indented', () => {
    expect(isVerse(BALLAD)).toBe(true)
    // Hard-wrapped prose — the 12.5% of the Library's paragraphs with a single newline — is not.
    expect(isVerse('It was the best of times,\nit was the worst of times.')).toBe(false)
    // One line indented and one not: prose.
    expect(isVerse('  A first line indented,\nand the rest not.')).toBe(false)
    // A single indented line has no lines to keep.
    expect(isVerse('  Alone.')).toBe(false)
  })

  it('marks the paragraphs, verse with its indentation off and its lines kept', () => {
    expect(paragraphBlocks(SCENE)).toEqual([
      { text: 'The tide turned.', verse: false },
      { text: LINES, verse: true },
      { text: 'She stopped singing.', verse: false },
    ])
    // The same paragraphs as `splitParagraphs` counts.
    expect(paragraphBlocks(SCENE)).toHaveLength(splitParagraphs(SCENE).length)
  })
})

describe('verse in what the book is compiled to', () => {
  it('HTML: a verse paragraph, its lines broken', () => {
    const html = compileManuscript(book(SCENE), 'html')
    expect(html).toContain(`<p class="verse">There's a bell on the Scaur that was never hung,<br />and it rings with no rope and it rings with no tongue;</p>`)
    expect(html).toContain('<p>The tide turned.</p>')
  })

  it('ePub and Word: the same, as each writes a line break', () => {
    const dec = new TextDecoder('latin1')
    const epub = dec.decode(compileEpub(book(SCENE), { title: 'Book' }))
    expect(epub).toContain('<p class="verse">')
    expect(epub).toContain('never hung,<br/>and it rings')
    const docx = dec.decode(compileDocx(book(SCENE), { title: 'Book' }))
    expect(docx).toContain('<w:ind w:left="720"/>')
    expect(docx).toContain('never hung,</w:t><w:br/><w:t xml:space="preserve">and it rings')
  })

  it('Markdown: `\\` line breaks, and back from an import as indented verse', () => {
    const md = compileManuscript(book(SCENE), 'markdown', { sceneTitles: true })
    expect(md).toContain("There's a bell on the Scaur that was never hung,\\\nand it rings with no rope and it rings with no tongue;")
    const back = parseManuscript(md)
    expect(back.chapters[0].scenes[0].text).toBe(SCENE)
    // And a scene that opens with verse keeps it.
    const opening = compileManuscript(book(`${BALLAD}\n\nShe stopped.`), 'markdown', { sceneTitles: true })
    expect(parseManuscript(opening).chapters[0].scenes[0].text).toBe(`${BALLAD}\n\nShe stopped.`)
  })

  it('Markdown: prose with single newlines is left as it was, either way', () => {
    const prose = 'It was the best of times,\nit was the worst of times.'
    expect(verseToMarkdown(prose)).toBe(prose)
    expect(verseFromMarkdown(prose)).toBe(prose)
  })
})
