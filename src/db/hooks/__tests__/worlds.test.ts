import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, updateWorld, deleteWorld } from '@/db/hooks/useWorlds'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

// ── createWorld ───────────────────────────────────────────────────────────────

describe('createWorld', () => {
  it('persists the world and returns it with id and timestamps', async () => {
    const world = await createWorld({ name: 'Eldoria', description: 'A fantasy realm' })
    expect(world.id).toBeTruthy()
    expect(world.name).toBe('Eldoria')
    expect(world.description).toBe('A fantasy realm')
    expect(world.coverImageId).toBeNull()
    expect(world.createdAt).toBeGreaterThan(0)
    expect(world.updatedAt).toBe(world.createdAt)

    const stored = await db.worlds.get(world.id)
    expect(stored).toBeDefined()
    expect(stored!.name).toBe('Eldoria')
  })

  it('generates a unique id for each world', async () => {
    const a = await createWorld({ name: 'World A', description: '' })
    const b = await createWorld({ name: 'World B', description: '' })
    expect(a.id).not.toBe(b.id)
  })
})

// ── updateWorld ───────────────────────────────────────────────────────────────

describe('updateWorld', () => {
  it('updates the specified fields and bumps updatedAt', async () => {
    const world = await createWorld({ name: 'Original', description: '' })
    await new Promise((r) => setTimeout(r, 5))

    await updateWorld(world.id, { name: 'Renamed', description: 'Added desc' })

    const stored = await db.worlds.get(world.id)
    expect(stored!.name).toBe('Renamed')
    expect(stored!.description).toBe('Added desc')
    expect(stored!.updatedAt).toBeGreaterThan(world.updatedAt)
  })

  it('does not alter createdAt', async () => {
    const world = await createWorld({ name: 'World', description: '' })
    await updateWorld(world.id, { name: 'Updated' })
    const stored = await db.worlds.get(world.id)
    expect(stored!.createdAt).toBe(world.createdAt)
  })
})

// ── deleteWorld ───────────────────────────────────────────────────────────────

describe('deleteWorld', () => {
  it('removes the world record', async () => {
    const world = await createWorld({ name: 'Doomed', description: '' })
    await deleteWorld(world.id)
    expect(await db.worlds.get(world.id)).toBeUndefined()
  })

  it('cascades to mapLayers', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    await db.mapLayers.add({
      id: 'layer-1', worldId: world.id, parentMapId: null,
      name: 'Root', description: '', imageId: 'img-1', imageWidth: 100, imageHeight: 100,
      scalePixelsPerUnit: null, scaleUnit: null, createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteWorld(world.id)
    expect(await db.mapLayers.where('worldId').equals(world.id).count()).toBe(0)
  })

  it('cascades to characters', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    await db.characters.add({
      id: 'char-1', worldId: world.id, name: 'Hero',
      aliases: [], description: '', portraitImageId: null,
      tags: [], isAlive: true, createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteWorld(world.id)
    expect(await db.characters.where('worldId').equals(world.id).count()).toBe(0)
  })

  it('cascades to items', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    await db.items.add({ id: 'item-1', worldId: world.id, name: 'Sword', description: '', iconType: 'weapon', imageId: null, tags: [] })
    await deleteWorld(world.id)
    expect(await db.items.where('worldId').equals(world.id).count()).toBe(0)
  })

  it('cascades to character snapshots', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    await db.characterSnapshots.add({
      id: 'snap-1', worldId: world.id, characterId: 'char-1', chapterId: 'ch-1',
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteWorld(world.id)
    expect(await db.characterSnapshots.where('worldId').equals(world.id).count()).toBe(0)
  })

  it('cascades to relationships', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    await db.relationships.add({
      id: 'rel-1', worldId: world.id, characterAId: 'c1', characterBId: 'c2',
      label: 'Friends', strength: 'strong', sentiment: 'positive',
      description: '', isBidirectional: true, startChapterId: null, createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteWorld(world.id)
    expect(await db.relationships.where('worldId').equals(world.id).count()).toBe(0)
  })

  it('only deletes data belonging to the target world', async () => {
    const a = await createWorld({ name: 'A', description: '' })
    const b = await createWorld({ name: 'B', description: '' })
    await db.characters.add({
      id: 'char-b', worldId: b.id, name: 'Survivor',
      aliases: [], description: '', portraitImageId: null,
      tags: [], isAlive: true, createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteWorld(a.id)
    expect(await db.characters.where('worldId').equals(b.id).count()).toBe(1)
  })
})
