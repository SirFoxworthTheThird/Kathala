import { describe, it, expect } from 'vitest'
import { factMatches } from '@/lib/spoilerWords'
import { sceneLeaks } from '@/lib/proseContinuity'
import type { KnowledgeFact } from '@/types'

/**
 * Part E1: where a scene's prose gives a fact away before the reader is set to
 * learn it, by the early-reveal check's own rule — for the Page to underline
 * as it is written.
 */

const fact = (over: Partial<KnowledgeFact>): KnowledgeFact => ({
  id: 'f', worldId: 'w', title: 'Ilse is the Opener', description: '', tags: [], spoilerWords: ['the Opener', 'Deck Nine'],
  readerLearnsAtEventId: 'e19', createdAt: 0, updatedAt: 0, ...over,
} as KnowledgeFact)

// Chapters in the order the reader meets them: e11 before e19, e20 after.
const order = (id: string) => ({ e11: 11, e19: 19, e20: 20 } as Record<string, number>)[id] ?? -1

describe('where prose gives a fact away', () => {
  it('finds each spoiler word as a whole word, ignoring case, and the title as a phrase', () => {
    const text = 'They said THE OPENER was on deck nine. Ilse is the Opener, said nobody. The openers rusted.'
    const found = factMatches(text, fact({}))
    expect(found.map((m) => text.slice(m.from, m.to))).toEqual(['Ilse is the Opener', 'THE OPENER', 'the Opener', 'deck nine'])
    // The title first: the checker names the first.
    expect(found[0].term).toBe('Ilse is the Opener')
    // "openers" is not "Opener".
    expect(found.some((m) => text.slice(m.from, m.to) === 'The openers')).toBe(false)
  })

  it('in a scene before the reader learns it, and not at or after', () => {
    const text = 'Nobody on Deck Nine slept.'
    const early = sceneLeaks(text, 'e11', [fact({})], order)
    expect(early.map((l) => [text.slice(l.from, l.to), l.revealEventId])).toEqual([['Deck Nine', 'e19']])
    expect(sceneLeaks(text, 'e19', [fact({})], order)).toEqual([])
    expect(sceneLeaks(text, 'e20', [fact({})], order)).toEqual([])
  })

  it('only for a fact the reader is set to learn somewhere in the book', () => {
    const text = 'Nobody on Deck Nine slept.'
    expect(sceneLeaks(text, 'e11', [fact({ readerLearnsAtEventId: null })], order)).toEqual([])
    expect(sceneLeaks(text, 'e11', [fact({ readerLearnsAtEventId: 'gone' })], order)).toEqual([])
    expect(sceneLeaks(text, 'e11', [fact({})], order)).toHaveLength(1)
  })
})
