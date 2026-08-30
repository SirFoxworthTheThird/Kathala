import { describe, it, expect } from 'vitest'
import { searchIndex, searchMatches } from '@/lib/searchMatch'

const PROSE = 'kept until the next casting, then washed. The tin was thin.'

describe('searchMatches', () => {
  it('matches inside a word when whole words are off', () => {
    expect(searchMatches(PROSE, 'tin', false)).toBe(true)
  })

  it('refuses the same match when whole words are on', () => {
    // The pair: same text, same query, only the option differs. The word "tin"
    // *is* in this sentence, so the two halves cannot both be vacuous.
    expect(searchMatches('kept until the next casting, then washed.', 'tin', true)).toBe(false)
    expect(searchMatches(PROSE, 'tin', true)).toBe(true)
  })

  it('does not match a longer word that starts with the query', () => {
    expect(searchMatches('Bellhouse of the Ninth', 'Bel', true)).toBe(false)
    expect(searchMatches('Bel Andry rang it', 'Bel', true)).toBe(true)
  })

  it('is case-insensitive either way', () => {
    expect(searchMatches('The Tally-Slate', 'tally', false)).toBe(true)
    expect(searchMatches('The Tally-Slate', 'tally', true)).toBe(true)
  })

  it('treats a hyphen as a boundary, as a reader would', () => {
    expect(searchMatches('The tally-slate', 'slate', true)).toBe(true)
  })

  it('matches a multi-word query whole', () => {
    expect(searchMatches('the ninth bell rang', 'ninth bell', true)).toBe(true)
    expect(searchMatches('the ninth bellhouse', 'ninth bell', true)).toBe(false)
  })

  it('has nothing to say about an empty query or empty text', () => {
    expect(searchMatches(PROSE, '', true)).toBe(false)
    expect(searchMatches('', 'tin', true)).toBe(false)
    expect(searchMatches(null, 'tin', false)).toBe(false)
  })

  it('escapes the query, so punctuation is literal rather than a pattern', () => {
    expect(searchMatches('a.b', 'a.b', false)).toBe(true)
    expect(searchMatches('axb', 'a.b', false)).toBe(false)
  })
})

describe('searchIndex', () => {
  it('points past an earlier partial hit when whole words are on', () => {
    /*
      This is why it returns an index rather than a boolean: the snippet under
      a prose result and the highlight in a label both have to land on the
      match the writer asked for. `tin` occurs three times in this sentence —
      inside "casting", standing alone, and inside "thin" — and only the middle
      one is a word.

      Asserted as the property rather than as an offset: the first draft of
      this test counted characters by hand and got it wrong, which is the kind
      of assertion that fails for a reason that has nothing to do with the code.
    */
    const loose = searchIndex(PROSE, 'tin', false)
    const strict = searchIndex(PROSE, 'tin', true)
    expect(PROSE.slice(loose, loose + 3)).toBe('tin')
    expect(PROSE.slice(strict, strict + 3)).toBe('tin')
    // The loose one is inside a word; the strict one has space either side.
    expect(PROSE[loose - 1]).not.toBe(' ')
    expect(PROSE[strict - 1]).toBe(' ')
    expect(PROSE[strict + 3]).toBe(' ')
    expect(strict).toBeGreaterThan(loose)
  })

  it('is -1 when nothing matches', () => {
    expect(searchIndex(PROSE, 'silver', true)).toBe(-1)
  })
})
