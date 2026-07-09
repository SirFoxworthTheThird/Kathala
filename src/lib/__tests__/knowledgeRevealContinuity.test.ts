import { describe, it, expect } from 'vitest'
import { computeDeadKnowerIssues } from '@/lib/knowledgeRevealContinuity'
import type { KnowledgeFact, KnowledgeReveal, CharacterSnapshot, WorldEvent, Chapter } from '@/types'

// ── factories ─────────────────────────────────────────────────────────────────

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: `Ch${number}`, synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, isFlashback = false): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback,
    createdAt: 0, updatedAt: 0,
  }
}
function fact(id: string, title: string): KnowledgeFact {
  return { id, worldId: 'w', title, description: '', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: 0, updatedAt: 0 }
}
function reveal(factId: string, characterId: string, eventId: string): KnowledgeReveal {
  return { id: `${factId}-${characterId}-${eventId}`, worldId: 'w', factId, characterId, eventId, note: '', createdAt: 0, updatedAt: 0 }
}
function aliveSnap(characterId: string, eventId: string, isAlive: boolean): CharacterSnapshot {
  return {
    id: `${characterId}-${eventId}`, worldId: 'w', characterId, eventId,
    isAlive, currentLocationMarkerId: null, currentMapLayerId: null,
    inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: 0, updatedAt: 0,
  }
}

// Three chapters, one event each: e1 < e2 < e3.
const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]
const events = [event('e1', 'c1', 0), event('e2', 'c2', 0), event('e3', 'c3', 0)]
const facts = [fact('f1', 'The king is a traitor')]

describe('computeDeadKnowerIssues', () => {
  it('flags a reveal to a character who died in an earlier event', () => {
    const snapshots = [aliveSnap('A', 'e1', false)] // A dies in Ch. 1
    const reveals = [reveal('f1', 'A', 'e3')]        // ...but "learns" it in Ch. 3
    const issues = computeDeadKnowerIssues({ facts, reveals, snapshots, events, chapters })
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ characterId: 'A', revealEventId: 'e3' })
    expect(issues[0].fact.id).toBe('f1')
  })

  it('does not flag a reveal to a living character', () => {
    const snapshots = [aliveSnap('A', 'e1', true)]
    const reveals = [reveal('f1', 'A', 'e3')]
    expect(computeDeadKnowerIssues({ facts, reveals, snapshots, events, chapters })).toHaveLength(0)
  })

  it('leaves a death-bed revelation (reveal at the death event) alone', () => {
    const snapshots = [aliveSnap('A', 'e2', false)] // A is marked dead at e2
    const reveals = [reveal('f1', 'A', 'e2')]        // learns it at that same event
    expect(computeDeadKnowerIssues({ facts, reveals, snapshots, events, chapters })).toHaveLength(0)
  })

  it('ignores reveals inside flashbacks', () => {
    const flashEvents = [event('e1', 'c1', 0), event('e2', 'c2', 0), event('e3', 'c3', 0, true)]
    const snapshots = [aliveSnap('A', 'e1', false)]
    const reveals = [reveal('f1', 'A', 'e3')]
    expect(computeDeadKnowerIssues({ facts, reveals, snapshots, events: flashEvents, chapters })).toHaveLength(0)
  })

  it('respects resurrection: alive again before the reveal is fine', () => {
    const snapshots = [aliveSnap('A', 'e1', false), aliveSnap('A', 'e2', true)] // dies then returns
    const reveals = [reveal('f1', 'A', 'e3')]
    expect(computeDeadKnowerIssues({ facts, reveals, snapshots, events, chapters })).toHaveLength(0)
  })

  it('skips reveals whose fact no longer exists', () => {
    const snapshots = [aliveSnap('A', 'e1', false)]
    const reveals = [reveal('ghost', 'A', 'e3')]
    expect(computeDeadKnowerIssues({ facts, reveals, snapshots, events, chapters })).toHaveLength(0)
  })

  it('handles a character with no snapshots (unknown status) as not dead', () => {
    const reveals = [reveal('f1', 'A', 'e3')]
    expect(computeDeadKnowerIssues({ facts, reveals, snapshots: [], events, chapters })).toHaveLength(0)
  })
})
