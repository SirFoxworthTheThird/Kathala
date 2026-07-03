import { describe, it, expect } from 'vitest'
import { computeKnowledgeAnachronisms } from '@/lib/knowledgeAnachronisms'
import type { KnowledgeFact, KnowledgeReveal, WorldEvent, Chapter } from '@/types'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: '', description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
    createdAt: 0, updatedAt: 0,
  }
}
function fact(id: string, originEventId: string | null, readerLearnsAtEventId: string | null = null): KnowledgeFact {
  return { id, worldId: 'w', title: id, description: '', tags: [], readerLearnsAtEventId, originEventId, createdAt: 0, updatedAt: 0 }
}
function reveal(factId: string, characterId: string, eventId: string): KnowledgeReveal {
  return { id: `${factId}-${characterId}`, worldId: 'w', factId, characterId, eventId, note: '', createdAt: 0, updatedAt: 0 }
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]
const events = [event('e1', 'c1', 0), event('e2', 'c2', 0), event('e3', 'c3', 0)]

describe('computeKnowledgeAnachronisms', () => {
  it('flags a character who knows a fact before its origin', () => {
    // "king dead" becomes true at e2, but Alice learns it at e1.
    const out = computeKnowledgeAnachronisms({
      facts: [fact('king-dead', 'e2')],
      reveals: [reveal('king-dead', 'alice', 'e1')],
      events, chapters,
    })
    expect(out).toHaveLength(1)
    expect(out[0].characterId).toBe('alice')
    expect(out[0].knownAtEventId).toBe('e1')
  })

  it('does not flag knowledge at or after the origin', () => {
    const out = computeKnowledgeAnachronisms({
      facts: [fact('king-dead', 'e2')],
      reveals: [reveal('king-dead', 'alice', 'e2'), reveal('king-dead', 'bob', 'e3')],
      events, chapters,
    })
    expect(out).toEqual([])
  })

  it('flags the reader when an explicit reader-clock precedes the origin', () => {
    const out = computeKnowledgeAnachronisms({
      facts: [fact('king-dead', 'e3', 'e1')], // origin e3, reader learns e1
      reveals: [],
      events, chapters,
    })
    expect(out).toHaveLength(1)
    expect(out[0].characterId).toBeNull()
  })

  it('ignores facts with no origin (true from the start)', () => {
    const out = computeKnowledgeAnachronisms({
      facts: [fact('always-true', null)],
      reveals: [reveal('always-true', 'alice', 'e1')],
      events, chapters,
    })
    expect(out).toEqual([])
  })
})
