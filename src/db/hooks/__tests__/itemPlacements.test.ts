import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { placeItemAtLocation, removeItemPlacement } from '@/db/hooks/useItemPlacements'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'

const W  = 'world-1'
const CH = 'ch-1'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function getPlacement(itemId: string, chapterId = CH) {
  return db.itemPlacements.where('[itemId+chapterId]').equals([itemId, chapterId]).first()
}

// ── placeItemAtLocation ───────────────────────────────────────────────────────

describe('placeItemAtLocation', () => {
  it('creates a new placement record', async () => {
    await placeItemAtLocation(W, 'item-1', CH, 'loc-1')
    const placement = await getPlacement('item-1')
    expect(placement).toBeDefined()
    expect(placement!.locationMarkerId).toBe('loc-1')
    expect(placement!.notes).toBe('')
    expect(placement!.worldId).toBe(W)
    expect(placement!.createdAt).toBeGreaterThan(0)
  })

  it('stores custom notes', async () => {
    await placeItemAtLocation(W, 'item-1', CH, 'loc-1', 'Hidden under the altar')
    const placement = await getPlacement('item-1')
    expect(placement!.notes).toBe('Hidden under the altar')
  })

  it('moves the item to a new location on second call', async () => {
    await placeItemAtLocation(W, 'item-1', CH, 'loc-1')
    await placeItemAtLocation(W, 'item-1', CH, 'loc-2')
    const placement = await getPlacement('item-1')
    expect(placement!.locationMarkerId).toBe('loc-2')
    expect(await db.itemPlacements.count()).toBe(1)
  })

  it('removes item from a character inventory before placing', async () => {
    await upsertSnapshot({
      worldId: W, characterId: 'char-1', chapterId: CH,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: ['item-1', 'item-2'],
      inventoryNotes: '', statusNotes: '', travelModeId: null,
    })

    await placeItemAtLocation(W, 'item-1', CH, 'loc-1')

    const snap = await db.characterSnapshots
      .where('[characterId+chapterId]').equals(['char-1', CH]).first()
    expect(snap!.inventoryItemIds).toEqual(['item-2'])
  })

  it('removes item from all character inventories in the chapter', async () => {
    await upsertSnapshot({
      worldId: W, characterId: 'char-1', chapterId: CH,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: ['item-1'], inventoryNotes: '', statusNotes: '', travelModeId: null,
    })
    await upsertSnapshot({
      worldId: W, characterId: 'char-2', chapterId: CH,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: ['item-1', 'item-3'], inventoryNotes: '', statusNotes: '', travelModeId: null,
    })

    await placeItemAtLocation(W, 'item-1', CH, 'loc-5')

    const snap1 = await db.characterSnapshots.where('[characterId+chapterId]').equals(['char-1', CH]).first()
    const snap2 = await db.characterSnapshots.where('[characterId+chapterId]').equals(['char-2', CH]).first()
    expect(snap1!.inventoryItemIds).toEqual([])
    expect(snap2!.inventoryItemIds).toEqual(['item-3'])
  })

  it('keeps placements isolated by chapter', async () => {
    await placeItemAtLocation(W, 'item-1', 'ch-1', 'loc-A')
    await placeItemAtLocation(W, 'item-1', 'ch-2', 'loc-B')

    const ch1 = await db.itemPlacements.where('[itemId+chapterId]').equals(['item-1', 'ch-1']).first()
    const ch2 = await db.itemPlacements.where('[itemId+chapterId]').equals(['item-1', 'ch-2']).first()
    expect(ch1!.locationMarkerId).toBe('loc-A')
    expect(ch2!.locationMarkerId).toBe('loc-B')
  })
})

// ── removeItemPlacement ───────────────────────────────────────────────────────

describe('removeItemPlacement', () => {
  it('deletes the placement record', async () => {
    await placeItemAtLocation(W, 'item-1', CH, 'loc-1')
    await removeItemPlacement('item-1', CH)
    expect(await getPlacement('item-1')).toBeUndefined()
  })

  it('is a no-op when no placement exists', async () => {
    await expect(removeItemPlacement('item-ghost', CH)).resolves.toBeUndefined()
  })

  it('only removes the targeted chapter placement', async () => {
    await placeItemAtLocation(W, 'item-1', 'ch-1', 'loc-A')
    await placeItemAtLocation(W, 'item-1', 'ch-2', 'loc-B')
    await removeItemPlacement('item-1', 'ch-1')

    const ch1 = await db.itemPlacements.where('[itemId+chapterId]').equals(['item-1', 'ch-1']).first()
    const ch2 = await db.itemPlacements.where('[itemId+chapterId]').equals(['item-1', 'ch-2']).first()
    expect(ch1).toBeUndefined()
    expect(ch2).toBeDefined()
  })
})
