import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, bibleOf } from '@/db/database'
import { generateId } from '@/lib/id'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { createCharacter, updateCharacter } from '@/db/hooks/useCharacters'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { makeSeries, addBook, booksOf, leaveSeries, dissolveSeries } from '@/db/hooks/useSeries'
import { serializeWorldForSync, importWorldFromJson } from '@/lib/exportImport'

/*
  Out of a series (issue #698): a book taken out, with its own copy of what the
  series shared; a series dissolved, each book keeping its own; and a book's
  file brought back in, which must never take the series' rows for its own.
*/

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function scene(worldId: string, cast: string[]) {
  const tl = await createTimeline({ worldId, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  return createEvent({ worldId, chapterId: ch.id, timelineId: tl.id, title: 'S', description: '', locationMarkerId: null, involvedCharacterIds: cast, involvedItemIds: [], tags: [], sortOrder: 0 })
}

/** Three books: Anna in all of them, with a portrait; Cara kept to book two; the key in Anna's hands in book two. */
async function threeBooks() {
  const one = await createWorld({ name: 'One', description: '' })
  const anna = await createCharacter({ worldId: one.id, name: 'Anna', description: '' })
  await scene(one.id, [anna.id])
  const series = await makeSeries(one.id, 'S')
  const two = await addBook(series.id, 'Two')
  const three = await addBook(series.id, 'Three')
  const cara = await createCharacter({ worldId: two.id, name: 'Cara', description: '' })
  await updateCharacter(cara.id, { onlyInBook: two.id })
  const portrait = generateId()
  await db.blobs.add({ id: portrait, worldId: series.id, mimeType: 'image/png', url: 'https://example.invalid/anna.png', createdAt: 0 } as never)
  await updateCharacter(anna.id, { portraitImageId: portrait })
  const t1 = await scene(two.id, [anna.id, cara.id])
  const key = generateId()
  await db.items.add({ id: key, worldId: series.id, name: 'Key', description: '', iconType: 'key', imageId: null, tags: [] } as never)
  await db.itemCustody.add({ id: `custody:${key}:${t1.id}`, worldId: two.id, itemId: key, eventId: t1.id, holderId: anna.id, placeId: null, sortKey: 1, createdAt: 0, updatedAt: 0 } as never)
  await scene(three.id, [anna.id])
  return { one, two, three, series, anna, cara, portrait, key, t1 }
}

describe('a book taken out of its series', () => {
  it('is a book on its own, with its own copy of the cast, which its scenes and records name', async () => {
    const { two, series, anna, cara, key, t1 } = await threeBooks()
    await leaveSeries(two.id)
    const book = await db.worlds.get(two.id)
    expect(book?.seriesId).toBeUndefined()
    expect(bibleOf(two.id)).toBe(two.id)
    const cast = await db.characters.where('worldId').equals(two.id).toArray()
    expect(cast.map((c) => c.name).sort()).toEqual(['Anna', 'Cara'])
    const annaHere = cast.find((c) => c.name === 'Anna')!
    expect(annaHere.id).not.toBe(anna.id)
    // Cara was kept to book two: she goes with it, as she was.
    expect(cast.find((c) => c.name === 'Cara')?.id).toBe(cara.id)
    // On its own, the mark means nothing: she is simply the book's.
    expect(cast.find((c) => c.name === 'Cara')).not.toHaveProperty('onlyInBook', two.id)
    const scene = await db.events.get(t1.id)
    expect(scene?.involvedCharacterIds).toEqual([annaHere.id, cara.id])
    const keyHere = (await db.items.where('worldId').equals(two.id).first())!
    expect(await db.itemCustody.get(`custody:${keyHere.id}:${t1.id}`)).toMatchObject({ itemId: keyHere.id, holderId: annaHere.id })
    expect(await db.itemCustody.get(`custody:${key}:${t1.id}`)).toBeUndefined()
    // The series keeps its own: Anna and the key, and not Cara.
    expect((await db.characters.where('worldId').equals(series.id).toArray()).map((c) => c.id)).toEqual([anna.id])
  })

  it('its copy is its own: an edit to it does not reach the series, and its picture is its own', async () => {
    const { two, anna, portrait } = await threeBooks()
    await leaveSeries(two.id)
    const annaHere = (await db.characters.where('worldId').equals(two.id).filter((c) => c.name === 'Anna').first())!
    await updateCharacter(annaHere.id, { description: 'Older now.' })
    expect((await db.characters.get(anna.id))?.description).toBe('')
    expect(annaHere.portraitImageId).not.toBe(portrait)
    expect(await db.blobs.get(annaHere.portraitImageId!)).toMatchObject({ worldId: two.id })
  })

  it('the books left are numbered again, the book’s journal is reset, and deleting the series leaves the book whole', async () => {
    const { one, two, three, series } = await threeBooks()
    await db.operations.put({ id: generateId(), worldId: two.id, seq: 1, entityType: 'character', entityId: 'x', op: 'update', at: 0 } as never)
    await leaveSeries(two.id)
    expect((await booksOf(series.id)).map((b) => [b.id, b.seriesIndex])).toEqual([[one.id, 1], [three.id, 2]])
    expect(await db.operations.where('worldId').equals(two.id).count()).toBe(0)
    await deleteWorld(series.id)
    expect(await db.characters.where('worldId').equals(two.id).count()).toBe(2)
  })

  it('a book not in a series is refused', async () => {
    const alone = await createWorld({ name: 'Alone', description: '' })
    await expect(leaveSeries(alone.id)).rejects.toThrow(/not in a series/)
  })
})

describe('a series dissolved', () => {
  it('each book keeps its own copy of the cast, its scenes naming it; the series is gone', async () => {
    const { one, two, three, series, anna } = await threeBooks()
    await dissolveSeries(series.id)
    expect(await db.worlds.get(series.id)).toBeUndefined()
    expect(await db.characters.where('worldId').equals(series.id).count()).toBe(0)
    const annas = new Set<string>()
    for (const book of [one, two, three]) {
      expect((await db.worlds.get(book.id))?.seriesId).toBeUndefined()
      const annaHere = (await db.characters.where('worldId').equals(book.id).filter((c) => c.name === 'Anna').first())!
      annas.add(annaHere.id)
      const [first] = await db.events.where('worldId').equals(book.id).toArray()
      expect(first.involvedCharacterIds).toContain(annaHere.id)
      expect(first.involvedCharacterIds).not.toContain(anna.id)
    }
    expect(annas.size).toBe(3)
  })
})

describe('a book’s own file brought back in', () => {
  it('never takes the series’ rows: its cast comes in under its own ids, and the series keeps its own', async () => {
    const { two, series, anna, t1, portrait } = await threeBooks()
    const json = await serializeWorldForSync(two.id)
    await deleteWorld(two.id)
    await importWorldFromJson(json)
    // The series still has Anna, under her own id.
    expect((await db.characters.get(anna.id))?.worldId).toBe(series.id)
    // The book is on its own, with its own Anna, whom its scene names.
    const annaHere = (await db.characters.where('worldId').equals(two.id).filter((c) => c.name === 'Anna').first())!
    expect(annaHere.id).not.toBe(anna.id)
    expect((await db.events.get(t1.id))?.involvedCharacterIds).toContain(annaHere.id)
    // Her portrait too: the book's is its own, and the series' stays the series'.
    expect(annaHere.portraitImageId).not.toBe(portrait)
    expect(await db.blobs.get(annaHere.portraitImageId!)).toMatchObject({ worldId: two.id })
    expect(await db.blobs.get(portrait)).toMatchObject({ worldId: series.id })
  })

  it('a world’s file brought in over itself keeps its ids', async () => {
    const one = await createWorld({ name: 'One', description: '' })
    const anna = await createCharacter({ worldId: one.id, name: 'Anna', description: '' })
    const json = await serializeWorldForSync(one.id)
    await importWorldFromJson(json)
    expect((await db.characters.get(anna.id))?.worldId).toBe(one.id)
    expect(await db.characters.count()).toBe(1)
  })
})
