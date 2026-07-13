import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { parseCharactersSpec, addCharactersToWorld, parseItemsSpec, addItemsToWorld } from '@/lib/sectionImport'

describe('parseCharactersSpec', () => {
  it('accepts a bare array of characters', () => {
    const { characters, error } = parseCharactersSpec('[{"name":"Aria"},{"name":"Bran"}]')
    expect(error).toBeUndefined()
    expect(characters?.map((c) => c.name)).toEqual(['Aria', 'Bran'])
  })

  it('accepts an object with a "characters" array and keeps optional fields', () => {
    const json = JSON.stringify({
      format: 'plotweave-characters',
      characters: [{ name: 'Aria', aliases: ['The Fox'], description: 'A thief', tags: ['protagonist'], alive: false }],
    })
    const { characters } = parseCharactersSpec(json)
    expect(characters).toHaveLength(1)
    expect(characters![0]).toMatchObject({ name: 'Aria', aliases: ['The Fox'], description: 'A thief', tags: ['protagonist'], alive: false })
  })

  it('drops entries without a usable name', () => {
    const { characters } = parseCharactersSpec('[{"name":"Aria"},{"name":"   "},{"description":"no name"}]')
    expect(characters?.map((c) => c.name)).toEqual(['Aria'])
  })

  it('errors on invalid JSON', () => {
    expect(parseCharactersSpec('not json').error).toMatch(/valid JSON/)
  })

  it('errors when nothing usable is present', () => {
    expect(parseCharactersSpec('[]').error).toMatch(/No characters/)
    expect(parseCharactersSpec('{"foo":1}').error).toMatch(/Expected a JSON array/)
  })
})

describe('addCharactersToWorld', () => {
  const worldId = 'w1'

  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.worlds.put({ id: worldId, name: 'W', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 })
  })

  it('adds new characters with their fields set', async () => {
    const res = await addCharactersToWorld(worldId, [
      { name: 'Aria', aliases: ['The Fox'], description: 'A thief', tags: ['protagonist'], alive: false, color: '#f00' },
    ])
    expect(res).toMatchObject({ added: 1, skipped: 0, addedNames: ['Aria'] })
    const chars = await db.characters.where('worldId').equals(worldId).toArray()
    expect(chars).toHaveLength(1)
    expect(chars[0]).toMatchObject({ name: 'Aria', aliases: ['The Fox'], description: 'A thief', tags: ['protagonist'], isAlive: false, color: '#f00' })
  })

  it('defaults alive to true and fills empty optional fields', async () => {
    await addCharactersToWorld(worldId, [{ name: 'Bran' }])
    const [bran] = await db.characters.where('worldId').equals(worldId).toArray()
    expect(bran).toMatchObject({ name: 'Bran', aliases: [], description: '', tags: [], isAlive: true, color: null })
  })

  it('skips names already present (case-insensitive) and repeats within the batch', async () => {
    await db.characters.put({ id: 'c-existing', worldId, name: 'Aria', aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })
    const res = await addCharactersToWorld(worldId, [
      { name: 'aria' },     // dupes the existing one
      { name: 'Bran' },
      { name: 'Bran' },     // dupes within the batch
    ])
    expect(res).toMatchObject({ added: 1, skipped: 2, addedNames: ['Bran'] })
    const names = (await db.characters.where('worldId').equals(worldId).toArray()).map((c) => c.name).sort()
    expect(names).toEqual(['Aria', 'Bran'])
  })

  it('does not touch characters in other worlds', async () => {
    await db.characters.put({ id: 'other', worldId: 'w2', name: 'Aria', aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })
    const res = await addCharactersToWorld(worldId, [{ name: 'Aria' }])
    expect(res.added).toBe(1) // same name, different world — still added here
  })
})

describe('parseItemsSpec', () => {
  it('accepts a bare array and an object form, keeping icon + tags', () => {
    expect(parseItemsSpec('[{"name":"Sword"}]').items?.map((i) => i.name)).toEqual(['Sword'])
    const { items } = parseItemsSpec('{"items":[{"name":"Amulet","icon":"ring","tags":["cursed"],"description":"glows"}]}')
    expect(items![0]).toMatchObject({ name: 'Amulet', icon: 'ring', tags: ['cursed'], description: 'glows' })
  })

  it('errors on invalid JSON and when nothing usable is present', () => {
    expect(parseItemsSpec('nope').error).toMatch(/valid JSON/)
    expect(parseItemsSpec('[]').error).toMatch(/No items/)
    expect(parseItemsSpec('{"foo":1}').error).toMatch(/Expected a JSON array/)
  })
})

describe('addItemsToWorld', () => {
  const worldId = 'w1'

  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.worlds.put({ id: worldId, name: 'W', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 })
  })

  it('adds new items with fields set and default icon', async () => {
    const res = await addItemsToWorld(worldId, [
      { name: 'Excalibur', icon: 'weapon', description: 'A famous sword.', tags: ['legendary'] },
      { name: 'Pebble' },
    ])
    expect(res).toMatchObject({ added: 2, skipped: 0 })
    const items = (await db.items.where('worldId').equals(worldId).toArray()).sort((a, b) => a.name.localeCompare(b.name))
    expect(items[0]).toMatchObject({ name: 'Excalibur', iconType: 'weapon', description: 'A famous sword.', tags: ['legendary'], imageId: null })
    expect(items[1]).toMatchObject({ name: 'Pebble', iconType: 'other', tags: [] })
  })

  it('skips names already present (case-insensitive) and repeats within the batch', async () => {
    await db.items.put({ id: 'x', worldId, name: 'Sword', description: '', iconType: 'weapon', imageId: null, tags: [] })
    const res = await addItemsToWorld(worldId, [{ name: 'sword' }, { name: 'Shield' }, { name: 'Shield' }])
    expect(res).toMatchObject({ added: 1, skipped: 2, addedNames: ['Shield'] })
  })
})
