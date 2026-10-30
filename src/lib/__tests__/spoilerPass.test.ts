import { describe, it, expect } from 'vitest'
import { passFacts, toldAt, spoilerMarker } from '@/lib/spoilerPass'
import type { KnowledgeFact } from '@/types'

const fact = (id: string, at: string | null, words: string[] = [], tags: string[] = []): KnowledgeFact => ({
  id, worldId: 'w', title: `Fact ${id}`, description: '', tags, spoilerWords: words,
  readerLearnsAtEventId: at, originEventId: null, createdAt: 0, updatedAt: 0,
})

// Scenes s1..s4 at 1..4; s1 and s3 in the first era, s2 and s4 in the second. "gone" is not in the book.
const pos = (id: string) => ({ s1: 1, s2: 2, s3: 3, s4: 4 } as Record<string, number>)[id] ?? -1
const era = (id: string) => ({ s1: 'first', s2: 'second', s3: 'first', s4: 'second' } as Record<string, string>)[id] ?? null

describe('passFacts', () => {
  it('keeps the facts with a reveal scene in the book, in the order the reader learns them', () => {
    const got = passFacts([fact('d', 's4', ['Opener']), fact('a', 's1'), fact('x', null), fact('g', 'gone')], pos, era)
    expect(got.map((f) => [f.fact.id, f.at, f.era, f.terms])).toEqual([
      ['a', 1, 'first', []],
      ['d', 4, 'second', ['Opener']],
    ])
  })
})

describe('toldAt', () => {
  const facts = passFacts([fact('a', 's1'), fact('b', 's2'), fact('c', 's3'), fact('d', 's4')], pos, era)

  it('counts a fact told in this scene as told, groups what was told by era in the order the book reaches it, and lists the rest as to come', () => {
    const { told, toCome } = toldAt(facts, 3)
    expect(told.map((g) => [g.era, g.facts.map((f) => f.fact.id)])).toEqual([['first', ['a', 'c']], ['second', ['b']]])
    expect(toCome.map((f) => f.fact.id)).toEqual(['d'])
  })

  it('before any reveal, everything is still to come', () => {
    const { told, toCome } = toldAt(facts, 0.5)
    expect(told).toEqual([])
    expect(toCome.map((f) => f.fact.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('spoilerMarker', () => {
  const runs = (marker: ReturnType<typeof spoilerMarker>, text: string) =>
    marker!(text).map((r) => (r.fact ? `[${r.text}:${r.fact.id}]` : r.text)).join('')

  it('marks each word of a fact to come, whole word and whatever the case, and leaves the rest of the text as it was', () => {
    const m = spoilerMarker(passFacts([fact('o', 's4', ['Opener'], ['deck nine'])], pos, era))
    expect(runs(m, 'The opener, the Openers, and DECK NINE; Reopener.')).toBe('The [opener:o], the Openers, and [DECK NINE:o]; Reopener.')
    expect(m!('Nothing here.')).toEqual([{ text: 'Nothing here.' }])
  })

  it('prefers the longer word, and gives a shared word to the fact the reader learns first', () => {
    const facts = passFacts([fact('late', 's4', ['Deck']), fact('soon', 's2', ['Deck Nine', 'deck'])], pos, era)
    expect(runs(spoilerMarker(facts), 'Deck Nine, then the deck.')).toBe('[Deck Nine:soon], then the [deck:soon].')
  })

  it('finds a word that is not Latin, and one with characters a pattern would read as its own', () => {
    const m = spoilerMarker(passFacts([fact('u', 's2', ['Ünal', 'C.O.']), fact('q', 's3', ['(Kesh)'])], pos, era))
    expect(runs(m, 'Ünal met the C.O. and (Kesh); Ünalı did not.')).toBe('[Ünal:u] met the [C.O.:u] and [(Kesh):q]; Ünalı did not.')
  })

  it('is null when nothing to come has a word to find', () => {
    expect(spoilerMarker(passFacts([fact('a', 's2')], pos, era))).toBeNull()
    expect(spoilerMarker([])).toBeNull()
  })
})
