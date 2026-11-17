import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, bibleOf } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createCharacter, updateCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import { createTimeline, createChapter, createEvent, deleteEvent } from '@/db/hooks/useTimeline'
import { sayPerson } from '@/db/hooks/useSnapshots'
import { makeSeries, addBook, booksOf } from '@/db/hooks/useSeries'
import { openingOf } from '@/db/hooks/useOpening'
import { serializeSeries, readSeriesFile, importSeriesData, collectSeriesData } from '@/lib/exportImport'

/*
  A series' file (issue #698, part 5): the series' bible, each book as stored,
  and the images once; brought in whole, in one transaction, by replacing the
  series here or merging with it, deletions travelling as tombstones.
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

/** Book one: Anna, with a portrait, dies at its scene. Book two: Cara, a scene, a cover. Bo was made and deleted; so was a scene of book two. */
async function aSeries() {
  const one = await createWorld({ name: 'The Salt Road', description: '' })
  const anna = await createCharacter({ worldId: one.id, name: 'Anna', description: 'Grey eyes.' })
  const s1 = await scene(one.id, [anna.id])
  await sayPerson(one.id, anna.id, s1.id, { isAlive: false }, { says: ['alive'] })
  const series = await makeSeries(one.id, 'The Salt Books')
  const two = await addBook(series.id, 'The Second Road')
  const cara = await createCharacter({ worldId: two.id, name: 'Cara', description: '' })
  const t1 = await scene(two.id, [anna.id, cara.id])
  const gone = await scene(two.id, [])
  await deleteEvent(gone.id)
  const bo = await createCharacter({ worldId: one.id, name: 'Bo', description: '' })
  await deleteCharacter(bo.id)
  await db.blobs.bulkAdd([
    // Linked images: fake-indexeddb under jsdom does not give a stored Blob back as one, and a link travels the same way.
    { id: 'portrait', worldId: series.id, mimeType: 'image/png', url: 'https://example.invalid/anna.png', createdAt: 0 },
    { id: 'cover', worldId: two.id, mimeType: 'image/png', url: 'https://example.invalid/road.png', createdAt: 0 },
  ] as never)
  await updateCharacter(anna.id, { portraitImageId: 'portrait' })
  return { one, two, series, anna, cara, bo, s1, t1, gone }
}

const fileOf = async (seriesId: string) => readSeriesFile(JSON.parse(await serializeSeries(seriesId)))

describe('a series’ file', () => {
  it('holds the series’ bible once, each book as stored with none of it, and each image with the part it belongs to', async () => {
    const { one, two, series, anna, cara } = await aSeries()
    const { header } = await collectSeriesData(series.id)
    expect(header.series.world).toMatchObject({ id: series.id, kind: 'series' })
    expect(header.series.characters.map((c) => c.id).sort()).toEqual([anna.id, cara.id].sort())
    expect(header.books.map((b) => [b.world.id, b.world.seriesId, b.world.seriesIndex])).toEqual([[one.id, series.id, 1], [two.id, series.id, 2]])
    expect(header.books.every((b) => b.characters.length === 0 && b.items.length === 0)).toBe(true)
    expect(header.books[1].events.length).toBe(1)
    const file = await fileOf(series.id)
    expect(file.series.blobs.map((b) => b.id)).toEqual(['portrait'])
    expect(file.books[1].blobs.map((b) => b.id)).toEqual(['cover'])
  })

  it('carries the tombstones of the bible in the series’ part and of each book in its own', async () => {
    const { series, bo, gone } = await aSeries()
    const file = await fileOf(series.id)
    expect(file.series.tombstones?.map((t) => t.entityId)).toContain(bo.id)
    expect(file.books[1].tombstones?.map((t) => t.entityId)).toContain(gone.id)
    expect(file.series.tombstones?.map((t) => t.entityId)).not.toContain(gone.id)
    // And each part only its own: Bo's deletion is the bible's, not book two's or book one's.
    expect(file.books.flatMap((b) => b.tombstones ?? []).map((t) => t.entityId)).not.toContain(bo.id)
  })
})

describe('bringing a series’ file in', () => {
  it('into an empty library: the series, its books in order, its bible, its images; and book two opens on book one’s end', async () => {
    const { one, two, series, anna } = await aSeries()
    const json = await serializeSeries(series.id)
    await db.delete()
    await db.open()
    await importSeriesData(readSeriesFile(JSON.parse(json)))
    expect((await db.worlds.get(series.id))?.kind).toBe('series')
    expect((await booksOf(series.id)).map((b) => b.id)).toEqual([one.id, two.id])
    expect(bibleOf(two.id)).toBe(series.id)
    expect((await db.characters.where('worldId').equals(series.id).toArray()).map((c) => c.name).sort()).toEqual(['Anna', 'Cara'])
    expect((await db.blobs.get('portrait'))?.worldId).toBe(series.id)
    expect((await db.blobs.get('cover'))?.worldId).toBe(two.id)
    expect((await openingOf(two.id)).people.find((p) => p.characterId === anna.id)?.isAlive).toBe(false)
  })

  it('replacing the series here: its bible and books become the file’s, and a book the file has not got goes', async () => {
    const { series, anna } = await aSeries()
    const json = await serializeSeries(series.id)
    await updateCharacter(anna.id, { name: 'Anna Vell' })
    const three = await addBook(series.id, 'The Last Road')
    await importSeriesData(readSeriesFile(JSON.parse(json)), 'replace')
    expect((await db.characters.get(anna.id))?.name).toBe('Anna')
    expect(await db.worlds.get(three.id)).toBeUndefined()
    expect((await booksOf(series.id)).length).toBe(2)
  })

  it('merging with the series here: newer work on either side is kept, a book only here stays, and a deletion in the file is made here', async () => {
    const { series, anna, cara, two, t1 } = await aSeries()
    // The file is made after Cara is deleted from the bible, and book two's scene from the book: it says so with tombstones.
    const scene = (await db.events.get(t1.id))!
    await deleteCharacter(cara.id)
    await deleteEvent(t1.id)
    const json = await serializeSeries(series.id)
    // Here, the scene is still there too.
    await db.events.put(scene)
    await db.tombstones.where('entityId').equals(t1.id).delete()
    // Here, meanwhile, Cara is still alive (as if the file came from another device) and Anna was renamed after the file was made.
    await db.characters.put({ id: cara.id, worldId: series.id, name: 'Cara', description: '', aliases: [], tags: [], isAlive: true, portraitImageId: null, color: null, createdAt: 0, updatedAt: 0 } as never)
    await db.tombstones.where('entityId').equals(cara.id).delete()
    await new Promise((r) => setTimeout(r, 5))
    await updateCharacter(anna.id, { name: 'Anna Vell' })
    const three = await addBook(series.id, 'The Last Road')
    // And a scene written in book two since: a book's own work here, which a merge keeps and a replace would not.
    const since = await scene(two.id, [])

    await importSeriesData(readSeriesFile(JSON.parse(json)), 'merge')
    expect(await db.events.get(since.id)).toBeDefined()
    expect((await db.characters.get(anna.id))?.name).toBe('Anna Vell')
    expect(await db.characters.get(cara.id)).toBeUndefined()
    expect(await db.events.get(t1.id)).toBeUndefined()
    expect(await db.worlds.get(three.id)).toBeDefined()
    expect((await booksOf(series.id)).map((b) => b.id)).toContain(two.id)
  })

  it('a book of the file that is here on its own is refused, and nothing is written', async () => {
    const { series, two } = await aSeries()
    const json = await serializeSeries(series.id)
    await db.delete()
    await db.open()
    await db.worlds.add({ id: two.id, name: 'The Second Road', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: 0, updatedAt: 0 } as never)
    await expect(importSeriesData(readSeriesFile(JSON.parse(json)))).rejects.toThrow(/here already, as a book on its own/)
    expect(await db.worlds.get(series.id)).toBeUndefined()
  })

  it('a file that is not a series, or whose book is another series’, is not read as one', async () => {
    const { series } = await aSeries()
    const file = JSON.parse(await serializeSeries(series.id))
    expect(() => readSeriesFile({ ...file, type: 'full' })).toThrow(/not a series/)
    file.books[0].world.seriesId = 'someone-else'
    expect(() => readSeriesFile(file)).toThrow(/is not a book of this series/)
  })
})
