import { describe, it, expect } from 'vitest'
import { suggestDeathFacts, suggestReveals } from '@/lib/knowledgeSuggestions'
import type { KnowledgeFact, KnowledgeReveal, WorldEvent, Chapter, Character, CharacterSnapshot } from '@/types'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, involved: string[] = [], pov: string | null = null): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: '', description: '',
    locationMarkerId: null, involvedCharacterIds: involved, mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: pov, isFlashback: false,
    createdAt: 0, updatedAt: 0,
  }
}
// Only id/name and characterId/eventId/isAlive are read by the helpers, so
// minimal stubs cast through unknown keep the tests independent of the full types.
function character(id: string, name: string): Character {
  return { id, name } as unknown as Character
}
function snap(characterId: string, eventId: string, isAlive: boolean): CharacterSnapshot {
  return { id: `${characterId}-${eventId}`, characterId, eventId, isAlive } as unknown as CharacterSnapshot
}
function fact(id: string): KnowledgeFact {
  return { id, worldId: 'w', title: id, description: '', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: 0, updatedAt: 0 }
}
function reveal(factId: string, characterId: string, eventId: string): KnowledgeReveal {
  return { id: `${factId}-${characterId}`, worldId: 'w', factId, characterId, eventId, note: '', createdAt: 0, updatedAt: 0 }
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]

describe('suggestDeathFacts', () => {
  it('proposes a fact at a character\'s first death, not covered by an existing fact', () => {
    const events = [event('e1', 'c1', 0, ['roland', 'alice']), event('e2', 'c2', 0, ['roland', 'alice'])]
    const characters = [character('roland', 'Roland'), character('alice', 'Alice')]
    const snapshots = [snap('roland', 'e1', true), snap('roland', 'e2', false)] // Roland dies at e2
    const out = suggestDeathFacts({ characters, snapshots, events, chapters, existingFacts: [] })
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('Roland is dead')
    expect(out[0].originEventId).toBe('e2')
    expect(out[0].presentCharacterIds).toContain('alice')
  })

  it('does not re-propose when a fact already originates at the death', () => {
    const events = [event('e2', 'c2', 0, ['roland'])]
    const characters = [character('roland', 'Roland')]
    const snapshots = [snap('roland', 'e2', false)]
    const existing = [{ ...fact('f'), originEventId: 'e2' }]
    expect(suggestDeathFacts({ characters, snapshots, events, chapters, existingFacts: existing })).toEqual([])
  })
})

describe('suggestReveals', () => {
  it('proposes a reveal for a co-present character who does not yet know it', () => {
    // Kael knows at e1; e2 has Kael + Bren together → suggest Bren.
    const events = [event('e1', 'c1', 0, ['kael']), event('e2', 'c2', 0, ['kael', 'bren'])]
    const out = suggestReveals({ fact: fact('secret'), reveals: [reveal('secret', 'kael', 'e1')], events, chapters })
    expect(out).toHaveLength(1)
    expect(out[0].characterId).toBe('bren')
    expect(out[0].eventId).toBe('e2')
    expect(out[0].viaCharacterId).toBe('kael')
  })

  it('returns nothing when nobody knows the fact yet', () => {
    const events = [event('e1', 'c1', 0, ['kael', 'bren'])]
    expect(suggestReveals({ fact: fact('secret'), reveals: [], events, chapters })).toEqual([])
  })

  it('does not suggest a character who already knows it', () => {
    const events = [event('e1', 'c1', 0, ['kael']), event('e2', 'c2', 0, ['kael', 'bren'])]
    const reveals = [reveal('secret', 'kael', 'e1'), reveal('secret', 'bren', 'e2')]
    expect(suggestReveals({ fact: fact('secret'), reveals, events, chapters })).toEqual([])
  })
})
