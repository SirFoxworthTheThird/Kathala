import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import { createSequelWorld } from '@/db/hooks/useSequel'
import { makeSeries, joinOffers, joinSeries, booksOf } from '@/db/hooks/useSeries'
import { openingOf } from '@/db/hooks/useOpening'
import { suggestedPairs } from '@/lib/seriesJoin'

/*
  Joining a sequel made with Start a sequel to the series its first book became
  (issue #698, part 3): every reference to a copy in the sequel is pointed at the
  series' own record, the copies go, and what was the sequel's own joins the bible.
*/

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const t = 0
const ev = (id: string, worldId: string, chapterId: string, timelineId: string, extra: Record<string, unknown> = {}) => ({
  id, worldId, chapterId, timelineId, title: id, description: '', locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
  threadIds: [], involvedItemIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
  status: 'draft', povCharacterId: null, isFlashback: false, createdAt: t, updatedAt: t, ...extra,
})

/** Book one: Anna and Bo, friends; the key; the coast with its harbour; the guild, Anna in it. Anna dies at its one scene. */
async function bookOne() {
  const id = {
    one: generateId(), anna: generateId(), bo: generateId(), rel: generateId(), key: generateId(), coast: generateId(),
    harbour: generateId(), guild: generateId(), member: generateId(), s1: generateId(), portrait: generateId(),
  }
  await db.worlds.put({ id: id.one, name: 'Book One', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: t, updatedAt: t })
  await db.characters.bulkPut([
    { id: id.anna, worldId: id.one, name: 'Anna', aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: t, updatedAt: t },
    { id: id.bo, worldId: id.one, name: 'Bo', aliases: [], description: 'A sailor.', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: t, updatedAt: t },
  ])
  await db.relationships.put({ id: id.rel, worldId: id.one, characterAId: id.anna, characterBId: id.bo, label: 'friends', strength: 'moderate', sentiment: 'positive', description: '', isBidirectional: true, startEventId: null, createdAt: t, updatedAt: t })
  await db.items.put({ id: id.key, worldId: id.one, name: 'Brass Key', description: '', iconType: 'key', imageId: null, tags: [] } as never)
  await db.mapLayers.put({ id: id.coast, worldId: id.one, parentMapId: null, name: 'The Coast', description: '', imageId: null, imageWidth: 100, imageHeight: 100, createdAt: t, updatedAt: t } as never)
  await db.locationMarkers.put({ id: id.harbour, worldId: id.one, mapLayerId: id.coast, linkedMapLayerId: null, name: 'Harbour', description: '', x: 1, y: 1, iconType: 'city', tags: [], createdAt: t, updatedAt: t } as never)
  await db.factions.put({ id: id.guild, worldId: id.one, name: 'The Guild', description: '', color: '#fff', coverImageId: null, tags: [], createdAt: t, updatedAt: t } as never)
  await db.factionMemberships.put({ id: id.member, worldId: id.one, factionId: id.guild, characterId: id.anna, role: '', startEventId: null, endEventId: null, notes: '', createdAt: t, updatedAt: t } as never)
  await db.timelines.put({ id: `tl-${id.one}`, worldId: id.one, name: 'Main', description: '', color: '#000', createdAt: t })
  await db.chapters.put({ id: `ch-${id.one}`, worldId: id.one, timelineId: `tl-${id.one}`, number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: t, updatedAt: t })
  await db.events.put(ev(id.s1, id.one, `ch-${id.one}`, `tl-${id.one}`) as never)
  await db.characterSnapshots.put({ id: generateId(), worldId: id.one, characterId: id.anna, eventId: id.s1, isAlive: false, sortKey: 1, createdAt: t, updatedAt: t } as never)
  return id
}

/** The sequel, made with Start a sequel, and written in: a scene with Anna at the harbour, Bo holding the key, a new person, a warning dismissed. */
async function sequelWrittenIn(one: Awaited<ReturnType<typeof bookOne>>) {
  const two = await createSequelWorld(one.one, { characterIds: [one.anna, one.bo], itemIds: [one.key], factionIds: [one.guild], mapLayerIds: [one.coast] }, { name: 'Book Two' })
  const copy = async <T extends { id: string; name: string }>(table: string, name: string) =>
    ((await db.table(table).where('worldId').equals(two).toArray()) as T[]).find((r) => r.name === name)!
  const anna = await copy('characters', 'Anna')
  const bo = await copy<{ id: string; name: string; description: string; portraitImageId: string | null }>('characters', 'Bo')
  const key = await copy('items', 'Brass Key')
  const harbour = await copy('locationMarkers', 'Harbour')
  const coast = await copy('mapLayers', 'The Coast')
  const guild = await copy('factions', 'The Guild')
  // The sequel's Bo has a portrait book one's has not; his description is the sequel's own.
  await db.blobs.put({ id: one.portrait, worldId: two, mimeType: 'image/png', data: new Blob(['bo']), createdAt: t })
  await db.characters.update(bo.id, { portraitImageId: one.portrait, description: 'An old sailor.' })
  const cara = generateId()
  await db.characters.put({ id: cara, worldId: two, name: 'Cara', aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: t, updatedAt: t })
  const t1 = generateId()
  const [tl] = await db.timelines.where('worldId').equals(two).toArray()
  const chapter = generateId()
  await db.chapters.put({ id: chapter, worldId: two, timelineId: tl.id, number: 1, title: 'Two', synopsis: '', notes: '', wordGoal: null, createdAt: t, updatedAt: t })
  await db.events.put(ev(t1, two, chapter, tl.id, { involvedCharacterIds: [anna.id, cara], locationMarkerId: harbour.id, povCharacterId: anna.id }) as never)
  await db.characterSnapshots.put({ id: generateId(), worldId: two, characterId: anna.id, eventId: t1, isAlive: true, revived: true, currentLocationMarkerId: harbour.id, currentMapLayerId: coast.id, sortKey: 1, createdAt: t, updatedAt: t } as never)
  const custody = `custody:${key.id}:${t1}`
  await db.itemCustody.put({ id: custody, worldId: two, itemId: key.id, eventId: t1, holderId: bo.id, placeId: null, sortKey: 1, createdAt: t, updatedAt: t } as never)
  const issueId = `dead-in-event-${anna.id}-${t1}`
  await db.continuitySuppressions.put({ id: generateId(), worldId: two, issueId, createdAt: t } as never)
  await db.operations.put({ id: generateId(), worldId: two, seq: 1, entityType: 'character', entityId: anna.id, op: 'update', at: t } as never)
  return { two, anna, bo, key, harbour, coast, guild, cara, t1, custody, issueId }
}

async function series() {
  const one = await bookOne()
  const sequel = await sequelWrittenIn(one)
  const s = await makeSeries(one.one, 'The Salt Books')
  return { one, sequel, s }
}

describe('joining a sequel to its first book’s series', () => {
  it('offers each copy as the series’ own by its name, and nothing for one the series has not got', async () => {
    const { s, sequel, one } = await series()
    const offers = await joinOffers(sequel.two, s.id)
    const by = (name: string) => offers.find((o) => o.copy.name === name)
    expect(by('Anna')?.suggested).toBe(one.anna)
    expect(by('Bo')?.suggested).toBe(one.bo)
    expect(by('Brass Key')?.suggested).toBe(one.key)
    expect(by('Harbour')?.suggested).toBe(one.harbour)
    expect(by('The Coast')?.suggested).toBe(one.coast)
    expect(by('The Guild')?.suggested).toBe(one.guild)
    expect(by('Cara')).toMatchObject({ suggested: null, candidates: [] })
  })

  it('points every reference in the sequel at the series’ records, and removes the copies', async () => {
    const { s, sequel, one } = await series()
    const result = await joinSeries(sequel.two, s.id, suggestedPairs(await joinOffers(sequel.two, s.id)))
    // Anna, Bo, the key, the coast, the harbour, the guild; and Anna and Bo's friendship, Anna's membership, which follow.
    expect(result.matched).toBe(8)

    // No copy is left anywhere; the series has each once, and Cara besides.
    for (const table of ['characters', 'items', 'mapLayers', 'locationMarkers', 'factions', 'relationships', 'factionMemberships']) {
      expect(await db.table(table).where('worldId').equals(sequel.two).count(), table).toBe(0)
    }
    expect((await db.characters.where('worldId').equals(s.id).toArray()).map((c) => c.name).sort()).toEqual(['Anna', 'Bo', 'Cara'])
    expect(await db.relationships.where('worldId').equals(s.id).count()).toBe(1)
    expect(await db.factionMemberships.where('worldId').equals(s.id).count()).toBe(1)

    // The scene: its cast, its place and its point of view.
    const scene = await db.events.get(sequel.t1)
    expect(scene).toMatchObject({ involvedCharacterIds: [one.anna, sequel.cara], locationMarkerId: one.harbour, povCharacterId: one.anna })
    // Anna's state there, by her and her place on the map.
    const [state] = await db.characterSnapshots.where('worldId').equals(sequel.two).toArray()
    expect(state).toMatchObject({ characterId: one.anna, currentLocationMarkerId: one.harbour, currentMapLayerId: one.coast, eventId: sequel.t1 })
    // The key in Bo's hands, under the id custody gives such a statement.
    expect(await db.itemCustody.get(sequel.custody)).toBeUndefined()
    expect(await db.itemCustody.get(`custody:${one.key}:${sequel.t1}`)).toMatchObject({ itemId: one.key, holderId: one.bo, worldId: sequel.two })
    // The warning dismissed stays dismissed.
    const [suppressed] = await db.continuitySuppressions.where('worldId').equals(sequel.two).toArray()
    expect(suppressed.issueId).toBe(`dead-in-event-${one.anna}-${sequel.t1}`)
  })

  it('a copy fills what the series’ record has left empty, its image with it, and the series’ words stand', async () => {
    const { s, sequel, one } = await series()
    await joinSeries(sequel.two, s.id, suggestedPairs(await joinOffers(sequel.two, s.id)))
    const bo = await db.characters.get(one.bo)
    expect(bo).toMatchObject({ description: 'A sailor.', portraitImageId: one.portrait })
    expect(await db.blobs.get(one.portrait)).toMatchObject({ worldId: s.id })
  })

  it('a copy not confirmed joins the series as it is, beside the record it was not matched to', async () => {
    const { s, sequel, one } = await series()
    const pairs = suggestedPairs(await joinOffers(sequel.two, s.id))
    pairs.delete(sequel.bo.id)
    await joinSeries(sequel.two, s.id, pairs)
    const bos = await db.characters.where('worldId').equals(s.id).filter((c) => c.name === 'Bo').toArray()
    expect(bos.map((b) => b.id).sort()).toEqual([one.bo, sequel.bo.id].sort())
    // The key is still in the hands of the Bo the sequel wrote about.
    expect(await db.itemCustody.get(`custody:${one.key}:${sequel.t1}`)).toMatchObject({ holderId: sequel.bo.id })
    // And with Bo not matched, Anna and Bo's friendship is not book one's: it joins as the sequel's own.
    expect(await db.relationships.where('worldId').equals(s.id).count()).toBe(2)
  })

  it('the sequel is the series’ second book, its journal reset, and it opens on book one’s end', async () => {
    const { s, sequel, one } = await series()
    await joinSeries(sequel.two, s.id, suggestedPairs(await joinOffers(sequel.two, s.id)))
    expect((await booksOf(s.id)).map((b) => [b.id, b.seriesIndex])).toEqual([[one.one, 1], [sequel.two, 2]])
    expect(await db.operations.where('worldId').equals(sequel.two).count()).toBe(0)
    // Anna died at the end of book one: the sequel opens on that, now that she is the same person.
    const opening = await openingOf(sequel.two)
    expect(opening.from?.id).toBe(one.one)
    expect(opening.people.find((p) => p.characterId === one.anna)?.isAlive).toBe(false)
  })

  it('a deleted shared record’s tombstone goes to the series, so a merge does not bring it back; a deleted scene’s stays the book’s', async () => {
    const { s, sequel } = await series()
    const gone = { person: generateId(), scene: generateId() }
    await db.tombstones.bulkPut([
      { id: generateId(), worldId: sequel.two, entityType: 'character', entityId: gone.person, deletedAt: t, version: 1 },
      { id: generateId(), worldId: sequel.two, entityType: 'event', entityId: gone.scene, deletedAt: t, version: 1 },
    ] as never)
    await joinSeries(sequel.two, s.id, suggestedPairs(await joinOffers(sequel.two, s.id)))
    expect((await db.tombstones.where('entityId').equals(gone.person).first())?.worldId).toBe(s.id)
    expect((await db.tombstones.where('entityId').equals(gone.scene).first())?.worldId).toBe(sequel.two)
  })

  it('a pair the offers do not allow is refused, and nothing is written', async () => {
    const { s, sequel, one } = await series()
    // Cara is not one of Anna's candidates; taking her for Anna would also give Anna two copies.
    await expect(joinSeries(sequel.two, s.id, new Map([[sequel.anna.id, one.anna], [sequel.cara, one.anna]]))).rejects.toThrow(/Cara is not matched to one of the series/)
    expect((await db.worlds.get(sequel.two))?.seriesId).toBeUndefined()
    expect(await db.characters.where('worldId').equals(sequel.two).count()).toBe(3)
  })

  it('a book already in a series, or a series, is not joined', async () => {
    const { s, one } = await series()
    await expect(joinSeries(one.one, s.id, new Map())).rejects.toThrow(/already a book of a series/)
    await expect(joinSeries(s.id, s.id, new Map())).rejects.toThrow(/is a series/)
  })
})
