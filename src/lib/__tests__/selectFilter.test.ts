import { describe, it, expect } from 'vitest'
import { matchesQuery } from '@/lib/selectFilter'

/**
 * N8, from a blind writer run: the Structure board's scene picker was 149
 * options and ~10,056 px tall, shown four at a time, with no way to type.
 */

const SCENE = 'Ch. 9 — The count returns'

describe('matchesQuery', () => {
  it('matches everything while the box is empty, so the list starts whole', () => {
    expect(matchesQuery(SCENE, '')).toBe(true)
    expect(matchesQuery(SCENE, '   ')).toBe(true)
  })

  it('ignores case, because nobody types a chapter heading', () => {
    expect(matchesQuery(SCENE, 'THE COUNT')).toBe(true)
    expect(matchesQuery('the marrowgate', 'Marrow')).toBe(true)
  })

  it('matches a word from the middle, not only the start', () => {
    // The prefix is always "Ch. N — ", so a prefix-only filter would be useless.
    expect(matchesQuery(SCENE, 'returns')).toBe(true)
  })

  it('requires every term, so a second word narrows rather than widens', () => {
    expect(matchesQuery(SCENE, 'count returns')).toBe(true)
    expect(matchesQuery(SCENE, 'count escapes')).toBe(false)
  })

  it('takes the terms in any order, since a chapter number is one of them', () => {
    // "9 returns" and "returns 9" are the same writer naming the same scene.
    expect(matchesQuery(SCENE, '9 returns')).toBe(true)
    expect(matchesQuery(SCENE, 'returns 9')).toBe(true)
  })

  it('finds a chapter by number without its punctuation', () => {
    expect(matchesQuery(SCENE, 'ch 9')).toBe(true)
  })

  it('says no when nothing matches, which is what empties the list', () => {
    expect(matchesQuery(SCENE, 'zzz')).toBe(false)
  })

  it('collapses the whitespace on both sides', () => {
    expect(matchesQuery('The   count    returns', 'count returns')).toBe(true)
    expect(matchesQuery(SCENE, '  count   returns  ')).toBe(true)
  })
})
