import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, updateWorld, deleteWorld, listWorlds } from '@/db/hooks/useWorlds'
import { createCharacter } from '@/db/hooks/useCharacters'

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
      scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: "", createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteWorld(world.id)
    expect(await db.mapLayers.where('worldId').equals(world.id).count()).toBe(0)
  })

  it('cascades to characters', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    await db.characters.add({
      id: 'char-1', worldId: world.id, name: 'Hero',
      aliases: [], description: '', portraitImageId: null, color: null,
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
      id: 'snap-1', worldId: world.id, characterId: 'char-1', eventId: 'ch-1',
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
      description: '', isBidirectional: true, startEventId: null, createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteWorld(world.id)
    expect(await db.relationships.where('worldId').equals(world.id).count()).toBe(0)
  })

  it('only deletes data belonging to the target world', async () => {
    const a = await createWorld({ name: 'A', description: '' })
    const b = await createWorld({ name: 'B', description: '' })
    await db.characters.add({
      id: 'char-b', worldId: b.id, name: 'Survivor',
      aliases: [], description: '', portraitImageId: null, color: null,
      tags: [], isAlive: true, createdAt: Date.now(), updatedAt: Date.now(),
    })
    await deleteWorld(a.id)
    expect(await db.characters.where('worldId').equals(b.id).count()).toBe(1)
  })
})

// ── listWorlds ────────────────────────────────────────────────────────────────

/*
  W19-5: the selector listed worlds oldest first, so a morning's work sat below
  a book downloaded from the library once. A downloaded world keeps the
  `createdAt` written into its `.pwk` — every shipped book is dated in the past
  — so an ascending sort put every one of them above anything you made today.
*/
describe('listWorlds', () => {
  it('puts the newest world first', async () => {
    // Written straight to Dexie so the dates are the point rather than the
    // order the rows happened to be inserted in.
    const at = (id: string, createdAt: number) => db.worlds.put({
      id, name: id, description: '', coverImageId: null, theme: null,
      continuityStaleThreshold: 3, createdAt, updatedAt: createdAt,
    })
    await at('older', Date.parse('2024-04-15'))
    await at('newest', Date.parse('2026-08-19'))
    await at('middle', Date.parse('2026-08-16'))

    expect((await listWorlds()).map((w) => w.id)).toEqual(['newest', 'middle', 'older'])
  })

  it('puts a world made today above a library book dated years ago', async () => {
    // The reported case, with the two real dates: The Name of the Wind carries
    // 15 Apr 2024 in its .pwk, and it was listed above the world made today.
    await db.worlds.put({
      id: 'name-of-the-wind', name: 'The Name of the Wind', description: '',
      coverImageId: null, theme: null, continuityStaleThreshold: 3,
      createdAt: Date.parse('2024-04-15'), updatedAt: Date.parse('2024-04-15'),
    })
    const mine = await createWorld({ name: 'The Salt Gate', description: '' })

    expect((await listWorlds())[0].id).toBe(mine.id)
  })

  /*
    The order is now "last worked on", read from the operation journal — the key
    the W19-5 note called better and said did not exist. These three are the
    cases that make it more than a rename of the old one.
  */
  it('lifts a world that has been worked in above a newer one that has not', async () => {
    const at = (id: string, createdAt: number) => db.worlds.put({
      id, name: id, description: '', coverImageId: null, theme: null,
      continuityStaleThreshold: 3, createdAt, updatedAt: createdAt,
    })
    await at('old-but-active', Date.parse('2024-04-15'))
    await at('new-and-idle', Date.parse('2026-08-19'))

    // By creation date alone the idle one leads — asserted first, so the change
    // below cannot pass on an ordering that was already what it wanted.
    expect((await listWorlds()).map((w) => w.id)).toEqual(['new-and-idle', 'old-but-active'])

    // One journalled edit in the older world.
    await createCharacter({ worldId: 'old-but-active', name: 'Ossian Marl', description: '' })

    expect((await listWorlds()).map((w) => w.id)).toEqual(['old-but-active', 'new-and-idle'])
  })

  it('leaves a library book where its own date puts it, since its journal is reset', async () => {
    /*
      The W19-5 case has to survive the new key. `applyWorldImport` calls
      `markJournalDiscontinuity`, so a downloaded book has no operations at all
      — it falls back to the date in its `.pwk` and stays below your own work,
      which is the whole point of the original fix.
    */
    await db.worlds.put({
      id: 'name-of-the-wind', name: 'The Name of the Wind', description: '',
      coverImageId: null, theme: null, continuityStaleThreshold: 3,
      createdAt: Date.parse('2024-04-15'), updatedAt: Date.parse('2024-04-15'),
    })
    const mine = await createWorld({ name: 'The Salt Gate', description: '' })
    await createCharacter({ worldId: mine.id, name: 'Cathe Vaux', description: '' })

    expect((await listWorlds())[0].id).toBe(mine.id)
    expect(await db.operations.where('worldId').equals('name-of-the-wind').count()).toBe(0)
  })

  it('orders ties by creation, so the list does not shuffle between renders', async () => {
    const same = Date.parse('2026-08-19')
    const at = (id: string, createdAt: number) => db.worlds.put({
      id, name: id, description: '', coverImageId: null, theme: null,
      continuityStaleThreshold: 3, createdAt, updatedAt: same,
    })
    await at('b', Date.parse('2026-08-16'))
    await at('a', Date.parse('2026-08-17'))

    const once = (await listWorlds()).map((w) => w.id)
    const twice = (await listWorlds()).map((w) => w.id)
    expect(once).toEqual(['a', 'b'])
    expect(twice).toEqual(once)
  })

  it('returns an empty list rather than throwing when there are no worlds', async () => {
    expect(await listWorlds()).toEqual([])
  })
})
