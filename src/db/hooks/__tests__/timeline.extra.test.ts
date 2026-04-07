import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createTimeline, createChapter, createEvent, deleteChapter, deleteEvent } from '@/db/hooks/useTimeline'
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

async function makeCh(tl: { id: string }, number: number) {
  return createChapter({ worldId: 'w', timelineId: tl.id, number, title: `Ch ${number}`, synopsis: '' })
}

async function makeEv(tl: { id: string }, ch: { id: string }, sortOrder: number) {
  return createEvent({
    worldId: 'w',
    timelineId: tl.id,
    chapterId: ch.id,
    title: `Event ${sortOrder}`,
    description: '',
    locationMarkerId: null,
    involvedCharacterIds: [],
    involvedItemIds: [],
    tags: [],
    sortOrder,
  })
}

// ── createEvent — state inheritance ──────────────────────────────────────────

describe('createEvent — inherits state from previous event in same chapter', () => {
  it('copies characterSnapshots from the previous event', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)

    await upsertSnapshot({
      worldId: 'w', characterId: 'char-1', eventId: ev1.id,
      isAlive: true, currentLocationMarkerId: 'loc-1', currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'healthy', travelModeId: null,
    })

    const ev2 = await makeEv(tl, ch, 1)

    const ev2Snaps = await db.characterSnapshots.where('eventId').equals(ev2.id).toArray()
    expect(ev2Snaps).toHaveLength(1)
    expect(ev2Snaps[0].characterId).toBe('char-1')
    expect(ev2Snaps[0].statusNotes).toBe('healthy')
    expect(ev2Snaps[0].id).not.toBe((await db.characterSnapshots.where('eventId').equals(ev1.id).first())!.id)
  })

  it('copies itemPlacements from the previous event', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)

    await placeItemAtLocation('w', 'item-1', ev1.id, 'loc-A')

    const ev2 = await makeEv(tl, ch, 1)

    const ev2Placements = await db.itemPlacements.where('eventId').equals(ev2.id).toArray()
    expect(ev2Placements).toHaveLength(1)
    expect(ev2Placements[0].itemId).toBe('item-1')
    expect(ev2Placements[0].locationMarkerId).toBe('loc-A')
  })

  it('copies locationSnapshots from the previous event', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)

    await upsertLocationSnapshot({
      worldId: 'w', locationMarkerId: 'loc-1', eventId: ev1.id,
      status: 'thriving', notes: 'All is well',
    })

    const ev2 = await makeEv(tl, ch, 1)

    const ev2LocSnaps = await db.locationSnapshots.where('eventId').equals(ev2.id).toArray()
    expect(ev2LocSnaps).toHaveLength(1)
    expect(ev2LocSnaps[0].locationMarkerId).toBe('loc-1')
    expect(ev2LocSnaps[0].status).toBe('thriving')
  })

  it('copies itemSnapshots from the previous event', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)

    await upsertItemSnapshot({
      worldId: 'w', itemId: 'item-1', eventId: ev1.id,
      condition: 'shiny', notes: 'Freshly polished',
    })

    const ev2 = await makeEv(tl, ch, 1)

    const ev2ItemSnaps = await db.itemSnapshots.where('eventId').equals(ev2.id).toArray()
    expect(ev2ItemSnaps).toHaveLength(1)
    expect(ev2ItemSnaps[0].itemId).toBe('item-1')
    expect(ev2ItemSnaps[0].condition).toBe('shiny')
  })

  it('does not copy anything when there is no previous event', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    // First event in first chapter — no predecessor
    const ev1 = await makeEv(tl, ch, 0)

    const snaps = await db.characterSnapshots.where('eventId').equals(ev1.id).toArray()
    const placements = await db.itemPlacements.where('eventId').equals(ev1.id).toArray()
    expect(snaps).toHaveLength(0)
    expect(placements).toHaveLength(0)
  })

  it('inherits from the immediately preceding event, not a further one', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)
    const ev2 = await makeEv(tl, ch, 1)

    await upsertSnapshot({
      worldId: 'w', characterId: 'char-x', eventId: ev1.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'ev1 state', travelModeId: null,
    })
    await upsertSnapshot({
      worldId: 'w', characterId: 'char-x', eventId: ev2.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'ev2 state', travelModeId: null,
    })

    // ev3 should inherit from ev2, not ev1
    const ev3 = await makeEv(tl, ch, 2)

    const ev3Snaps = await db.characterSnapshots.where('eventId').equals(ev3.id).toArray()
    expect(ev3Snaps).toHaveLength(1)
    expect(ev3Snaps[0].statusNotes).toBe('ev2 state')
  })
})

describe('createEvent — inherits from last event of previous chapter', () => {
  it('falls back to previous chapter last event when first event in new chapter', async () => {
    const tl = await makeTl()
    const ch1 = await makeCh(tl, 1)
    const ch2 = await makeCh(tl, 2)

    const ev1 = await makeEv(tl, ch1, 0)

    await upsertSnapshot({
      worldId: 'w', characterId: 'char-1', eventId: ev1.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'from ch1', travelModeId: null,
    })

    // First event in ch2 — should inherit from ev1 (last event in ch1)
    const ev2 = await makeEv(tl, ch2, 0)

    const ev2Snaps = await db.characterSnapshots.where('eventId').equals(ev2.id).toArray()
    expect(ev2Snaps).toHaveLength(1)
    expect(ev2Snaps[0].statusNotes).toBe('from ch1')
  })
})

// ── deleteEvent — cascades ────────────────────────────────────────────────────

describe('deleteEvent — cascades to snapshots', () => {
  it('cascades to characterSnapshots', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev = await makeEv(tl, ch, 0)

    await upsertSnapshot({
      worldId: 'w', characterId: 'char-1', eventId: ev.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
    })

    await deleteEvent(ev.id)
    expect(await db.characterSnapshots.where('eventId').equals(ev.id).count()).toBe(0)
  })

  it('cascades to itemPlacements', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev = await makeEv(tl, ch, 0)
    await placeItemAtLocation('w', 'item-1', ev.id, 'loc-1')

    await deleteEvent(ev.id)
    expect(await db.itemPlacements.where('eventId').equals(ev.id).count()).toBe(0)
  })

  it('cascades to locationSnapshots', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev = await makeEv(tl, ch, 0)
    await upsertLocationSnapshot({
      worldId: 'w', locationMarkerId: 'loc-1', eventId: ev.id,
      status: 'active', notes: '',
    })

    await deleteEvent(ev.id)
    expect(await db.locationSnapshots.where('eventId').equals(ev.id).count()).toBe(0)
  })

  it('cascades to itemSnapshots', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev = await makeEv(tl, ch, 0)
    await upsertItemSnapshot({
      worldId: 'w', itemId: 'item-1', eventId: ev.id,
      condition: 'good', notes: '',
    })

    await deleteEvent(ev.id)
    expect(await db.itemSnapshots.where('eventId').equals(ev.id).count()).toBe(0)
  })
})

// ── deleteChapter — cascades through events to snapshots ─────────────────────

describe('deleteChapter — cascades to events and their snapshots', () => {
  it('cascades to itemPlacements via events', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev = await makeEv(tl, ch, 0)
    await placeItemAtLocation('w', 'item-1', ev.id, 'loc-1')

    await deleteChapter(ch.id)
    expect(await db.itemPlacements.where('eventId').equals(ev.id).count()).toBe(0)
    expect(await db.events.where('chapterId').equals(ch.id).count()).toBe(0)
  })

  it('cascades to locationSnapshots via events', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev = await makeEv(tl, ch, 0)
    await upsertLocationSnapshot({
      worldId: 'w', locationMarkerId: 'loc-1', eventId: ev.id,
      status: 'active', notes: '',
    })

    await deleteChapter(ch.id)
    expect(await db.locationSnapshots.where('eventId').equals(ev.id).count()).toBe(0)
  })

  it('cascades to itemSnapshots via events', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev = await makeEv(tl, ch, 0)
    await upsertItemSnapshot({
      worldId: 'w', itemId: 'item-1', eventId: ev.id,
      condition: 'good', notes: '',
    })

    await deleteChapter(ch.id)
    expect(await db.itemSnapshots.where('eventId').equals(ev.id).count()).toBe(0)
  })
})
