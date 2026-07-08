import { describe, it, expect } from 'vitest'
import { computeProseMentionIssues, computeKnowledgeLeaks } from '@/lib/proseContinuity'
import type { WorldEvent, Chapter, Character, CharacterSnapshot, KnowledgeFact } from '@/types'

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
function snap(characterId: string, eventId: string, isAlive: boolean): CharacterSnapshot {
  return { id: `s-${characterId}-${eventId}`, worldId: 'w', characterId, eventId, isAlive } as unknown as CharacterSnapshot
}
function fact(id: string, title: string, tags: string[], readerLearnsAtEventId: string | null): KnowledgeFact {
  return { id, worldId: 'w', title, description: '', tags, readerLearnsAtEventId, originEventId: null, createdAt: 0, updatedAt: 0 }
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]
const cast = [char('kael', 'Kael'), char('mira', 'Mira')]

describe('computeProseMentionIssues', () => {
  it('flags a character named in the prose but not in the cast', () => {
    const events = [event('e1', 'c1', 0, { involvedCharacterIds: ['kael'] })]
    const sceneTextByEvent = new Map([['e1', 'Kael turned to Mira and spoke.']])
    const issues = computeProseMentionIssues({ events, chapters, characters: cast, snapshots: [], sceneTextByEvent })
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ kind: 'untagged', characterId: 'mira', eventId: 'e1' })
  })

  it('does not flag characters already in the cast or POV', () => {
    const events = [event('e1', 'c1', 0, { involvedCharacterIds: ['kael'], povCharacterId: 'mira' })]
    const sceneTextByEvent = new Map([['e1', 'Kael and Mira faced the storm.']])
    const issues = computeProseMentionIssues({ events, chapters, characters: cast, snapshots: [], sceneTextByEvent })
    expect(issues).toHaveLength(0)
  })

  it('does not flag a character who is an explicit @-mention on the event', () => {
    const events = [event('e1', 'c1', 0, { involvedCharacterIds: ['kael'], mentionedCharacterIds: ['mira'] })]
    const sceneTextByEvent = new Map([['e1', 'Kael spoke of Mira, far away.']])
    const issues = computeProseMentionIssues({ events, chapters, characters: cast, snapshots: [], sceneTextByEvent })
    expect(issues).toHaveLength(0)
  })

  it('flags a dead character named in a later scene', () => {
    const events = [
      event('e1', 'c1', 0, { involvedCharacterIds: ['mira'] }),
      event('e3', 'c3', 0, { involvedCharacterIds: ['mira'] }),
    ]
    // Kael dies at e1; his name then appears in e3's prose (not in that cast).
    const snapshots = [snap('kael', 'e1', false)]
    const sceneTextByEvent = new Map([['e3', 'Mira remembered how Kael had fallen.']])
    const issues = computeProseMentionIssues({ events, chapters, characters: cast, snapshots, sceneTextByEvent })
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ kind: 'dead', characterId: 'kael', eventId: 'e3' })
  })

  it('treats a dead mention in a flashback as ordinary drift, not a death error', () => {
    const events = [
      event('e1', 'c1', 0),
      event('e3', 'c3', 0, { isFlashback: true }),
    ]
    const snapshots = [snap('kael', 'e1', false)]
    const sceneTextByEvent = new Map([['e3', 'Kael laughed in the sunlit yard.']])
    const issues = computeProseMentionIssues({ events, chapters, characters: cast, snapshots, sceneTextByEvent })
    expect(issues[0].kind).toBe('untagged')
  })

  it('ignores events without prose', () => {
    const events = [event('e1', 'c1', 0)]
    const issues = computeProseMentionIssues({ events, chapters, characters: cast, snapshots: [], sceneTextByEvent: new Map() })
    expect(issues).toEqual([])
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
