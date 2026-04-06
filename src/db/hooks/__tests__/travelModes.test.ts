import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createTravelMode, updateTravelMode, deleteTravelMode } from '@/db/hooks/useTravelModes'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

// ── createTravelMode ──────────────────────────────────────────────────────────

describe('createTravelMode', () => {
  it('persists a travel mode with correct fields', async () => {
    const mode = await createTravelMode({ worldId: 'world-1', name: 'Walking', speedPerDay: 30 })

    expect(mode.id).toBeTruthy()
    expect(mode.worldId).toBe('world-1')
    expect(mode.name).toBe('Walking')
    expect(mode.speedPerDay).toBe(30)
    expect(mode.createdAt).toBeGreaterThan(0)
    expect(mode.updatedAt).toBe(mode.createdAt)

    const stored = await db.travelModes.get(mode.id)
    expect(stored).toBeDefined()
    expect(stored!.name).toBe('Walking')
  })

  it('generates unique ids for different modes', async () => {
    const a = await createTravelMode({ worldId: 'w', name: 'Walking', speedPerDay: 30 })
    const b = await createTravelMode({ worldId: 'w', name: 'Riding', speedPerDay: 60 })
    expect(a.id).not.toBe(b.id)
  })

  it('stores modes for different worlds independently', async () => {
    await createTravelMode({ worldId: 'world-A', name: 'Walk', speedPerDay: 20 })
    await createTravelMode({ worldId: 'world-B', name: 'Walk', speedPerDay: 25 })

    const forA = await db.travelModes.where('worldId').equals('world-A').toArray()
    const forB = await db.travelModes.where('worldId').equals('world-B').toArray()
    expect(forA).toHaveLength(1)
    expect(forB).toHaveLength(1)
    expect(forA[0].speedPerDay).toBe(20)
    expect(forB[0].speedPerDay).toBe(25)
  })
})

// ── updateTravelMode ──────────────────────────────────────────────────────────

describe('updateTravelMode', () => {
  it('updates name and speedPerDay and bumps updatedAt', async () => {
    const mode = await createTravelMode({ worldId: 'w', name: 'Walk', speedPerDay: 20 })
    await new Promise((r) => setTimeout(r, 5))

    await updateTravelMode(mode.id, { name: 'Jog', speedPerDay: 40 })

    const stored = await db.travelModes.get(mode.id)
    expect(stored!.name).toBe('Jog')
    expect(stored!.speedPerDay).toBe(40)
    expect(stored!.updatedAt).toBeGreaterThan(mode.updatedAt)
  })

  it('can update only name without changing speedPerDay', async () => {
    const mode = await createTravelMode({ worldId: 'w', name: 'Walk', speedPerDay: 30 })
    await updateTravelMode(mode.id, { name: 'Stroll' })

    const stored = await db.travelModes.get(mode.id)
    expect(stored!.name).toBe('Stroll')
    expect(stored!.speedPerDay).toBe(30)
  })

  it('can update only speedPerDay without changing name', async () => {
    const mode = await createTravelMode({ worldId: 'w', name: 'Walk', speedPerDay: 30 })
    await updateTravelMode(mode.id, { speedPerDay: 50 })

    const stored = await db.travelModes.get(mode.id)
    expect(stored!.name).toBe('Walk')
    expect(stored!.speedPerDay).toBe(50)
  })

  it('does not alter createdAt', async () => {
    const mode = await createTravelMode({ worldId: 'w', name: 'Walk', speedPerDay: 30 })
    await updateTravelMode(mode.id, { name: 'Changed' })

    const stored = await db.travelModes.get(mode.id)
    expect(stored!.createdAt).toBe(mode.createdAt)
  })
})

// ── deleteTravelMode ──────────────────────────────────────────────────────────

describe('deleteTravelMode', () => {
  it('removes the travel mode from the database', async () => {
    const mode = await createTravelMode({ worldId: 'w', name: 'Walk', speedPerDay: 30 })
    await deleteTravelMode(mode.id)

    const stored = await db.travelModes.get(mode.id)
    expect(stored).toBeUndefined()
  })

  it('clears travelModeId from snapshots that referenced the deleted mode', async () => {
    const mode = await createTravelMode({ worldId: 'w', name: 'Walk', speedPerDay: 30 })

    await upsertSnapshot({
      worldId: 'w',
      characterId: 'char-1',
      eventId: 'ev-1',
      isAlive: true,
      currentLocationMarkerId: null,
      currentMapLayerId: null,
      inventoryItemIds: [],
      inventoryNotes: '',
      statusNotes: '',
      travelModeId: mode.id,
    })

    const before = await db.characterSnapshots
      .where('[characterId+eventId]').equals(['char-1', 'ev-1']).first()
    expect(before!.travelModeId).toBe(mode.id)

    await deleteTravelMode(mode.id)

    const after = await db.characterSnapshots
      .where('[characterId+eventId]').equals(['char-1', 'ev-1']).first()
    expect(after!.travelModeId).toBeNull()
  })

  it('only clears travelModeId for the deleted mode, not others', async () => {
    const modeA = await createTravelMode({ worldId: 'w', name: 'Walk', speedPerDay: 20 })
    const modeB = await createTravelMode({ worldId: 'w', name: 'Ride', speedPerDay: 60 })

    await upsertSnapshot({
      worldId: 'w',
      characterId: 'char-1',
      eventId: 'ev-1',
      isAlive: true,
      currentLocationMarkerId: null,
      currentMapLayerId: null,
      inventoryItemIds: [],
      inventoryNotes: '',
      statusNotes: '',
      travelModeId: modeA.id,
    })
    await upsertSnapshot({
      worldId: 'w',
      characterId: 'char-2',
      eventId: 'ev-1',
      isAlive: true,
      currentLocationMarkerId: null,
      currentMapLayerId: null,
      inventoryItemIds: [],
      inventoryNotes: '',
      statusNotes: '',
      travelModeId: modeB.id,
    })

    await deleteTravelMode(modeA.id)

    const snap1 = await db.characterSnapshots.where('[characterId+eventId]').equals(['char-1', 'ev-1']).first()
    const snap2 = await db.characterSnapshots.where('[characterId+eventId]').equals(['char-2', 'ev-1']).first()

    expect(snap1!.travelModeId).toBeNull()
    expect(snap2!.travelModeId).toBe(modeB.id)
  })

  it('clears references across multiple snapshots for the same mode', async () => {
    const mode = await createTravelMode({ worldId: 'w', name: 'Walk', speedPerDay: 30 })

    for (let i = 1; i <= 3; i++) {
      await upsertSnapshot({
        worldId: 'w',
        characterId: `char-${i}`,
        eventId: 'ev-1',
        isAlive: true,
        currentLocationMarkerId: null,
        currentMapLayerId: null,
        inventoryItemIds: [],
        inventoryNotes: '',
        statusNotes: '',
        travelModeId: mode.id,
      })
    }

    await deleteTravelMode(mode.id)

    for (let i = 1; i <= 3; i++) {
      const snap = await db.characterSnapshots.where('[characterId+eventId]').equals([`char-${i}`, 'ev-1']).first()
      expect(snap!.travelModeId).toBeNull()
    }
  })

  it('is a no-op for a non-existent id', async () => {
    await expect(deleteTravelMode('does-not-exist')).resolves.toBeUndefined()
  })
})
