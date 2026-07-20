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
})
