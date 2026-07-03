import { describe, it, expect } from 'vitest'
import { wordCount, detectMentions } from '@/lib/manuscript'
import type { Character } from '@/types'

function char(id: string, name: string): Character {
  return { id, worldId: 'w', name } as unknown as Character
}

describe('wordCount', () => {
  it('counts whitespace-delimited words', () => {
    expect(wordCount('The quick brown fox')).toBe(4)
  })
  it('is zero for empty / whitespace', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('   \n\t ')).toBe(0)
  })
  it('collapses irregular spacing and newlines', () => {
    expect(wordCount('one   two\n\nthree\tfour')).toBe(4)
  })
})

describe('detectMentions', () => {
  const cast = [char('a', 'Kael Stormwind'), char('b', 'Mira'), char('c', 'Will Hunter')]

  it('finds characters by first name as a proper noun', () => {
    const m = detectMentions('Kael drew his sword as Mira watched.', cast)
    const ids = m.map((x) => x.characterId)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).not.toContain('c')
  })

  it('counts occurrences and sorts by frequency', () => {
    const m = detectMentions('Kael. Kael. Kael. Mira.', cast)
    expect(m[0].characterId).toBe('a')
    expect(m[0].count).toBe(3)
    expect(m[1].characterId).toBe('b')
  })

  it('does not match a common-word name in lowercase (verb "will")', () => {
    const m = detectMentions('She will go, but Will stayed behind.', cast)
    const will = m.find((x) => x.characterId === 'c')
    // Only the capitalized proper-noun "Will" counts, not the verb "will".
    expect(will?.count).toBe(1)
  })

  it('does not match substrings of longer words', () => {
    // "Miracle" contains "Mira" but should not match as a whole word.
    const m = detectMentions('It was a miracle, a Miracle indeed.', cast)
    expect(m.find((x) => x.characterId === 'b')).toBeUndefined()
  })

  it('returns nothing for empty prose', () => {
    expect(detectMentions('', cast)).toEqual([])
  })
})
