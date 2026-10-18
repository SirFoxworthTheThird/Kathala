import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { handItemTo, placeItemAtLocation } from '@/db/hooks/useItemPlacements'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
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
  await upsertSnapshot({
    worldId: W, characterId: 'ilse', eventId: 'mercy-1', isAlive: true,
    currentLocationMarkerId: 'deck-nine', currentMapLayerId: null,
    inventoryItemIds: ['key'], inventoryNotes: '', statusNotes: '', travelModeId: null,
  })
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

describe('a hand-off takes an item only from its holder in this era', () => {
  it('gives it to Rhee without writing Ilse a state three centuries on', async () => {
    await seed(true)
    await handItemTo(W, 'key', 'compact-2', 'rhee')
    expect(await statesAt('ilse', 'compact-2')).toHaveLength(0)
    expect((await statesAt('rhee', 'compact-2'))[0]?.inventoryItemIds).toEqual(['key'])
  })

  it('still takes it from Ilse where the two timelines share an era', async () => {
    await seed(false)
    await handItemTo(W, 'key', 'compact-2', 'rhee')
    const [ilse] = await statesAt('ilse', 'compact-2')
    expect(ilse?.inventoryItemIds).toEqual([])
  })

  it('puts it down the same way', async () => {
    await seed(true)
    await placeItemAtLocation(W, 'key', 'compact-2', 'the-choir')
    expect(await statesAt('ilse', 'compact-2')).toHaveLength(0)
    await db.delete()
    await db.open()
    await seed(false)
    await placeItemAtLocation(W, 'key', 'compact-2', 'the-choir')
    expect((await statesAt('ilse', 'compact-2'))[0]?.inventoryItemIds).toEqual([])
  })
})
