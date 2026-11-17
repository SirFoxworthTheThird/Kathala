import { describe, it, expect } from 'vitest'
import { parseManuscript, manuscriptStats } from '@/lib/manuscriptImport'

describe('parseManuscript', () => {
  it('splits markdown chapters and scene-break scenes', () => {
    const src = [
      '# The Fellowship',
      '',
      '## Chapter 1: A Long-expected Party',
      '',
      'Bilbo turned eleventy-one.',
      '',
      '* * *',
      '',
      'The fireworks began.',
      '',
      '## Chapter 2',
      '',
      'Frodo set out.',
    ].join('\n')

    const m = parseManuscript(src)
    expect(m.title).toBe('The Fellowship')
    expect(m.chapters).toHaveLength(2)
    expect(m.chapters[0].title).toBe('A Long-expected Party')
    expect(m.chapters[0].scenes.map((s) => s.text)).toEqual([
      'Bilbo turned eleventy-one.',
      'The fireworks began.',
    ])
    expect(m.chapters[1].title).toBe('') // bare "Chapter 2" → number carries it
    expect(m.chapters[1].scenes).toEqual([{ text: 'Frodo set out.' }])
  })

  it('parses keyword chapter headings with "* * *" and "---" breaks', () => {
    const src = [
      'Chapter One',
      'The road was long.',
      '---',
      'They rested at dusk.',
      'Chapter Two: The River',
      'Water everywhere.',
    ].join('\n')

    const m = parseManuscript(src)
    expect(m.title).toBeNull()
    expect(m.chapters.map((c) => c.title)).toEqual(['', 'The River'])
    expect(m.chapters[0].scenes).toHaveLength(2)
    expect(m.chapters[1].scenes).toEqual([{ text: 'Water everywhere.' }])
  })

  it('treats leading prose before any heading as an untitled chapter', () => {
    const src = 'Once upon a time.\n\n## Chapter 1\n\nThe story begins.'
    const m = parseManuscript(src)
    expect(m.title).toBeNull()
    expect(m.chapters).toHaveLength(2)
    expect(m.chapters[0]).toEqual({ title: '', scenes: [{ text: 'Once upon a time.' }] })
    expect(m.chapters[1].scenes).toEqual([{ text: 'The story begins.' }])
  })

  it('handles a plain draft with no headings as one chapter with scene breaks', () => {
    const src = 'Scene one prose.\n\n***\n\nScene two prose.'
    const m = parseManuscript(src)
    expect(m.chapters).toHaveLength(1)
    expect(m.chapters[0].title).toBe('')
    expect(m.chapters[0].scenes.map((s) => s.text)).toEqual(['Scene one prose.', 'Scene two prose.'])
  })

  it('keeps a single block with no headings or breaks as one scene', () => {
    const m = parseManuscript('Just one continuous passage of prose.')
    expect(m.chapters).toHaveLength(1)
    expect(m.chapters[0].scenes).toEqual([{ text: 'Just one continuous passage of prose.' }])
  })

  it('preserves paragraph breaks inside a scene', () => {
    const src = '## Chapter 1\n\nFirst paragraph.\n\nSecond paragraph.'
    const m = parseManuscript(src)
    expect(m.chapters[0].scenes[0].text).toBe('First paragraph.\n\nSecond paragraph.')
  })

  it('does not treat "# Chapter 1" (H1 keyword) as a book title', () => {
    const src = '# Chapter 1\n\nThe opening.\n\n# Chapter 2\n\nThe next.'
    const m = parseManuscript(src)
    expect(m.title).toBeNull()
    expect(m.chapters).toHaveLength(2)
    expect(m.chapters[0].scenes).toEqual([{ text: 'The opening.' }])
  })

  it('normalises Windows line endings and strips a BOM', () => {
    const src = '﻿# Book\r\n\r\n## Chapter 1\r\n\r\nLine one.\r\nLine two.'
    const m = parseManuscript(src)
    expect(m.title).toBe('Book')
    expect(m.chapters[0].scenes[0].text).toBe('Line one.\nLine two.')
  })

  it('drops empty chapters (heading with no prose keeps zero scenes)', () => {
    const src = '## Chapter 1\n\n## Chapter 2\n\nOnly here.'
    const m = parseManuscript(src)
    expect(m.chapters).toHaveLength(2)
    expect(m.chapters[0].scenes).toEqual([])
    expect(m.chapters[1].scenes).toEqual([{ text: 'Only here.' }])
  })

  it('returns nothing for empty input', () => {
    expect(parseManuscript('')).toEqual({ title: null, chapters: [] })
    expect(parseManuscript('   \n\n  ')).toEqual({ title: null, chapters: [] })
  })

  it('computes preview stats', () => {
    const m = parseManuscript('# T\n\n## Chapter 1\n\nThree little words.\n\n***\n\nTwo words.')
    const stats = manuscriptStats(m)
    expect(stats).toEqual({ chapters: 1, scenes: 2, words: 5 })
  })

  it('reads ## as a titled scene under # chapters, keeping a titled scene with no prose', () => {
    const src = ['# Low Water', '', '## The assize rises', '', 'The court sat.', '', '## Teodora at the table', '',
      '# High Water', '', '## The tide-table', '', 'And the heron flew.', '', '* * *', '', 'Untitled after a break.'].join('\n')
    const m = parseManuscript(src)
    // The first # is a chapter: a scene follows it, not another chapter.
    expect(m.title).toBeNull()
    expect(m.chapters).toEqual([
      { title: 'Low Water', scenes: [{ title: 'The assize rises', text: 'The court sat.' }, { title: 'Teodora at the table', text: '' }] },
      { title: 'High Water', scenes: [{ title: 'The tide-table', text: 'And the heron flew.' }, { text: 'Untitled after a break.' }] },
    ])
  })

  it('under # chapters, a ## that reads as a chapter is still one', () => {
    const src = '# Part One\n\n## Chapter 1\n\nFirst.\n\n# Part Two\n\n## Chapter 2\n\nSecond.'
    const m = parseManuscript(src)
    // Four chapters — bare "Part One" and "Chapter 1" carry no title of their own — and no ## scenes.
    expect(m.chapters).toHaveLength(4)
    expect(m.chapters.flatMap((c) => c.scenes)).toEqual([{ text: 'First.' }, { text: 'Second.' }])
    expect(m.chapters[1].scenes).toEqual([{ text: 'First.' }])
  })

  it('without # chapters, ## is a chapter as before — under a book title too', () => {
    const src = '# The Book\n\n## The Beginning\n\nFirst.\n\n## The End\n\nLast.'
    const m = parseManuscript(src)
    expect(m.title).toBe('The Book')
    expect(m.chapters).toEqual([
      { title: 'The Beginning', scenes: [{ text: 'First.' }] },
      { title: 'The End', scenes: [{ text: 'Last.' }] },
    ])
  })

  it('reads the export’s "Ch. N — Title" as the title, and a bare "Ch. N" as none', () => {
    const m = parseManuscript('# Ch. 3 — Low Water\n\nText.\n\n# Ch. 4\n\nMore.')
    expect(m.title).toBeNull()
    expect(m.chapters.map((c) => c.title)).toEqual(['Low Water', ''])
  })
})

/*
  A line is a chapter only where it reads as a heading (issue #697, D-5). Any
  line opening with Chapter, Part, Prologue or Epilogue was one: "Part of the
  house was dark, and she went on." became a chapter titled with that
  sentence, in a text file as in a Word one, where every paragraph is a line.
*/
describe('a bare line that reads as a chapter heading, and one that does not', () => {
  const titles = (src: string) => parseManuscript(src).chapters.map((c) => c.title)

  it('a paragraph of prose that opens with a chapter word stays prose', () => {
    const m = parseManuscript('Chapter 1\n\nShe walked in.\n\nPart of the house was dark, and she went on.\n\nThen she slept.')
    expect(m.chapters).toHaveLength(1)
    expect(m.chapters[0].scenes[0].text).toContain('Part of the house was dark, and she went on.')
    expect(titles('Chapter one of the book was the hardest to write.\n\nIt was.')).toEqual([''])
    expect(parseManuscript('Chapter one of the book was the hardest to write.\n\nIt was.').chapters[0].scenes[0].text).toContain('Chapter one of the book')
    expect(titles('Prologue to a long day, the morning came grey.\n\nIt rained.')).toEqual([''])
  })

  it('a heading reads as one: a number in figures, a numeral, in words or an ordinal, then a title or none', () => {
    for (const [line, title] of [
      ['Chapter 3', ''], ['CHAPTER ONE', ''], ['Chapter XII', ''], ['Chapter Twenty-One', ''], ['Part the First', ''],
      ['Chapter 3: The Sea', 'The Sea'], ['Chapter Two — The River', 'The River'], ['Chapter 4 The Long Road', 'The Long Road'],
      ['Prologue', 'Prologue'], ['Epilogue: After', 'Epilogue: After'], ['Ch. 3 — The Gate', 'The Gate'],
    ] as const) {
      expect(titles(`${line}\n\nThe prose.`), line).toEqual([title])
    }
  })

  it('a line longer than a heading is prose, whatever it opens with', () => {
    const long = `Chapter 3: ${'a very long title that runs on and on '.repeat(3)}`
    expect(long.length).toBeGreaterThan(80)
    expect(parseManuscript(`${long}\n\nThe prose.`).chapters[0].scenes[0].text).toContain('Chapter 3:')
  })
})

describe('a chapter heading typed twice is one chapter (#697, D-5)', () => {
  it('a bare chapter line straight after a heading is its second line; its title only where the heading had none', () => {
    const typedAgain = parseManuscript('# Chapter I — The Science of Deduction\n\nChapter I\n\nSherlock Holmes took his bottle.\n\n# Chapter II — The Case\n\nMiss Morstan entered.')
    expect(typedAgain.chapters.map((c) => [c.title, c.scenes.length])).toEqual([['The Science of Deduction', 1], ['The Case', 1]])
    const twoLines = parseManuscript('CHAPTER ONE\n\nPROLOGUE\n\nUpon a paper attached.\n\nCHAPTER TWO\n\nIn Styria.')
    expect(twoLines.chapters.map((c) => [c.title, c.scenes.length])).toEqual([['PROLOGUE', 1], ['', 1]])
  })

  it('but not with prose between them, nor where both are marked headings', () => {
    expect(parseManuscript('Chapter 1\n\nIt began.\n\nChapter 2\n\nIt went on.').chapters).toHaveLength(2)
    expect(parseManuscript('## Chapter 1\n\n## Chapter 2\n\nOnly here.').chapters.map((c) => c.scenes.length)).toEqual([0, 1])
  })
})
