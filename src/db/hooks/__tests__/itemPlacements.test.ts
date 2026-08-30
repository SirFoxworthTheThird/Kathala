import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { placeItemAtLocation, removeItemPlacement } from '@/db/hooks/useItemPlacements'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'

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

  it('removes item from a character inventory before placing', async () => {
    await upsertSnapshot({
      worldId: W, characterId: 'char-1', eventId: EV,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: ['item-1', 'item-2'],
      inventoryNotes: '', statusNotes: '', travelModeId: null,
    })

    await placeItemAtLocation(W, 'item-1', EV, 'loc-1')

    const snap = await db.characterSnapshots
      .where('[characterId+eventId]').equals(['char-1', EV]).first()
    expect(snap!.inventoryItemIds).toEqual(['item-2'])
  })

  it('removes item from all character inventories in the event', async () => {
    await upsertSnapshot({
      worldId: W, characterId: 'char-1', eventId: EV,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: ['item-1'], inventoryNotes: '', statusNotes: '', travelModeId: null,
    })
    await upsertSnapshot({
      worldId: W, characterId: 'char-2', eventId: EV,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: ['item-1', 'item-3'], inventoryNotes: '', statusNotes: '', travelModeId: null,
    })

    await placeItemAtLocation(W, 'item-1', EV, 'loc-5')

    const snap1 = await db.characterSnapshots.where('[characterId+eventId]').equals(['char-1', EV]).first()
    const snap2 = await db.characterSnapshots.where('[characterId+eventId]').equals(['char-2', EV]).first()
    expect(snap1!.inventoryItemIds).toEqual([])
    expect(snap2!.inventoryItemIds).toEqual(['item-3'])
  })

  /*
    The case both tests above miss, and the reason a blind run could not make
    the `dup-item` continuity rule fire: they give the holder a record at the
    very event being placed. The app resolves state by *last known*, so the
    ordinary holder is somebody recorded chapters earlier with nothing since —
    and a literal `where('eventId')` query does not see them. The item then sits
    at a location and in their hands at the same moment, and the checker cannot
    say so, because it compares literal records at one scene too.
  */
  it('takes the item off a holder whose record is at an earlier scene', async () => {
    await db.chapters.add({ id: 'ch1', worldId: W, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 })
    const ev = (id: string, sortOrder: number) => ({
      id, worldId: W, chapterId: 'ch1', timelineId: 'tl', title: id, description: '',
      sortOrder, tags: [], locationMarkerId: null, involvedCharacterIds: [],
      mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [],
      travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft' as const,
      povCharacterId: null, tension: null, isFlashback: false, createdAt: 0, updatedAt: 0,
    })
    await db.events.bulkAdd([ev('ev-early', 0), ev('ev-late', 1)])

    await upsertSnapshot({
      worldId: W, characterId: 'char-1', eventId: 'ev-early',
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: ['item-1', 'item-2'], inventoryNotes: '', statusNotes: '', travelModeId: null,
    })

    await placeItemAtLocation(W, 'item-1', 'ev-late', 'loc-1')

    // The earlier record is the writer's statement about that scene and stands.
    const early = await db.characterSnapshots.where('[characterId+eventId]').equals(['char-1', 'ev-early']).first()
    expect(early!.inventoryItemIds).toEqual(['item-1', 'item-2'])
    // The hand-off is recorded *here*, carrying the rest of what they had.
    const late = await db.characterSnapshots.where('[characterId+eventId]').equals(['char-1', 'ev-late']).first()
    expect(late).toBeDefined()
    expect(late!.inventoryItemIds).toEqual(['item-2'])
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
