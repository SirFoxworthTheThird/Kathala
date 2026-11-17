import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createCharacter } from '@/db/hooks/useCharacters'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { sayPerson } from '@/db/hooks/useSnapshots'
import { createItem } from '@/db/hooks/useItems'
import { giveTo } from '@/db/hooks/useCustody'
import { upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'
import { makeSeries, addBook } from '@/db/hooks/useSeries'
import { openingOf, OPENING_KEY, isOpening } from '@/db/hooks/useOpening'
import { loadStory } from '@/db/hooks/useStory'
import { stateAt } from '@/lib/stateAt'

/*
  Each book of a series opens where the book before it ended (issue #698, D-2):
  the opening is read from the book before as it stands, before this book's
  first scene, and this book's own records override it from their scene on.
*/

beforeEach(async () => {
  await db.delete()
  await db.open()
})

/** A book's chapter and its scenes, in order. */
async function scenes(worldId: string, n: number) {
  const tl = await createTimeline({ worldId, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const out = []
  for (let k = 0; k < n; k++) {
    out.push(await createEvent({ worldId, chapterId: ch.id, timelineId: tl.id, title: `S${k + 1}`, description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: k }))
  }
  return out
}

/** Book one: Anna alive at its first scene and dead at its last, with the key in her hands and the lamp cracked; Bo alive throughout. */
async function seriesOfTwo() {
  const one = await createWorld({ name: 'One', description: '' })
  const [s1, s2] = await scenes(one.id, 2)
  const anna = await createCharacter({ worldId: one.id, name: 'Anna', description: '' })
  const bo = await createCharacter({ worldId: one.id, name: 'Bo', description: '' })
  await sayPerson(one.id, anna.id, s1.id, { isAlive: true, statusNotes: 'tired' })
  await sayPerson(one.id, anna.id, s2.id, { isAlive: false })
  await sayPerson(one.id, bo.id, s1.id, { isAlive: true })
  const key = await createItem({ worldId: one.id, name: 'Key', description: '', iconType: 'key', tags: [] } as never)
  const lamp = await createItem({ worldId: one.id, name: 'Lamp', description: '', iconType: 'lamp', tags: [] } as never)
  await giveTo(one.id, key.id, s1.id, bo.id)
  await upsertItemSnapshot({ worldId: one.id, itemId: lamp.id, eventId: s2.id, condition: 'cracked', notes: '' })
  const series = await makeSeries(one.id, 'S')
  const two = await addBook(series.id, 'Two')
  const [t1, t2] = await scenes(two.id, 2)
  return { one, two, series, anna, bo, key, lamp, s1, s2, t1, t2 }
}

/** What is true in a book at a scene, with its opening before its own records. */
async function at(worldId: string, sceneId: string) {
  const o = await openingOf(worldId)
  const [people, custody, items] = await Promise.all([
    db.characterSnapshots.where('worldId').equals(worldId).toArray(),
    db.itemCustody.where('worldId').equals(worldId).toArray(),
    db.itemSnapshots.where('worldId').equals(worldId).toArray(),
  ])
  return stateAt({
    people: [...o.people, ...people],
    custody: { rows: [...o.custody, ...custody], collective: new Set() },
    items: { records: [...o.items, ...items], keptInEra: new Set() },
  }, sceneId, await loadStory(worldId))
}

describe('a book opens on the end of the book before', () => {
  it('a first book, and a book on its own, open on nothing', async () => {
    const { one } = await seriesOfTwo()
    expect((await openingOf(one.id)).people).toEqual([])
    const alone = await createWorld({ name: 'Alone', description: '' })
    expect(await openingOf(alone.id)).toMatchObject({ from: null, people: [], custody: [] })
  })

  it('book two opens with each person, each item’s holder and condition, as book one ended them', async () => {
    const { one, two, anna, bo, key, lamp } = await seriesOfTwo()
    const o = await openingOf(two.id)
    expect(o.from?.id).toBe(one.id)
    // Every opening record is before every scene, and is no stored record.
    expect([...o.people, ...o.custody, ...o.items].every((r) => r.sortKey === OPENING_KEY && isOpening(r) && r.worldId === two.id)).toBe(true)
    const person = (id: string) => o.people.find((p) => p.characterId === id)
    // Anna ended book one dead; what her first scene said and her last did not, she still carries.
    expect(person(anna.id)).toMatchObject({ isAlive: false, statusNotes: 'tired' })
    expect(person(bo.id)).toMatchObject({ isAlive: true })
    expect(o.custody.map((c) => [c.itemId, c.holderId])).toEqual([[key.id, bo.id]])
    expect(o.items.map((i) => [i.itemId, i.condition])).toEqual([[lamp.id, 'cracked']])
  })

  it('at book two’s first scene, with no record there, the state is book one’s end; a record there overrides it from that scene on', async () => {
    const { two, anna, bo, key, t1, t2 } = await seriesOfTwo()
    const first = await at(two.id, t1.id)
    expect(first.people.find((p) => p.characterId === anna.id)?.isAlive).toBe(false)
    expect(first.holdings?.ofItem.get(key.id)?.holderId).toBe(bo.id)
    expect(first.people.find((p) => p.characterId === bo.id)?.inventoryItemIds).toEqual([key.id])

    // Brought back at book two's second scene, and only from there: a facet not said there is still the opening's.
    await sayPerson(two.id, anna.id, t2.id, { isAlive: true, revived: true })
    expect((await at(two.id, t1.id)).people.find((p) => p.characterId === anna.id)?.isAlive).toBe(false)
    const second = (await at(two.id, t2.id)).people.find((p) => p.characterId === anna.id)
    expect(second).toMatchObject({ isAlive: true, statusNotes: 'tired' })
  })

  it('a correction in book one is in book two’s opening at once', async () => {
    const { two, anna, s2 } = await seriesOfTwo()
    await sayPerson((await db.events.get(s2.id))!.worldId, anna.id, s2.id, { isAlive: true })
    expect((await openingOf(two.id)).people.find((p) => p.characterId === anna.id)?.isAlive).toBe(true)
  })

  it('book three opens on book two’s end, which began where book one ended, through a book with no scenes', async () => {
    const { series, anna, bo } = await seriesOfTwo()
    const empty = await addBook(series.id, 'Interlude')
    const three = await addBook(series.id, 'Three')
    expect((await openingOf(empty.id)).people.map((p) => p.characterId).sort()).toEqual([anna.id, bo.id].sort())
    const o = await openingOf(three.id)
    expect(o.from?.id).toBe(empty.id)
    expect(o.people.find((p) => p.characterId === anna.id)?.isAlive).toBe(false)
  })

  it('a write in book two compares with the opening: saying what book one ended on adds nothing, saying a change does', async () => {
    const { two, anna, bo, t1 } = await seriesOfTwo()
    await sayPerson(two.id, bo.id, t1.id, { isAlive: true })
    await sayPerson(two.id, anna.id, t1.id, { isAlive: true })
    const stored = await db.characterSnapshots.where('worldId').equals(two.id).toArray()
    expect(stored.map((r) => [r.characterId, r.isAlive])).toEqual([[anna.id, true]])
  })

  it('a relationship’s state stays in its book: the opening carries none', async () => {
    const { two } = await seriesOfTwo()
    expect(Object.keys(await openingOf(two.id)).sort()).toEqual(['custody', 'from', 'items', 'people', 'places', 'regions'])
  })
})
