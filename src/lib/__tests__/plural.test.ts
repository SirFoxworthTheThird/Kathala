import { describe, it, expect } from 'vitest'
import { plural, pluralWord } from '@/lib/plural'

describe('plural', () => {
  it('agrees at one, which is the case MS-5 found broken', () => {
    expect(plural(1, 'scene')).toBe('1 scene')
    expect(plural(2, 'scene')).toBe('2 scenes')
  })

  it('treats zero as plural, as English does', () => {
    expect(plural(0, 'word')).toBe('0 words')
  })

  it('groups the number, so a count reads as a quantity and not an id', () => {
    expect(plural(6223, 'day')).toBe('6,223 days')
  })

  it('takes an irregular plural', () => {
    expect(plural(1, 'entry', 'entries')).toBe('1 entry')
    expect(plural(3, 'entry', 'entries')).toBe('3 entries')
  })

  it('gives the noun alone for phrases that count for themselves', () => {
    expect(pluralWord(1, 'scene')).toBe('scene')
    expect(pluralWord(0, 'scene')).toBe('scenes')
    expect(pluralWord(1, 'entry', 'entries')).toBe('entry')
  })
})
