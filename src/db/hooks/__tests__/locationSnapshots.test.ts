import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { upsertLocationSnapshot } from '@/db/hooks/useLocationSnapshots'
import type { LocationSnapshot } from '@/types'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

function makeLocSnapData(overrides: Partial<Omit<LocationSnapshot, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<LocationSnapshot, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    worldId: 'world-1',
    locationMarkerId: 'loc-1',
    eventId: 'ev-1',
    status: 'active',
    notes: '',
    ...overrides,
  }
}

// ── upsertLocationSnapshot ────────────────────────────────────────────────────

describe('upsertLocationSnapshot', () => {
  it('creates a new snapshot with id and timestamps', async () => {
    const snap = await upsertLocationSnapshot(makeLocSnapData())
    expect(snap.id).toBeTruthy()
    expect(snap.createdAt).toBeGreaterThan(0)
    expect(snap.updatedAt).toBeGreaterThan(0)
    expect(snap.status).toBe('active')

    const stored = await db.locationSnapshots.get(snap.id)
    expect(stored).toBeDefined()
    expect(stored!.locationMarkerId).toBe('loc-1')
  })

  it('updates an existing snapshot without changing createdAt', async () => {
    const first = await upsertLocationSnapshot(makeLocSnapData({ status: 'active' }))

    await new Promise((r) => setTimeout(r, 5))

    const second = await upsertLocationSnapshot(makeLocSnapData({ status: 'destroyed' }))

    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt)
    expect(second.status).toBe('destroyed')
  })

  it('stores distinct snapshots for different chapters', async () => {
    await upsertLocationSnapshot(makeLocSnapData({ eventId: 'ev-1' }))
    await upsertLocationSnapshot(makeLocSnapData({ eventId: 'ev-2' }))

    const all = await db.locationSnapshots.toArray()
    expect(all).toHaveLength(2)
  })

  it('stores distinct snapshots for different location markers', async () => {
    await upsertLocationSnapshot(makeLocSnapData({ locationMarkerId: 'loc-1' }))
    await upsertLocationSnapshot(makeLocSnapData({ locationMarkerId: 'loc-2' }))

    const all = await db.locationSnapshots.toArray()
    expect(all).toHaveLength(2)
  })

  it('persists all provided fields', async () => {
    const snap = await upsertLocationSnapshot(makeLocSnapData({
      status: 'ruined',
      notes: 'Burned down in the war',
    }))

    const stored = await db.locationSnapshots.get(snap.id)
    expect(stored!.status).toBe('ruined')
    expect(stored!.notes).toBe('Burned down in the war')
    expect(stored!.worldId).toBe('world-1')
    expect(stored!.eventId).toBe('ev-1')
  })

  it('only updates the targeted marker+chapter combination', async () => {
    const snapA = await upsertLocationSnapshot(makeLocSnapData({ locationMarkerId: 'loc-1', status: 'active' }))
    await upsertLocationSnapshot(makeLocSnapData({ locationMarkerId: 'loc-2', status: 'active' }))

    // Update loc-1 only
    await upsertLocationSnapshot(makeLocSnapData({ locationMarkerId: 'loc-1', status: 'destroyed' }))

    const loc1Snap = await db.locationSnapshots.get(snapA.id)
    const all = await db.locationSnapshots.toArray()
    const loc2Snap = all.find((s) => s.locationMarkerId === 'loc-2')

    expect(loc1Snap!.status).toBe('destroyed')
    expect(loc2Snap!.status).toBe('active')
    expect(all).toHaveLength(2)
  })
})
