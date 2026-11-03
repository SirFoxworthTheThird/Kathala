import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { placeItemAtLocation, removeItemPlacement } from '@/db/hooks/useItemPlacements'
import { custodyOf, inventoryOf, rederiveCustodyAt } from '@/db/hooks/useCustody'

const W  = 'world-1'
const EV = 'ev-1'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function getPlacement(itemId: string, eventId = EV) {
  return db.itemPlacements.where('[itemId+eventId]').equals([itemId, eventId]).first()
}

// ── placeItemAtLocation ───────────────────────────────────────────────────────

describe('placeItemAtLocation', () => {
  it('creates a new placement record', async () => {
    await placeItemAtLocation(W, 'item-1', EV, 'loc-1')
    const placement = await getPlacement('item-1')
    expect(placement).toBeDefined()
    expect(placement!.locationMarkerId).toBe('loc-1')
    expect(placement!.notes).toBe('')
    expect(placement!.worldId).toBe(W)
    expect(placement!.createdAt).toBeGreaterThan(0)
  })

  it('stores custom notes', async () => {
    await placeItemAtLocation(W, 'item-1', EV, 'loc-1', 'Hidden under the altar')
    const placement = await getPlacement('item-1')
    expect(placement!.notes).toBe('Hidden under the altar')
  })

  it('moves the item to a new location on second call', async () => {
    await placeItemAtLocation(W, 'item-1', EV, 'loc-1')
    await placeItemAtLocation(W, 'item-1', EV, 'loc-2')
    const placement = await getPlacement('item-1')
    expect(placement!.locationMarkerId).toBe('loc-2')
    expect(await db.itemPlacements.count()).toBe(1)
  })

  /*
    Placed, it is out of its holder's hands — and the holder is whoever had it
    at the last word about it, usually somebody recorded chapters earlier with
    nothing since. Custody (Part B1) says so once, at the scene it was put
    down; nobody's state is written for it, and the earlier record stands as
    the writer's statement about that scene.
  */
  it('takes the item off a holder whose record is at an earlier scene, writing nobody a state', async () => {
    await db.chapters.add({ id: 'ch1', worldId: W, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 })
    const ev = (id: string, sortOrder: number) => ({
      id, worldId: W, chapterId: 'ch1', timelineId: 'tl', title: id, description: '',
      sortOrder, tags: [], locationMarkerId: null, involvedCharacterIds: [],
      mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [],
      travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft' as const,
      povCharacterId: null, tension: null, isFlashback: false, createdAt: 0, updatedAt: 0,
    })
    await db.events.bulkAdd([ev('ev-early', 0), ev('ev-late', 1)])
    for (const id of ['item-1', 'item-2']) {
      await db.items.add({ id, worldId: W, name: id, description: '', iconType: 'misc', tags: [], imageId: null, createdAt: 0, updatedAt: 0 } as never)
    }
    // A whole record, as a store from before custody held it, and custody derived from it.
    await db.characterSnapshots.put({
      id: 'char-1-early', worldId: W, characterId: 'char-1', eventId: 'ev-early',
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: ['item-1', 'item-2'], inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: 0, updatedAt: 0,
    })
    await rederiveCustodyAt(W, ['ev-early'])
    expect(await inventoryOf(W, 'char-1', 'ev-late')).toEqual(['item-1', 'item-2'])

    await placeItemAtLocation(W, 'item-1', 'ev-late', 'loc-1')

    expect(await inventoryOf(W, 'char-1', 'ev-late')).toEqual(['item-2'])
    expect(await custodyOf(W, 'item-1', 'ev-late')).toEqual({ holderId: null, placeId: 'loc-1' })
    expect(await inventoryOf(W, 'char-1', 'ev-early')).toEqual(['item-1', 'item-2'])
    const early = await db.characterSnapshots.where('[characterId+eventId]').equals(['char-1', 'ev-early']).first()
    expect(early!.inventoryItemIds).toEqual(['item-1', 'item-2'])
    expect(await db.characterSnapshots.where('eventId').equals('ev-late').count()).toBe(0)

    // Taken off again, it is back in the hands it left.
    await removeItemPlacement('item-1', 'ev-late')
    expect(await inventoryOf(W, 'char-1', 'ev-late')).toEqual(['item-1', 'item-2'])
  })

  it('keeps placements isolated by event', async () => {
    await placeItemAtLocation(W, 'item-1', 'ev-1', 'loc-A')
    await placeItemAtLocation(W, 'item-1', 'ev-2', 'loc-B')

    const ev1 = await db.itemPlacements.where('[itemId+eventId]').equals(['item-1', 'ev-1']).first()
    const ev2 = await db.itemPlacements.where('[itemId+eventId]').equals(['item-1', 'ev-2']).first()
    expect(ev1!.locationMarkerId).toBe('loc-A')
    expect(ev2!.locationMarkerId).toBe('loc-B')
  })
})

// ── removeItemPlacement ───────────────────────────────────────────────────────

describe('removeItemPlacement', () => {
  it('deletes the placement record', async () => {
    await placeItemAtLocation(W, 'item-1', EV, 'loc-1')
    await removeItemPlacement('item-1', EV)
    expect(await getPlacement('item-1')).toBeUndefined()
  })

  it('is a no-op when no placement exists', async () => {
    await expect(removeItemPlacement('item-ghost', EV)).resolves.toBeUndefined()
  })

  it('only removes the targeted event placement', async () => {
    await placeItemAtLocation(W, 'item-1', 'ev-1', 'loc-A')
    await placeItemAtLocation(W, 'item-1', 'ev-2', 'loc-B')
    await removeItemPlacement('item-1', 'ev-1')

    const ev1 = await db.itemPlacements.where('[itemId+eventId]').equals(['item-1', 'ev-1']).first()
    const ev2 = await db.itemPlacements.where('[itemId+eventId]').equals(['item-1', 'ev-2']).first()
    expect(ev1).toBeUndefined()
    expect(ev2).toBeDefined()
  })
})
