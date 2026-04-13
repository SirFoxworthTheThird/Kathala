import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'
import type { ItemSnapshot } from '@/types'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

function makeItemSnapData(overrides: Partial<Omit<ItemSnapshot, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<ItemSnapshot, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    worldId: 'world-1',
    itemId: 'item-1',
    eventId: 'ev-1',
    condition: 'pristine',
    notes: '',
    ...overrides,
  }
}

// ── upsertItemSnapshot ────────────────────────────────────────────────────────

describe('upsertItemSnapshot', () => {
  it('creates a new snapshot with id and timestamps', async () => {
    const snap = await upsertItemSnapshot(makeItemSnapData())
    expect(snap.id).toBeTruthy()
    expect(snap.createdAt).toBeGreaterThan(0)
    expect(snap.updatedAt).toBeGreaterThan(0)
    expect(snap.condition).toBe('pristine')

    const stored = await db.itemSnapshots.get(snap.id)
    expect(stored).toBeDefined()
    expect(stored!.itemId).toBe('item-1')
  })

  it('updates an existing snapshot without changing createdAt', async () => {
    const first = await upsertItemSnapshot(makeItemSnapData({ condition: 'good' }))

    await new Promise((r) => setTimeout(r, 5))

    const second = await upsertItemSnapshot(makeItemSnapData({ condition: 'damaged' }))

    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt)
    expect(second.condition).toBe('damaged')
  })

  it('stores distinct snapshots for different chapters', async () => {
    await upsertItemSnapshot(makeItemSnapData({ eventId: 'ev-1' }))
    await upsertItemSnapshot(makeItemSnapData({ eventId: 'ev-2' }))

    const all = await db.itemSnapshots.toArray()
    expect(all).toHaveLength(2)
  })

  it('stores distinct snapshots for different items', async () => {
    await upsertItemSnapshot(makeItemSnapData({ itemId: 'item-1' }))
    await upsertItemSnapshot(makeItemSnapData({ itemId: 'item-2' }))

    const all = await db.itemSnapshots.toArray()
    expect(all).toHaveLength(2)
  })

  it('persists all provided fields', async () => {
    const snap = await upsertItemSnapshot(makeItemSnapData({
      condition: 'broken',
      notes: 'cracked in battle',
    }))

    const stored = await db.itemSnapshots.get(snap.id)
    expect(stored!.condition).toBe('broken')
    expect(stored!.notes).toBe('cracked in battle')
    expect(stored!.worldId).toBe('world-1')
    expect(stored!.eventId).toBe('ev-1')
  })

  it('only updates the targeted item+chapter combination', async () => {
    const snapA = await upsertItemSnapshot(makeItemSnapData({ itemId: 'item-1', eventId: 'ev-1', condition: 'good' }))
    await upsertItemSnapshot(makeItemSnapData({ itemId: 'item-2', eventId: 'ev-1', condition: 'poor' }))

    // Update item-1 only
    await upsertItemSnapshot(makeItemSnapData({ itemId: 'item-1', eventId: 'ev-1', condition: 'ruined' }))

    const item1Snap = await db.itemSnapshots.get(snapA.id)
    const allSnaps = await db.itemSnapshots.toArray()
    const item2Snap = allSnaps.find((s) => s.itemId === 'item-2')

    expect(item1Snap!.condition).toBe('ruined')
    expect(item2Snap!.condition).toBe('poor')
    expect(allSnaps).toHaveLength(2)
  })
})
