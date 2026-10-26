import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { handItemTo, placeItemAtLocation, takeItemBack } from '@/db/hooks/useItemPlacements'
import { recordFates, upsertSnapshot } from '@/db/hooks/useSnapshots'
import { inventoryOf, rederiveCustodyAt } from '@/db/hooks/useCustody'
import { upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'
import { upsertLocationSnapshot } from '@/db/hooks/useLocationSnapshots'
import { upsertRelationshipSnapshot } from '@/db/hooks/useRelationshipSnapshots'
import type { Chapter, Timeline, World, WorldEvent } from '@/types'

/*
  Writer run 10: the Torque Key is Ilse's in the Mercy (1 BL) and Rhee's in the
  Compact, three centuries on. Giving it to Rhee took it "out of Ilse's hands"
  by writing Ilse a state at Rhee's scene — and every such hand-off across the
  book put a person on a map centuries from their own era. A hand-off takes an
  item from whoever holds it *in this scene's era*.
*/
const W = 'w'

async function seed(apart: boolean) {
  await db.worlds.add({ id: W, name: 'The Cold Choir', description: '', createdAt: 0, updatedAt: 0 } as unknown as World)
  await db.timelines.bulkAdd([
    { id: 'mercy', worldId: W, name: 'The Mercy', dayOffset: 0, createdAt: 0 },
    { id: 'compact', worldId: W, name: 'The Compact', dayOffset: apart ? 113_000 : 0, createdAt: 0 },
  ] as unknown as Timeline[])
  await db.chapters.bulkAdd([
    { id: 'c1', worldId: W, timelineId: 'mercy', number: 1, title: 'One' },
    { id: 'c2', worldId: W, timelineId: 'compact', number: 2, title: 'Two' },
  ] as unknown as Chapter[])
  const scene = (id: string, chapterId: string, timelineId: string) => ({
    id, worldId: W, chapterId, timelineId, sortOrder: 0, title: id, travelDays: 1, inWorldTime: null, isFlashback: false,
    involvedCharacterIds: [], locationMarkerId: null,
  })
  await db.events.bulkAdd([scene('mercy-1', 'c1', 'mercy'), scene('compact-2', 'c2', 'compact')] as unknown as WorldEvent[])
  await db.items.add({ id: 'key', worldId: W, name: 'The Torque Key', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: 0, updatedAt: 0 } as never)
  await upsertSnapshot({
    worldId: W, characterId: 'ilse', eventId: 'mercy-1', isAlive: true,
    currentLocationMarkerId: 'deck-nine', currentMapLayerId: null,
    inventoryItemIds: ['key'], inventoryNotes: '', statusNotes: '', travelModeId: null,
  })
  await rederiveCustodyAt(W, ['mercy-1'])
}

const statesAt = (characterId: string, eventId: string) =>
  db.characterSnapshots.where('[characterId+eventId]').equals([characterId, eventId]).toArray()

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

/*
  With custody (Part B1) a hand-off writes nobody a state at all: it is one
  statement about the key, at Rhee's scene. The era is in the reading — Ilse's
  key in 1 BL is not in her hands in 311 AL, three centuries on — and the
  writes no longer have a way to reach across it.
*/
describe('a hand-off takes an item only from its holder in this era', () => {
  const holds = (characterId: string, eventId: string) => inventoryOf(W, characterId, eventId)

  it('gives it to Rhee without writing Ilse a state three centuries on', async () => {
    await seed(true)
    // Apart, Ilse's key is hers in her own era only.
    expect(await holds('ilse', 'compact-2')).toEqual([])
    await handItemTo(W, 'key', 'compact-2', 'rhee')
    expect(await statesAt('ilse', 'compact-2')).toHaveLength(0)
    expect(await statesAt('rhee', 'compact-2')).toHaveLength(0)
    expect(await holds('rhee', 'compact-2')).toEqual(['key'])
    expect(await holds('ilse', 'mercy-1')).toEqual(['key'])
  })

  it('still takes it from Ilse where the two timelines share an era', async () => {
    await seed(false)
    expect(await holds('ilse', 'compact-2')).toEqual(['key'])
    await handItemTo(W, 'key', 'compact-2', 'rhee')
    expect(await holds('ilse', 'compact-2')).toEqual([])
    expect(await holds('rhee', 'compact-2')).toEqual(['key'])
    expect(await statesAt('ilse', 'compact-2')).toHaveLength(0)
  })

  it('puts it down the same way', async () => {
    for (const apart of [true, false]) {
      await db.delete()
      await db.open()
      await seed(apart)
      await placeItemAtLocation(W, 'key', 'compact-2', 'the-choir')
      expect(await statesAt('ilse', 'compact-2')).toHaveLength(0)
      expect(await holds('ilse', 'compact-2')).toEqual([])
      expect(await holds('ilse', 'mercy-1')).toEqual(['key'])
    }
  })
})

/*
  A write starts from what this era last said. "The state before this scene"
  used to be the previous stored sortKey anywhere in the book, so a state
  recorded in 311 AL that matched one from 1 BL was not written at all, and a
  death in 311 AL carried the 1 BL record's place.
*/
describe('a write starts from the state before it in its own era', () => {
  // Word for word the state seeded at the Mercy's scene.
  const state = (characterId: string, eventId: string) => ({
    worldId: W, characterId, eventId, isAlive: true, currentLocationMarkerId: 'deck-nine' as string | null, currentMapLayerId: null,
    inventoryItemIds: ['key'], inventoryNotes: '', statusNotes: '', travelModeId: null,
  })

  it('records a state that repeats another era’s, and still skips one that repeats its own', async () => {
    await seed(true)
    await upsertSnapshot(state('ilse', 'compact-2'))
    expect(await statesAt('ilse', 'compact-2')).toHaveLength(1)
    await db.delete()
    await db.open()
    await seed(false)
    await upsertSnapshot(state('ilse', 'compact-2'))
    // One era: it repeats the state before it, so nothing is written.
    expect(await statesAt('ilse', 'compact-2')).toHaveLength(0)
  })

  it('carries a death’s place only from the same era', async () => {
    await seed(true)
    await recordFates(W, 'compact-2', [{ characterId: 'ilse', isAlive: false, revived: false }])
    expect((await statesAt('ilse', 'compact-2'))[0]?.currentLocationMarkerId).toBeNull()
    await db.delete()
    await db.open()
    await seed(false)
    await recordFates(W, 'compact-2', [{ characterId: 'ilse', isAlive: false, revived: false }])
    expect((await statesAt('ilse', 'compact-2'))[0]?.currentLocationMarkerId).toBe('deck-nine')
  })

  it('records an item’s condition that repeats another era’s', async () => {
    await seed(true)
    const condition = (eventId: string) => upsertItemSnapshot({ worldId: W, itemId: 'key', eventId, condition: 'damaged', notes: '' })
    await condition('mercy-1')
    await condition('compact-2')
    expect(await db.itemSnapshots.where('itemId').equals('key').count()).toBe(2)
    await db.delete()
    await db.open()
    await seed(false)
    await condition('mercy-1')
    await condition('compact-2')
    expect(await db.itemSnapshots.where('itemId').equals('key').count()).toBe(1)
  })

  it('records a place’s state and a relationship’s that repeat another era’s', async () => {
    const both = async (eventId: string) => {
      await upsertLocationSnapshot({ worldId: W, locationMarkerId: 'hall', eventId, status: 'ruined', notes: '' })
      await upsertRelationshipSnapshot({ worldId: W, relationshipId: 'r', eventId, label: 'sworn', strength: 'strong', sentiment: 'positive', description: '', isActive: true })
    }
    await seed(true)
    await both('mercy-1')
    await both('compact-2')
    expect([await db.locationSnapshots.count(), await db.relationshipSnapshots.count()]).toEqual([2, 2])
    await db.delete()
    await db.open()
    await seed(false)
    await both('mercy-1')
    await both('compact-2')
    expect([await db.locationSnapshots.count(), await db.relationshipSnapshots.count()]).toEqual([1, 1])
  })

  it('gives an item taken back to its holder before only within the era', async () => {
    const run = async (apart: boolean) => {
      await db.delete()
      await db.open()
      await seed(apart)
      await handItemTo(W, 'key', 'compact-2', 'rhee')
      await takeItemBack('key', 'compact-2', 'rhee')
      return inventoryOf(W, 'ilse', 'compact-2')
    }
    // Ilse's key in 1 BL is not one Rhee took from her in 311 AL.
    expect(await run(true)).toEqual([])
    expect(await run(false)).toEqual(['key'])
  })
})
