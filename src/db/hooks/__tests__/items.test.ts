import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createItem, updateItem, deleteItem } from '@/db/hooks/useItems'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

// ── createItem ────────────────────────────────────────────────────────────────

describe('createItem', () => {
  it('persists the item with correct defaults', async () => {
    const item = await createItem({
      worldId: 'world-1', name: 'Excalibur',
      description: 'A legendary sword', iconType: 'weapon', tags: [],
    })
    expect(item.id).toBeTruthy()
    expect(item.name).toBe('Excalibur')
    expect(item.description).toBe('A legendary sword')
    expect(item.iconType).toBe('weapon')
    expect(item.imageId).toBeNull()
    expect(item.worldId).toBe('world-1')

    const stored = await db.items.get(item.id)
    expect(stored).toBeDefined()
    expect(stored!.name).toBe('Excalibur')
  })

  it('generates unique ids per item', async () => {
    const a = await createItem({ worldId: 'w', name: 'A', description: '', iconType: '', tags: [] })
    const b = await createItem({ worldId: 'w', name: 'B', description: '', iconType: '', tags: [] })
    expect(a.id).not.toBe(b.id)
  })

  it('stores tags correctly', async () => {
    const item = await createItem({ worldId: 'w', name: 'Ring', description: '', iconType: 'artifact', tags: ['cursed', 'magic'] })
    const stored = await db.items.get(item.id)
    expect(stored!.tags).toEqual(['cursed', 'magic'])
  })
})

// ── updateItem ────────────────────────────────────────────────────────────────

describe('updateItem', () => {
  it('updates the specified fields', async () => {
    const item = await createItem({ worldId: 'w', name: 'Old Name', description: '', iconType: '', tags: [] })
    await updateItem(item.id, { name: 'New Name', description: 'Updated', iconType: 'key item' })

    const stored = await db.items.get(item.id)
    expect(stored!.name).toBe('New Name')
    expect(stored!.description).toBe('Updated')
    expect(stored!.iconType).toBe('key item')
  })

  it('can update imageId', async () => {
    const item = await createItem({ worldId: 'w', name: 'Shield', description: '', iconType: '', tags: [] })
    await updateItem(item.id, { imageId: 'blob-123' })
    const stored = await db.items.get(item.id)
    expect(stored!.imageId).toBe('blob-123')
  })
})

// ── deleteItem ────────────────────────────────────────────────────────────────

describe('deleteItem', () => {
  it('removes the item from the database', async () => {
    const item = await createItem({ worldId: 'w', name: 'Trash', description: '', iconType: '', tags: [] })
    await deleteItem(item.id)
    expect(await db.items.get(item.id)).toBeUndefined()
  })

  it('is a no-op for a non-existent id', async () => {
    await expect(deleteItem('ghost-id')).resolves.toBeUndefined()
  })

  it('only removes the targeted item', async () => {
    const a = await createItem({ worldId: 'w', name: 'A', description: '', iconType: '', tags: [] })
    const b = await createItem({ worldId: 'w', name: 'B', description: '', iconType: '', tags: [] })
    await deleteItem(a.id)
    expect(await db.items.get(b.id)).toBeDefined()
  })

  /*
    The confirmation promises the item and all its snapshots are gone. Two
    tables kept its id and rendered the leftover through `item?.name ?? itemId`:
    a character's inventory printed a raw nanoid, and a scene's item list fed
    the same fallback into the continuity checker's findings.
  */
  it('takes the item out of every inventory holding it, and leaves the rest', async () => {
    const doomed = await createItem({ worldId: 'w', name: "Reeve's seal", description: '', iconType: '', tags: [] })
    const keeper = await createItem({ worldId: 'w', name: 'The ninth bell', description: '', iconType: '', tags: [] })
    const snap = {
      worldId: 'w', isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryNotes: '', statusNotes: '', travelModeId: null, sortKey: 1,
      createdAt: 0, updatedAt: 0,
    }
    await db.characterSnapshots.add({ ...snap, id: 's1', characterId: 'ossian', eventId: 'ev1', inventoryItemIds: [doomed.id, keeper.id] })
    await db.characterSnapshots.add({ ...snap, id: 's2', characterId: 'cathe', eventId: 'ev2', inventoryItemIds: [keeper.id] })

    await deleteItem(doomed.id)

    expect((await db.characterSnapshots.get('s1'))!.inventoryItemIds).toEqual([keeper.id])
    expect((await db.characterSnapshots.get('s2'))!.inventoryItemIds).toEqual([keeper.id])
  })

  it("takes the item out of every scene's cast of objects", async () => {
    const doomed = await createItem({ worldId: 'w', name: 'The tally-slate', description: '', iconType: '', tags: [] })
    const keeper = await createItem({ worldId: 'w', name: 'The letter', description: '', iconType: '', tags: [] })
    const base = {
      worldId: 'w', chapterId: 'ch1', timelineId: 'tl', title: '', description: '', sortOrder: 0,
      tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null,
      status: 'draft' as const, povCharacterId: null, tension: null, isFlashback: false,
      createdAt: 0, updatedAt: 0,
    }
    await db.events.add({ ...base, id: 'ev1', involvedItemIds: [doomed.id, keeper.id] })
    await db.events.add({ ...base, id: 'ev2', involvedItemIds: [keeper.id] })

    await deleteItem(doomed.id)

    expect((await db.events.get('ev1'))!.involvedItemIds).toEqual([keeper.id])
    expect((await db.events.get('ev2'))!.involvedItemIds).toEqual([keeper.id])
  })
})
