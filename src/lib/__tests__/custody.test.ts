import { describe, it, expect } from 'vitest'
import { custodyAt, deriveCustody, inventoryAt, sharedHoldersAt, type CustodyStatement } from '@/lib/custody'
import { storyOf } from '@/lib/stateEngine'
import type { CharacterSnapshot, ItemPlacement } from '@/types'

/**
 * Item custody as statements (next-plan.md, B1): one statement per item per
 * scene, read as the last at or before the cursor; and the walk that turns a
 * world's existing records into them, keeping only the changes.
 */

const scenes = ['e1', 'e2', 'e3', 'e4', 'e5']
const events = scenes.map((id, i) => ({ id, chapterId: 'c1', sortOrder: i, timelineId: 'tl', travelDays: null, inWorldTime: null }))
const story = storyOf(events, [{ id: 'c1', number: 1 }], [{ id: 'tl', dayOffset: 0 }])

function snap(characterId: string, eventId: string, inventoryItemIds: string[]): CharacterSnapshot {
  return {
    id: `${characterId}-${eventId}`, worldId: 'w', characterId, eventId, isAlive: true,
    currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds,
    inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: 0, updatedAt: 0,
  }
}
const placed = (itemId: string, eventId: string, locationMarkerId: string): ItemPlacement => ({
  id: `p-${itemId}-${eventId}`, worldId: 'w', itemId, eventId, locationMarkerId, notes: '', createdAt: 0, updatedAt: 0,
})
const says = (eventId: string, holderId: string | null, placeId: string | null = null): CustodyStatement => ({ itemId: 'ledger', eventId, holderId, placeId })

describe('custodyAt', () => {
  it('is the last statement at or before the scene, and nothing before the first', () => {
    const statements = [says('e2', 'anna'), says('e4', 'bruno')]
    expect(custodyAt(statements, 'e1', story).custody).toEqual({ holderId: null, placeId: null })
    expect(custodyAt(statements, 'e3', story)).toEqual({ custody: { holderId: 'anna', placeId: null }, carriedFrom: null, at: 'e2' })
    expect(custodyAt(statements, 'e4', story).custody).toEqual({ holderId: 'bruno', placeId: null })
    expect(custodyAt(statements, 'e5', story).custody).toEqual({ holderId: 'bruno', placeId: null })
  })

  /*
    Ch. 1 is 1 BL, Ch. 2 is 311 AL. Left on the altar in the first era, it is
    still on the altar in the second; held by Anna in the first, it is in
    nobody's hands in the second, where Anna is not.
  */
  it('carries a placement into a later era, and not a holder', () => {
    const braided = [
      { id: 'a1', chapterId: 'c1', sortOrder: 0, timelineId: 'mercy', travelDays: 1, inWorldTime: null },
      { id: 'a2', chapterId: 'c1', sortOrder: 1, timelineId: 'mercy', travelDays: 1, inWorldTime: null },
      { id: 'b1', chapterId: 'c2', sortOrder: 0, timelineId: 'compact', travelDays: 1, inWorldTime: null },
    ]
    const eras = storyOf(braided, [{ id: 'c1', number: 1 }, { id: 'c2', number: 2 }], [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 113_000 }])
    expect(custodyAt([says('a1', null, 'altar')], 'b1', eras)).toEqual({ custody: { holderId: null, placeId: 'altar' }, carriedFrom: 'mercy', at: 'a1' })
    expect(custodyAt([says('a1', 'anna')], 'b1', eras).custody).toEqual({ holderId: null, placeId: null })
    // Paired: in its own era the holder is read.
    expect(custodyAt([says('a1', 'anna')], 'a2', eras).custody).toEqual({ holderId: 'anna', placeId: null })
  })
})

describe('deriveCustody', () => {
  const derive = (snapshots: CharacterSnapshot[], placements: ItemPlacement[] = [], collective = new Set<string>()) =>
    deriveCustody({ itemIds: ['ledger'], collective, placements, snapshots, scenes, story })
  const read = (statements: CustodyStatement[]) => scenes.map((scene) => {
    const { holderId: holder, placeId: place } = custodyAt(statements, scene, story).custody
    return [scene, holder ?? place ?? 'nowhere']
  })

  it('keeps only the changes: a copied inventory is one statement, not one per record', () => {
    const snapshots = [snap('anna', 'e1', ['ledger']), snap('anna', 'e2', ['ledger']), snap('anna', 'e3', ['ledger']), snap('bruno', 'e4', ['ledger']), snap('anna', 'e4', [])]
    const { statements, ambiguities } = derive(snapshots)
    expect(statements.map((s) => [s.eventId, s.holderId, s.placeId])).toEqual([['e1', 'anna', null], ['e4', 'bruno', null]])
    expect(ambiguities).toEqual([])
  })

  /*
    W-3's shape: the ledger given to Bruno at e3, and Anna's later record a copy
    of her last one. Today the copy outvotes the hand-off, and the ledger is in
    two pairs of hands from e4; as statements, a copy says nothing.
  */
  it('a stale copy says nothing: the hand-off holds', () => {
    const { statements } = derive([snap('anna', 'e1', ['ledger']), snap('bruno', 'e3', ['ledger']), snap('anna', 'e4', ['ledger'])])
    expect(read(statements)).toEqual([['e1', 'anna'], ['e2', 'anna'], ['e3', 'bruno'], ['e4', 'bruno'], ['e5', 'bruno']])
    expect(inventoryAt(statements, 'anna', 'e4', story)).toEqual([])
    expect(inventoryAt(statements, 'bruno', 'e4', story)).toEqual(['ledger'])
  })

  it('a placement holds over a copy, and a pick-up after it holds over the placement', () => {
    const snapshots = [snap('anna', 'e1', ['ledger']), snap('anna', 'e3', ['ledger']), snap('bruno', 'e4', ['ledger']), snap('anna', 'e5', [])]
    const { statements } = derive(snapshots, [placed('ledger', 'e2', 'altar')])
    // Anna's e3 record copies her e1: the altar holds. Bruno takes it in at e4: his. Anna letting go of what she no longer has says nothing.
    expect(read(statements)).toEqual([['e1', 'anna'], ['e2', 'altar'], ['e3', 'altar'], ['e4', 'bruno'], ['e5', 'bruno']])
  })

  it('a placement where its carrier is says where they have it, and it stays there when they let go', () => {
    const at = (s: CharacterSnapshot, place: string) => ({ ...s, currentLocationMarkerId: place })
    const { statements } = derive([at(snap('anna', 'e1', ['ledger']), 'quay'), at(snap('anna', 'e3', []), 'quay')], [placed('ledger', 'e1', 'quay')])
    expect(custodyAt(statements, 'e2', story).custody).toEqual({ holderId: 'anna', placeId: 'quay' })
    expect(custodyAt(statements, 'e3', story).custody).toEqual({ holderId: null, placeId: 'quay' })
    // Paired: put down somewhere she is not, it is not hers.
    const elsewhere = derive([at(snap('anna', 'e1', ['ledger']), 'quay')], [placed('ledger', 'e1', 'altar')]).statements
    expect(custodyAt(elsewhere, 'e2', story).custody).toEqual({ holderId: null, placeId: 'altar' })
  })

  it('two people taking one item at one scene is said, and one kept', () => {
    const { statements, ambiguities } = derive([snap('bruno', 'e2', ['ledger']), snap('anna', 'e2', ['ledger'])])
    expect(ambiguities).toEqual([{ itemId: 'ledger', sceneId: 'e2', holders: ['anna', 'bruno'], kept: 'anna' }])
    expect(custodyAt(statements, 'e3', story).custody.holderId).toBe('anna')
  })

  it('a collective item is each person’s own: many have some at once', () => {
    const { statements, ambiguities } = derive([snap('anna', 'e1', ['ledger']), snap('bruno', 'e2', ['ledger']), snap('anna', 'e3', [])], [], new Set(['ledger']))
    expect(ambiguities).toEqual([])
    expect(sharedHoldersAt(statements, 'e2', story).sort()).toEqual(['anna', 'bruno'])
    expect(sharedHoldersAt(statements, 'e3', story)).toEqual(['bruno'])
    expect(inventoryAt(statements, 'anna', 'e2', story, new Set(['ledger']))).toEqual(['ledger'])
    expect(inventoryAt(statements, 'anna', 'e3', story, new Set(['ledger']))).toEqual([])
  })
})
