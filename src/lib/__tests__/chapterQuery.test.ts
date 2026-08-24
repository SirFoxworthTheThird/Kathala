import { describe, it, expect } from 'vitest'
import { chapterNumberQuery } from '../chapterQuery'

describe('chapterNumberQuery', () => {
  it('reads a bare number', () => {
    expect(chapterNumberQuery('74')).toBe(74)
  })

  it('reads the forms a writer types', () => {
    for (const q of ['ch 74', 'ch74', 'ch. 74', 'ch.74', 'chapter 74', 'Chapter 74', 'CHAPTER74']) {
      expect(chapterNumberQuery(q), q).toBe(74)
    }
  })

  it('tolerates surrounding space', () => {
    expect(chapterNumberQuery('  chapter 7  ')).toBe(7)
  })

  it('is not a substring match, because a chapter number is exact', () => {
    // `7` must not also mean 17, 27 and 70 — that is the whole difference
    // between searching a number and searching a title.
    expect(chapterNumberQuery('7')).toBe(7)
    expect(chapterNumberQuery('17')).toBe(17)
  })

  it('says nothing about a query that is not a number', () => {
    for (const q of ['', 'the', 'chapter', 'ch', 'Mira', '7a', '7 the wreck', 'chapter seven']) {
      expect(chapterNumberQuery(q), q).toBeNull()
    }
  })

  it('refuses an absurdly long run of digits rather than matching nothing usefully', () => {
    expect(chapterNumberQuery('12345')).toBeNull()
  })
})
