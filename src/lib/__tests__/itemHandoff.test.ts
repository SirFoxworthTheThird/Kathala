import { describe, it, expect } from 'vitest'
import { computeItemHandoffIssues } from '@/lib/itemHandoff'
import type { WorldEvent, Chapter, CharacterSnapshot, ItemPlacement } from '@/types'

// ── factories ─────────────────────────────────────────────────────────────────

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: `Ch${number}`, synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
    createdAt: 0, updatedAt: 0,
  }
}
function snap(characterId: string, eventId: string, markerId: string | null, inventoryItemIds: string[] = []): CharacterSnapshot {
  return {
    id: `${characterId}-${eventId}`, worldId: 'w', characterId, eventId,
    isAlive: true, currentLocationMarkerId: markerId, currentMapLayerId: markerId ? 'layer1' : null,
    inventoryItemIds, inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: 0, updatedAt: 0,
  }
}
function placement(itemId: string, eventId: string, locationMarkerId: string): ItemPlacement {
  return { id: `${itemId}-${eventId}`, worldId: 'w', itemId, eventId, locationMarkerId, notes: '', createdAt: 0, updatedAt: 0 }
}

// Three chapters, one event each, in narrative order e1 < e2 < e3.
const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]
const events = [event('e1', 'c1', 0), event('e2', 'c2', 0), event('e3', 'c3', 0)]

describe('computeItemHandoffIssues', () => {
  it('flags an item that jumps between characters at different places with no meeting', () => {
    const snapshots = [
      snap('A', 'e1', 'X', ['sword']),
      snap('B', 'e3', 'Y', ['sword']),
    ]
    const issues = computeItemHandoffIssues({ events, chapters, snapshots, placements: [] })
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      itemId: 'sword', fromCharacterId: 'A', toCharacterId: 'B',
      fromMarkerId: 'X', toMarkerId: 'Y', handoffEventId: 'e3',
    })
  })

  it('does not flag a hand-off at the same location', () => {
    const snapshots = [
      snap('A', 'e1', 'X', ['sword']),
      snap('B', 'e2', 'X', ['sword']),
    ]
    expect(computeItemHandoffIssues({ events, chapters, snapshots, placements: [] })).toHaveLength(0)
  })

  it('does not flag when the two characters meet somewhere in the hand-off window', () => {
    // A holds it at X (e1); both A and B are at Z at e2 (they meet); B holds it at Y (e3).
    const snapshots = [
      snap('A', 'e1', 'X', ['sword']),
      snap('A', 'e2', 'Z'),
      snap('B', 'e2', 'Z'),
      snap('B', 'e3', 'Y', ['sword']),
    ]
    expect(computeItemHandoffIssues({ events, chapters, snapshots, placements: [] })).toHaveLength(0)
  })

  it('does not flag a drop-then-pickup routed through a location placement', () => {
    // A drops it at a location (e2), B picks it up later (e3): no direct A→B transfer.
    const snapshots = [
      snap('A', 'e1', 'X', ['sword']),
      snap('B', 'e3', 'Y', ['sword']),
    ]
    const placements = [placement('sword', 'e2', 'P')]
    expect(computeItemHandoffIssues({ events, chapters, snapshots, placements })).toHaveLength(0)
  })

  it('does not judge hand-offs where either location is unknown', () => {
    const snapshots = [
      snap('A', 'e1', null, ['sword']),
      snap('B', 'e3', 'Y', ['sword']),
    ]
    expect(computeItemHandoffIssues({ events, chapters, snapshots, placements: [] })).toHaveLength(0)
  })

  it('uses the previous owner’s last location when they moved while holding it', () => {
    // A carries it X (e1) → Y (e2), then B has it at Z (e3): from-marker should be Y.
    const snapshots = [
      snap('A', 'e1', 'X', ['sword']),
      snap('A', 'e2', 'Y', ['sword']),
      snap('B', 'e3', 'Z', ['sword']),
    ]
    const issues = computeItemHandoffIssues({ events, chapters, snapshots, placements: [] })
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ fromMarkerId: 'Y', toMarkerId: 'Z', handoffEventId: 'e3' })
  })

  it('handles multiple items independently', () => {
    const snapshots = [
      snap('A', 'e1', 'X', ['sword', 'ring']),
      snap('B', 'e3', 'Y', ['sword']), // sword teleports
      snap('A', 'e3', 'X', ['ring']),  // ring stays with A
    ]
    const issues = computeItemHandoffIssues({ events, chapters, snapshots, placements: [] })
    expect(issues.map((i) => i.itemId)).toEqual(['sword'])
  })

  it('returns nothing when an item never changes hands', () => {
    const snapshots = [
      snap('A', 'e1', 'X', ['sword']),
      snap('A', 'e2', 'Y', ['sword']),
      snap('A', 'e3', 'Z', ['sword']),
    ]
    expect(computeItemHandoffIssues({ events, chapters, snapshots, placements: [] })).toHaveLength(0)
  })
})
