import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, bibleOf, familyOf } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { createCharacter, updateCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { sayPerson } from '@/db/hooks/useSnapshots'
import { createItem } from '@/db/hooks/useItems'
import { giveTo, custodyOf } from '@/db/hooks/useCustody'
import { makeSeries, addBook, booksOf, deleteSeries } from '@/db/hooks/useSeries'
import { setActingWorld, undoLast } from '@/db/hooks/useOperations'
import { collectWorldData, importWorldFromJson, serializeWorldForSync } from '@/lib/exportImport'

/*
  A series (issue #698, part 1): the bible its books share is the series', and
  each book reads and writes it through `bibleOf`; the story stays each book's.
*/

beforeEach(async () => {
  await db.delete()
  await db.open()
  setActingWorld(null)
})
afterEach(() => setActingWorld(null))

const castOf = async (worldId: string) => (await db.characters.where('worldId').equals(bibleOf(worldId)).toArray()).map((c) => c.name).sort()

/** A book with one scene, a character with a portrait and a state there, a lore page, and a cover of its own. */
async function bookOne() {
  const world = await createWorld({ name: 'The Salt Road', description: '' })
  const timeline = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const chapter = await createChapter({ worldId: world.id, timelineId: timeline.id, number: 1, title: 'One', synopsis: '' })
  const scene = await createEvent({
    worldId: world.id, chapterId: chapter.id, timelineId: timeline.id, title: 'Scene 1', description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
  })
  const anna = await createCharacter({ worldId: world.id, name: 'Anna', description: 'grey eyes' })
  await db.blobs.add({ id: 'portrait', worldId: world.id, mimeType: 'image/png', createdAt: 1 })
  await db.blobs.add({ id: 'cover', worldId: world.id, mimeType: 'image/png', createdAt: 1 })
  await updateCharacter(anna.id, { portraitImageId: 'portrait' })
  await db.worlds.update(world.id, { coverImageId: 'cover' })
  await sayPerson(world.id, anna.id, scene.id, { isAlive: true })
  await db.loreCategories.add({ id: 'cat', worldId: world.id, name: 'Places', color: null, sortOrder: 0, createdAt: 1, updatedAt: 1 } as never)
  return { world, timeline, chapter, scene, anna }
}

describe('making a series', () => {
  it('moves the bible, its images and its tombstones to the series; the book keeps its story, cover and journal', async () => {
    const { world, scene, anna } = await bookOne()
    const gone = await createCharacter({ worldId: world.id, name: 'Bo', description: '' })
    await deleteCharacter(gone.id)
    const opsBefore = await db.operations.where('worldId').equals(world.id).count()

    const series = await makeSeries(world.id, 'The Salt Books')

    expect(series).toMatchObject({ kind: 'series', name: 'The Salt Books' })
    expect(await db.worlds.get(world.id)).toMatchObject({ seriesId: series.id, seriesIndex: 1 })
    expect(bibleOf(world.id)).toBe(series.id)
    expect((await db.characters.get(anna.id))?.worldId).toBe(series.id)
    expect((await db.loreCategories.get('cat'))?.worldId).toBe(series.id)
    // What a shared row shows goes with it; the book's cover stays.
    expect((await db.blobs.get('portrait'))?.worldId).toBe(series.id)
    expect((await db.blobs.get('cover'))?.worldId).toBe(world.id)
    // A deleted shared row's tombstone is the series' world state now.
    expect((await db.tombstones.where('entityId').equals(gone.id).first())?.worldId).toBe(series.id)
    // The story and the journal are the book's.
    expect((await db.events.get(scene.id))?.worldId).toBe(world.id)
    expect(await db.characterSnapshots.where('worldId').equals(world.id).count()).toBe(1)
    expect(await db.operations.where('worldId').equals(world.id).count()).toBe(opsBefore)
    expect(await castOf(world.id)).toEqual(['Anna'])
  })

  it('refuses a book already in a series, and a series', async () => {
    const { world } = await bookOne()
    const series = await makeSeries(world.id, 'S')
    await expect(makeSeries(world.id, 'Again')).rejects.toThrow(/already a book of a series/)
    await expect(makeSeries(series.id, 'Of a series')).rejects.toThrow(/is a series/)
  })

  it('reads each book’s series from the database when it is opened, not from what it remembered', async () => {
    const { world } = await bookOne()
    const series = await makeSeries(world.id, 'S')
    expect(familyOf(world.id)).toEqual([series.id, world.id])
    // Changed behind the app's back, as another session would: a second connection, while the app's is closed.
    db.close()
    const raw = new Dexie(db.name)
    await raw.open()
    await raw.table('worlds').update(world.id, { seriesId: 'elsewhere' })
    raw.close()
    await db.open()
    expect(bibleOf(world.id)).toBe('elsewhere')
  })
})

describe('a series of two books', () => {
  async function twoBooks() {
    const one = await bookOne()
    const series = await makeSeries(one.world.id, 'S')
    const two = await addBook(series.id, 'The Second Road')
    return { ...one, series, two }
  }

  it('adds a book at the end, reading the series’ bible from its first page', async () => {
    const { world, series, two } = await twoBooks()
    expect((await booksOf(series.id)).map((b) => [b.id, b.seriesIndex])).toEqual([[world.id, 1], [two.id, 2]])
    expect(await castOf(two.id)).toEqual(['Anna'])
  })

  it('an edit made in one book is in the other at once', async () => {
    const { anna, two, world } = await twoBooks()
    setActingWorld(two.id)
    await updateCharacter(anna.id, { description: 'green eyes' })
    const read = async (w: string) => (await db.characters.where('worldId').equals(bibleOf(w)).toArray()).find((c) => c.id === anna.id)?.description
    expect(await read(world.id)).toBe('green eyes')
    expect(await read(two.id)).toBe('green eyes')
  })

  it('a character made in book two is the series’, and so in book one’s cast too (D-4)', async () => {
    const { world, two } = await twoBooks()
    const cara = await createCharacter({ worldId: two.id, name: 'Cara', description: '' })
    expect(cara.worldId).toBe(bibleOf(two.id))
    expect(await castOf(world.id)).toEqual(['Anna', 'Cara'])
    // Whatever path writes it: a bulk write lands in the bible too.
    await db.characters.bulkPut([{ ...cara, id: 'dan', name: 'Dan', worldId: two.id }])
    expect(await castOf(world.id)).toEqual(['Anna', 'Cara', 'Dan'])
    // And an existing row written again with a book's id, by a put over it or an update, stays in the bible.
    await db.characters.bulkPut([{ ...cara, name: 'Cara Lind', worldId: two.id }])
    await db.characters.update('dan', { worldId: world.id })
    expect((await db.characters.toArray()).map((c) => c.worldId === bibleOf(world.id))).toEqual([true, true, true])
    expect(await castOf(two.id)).toEqual(['Anna', 'Cara Lind', 'Dan'])
  })

  it('a shared edit is journalled under the book it was made in, and that book’s undo takes it back', async () => {
    const { anna, two, world } = await twoBooks()
    setActingWorld(two.id)
    const before = await db.operations.where('worldId').equals(world.id).count()
    await updateCharacter(anna.id, { description: 'green eyes' })
    expect(await db.operations.where('worldId').equals(world.id).count()).toBe(before)
    const ops = await db.operations.where('worldId').equals(two.id).toArray()
    expect(ops.map((o) => [o.entityType, o.type])).toEqual([['character', 'update']])
    await undoLast(two.id)
    expect((await db.characters.get(anna.id))?.description).toBe('grey eyes')
  })

  it('deleting a shared character takes its states from every book, and undo puts them all back', async () => {
    const { anna, two, scene } = await twoBooks()
    const tl = await createTimeline({ worldId: two.id, name: 'Main', description: '', color: '#fff' })
    const ch = await createChapter({ worldId: two.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
    const sc = await createEvent({ worldId: two.id, chapterId: ch.id, timelineId: tl.id, title: 'S', description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0 })
    await sayPerson(two.id, anna.id, sc.id, { isAlive: false })
    setActingWorld(two.id)
    await deleteCharacter(anna.id)
    expect(await db.characterSnapshots.where('characterId').equals(anna.id).count()).toBe(0)
    await undoLast(two.id)
    expect((await db.characterSnapshots.where('characterId').equals(anna.id).toArray()).map((r) => r.eventId).sort()).toEqual([scene.id, sc.id].sort())
    expect((await db.characters.get(anna.id))?.name).toBe('Anna')
  })

  it('what is true in a book is read from that book’s own records, not the series’ other books’', async () => {
    const { anna, two, scene } = await twoBooks()
    const tl = await createTimeline({ worldId: two.id, name: 'Main', description: '', color: '#fff' })
    const ch = await createChapter({ worldId: two.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
    const sc = await createEvent({ worldId: two.id, chapterId: ch.id, timelineId: tl.id, title: 'S', description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0 })
    // Alive in book one, and said alive in book two: book two's first word on her is recorded there, not found already said.
    await sayPerson(two.id, anna.id, sc.id, { isAlive: true })
    expect((await db.characterSnapshots.where('characterId').equals(anna.id).toArray()).map((r) => r.worldId === two.id).sort()).toEqual([false, true])
    // A key handed to her in book one is not hers in book two from book one's word: that is part 2's carry, made on purpose.
    const key = await createItem({ worldId: two.id, name: 'Key', description: '', iconType: 'key', tags: [] } as never)
    await giveTo(scene.worldId, key.id, scene.id, anna.id)
    expect((await custodyOf(two.id, key.id, sc.id)).holderId ?? null).toBeNull()
    expect((await custodyOf(scene.worldId, key.id, scene.id)).holderId).toBe(anna.id)
  })

  it('deleting a book leaves the bible; deleting the series takes the bible and every book', async () => {
    const { world, series, two, anna } = await twoBooks()
    await deleteWorld(two.id)
    expect(await db.worlds.get(two.id)).toBeUndefined()
    expect(await db.characters.get(anna.id)).toBeDefined()
    expect(await db.blobs.get('portrait')).toBeDefined()
    await deleteSeries(series.id)
    expect(await db.worlds.get(world.id)).toBeUndefined()
    expect(await db.worlds.get(series.id)).toBeUndefined()
    expect(await db.characters.get(anna.id)).toBeUndefined()
    expect(await db.blobs.get('portrait')).toBeUndefined()
  })

  it('a book goes out on its own: its bible and the images it shows under its own id, and no series named', async () => {
    const { two, anna } = await twoBooks()
    const d = await collectWorldData(two.id)
    expect(d.world.seriesId).toBeUndefined()
    expect(d.world.seriesIndex).toBeUndefined()
    expect(d.characters.map((c) => [c.id, c.worldId])).toEqual([[anna.id, two.id]])
    expect(d.loreCategories.map((c) => c.worldId)).toEqual([two.id])
    expect(d.rawBlobs.map((b) => [b.id, b.worldId])).toEqual([['portrait', two.id]])
  })

  it('a file is not brought in over a book of a series, nor over a series', async () => {
    const { world, series } = await twoBooks()
    const file = await serializeWorldForSync(world.id)
    await expect(importWorldFromJson(file)).rejects.toThrow(/book of a series/)
    const asSeries = JSON.parse(file) as { world: { id: string } }
    asSeries.world.id = series.id
    await expect(importWorldFromJson(JSON.stringify(asSeries))).rejects.toThrow(/is a series/)
    expect((await db.characters.toArray()).every((c) => c.worldId === series.id)).toBe(true)
  })
})
