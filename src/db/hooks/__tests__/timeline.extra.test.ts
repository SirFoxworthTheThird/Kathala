import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createTimeline, createChapter, deleteChapter } from '@/db/hooks/useTimeline'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { placeItemAtLocation } from '@/db/hooks/useItemPlacements'
import { upsertLocationSnapshot } from '@/db/hooks/useLocationSnapshots'
import { upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function makeTl() {
  return createTimeline({ worldId: 'w', name: 'Main', description: '', color: '#000' })
}

// ── createChapter — state inheritance ────────────────────────────────────────

describe('createChapter — inherits state from previous chapter', () => {
  it('copies characterSnapshots from the previous chapter', async () => {
    const tl = await makeTl()
    const ch1 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch 1', synopsis: '' })

    await upsertSnapshot({
      worldId: 'w', characterId: 'char-1', chapterId: ch1.id,
      isAlive: true, currentLocationMarkerId: 'loc-1', currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'healthy', travelModeId: null,
    })

    const ch2 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 2, title: 'Ch 2', synopsis: '' })

    const ch2Snaps = await db.characterSnapshots.where('chapterId').equals(ch2.id).toArray()
    expect(ch2Snaps).toHaveLength(1)
    expect(ch2Snaps[0].characterId).toBe('char-1')
    expect(ch2Snaps[0].statusNotes).toBe('healthy')
    // New snapshot should have a different id
    expect(ch2Snaps[0].id).not.toBe((await db.characterSnapshots.where('chapterId').equals(ch1.id).first())!.id)
  })

  it('copies itemPlacements from the previous chapter', async () => {
    const tl = await makeTl()
    const ch1 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch 1', synopsis: '' })

    await placeItemAtLocation('w', 'item-1', ch1.id, 'loc-A')

    const ch2 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 2, title: 'Ch 2', synopsis: '' })

    const ch2Placements = await db.itemPlacements.where('chapterId').equals(ch2.id).toArray()
    expect(ch2Placements).toHaveLength(1)
    expect(ch2Placements[0].itemId).toBe('item-1')
    expect(ch2Placements[0].locationMarkerId).toBe('loc-A')
  })

  it('copies locationSnapshots from the previous chapter', async () => {
    const tl = await makeTl()
    const ch1 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch 1', synopsis: '' })

    await upsertLocationSnapshot({
      worldId: 'w', locationMarkerId: 'loc-1', chapterId: ch1.id,
      status: 'thriving', notes: 'All is well',
    })

    const ch2 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 2, title: 'Ch 2', synopsis: '' })

    const ch2LocSnaps = await db.locationSnapshots.where('chapterId').equals(ch2.id).toArray()
    expect(ch2LocSnaps).toHaveLength(1)
    expect(ch2LocSnaps[0].locationMarkerId).toBe('loc-1')
    expect(ch2LocSnaps[0].status).toBe('thriving')
  })

  it('copies itemSnapshots from the previous chapter', async () => {
    const tl = await makeTl()
    const ch1 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch 1', synopsis: '' })

    await upsertItemSnapshot({
      worldId: 'w', itemId: 'item-1', chapterId: ch1.id,
      condition: 'shiny', notes: 'Freshly polished',
    })

    const ch2 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 2, title: 'Ch 2', synopsis: '' })

    const ch2ItemSnaps = await db.itemSnapshots.where('chapterId').equals(ch2.id).toArray()
    expect(ch2ItemSnaps).toHaveLength(1)
    expect(ch2ItemSnaps[0].itemId).toBe('item-1')
    expect(ch2ItemSnaps[0].condition).toBe('shiny')
  })

  it('does not copy anything when there is no previous chapter', async () => {
    const tl = await makeTl()
    // Chapter number 1 has no predecessor
    const ch1 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'First', synopsis: '' })

    const snaps = await db.characterSnapshots.where('chapterId').equals(ch1.id).toArray()
    const placements = await db.itemPlacements.where('chapterId').equals(ch1.id).toArray()
    expect(snaps).toHaveLength(0)
    expect(placements).toHaveLength(0)
  })

  it('inherits from the immediately preceding chapter, not a further one', async () => {
    const tl = await makeTl()
    const ch1 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch 1', synopsis: '' })
    const ch2 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 2, title: 'Ch 2', synopsis: '' })

    await upsertSnapshot({
      worldId: 'w', characterId: 'char-x', chapterId: ch1.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'ch1 state', travelModeId: null,
    })
    await upsertSnapshot({
      worldId: 'w', characterId: 'char-x', chapterId: ch2.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'ch2 state', travelModeId: null,
    })

    // ch3 should inherit from ch2, not ch1
    const ch3 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 3, title: 'Ch 3', synopsis: '' })

    const ch3Snaps = await db.characterSnapshots.where('chapterId').equals(ch3.id).toArray()
    expect(ch3Snaps).toHaveLength(1)
    expect(ch3Snaps[0].statusNotes).toBe('ch2 state')
  })
})

// ── deleteChapter — extended cascades ────────────────────────────────────────

describe('deleteChapter — cascades to itemPlacements, locationSnapshots, itemSnapshots', () => {
  it('cascades to itemPlacements', async () => {
    const tl = await makeTl()
    const ch = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch', synopsis: '' })
    await placeItemAtLocation('w', 'item-1', ch.id, 'loc-1')

    await deleteChapter(ch.id)
    expect(await db.itemPlacements.where('chapterId').equals(ch.id).count()).toBe(0)
  })

  it('cascades to locationSnapshots', async () => {
    const tl = await makeTl()
    const ch = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch', synopsis: '' })
    await upsertLocationSnapshot({
      worldId: 'w', locationMarkerId: 'loc-1', chapterId: ch.id,
      status: 'active', notes: '',
    })

    await deleteChapter(ch.id)
    expect(await db.locationSnapshots.where('chapterId').equals(ch.id).count()).toBe(0)
  })

  it('cascades to itemSnapshots', async () => {
    const tl = await makeTl()
    const ch = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch', synopsis: '' })
    await upsertItemSnapshot({
      worldId: 'w', itemId: 'item-1', chapterId: ch.id,
      condition: 'good', notes: '',
    })

    await deleteChapter(ch.id)
    expect(await db.itemSnapshots.where('chapterId').equals(ch.id).count()).toBe(0)
  })
})
