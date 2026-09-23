import { describe, it, expect } from 'vitest'
import { computeProseMentionIssues, computeKnowledgeLeaks } from '@/lib/proseContinuity'
import type { WorldEvent, Chapter, Character, KnowledgeFact } from '@/types'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, extra: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
    status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0, ...extra,
  }
}
function char(id: string, name: string): Character {
  return { id, worldId: 'w', name } as unknown as Character
}
function fact(id: string, title: string, tags: string[], readerLearnsAtEventId: string | null): KnowledgeFact {
  return { id, worldId: 'w', title, description: '', tags, readerLearnsAtEventId, originEventId: null, createdAt: 0, updatedAt: 0 }
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]
const cast = [char('kael', 'Kael'), char('mira', 'Mira')]

describe('computeProseMentionIssues', () => {
  it('flags a name in the prose that the cast does not account for', () => {
    const events = [event('e1', 'c1', 0, { involvedCharacterIds: ['kael'] })]
    const sceneTextByEvent = new Map([['e1', 'Kael turned to Mira. Mira did not look up.']])
    const issues = computeProseMentionIssues({ events, characters: cast, sceneTextByEvent })
    expect(issues).toHaveLength(1)
    expect(issues[0].eventId).toBe('e1')
    expect(issues[0].characters).toEqual([{ characterId: 'mira', characterName: 'Mira', count: 2 }])
  })

  /*
    The bound that matters. Per name, this check produced 4,894 warnings across
    the forty-six shipped books — three quarters of everything the continuity
    checker had to say, because in a novel people are talked about far more
    often than they are present. One scene is one question.
  */
  it('asks once per scene, however many names are unaccounted for', () => {
    const events = [event('e1', 'c1', 0, { involvedCharacterIds: [] })]
    const sceneTextByEvent = new Map([['e1', 'Kael and Mira. Kael again, and Mira again.']])
    const issues = computeProseMentionIssues({ events, characters: cast, sceneTextByEvent })
    expect(issues).toHaveLength(1)
    expect(issues[0].characters.map((c) => c.characterName).sort()).toEqual(['Kael', 'Mira'])
  })

  it('ignores a name that appears only once, and keeps one that recurs', () => {
    const events = [event('e1', 'c1', 0), event('e2', 'c2', 0)]
    const once = new Map([['e1', 'A letter came from Mira.']])
    expect(computeProseMentionIssues({ events, characters: cast, sceneTextByEvent: once })).toEqual([])

    const twice = new Map([['e2', 'A letter came from Mira. Mira had written it herself.']])
    const issues = computeProseMentionIssues({ events, characters: cast, sceneTextByEvent: twice })
    expect(issues).toHaveLength(1)
    expect(issues[0].characters[0]).toMatchObject({ characterName: 'Mira', count: 2 })
  })

  it('does not flag characters already in the cast or POV', () => {
    const events = [event('e1', 'c1', 0, { involvedCharacterIds: ['kael'], povCharacterId: 'mira' })]
    const sceneTextByEvent = new Map([['e1', 'Kael and Mira faced the storm. Kael spoke, Mira did not.']])
    expect(computeProseMentionIssues({ events, characters: cast, sceneTextByEvent })).toHaveLength(0)
  })

  it('does not flag a character who is an explicit @-mention on the event', () => {
    const events = [event('e1', 'c1', 0, { involvedCharacterIds: ['kael'], mentionedCharacterIds: ['mira'] })]
    const sceneTextByEvent = new Map([['e1', 'Kael spoke of Mira, far away. Mira, always Mira.']])
    expect(computeProseMentionIssues({ events, characters: cast, sceneTextByEvent })).toHaveLength(0)
  })

  /*
    The dead are not a separate finding here, deliberately. The check that made
    them one reported Billy Bones thirty-eight times on *Treasure Island*: he
    dies in chapter three and the whole plot is his map and his chest. Naming
    the dead is what novels do. `dead-in-event` asks the answerable version —
    is a dead character in the scene's *cast*.
  */
  it('treats a dead character named in the prose as an ordinary unaccounted name', () => {
    const events = [event('e3', 'c3', 0, { involvedCharacterIds: ['mira'] })]
    const sceneTextByEvent = new Map([['e3', 'Mira remembered Kael. Kael had fallen at the gate.']])
    const issues = computeProseMentionIssues({ events, characters: cast, sceneTextByEvent })
    expect(issues).toHaveLength(1)
    expect(issues[0].characters[0].characterName).toBe('Kael')
  })

  it('ignores events without prose', () => {
    const events = [event('e1', 'c1', 0)]
    expect(computeProseMentionIssues({ events, characters: cast, sceneTextByEvent: new Map() })).toEqual([])
  })
})

describe('computeKnowledgeLeaks', () => {
  const events = [event('e1', 'c1', 0), event('e2', 'c2', 0), event('e3', 'c3', 0)]

  it('flags a tag appearing in prose before the reader reveal', () => {
    const facts = [fact('f1', 'The true heir', ['heir'], 'e3')]
    const sceneTextByEvent = new Map([['e1', 'Rumors named a hidden heir in the north.']])
    const leaks = computeKnowledgeLeaks({ facts, events, chapters, sceneTextByEvent })
    expect(leaks).toHaveLength(1)
    expect(leaks[0]).toMatchObject({ leakEventId: 'e1', revealEventId: 'e3', matchedTerm: 'heir' })
  })

  it('flags the exact title phrase appearing early', () => {
    const facts = [fact('f1', 'the king is dead', [], 'e3')]
    const sceneTextByEvent = new Map([['e2', 'Whispers spread that the king is dead by dawn.']])
    const leaks = computeKnowledgeLeaks({ facts, events, chapters, sceneTextByEvent })
    expect(leaks).toHaveLength(1)
    expect(leaks[0].matchedTerm).toBe('the king is dead')
  })

  it('does not flag references at or after the reveal event', () => {
    const facts = [fact('f1', 'The true heir', ['heir'], 'e2')]
    const sceneTextByEvent = new Map([['e3', 'The heir claimed the throne.']]) // after reveal
    const leaks = computeKnowledgeLeaks({ facts, events, chapters, sceneTextByEvent })
    expect(leaks).toEqual([])
  })

  it('skips facts with no reader clock set', () => {
    const facts = [fact('f1', 'The true heir', ['heir'], null)]
    const sceneTextByEvent = new Map([['e1', 'The heir was near.']])
    expect(computeKnowledgeLeaks({ facts, events, chapters, sceneTextByEvent })).toEqual([])
  })

  it('does not match a tag as a substring of a longer word', () => {
    const facts = [fact('f1', 'The true heir', ['heir'], 'e3')]
    const sceneTextByEvent = new Map([['e1', 'Their theirloom, an heirloom, sat there.']])
    // "heirloom"/"theirloom" contain "heir" but not as a whole word.
    expect(computeKnowledgeLeaks({ facts, events, chapters, sceneTextByEvent })).toEqual([])
  })
})
