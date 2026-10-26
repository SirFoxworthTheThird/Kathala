import { describe, it, expect } from 'vitest'
import { itemCarryPlan } from '@/lib/carryForward'
import { storyOf } from '@/lib/stateEngine'
import type { CharacterSnapshot } from '@/types'

/**
 * T-2: an item held at a scene and missing from the holder's later records,
 * and where carrying it forward would stop. The field half of carrying forward
 * (F2) is gone: a record says only what changes at its scene (Part B2), so a
 * change at an earlier scene reaches past it with nothing to carry.
 */

const KNIFE = 'it-knife'
const LETTER = 'it-letter'

const events = [
  { id: 'e1', chapterId: 'c1', sortOrder: 0, title: 'The reed house' },
  { id: 'e2', chapterId: 'c1', sortOrder: 1, title: 'Setting out' },
  { id: 'e3', chapterId: 'c2', sortOrder: 0, title: 'The seal breaks' },
  { id: 'e4', chapterId: 'c3', sortOrder: 0, title: 'Ferrow Crossing' },
]
const chapters = [
  { id: 'c1', number: 1 },
  { id: 'c2', number: 2 },
  { id: 'c3', number: 3 },
]

function snap(eventId: string, inventoryItemIds: string[], extra: Partial<CharacterSnapshot> = {}): CharacterSnapshot {
  return {
    id: `s-${eventId}`, worldId: 'w', characterId: 'corvin', eventId, isAlive: true,
    currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds,
    inventoryNotes: '', statusNotes: '', travelModeId: null,
    createdAt: 0, updatedAt: 0, ...extra,
  }
}

describe('itemCarryPlan (T-2)', () => {
  const other = (eventId: string, inventoryItemIds: string[]) => snap(eventId, inventoryItemIds, { id: `o-${eventId}`, characterId: 'wren' })
  const run = (snapshots: CharacterSnapshot[], placements: Array<{ itemId: string; eventId: string }> = []) =>
    itemCarryPlan({ characterId: 'corvin', itemId: KNIFE, fromEventId: 'e1', snapshots, placements, events, chapters })
      .map((t) => t.snapshot.eventId)

  it('is the holder’s later records that lack the item, to the end of the book', () => {
    expect(run([snap('e1', [KNIFE]), snap('e2', []), snap('e3', [LETTER]), snap('e4', [])])).toEqual(['e2', 'e3', 'e4'])
  })
  it('stops where somebody else holds it', () => {
    expect(run([snap('e1', [KNIFE]), snap('e2', []), other('e3', [KNIFE]), snap('e4', [])])).toEqual(['e2'])
  })
  it('stops where it is put down at a place', () => {
    expect(run([snap('e1', [KNIFE]), snap('e2', []), snap('e4', [])], [{ itemId: KNIFE, eventId: 'e3' }])).toEqual(['e2'])
  })
  it('is nothing when the next record already has it', () => {
    expect(run([snap('e1', [KNIFE]), snap('e2', [KNIFE]), snap('e3', [])])).toEqual([])
  })
})

describe('carrying forward stays within an era', () => {
  /*
    Ch. 1 and 3 are 1 BL (the Mercy), Ch. 2 is 311 AL (the Compact). An item
    carried from Ch. 1 reaches Ch. 3's record, not Ch. 2's: that one is
    centuries away.
  */
  const placed = events.map((e) => ({ ...e, timelineId: e.chapterId === 'c2' ? 'compact' : 'mercy', travelDays: 1 }))
  const eras = storyOf(placed, chapters, [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 113_000 }])
  const oneEra = storyOf(placed, chapters, [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 0 }])

  it('puts an item back only through this era’s scenes', () => {
    const snapshots = [snap('e1', [KNIFE]), snap('e3', []), snap('e4', [])]
    const run = (story: typeof eras) => itemCarryPlan({ characterId: 'corvin', itemId: KNIFE, fromEventId: 'e1', snapshots, placements: [], events, chapters, story }).map((t) => t.snapshot.eventId)
    expect(run(eras)).toEqual(['e4'])
    expect(run(oneEra)).toEqual(['e3', 'e4'])
  })
})
