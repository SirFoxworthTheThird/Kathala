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
    const out = suggestReveals({ fact: fact('secret'), reveals: [reveal('secret', 'kael', 'e1')], events, chapters, snapshots: [] })
    expect(out).toHaveLength(1)
    expect(out[0].characterId).toBe('bren')
    expect(out[0].eventId).toBe('e2')
    expect(out[0].viaCharacterId).toBe('kael')
  })

  it('returns nothing when nobody knows the fact yet', () => {
    const events = [event('e1', 'c1', 0, ['kael', 'bren'])]
    expect(suggestReveals({ fact: fact('secret'), reveals: [], events, chapters, snapshots: [] })).toEqual([])
  })

  /**
   * **W-5.** A writer's run on a murder story opened the fact *"Teodor Ilm did
   * not fall — he was struck with his own rain gauge"* and found Teodor Ilm
   * himself at the top of *Might also know*. He is dead from chapter 1 and in
   * chapter 2's cast because the scene is his autopsy. He was the first row on
   * every fact and had to be skipped seven times.
   */
  it('does not suggest a character who is dead by that scene', () => {
    const events = [event('e1', 'c1', 0, ['kael']), event('e2', 'c2', 0, ['kael', 'bren'])]
    const reveals = [reveal('secret', 'kael', 'e1')]
    const dead = [snap('bren', 'e1', false)]
    expect(suggestReveals({ fact: fact('secret'), reveals, events, chapters, snapshots: dead })).toEqual([])
  })

  /*
    The pair, and the half that keeps the rule from being "never suggest
    anybody": the same scene, the same cast, and a living Bren is still offered.
    It also fixes the boundary — the scene a death is *recorded* at is the scene
    they die in, and the suggestion is gone from it.
  */
  it('still suggests them while they are alive', () => {
    const events = [event('e1', 'c1', 0, ['kael']), event('e2', 'c2', 0, ['kael', 'bren'])]
    const reveals = [reveal('secret', 'kael', 'e1')]
    const alive = [snap('bren', 'e1', true)]
    const out = suggestReveals({ fact: fact('secret'), reveals, events, chapters, snapshots: alive })
    expect(out.map((r) => r.characterId)).toEqual(['bren'])
  })

  /*
    And the other side of the co-presence: a corpse tells nobody. Kael is the
    only knower and is dead by e2, so there is no source in the room.
  */
  it('does not spread a fact from a knower who is dead', () => {
    const events = [event('e1', 'c1', 0, ['kael']), event('e2', 'c2', 0, ['kael', 'bren'])]
    const reveals = [reveal('secret', 'kael', 'e1')]
    const dead = [snap('kael', 'e2', false)]
    expect(suggestReveals({ fact: fact('secret'), reveals, events, chapters, snapshots: dead })).toEqual([])
  })

  it('does not suggest a character who already knows it', () => {
    const events = [event('e1', 'c1', 0, ['kael']), event('e2', 'c2', 0, ['kael', 'bren'])]
    const reveals = [reveal('secret', 'kael', 'e1'), reveal('secret', 'bren', 'e2')]
    expect(suggestReveals({ fact: fact('secret'), reveals, events, chapters, snapshots: [] })).toEqual([])
  })
})
