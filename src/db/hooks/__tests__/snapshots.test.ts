import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { upsertSnapshot, deleteSnapshot, fetchSnapshot } from '@/db/hooks/useSnapshots'
import type { CharacterSnapshot } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSnap(overrides: Partial<CharacterSnapshot> = {}): Omit<CharacterSnapshot, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    worldId: 'world-1',
    characterId: 'char-1',
    eventId: 'ev-1',
    isAlive: true,
    currentLocationMarkerId: null,
    currentMapLayerId: null,
    inventoryItemIds: [],
    inventoryNotes: '',
    statusNotes: '',
    travelModeId: null,
    ...overrides,
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

// ── upsertSnapshot ────────────────────────────────────────────────────────────

describe('upsertSnapshot', () => {
  it('creates a new snapshot with id and timestamps', async () => {
    const snap = await upsertSnapshot(makeSnap())
    expect(snap.id).toBeTruthy()
    expect(snap.createdAt).toBeGreaterThan(0)
    expect(snap.updatedAt).toBeGreaterThan(0)

    const stored = await db.characterSnapshots.get(snap.id)
    expect(stored).toBeDefined()
    expect(stored!.characterId).toBe('char-1')
  })

  it('updates an existing snapshot without changing createdAt', async () => {
    const first = await upsertSnapshot(makeSnap({ statusNotes: 'initial' }))

    await new Promise((r) => setTimeout(r, 5))

    const second = await upsertSnapshot(makeSnap({ statusNotes: 'updated' }))

    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt)
    expect(second.statusNotes).toBe('updated')
  })

  it('stores distinct snapshots for different chapters', async () => {
    await upsertSnapshot(makeSnap({ eventId: 'ev-1' }))
    await upsertSnapshot(makeSnap({ eventId: 'ev-2' }))

    const all = await db.characterSnapshots.toArray()
    expect(all).toHaveLength(2)
  })

  it('stores distinct snapshots for different characters', async () => {
    await upsertSnapshot(makeSnap({ characterId: 'char-1' }))
    await upsertSnapshot(makeSnap({ characterId: 'char-2' }))

    const all = await db.characterSnapshots.toArray()
    expect(all).toHaveLength(2)
  })

  it('persists all provided fields', async () => {
    const snap = await upsertSnapshot(makeSnap({
      isAlive: false,
      currentLocationMarkerId: 'loc-99',
      inventoryItemIds: ['item-1', 'item-2'],
      statusNotes: 'badly wounded',
    }))

    const stored = await db.characterSnapshots.get(snap.id)
    expect(stored!.isAlive).toBe(false)
    expect(stored!.currentLocationMarkerId).toBe('loc-99')
    expect(stored!.inventoryItemIds).toEqual(['item-1', 'item-2'])
    expect(stored!.statusNotes).toBe('badly wounded')
  })
})

// ── deleteSnapshot ────────────────────────────────────────────────────────────

describe('deleteSnapshot', () => {
  it('removes the snapshot from the database', async () => {
    const snap = await upsertSnapshot(makeSnap())
    await deleteSnapshot(snap.id)

    const stored = await db.characterSnapshots.get(snap.id)
    expect(stored).toBeUndefined()
  })

  it('is a no-op for a non-existent id', async () => {
    await expect(deleteSnapshot('does-not-exist')).resolves.toBeUndefined()
  })

  it('only removes the targeted snapshot', async () => {
    const a = await upsertSnapshot(makeSnap({ eventId: 'ev-1' }))
    await upsertSnapshot(makeSnap({ eventId: 'ev-2' }))

    await deleteSnapshot(a.id)

    const remaining = await db.characterSnapshots.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].eventId).toBe('ev-2')
  })
})

// ── fetchSnapshot ─────────────────────────────────────────────────────────────

describe('fetchSnapshot', () => {
  it('returns the snapshot when it exists', async () => {
    const created = await upsertSnapshot(makeSnap())
    const fetched = await fetchSnapshot('char-1', 'ev-1')
    expect(fetched).toBeDefined()
    expect(fetched!.id).toBe(created.id)
  })

  it('returns undefined when no snapshot matches', async () => {
    await upsertSnapshot(makeSnap())
    const result = await fetchSnapshot('char-1', 'ch-nonexistent')
    expect(result).toBeUndefined()
  })

  it('returns undefined when the characterId does not match', async () => {
    await upsertSnapshot(makeSnap())
    const result = await fetchSnapshot('char-unknown', 'ev-1')
    expect(result).toBeUndefined()
  })

  it('returns the correct snapshot when multiple characters exist in the same chapter', async () => {
    await upsertSnapshot(makeSnap({ characterId: 'char-1', statusNotes: 'first' }))
    await upsertSnapshot(makeSnap({ characterId: 'char-2', statusNotes: 'second' }))

    const result = await fetchSnapshot('char-2', 'ev-1')
    expect(result).toBeDefined()
    expect(result!.characterId).toBe('char-2')
    expect(result!.statusNotes).toBe('second')
  })

  it('returns the correct snapshot when a character has entries across multiple chapters', async () => {
    await upsertSnapshot(makeSnap({ eventId: 'ev-1', statusNotes: 'chapter one' }))
    await upsertSnapshot(makeSnap({ eventId: 'ev-2', statusNotes: 'chapter two' }))

    const result = await fetchSnapshot('char-1', 'ev-2')
    expect(result!.statusNotes).toBe('chapter two')
  })

  it('reflects the latest data after an upsert', async () => {
    await upsertSnapshot(makeSnap({ statusNotes: 'before' }))
    await upsertSnapshot(makeSnap({ statusNotes: 'after' }))

    const result = await fetchSnapshot('char-1', 'ev-1')
    expect(result!.statusNotes).toBe('after')
  })
})

// ── chapter isolation (useBestSnapshots logic) ────────────────────────────────

describe('chapter snapshot isolation', () => {
  it('only snapshots for the active chapter are returned when filtering by eventId', async () => {
    await upsertSnapshot(makeSnap({ eventId: 'ev-1', statusNotes: 'ch1 state' }))
    await upsertSnapshot(makeSnap({ eventId: 'ev-2', statusNotes: 'ch2 state' }))

    const all = await db.characterSnapshots.where('worldId').equals('world-1').toArray()
    const forChapter1 = all.filter((s) => s.eventId === 'ev-1')

    expect(forChapter1).toHaveLength(1)
    expect(forChapter1[0].statusNotes).toBe('ch1 state')
  })

  it('most-recent snapshot is selected per character when no chapter filter', async () => {
    await upsertSnapshot(makeSnap({ eventId: 'ev-1' }))
    await new Promise((r) => setTimeout(r, 5))
    await upsertSnapshot(makeSnap({ eventId: 'ev-2', statusNotes: 'latest' }))

    const all = await db.characterSnapshots.where('worldId').equals('world-1').toArray()

    const byChar = new Map<string, CharacterSnapshot>()
    for (const snap of all) {
      const current = byChar.get(snap.characterId)
      if (!current || snap.updatedAt > current.updatedAt) byChar.set(snap.characterId, snap)
    }

    const best = Array.from(byChar.values())
    expect(best).toHaveLength(1)
    expect(best[0].statusNotes).toBe('latest')
  })
})
