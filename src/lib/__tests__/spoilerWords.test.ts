import { describe, it, expect } from 'vitest'
import { matchTerms, parseSpoilerWords, spoilerSuggestions, uncheckedFacts, wordIn } from '@/lib/spoilerWords'

const fact = (over: Partial<{ title: string; description: string; tags: string[]; spoilerWords: string[]; readerLearnsAtEventId: string | null }> = {}) => ({
  title: 'Hal Oduya informed on Jory Mbeki', description: '', tags: [] as string[], readerLearnsAtEventId: 'e19' as string | null, ...over,
})

describe('spoiler words', () => {
  it('are matched once each, blanks left out, and the fact’s tags are not', () => {
    expect(matchTerms(fact({ spoilerWords: ['Ilse Varga', ' Opener ', 'ilse varga', ' '], tags: ['key', 'Concession'] }))).toEqual(['Ilse Varga', 'Opener'])
    expect(matchTerms(fact({ tags: ['key', 'Concession'] }))).toEqual([])
  })

  it('list a fact with a reveal scene and nothing to match as one the check cannot look for', () => {
    const blind = fact()
    const worded = fact({ spoilerWords: ['informer'] })
    // A tag sorts a fact; it is not something the check looks for.
    const tagged = fact({ tags: ['informer'] })
    const auto = fact({ readerLearnsAtEventId: null })
    expect(uncheckedFacts([blind, worded, tagged, auto])).toEqual([blind, tagged])
  })

  it('are typed as a list, separated by commas, semicolons or lines', () => {
    expect(parseSpoilerWords('Ilse, the Opener; Deck Nine\n ilse ,')).toEqual(['Ilse', 'the Opener', 'Deck Nine'])
  })

  it('are suggested from the names the fact itself uses, and not again once added', () => {
    const names = ['Hal Oduya', 'Jory Mbeki', 'Hal', 'Kit Aranda', 'Deck Nine']
    expect(spoilerSuggestions(fact({ description: 'On Deck Nine.' }), names)).toEqual(['Hal Oduya', 'Jory Mbeki', 'Hal', 'Deck Nine'])
    expect(spoilerSuggestions(fact({ spoilerWords: ['hal oduya'] }), names)).toEqual(['Jory Mbeki', 'Hal'])
  })

  it('match whole words only, whatever the case and the letters', () => {
    expect(wordIn('The Opener came.', 'opener')).toBe(true)
    expect(wordIn('The Openers came.', 'Opener')).toBe(false)
    expect(wordIn('Ama’s sister', 'Ama')).toBe(true)
    expect(wordIn('Amadeus', 'Ama')).toBe(false)
    expect(wordIn('Zoë rang.', 'Zoë')).toBe(true)
    expect(wordIn('Zoëlla rang.', 'Zoë')).toBe(false)
  })
})
