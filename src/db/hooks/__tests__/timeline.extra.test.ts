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

// ── createEvent — delta model (no snapshot inheritance) ──────────────────────
// In the delta/last-known model, createEvent does NOT copy snapshots forward.
// State at any event is resolved by reading back to the most recent prior snapshot.

describe('createEvent — delta model: no snapshot copies on event creation', () => {
  it('does not copy characterSnapshots to the new event', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)

    await upsertSnapshot({
      worldId: 'w', characterId: 'char-1', eventId: ev1.id,
      isAlive: true, currentLocationMarkerId: 'loc-1', currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'healthy', travelModeId: null,
    })

    const ev2 = await makeEv(tl, ch, 1)

    // Delta model: no copies — ev2 has no snapshots of its own
    const ev2Snaps = await db.characterSnapshots.where('eventId').equals(ev2.id).toArray()
    expect(ev2Snaps).toHaveLength(0)
    // But ev1 still has exactly one snapshot (not removed)
    const ev1Snaps = await db.characterSnapshots.where('eventId').equals(ev1.id).toArray()
    expect(ev1Snaps).toHaveLength(1)
    expect(ev1Snaps[0].statusNotes).toBe('healthy')
  })

  it('does not copy itemPlacements to the new event', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)

    await placeItemAtLocation('w', 'item-1', ev1.id, 'loc-A')

    const ev2 = await makeEv(tl, ch, 1)

    const ev2Placements = await db.itemPlacements.where('eventId').equals(ev2.id).toArray()
    expect(ev2Placements).toHaveLength(0)
  })

  it('does not copy locationSnapshots to the new event', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)

    await upsertLocationSnapshot({
      worldId: 'w', locationMarkerId: 'loc-1', eventId: ev1.id,
      status: 'thriving', notes: 'All is well',
    })

    const ev2 = await makeEv(tl, ch, 1)

    const ev2LocSnaps = await db.locationSnapshots.where('eventId').equals(ev2.id).toArray()
    expect(ev2LocSnaps).toHaveLength(0)
  })

  it('does not copy itemSnapshots to the new event', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)

    await upsertItemSnapshot({
      worldId: 'w', itemId: 'item-1', eventId: ev1.id,
      condition: 'shiny', notes: 'Freshly polished',
    })

    const ev2 = await makeEv(tl, ch, 1)

    const ev2ItemSnaps = await db.itemSnapshots.where('eventId').equals(ev2.id).toArray()
    expect(ev2ItemSnaps).toHaveLength(0)
  })

  it('does not create any snapshots when there is no previous event', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)

    const snaps = await db.characterSnapshots.where('eventId').equals(ev1.id).toArray()
    const placements = await db.itemPlacements.where('eventId').equals(ev1.id).toArray()
    expect(snaps).toHaveLength(0)
    expect(placements).toHaveLength(0)
  })

  it('upsertSnapshot deduplicates: skips write when state equals prior snapshot', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)
    const ev2 = await makeEv(tl, ch, 1)

    await upsertSnapshot({
      worldId: 'w', characterId: 'char-x', eventId: ev1.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'ev1 state', travelModeId: null,
    })

    // Writing identical state to ev2 should be a no-op (dedup)
    await upsertSnapshot({
      worldId: 'w', characterId: 'char-x', eventId: ev2.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'ev1 state', travelModeId: null,
    })

    const ev2Snaps = await db.characterSnapshots.where('eventId').equals(ev2.id).toArray()
    expect(ev2Snaps).toHaveLength(0) // deduped — no new record needed
  })
})

describe('createEvent — delta model: state is resolved by last-known lookup', () => {
  it('single snapshot is visible as last-known across subsequent events in same chapter', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)
    await makeEv(tl, ch, 1) // ev2 created; no snapshots on it
    await makeEv(tl, ch, 2) // ev3 created; no snapshots on it

    await upsertSnapshot({
      worldId: 'w', characterId: 'char-1', eventId: ev1.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'from ev1', travelModeId: null,
    })

    // Total snapshots: just the one on ev1
    const allSnaps = await db.characterSnapshots.where('characterId').equals('char-1').toArray()
    expect(allSnaps).toHaveLength(1)
    expect(allSnaps[0].eventId).toBe(ev1.id)
  })

  it('snapshot at later event overrides earlier one for its event', async () => {
    const tl = await makeTl()
    const ch = await makeCh(tl, 1)
    const ev1 = await makeEv(tl, ch, 0)
    const ev2 = await makeEv(tl, ch, 1)

    await upsertSnapshot({
      worldId: 'w', characterId: 'char-x', eventId: ev1.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'ev1 state', travelModeId: null,
    })
    // ev2 has a different state — should write a new delta record
    await upsertSnapshot({
      worldId: 'w', characterId: 'char-x', eventId: ev2.id,
      isAlive: false, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'ev2 state', travelModeId: null,
    })

    const ev2Snap = await db.characterSnapshots.where('[characterId+eventId]').equals(['char-x', ev2.id]).first()
    expect(ev2Snap).toBeTruthy()
    expect(ev2Snap!.statusNotes).toBe('ev2 state')
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
