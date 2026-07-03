import { describe, it, expect } from 'vitest'
import { computeSceneKnowledgeGaps } from '@/lib/knowledgeGaps'
import type { KnowledgeFact, KnowledgeReveal, WorldEvent, Chapter } from '@/types'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, povCharacterId: string | null = null): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: '', description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, status: 'draft', povCharacterId, isFlashback: false,
    createdAt: 0, updatedAt: 0,
  }
}
function fact(id: string, readerLearnsAtEventId: string | null = null): KnowledgeFact {
  return { id, worldId: 'w', title: id, description: '', tags: [], readerLearnsAtEventId, originEventId: null, createdAt: 0, updatedAt: 0 }
}
function reveal(factId: string, characterId: string, eventId: string): KnowledgeReveal {
  return { id: `${factId}-${characterId}`, worldId: 'w', factId, characterId, eventId, note: '', createdAt: 0, updatedAt: 0 }
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]

describe('computeSceneKnowledgeGaps', () => {
  it('returns nothing without an active event', () => {
    const gaps = computeSceneKnowledgeGaps({
      facts: [fact('f')], reveals: [], events: [], chapters, presentCharacterIds: ['a'], activeEventId: null,
    })
    expect(gaps).toEqual([])
  })

  it('flags dramatic irony: reader knows (explicit), present character does not', () => {
    const events = [event('e1', 'c1', 0), event('e2', 'c2', 0), event('e3', 'c3', 0)]
    // Reader learns "poison" at e1; Alice never learns it.
    const gaps = computeSceneKnowledgeGaps({
      facts: [fact('poison', 'e1')],
      reveals: [],
      events, chapters,
      presentCharacterIds: ['alice'],
      activeEventId: 'e2',
    })
    expect(gaps).toHaveLength(1)
    expect(gaps[0].kind).toBe('irony')
    expect(gaps[0].readerKnows).toBe(true)
    expect(gaps[0].unknownBy).toEqual(['alice'])
  })

  it('flags withheld info: a present character knows, the reader does not', () => {
    const events = [event('e1', 'c1', 0), event('e2', 'c2', 0)]
    // Marcus learns "spy" at e1; reader-clock explicitly withheld (far future / never).
    const gaps = computeSceneKnowledgeGaps({
      facts: [fact('spy', 'e2')], // reader learns only at e2
      reveals: [reveal('spy', 'marcus', 'e1')],
      events, chapters,
      presentCharacterIds: ['marcus'],
      activeEventId: 'e1', // at e1 marcus knows, reader doesn't yet
    })
    expect(gaps).toHaveLength(1)
    expect(gaps[0].kind).toBe('withheld')
    expect(gaps[0].readerKnows).toBe(false)
    expect(gaps[0].knownBy).toEqual(['marcus'])
  })

  it('derives the reader-clock from POV when unset (reader learns when a POV char knows)', () => {
    // Bran learns the secret at e1; e2 is from Bran's POV, so the reader learns it at e2.
    const events = [event('e1', 'c1', 0), event('e2', 'c2', 0, 'bran'), event('e3', 'c3', 0)]
    const facts = [fact('secret')] // no explicit reader clock → derive
    const reveals = [reveal('secret', 'bran', 'e1')]

    // At e1 (before Bran's POV scene) the reader does NOT know it yet, but Bran (present) does → withheld.
    const atE1 = computeSceneKnowledgeGaps({ facts, reveals, events, chapters, presentCharacterIds: ['bran', 'cara'], activeEventId: 'e1' })
    expect(atE1.find((g) => g.fact.id === 'secret')?.kind).toBe('withheld')

    // At e3 (after Bran's POV scene) the reader now knows it; Cara (present) doesn't → irony.
    const atE3 = computeSceneKnowledgeGaps({ facts, reveals, events, chapters, presentCharacterIds: ['cara'], activeEventId: 'e3' })
    expect(atE3.find((g) => g.fact.id === 'secret')?.kind).toBe('irony')
  })

  it('reports no gap when reader and all present characters are in sync', () => {
    const events = [event('e1', 'c1', 0), event('e2', 'c2', 0)]
    const gaps = computeSceneKnowledgeGaps({
      facts: [fact('known', 'e1')],
      reveals: [reveal('known', 'alice', 'e1')],
      events, chapters,
      presentCharacterIds: ['alice'],
      activeEventId: 'e2', // reader knows, alice knows
    })
    expect(gaps).toEqual([])
  })
})
