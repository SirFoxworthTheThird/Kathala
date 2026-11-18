import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { createCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import { createItem, deleteItem } from '@/db/hooks/useItems'
import { createLocationMarker, deleteLocationMarker } from '@/db/hooks/useLocationMarkers'
import { createFaction } from '@/db/hooks/useFactions'
import { createTimeline, createChapter, createEvent, deleteEvent, moveSceneStep } from '@/db/hooks/useTimeline'
import { joinWithNext } from '@/db/hooks/useSceneStructure'
import { undoLast } from '@/db/hooks/useOperations'
import { makeSeries, addBook, joinOffers, joinSeries, leaveSeries } from '@/db/hooks/useSeries'
import { openingOf } from '@/db/hooks/useOpening'
import { createSequelWorld } from '@/db/hooks/useSequel'
import {
  addTemplate, createFieldDef, deleteFieldDef, fieldUse, reorderFieldDefs, sayFieldValue, setFixedValue, unsayFieldValue, updateFieldDef,
} from '@/db/hooks/useCustomFields'
import { applyWorldImport, importWorldFromJson, previewWorldMerge, serializeWorldForSync } from '@/lib/exportImport'
import { suggestedPairs } from '@/lib/seriesJoin'
import { fieldValueId } from '@/lib/customFields'
import type { WorldEvent } from '@/types'

/**
 * Custom fields in the store (issue #699): fields made, changed and deleted,
 * fixed values on the records and values over time at scenes, every write
 * checked and journalled; carried by a backup and a merge; gone with what they
 * are on; moved with a scene; and kept through a series, a book leaving one,
 * and a sequel.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function scenes(worldId: string, n: number): Promise<WorldEvent[]> {
  const tl = await createTimeline({ worldId, name: 'Main', description: '', color: '#888' })
  const ch = await createChapter({ worldId, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const out: WorldEvent[] = []
  for (let k = 0; k < n; k++) {
    out.push(await createEvent({ worldId, chapterId: ch.id, timelineId: tl.id, title: `S${k + 1}`, description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: k }))
  }
  return out
}

async function book(n = 3) {
  const world = await createWorld({ name: 'Ferry', description: '' })
  const s = await scenes(world.id, n)
  const anna = await createCharacter({ worldId: world.id, name: 'Anna', description: '' })
  const bo = await createCharacter({ worldId: world.id, name: 'Bo', description: '' })
  const ship = await createItem({ worldId: world.id, name: 'The Gull', description: '', iconType: 'other', tags: [] })
  const port = await createLocationMarker({ worldId: world.id, mapLayerId: null, name: 'Saltmouth', description: '', iconType: 'town' })
  const guild = await createFaction({ worldId: world.id, name: 'Guild', description: '', color: '#888', coverImageId: null, tags: [] } as never)
  return { world, s, anna, bo, ship, port, guild }
}

const valuesOf = async (defId: string) =>
  (await db.fieldValues.where('defId').equals(defId).toArray()).map((v) => [v.entityId, v.eventId, v.value]).sort((a, b) => String(a[1]).localeCompare(String(b[1])))

describe('a field', () => {
  it('is made after its kind’s others, its choices given ids, and a shape that cannot be is refused', async () => {
    const { world } = await book()
    const race = await createFieldDef(world.id, 'character', { name: ' Race ', type: 'choice', overTime: false, options: ['Elf', 'Dwarf'] })
    const magic = await createFieldDef(world.id, 'character', { name: 'Magic', type: 'text', overTime: false, unit: 'ignored' })
    const pop = await createFieldDef(world.id, 'place', { name: 'Population', type: 'number', overTime: false, unit: 'souls' })
    expect([race.name, race.order, magic.order, pop.order]).toEqual(['Race', 0, 1, 0])
    expect(race.options?.map((o) => o.label)).toEqual(['Elf', 'Dwarf'])
    expect(new Set(race.options?.map((o) => o.id)).size).toBe(2)
    expect(magic.unit).toBeUndefined()
    expect(pop.unit).toBe('souls')
    await expect(createFieldDef(world.id, 'character', { name: 'Race', type: 'choice', overTime: false, options: [] })).rejects.toThrow('A choice field needs its choices')
    await expect(createFieldDef(world.id, 'item', { name: 'Captain', type: 'link', overTime: true })).rejects.toThrow('A link field needs')

    await reorderFieldDefs([magic.id, race.id])
    expect((await db.customFieldDefs.get(magic.id))?.order).toBe(0)
    expect((await db.customFieldDefs.get(race.id))?.order).toBe(1)
    await undoLast(world.id)
    expect((await db.customFieldDefs.get(magic.id))?.order).toBe(1)
  })

  it('a template adds its fields once, as one undo', async () => {
    const { world } = await book()
    const made = await addTemplate(world.id, 'settlements')
    expect(made.map((d) => [d.name, d.kind, d.type, d.overTime])).toEqual([
      ['Population', 'place', 'number', false], ['Ruler', 'place', 'link', true], ['Founded', 'place', 'date', false],
    ])
    expect(made[1].linkKind).toBe('character')
    expect(await addTemplate(world.id, 'settlements')).toEqual([])
    expect(await db.customFieldDefs.count()).toBe(3)
    await undoLast(world.id)
    expect(await db.customFieldDefs.count()).toBe(0)
  })
})

describe('a fixed value', () => {
  it('is checked, kept on the record by field, cleared by an empty value, and one undo each', async () => {
    const { world, anna, guild } = await book()
    const race = await createFieldDef(world.id, 'character', { name: 'Race', type: 'choice', overTime: false, options: ['Elf', 'Dwarf'] })
    const sworn = await createFieldDef(world.id, 'character', { name: 'Sworn to', type: 'link', overTime: false, linkKind: 'faction' })
    const elf = race.options![0].id
    await setFixedValue(world.id, race.id, anna.id, elf)
    await setFixedValue(world.id, sworn.id, anna.id, guild.id)
    expect((await db.characters.get(anna.id))?.customValues).toEqual({ [race.id]: elf, [sworn.id]: guild.id })

    await expect(setFixedValue(world.id, race.id, anna.id, 'Elf')).rejects.toThrow('Race: that is not one of its choices.')
    await expect(setFixedValue(world.id, sworn.id, anna.id, 'no-such-faction')).rejects.toThrow('Sworn to: that is not one of the world’s records.')

    await setFixedValue(world.id, race.id, anna.id, '')
    expect((await db.characters.get(anna.id))?.customValues).toEqual({ [sworn.id]: guild.id })
    await undoLast(world.id)
    expect((await db.characters.get(anna.id))?.customValues?.[race.id]).toBe(elf)
    expect(await fieldUse(race.id)).toEqual({ fixed: 1, overTime: 0 })
  })

  it('is refused for a field over time, and a value over time for a fixed one', async () => {
    const { world, anna, s } = await book()
    const fixed = await createFieldDef(world.id, 'character', { name: 'Magic', type: 'text', overTime: false })
    const over = await createFieldDef(world.id, 'character', { name: 'Rank', type: 'text', overTime: true })
    await expect(setFixedValue(world.id, over.id, anna.id, 'Mate')).rejects.toThrow('Rank is over time')
    await expect(sayFieldValue(world.id, fixed.id, anna.id, s[0].id, 'Fire')).rejects.toThrow('Magic is fixed')
  })
})

describe('a value over time', () => {
  it('is said at a scene; a repeat of what holds is not written; null is said; and it can be taken back', async () => {
    const { world, anna, s } = await book()
    const rank = await createFieldDef(world.id, 'character', { name: 'Rank', type: 'text', overTime: true })
    await sayFieldValue(world.id, rank.id, anna.id, s[0].id, 'Mate')
    // The same at the next scene says nothing new there.
    await sayFieldValue(world.id, rank.id, anna.id, s[1].id, 'Mate')
    expect(await valuesOf(rank.id)).toEqual([[anna.id, s[0].id, 'Mate']])
    // Said again where it is said: changed there.
    await sayFieldValue(world.id, rank.id, anna.id, s[0].id, 'Bosun')
    await sayFieldValue(world.id, rank.id, anna.id, s[2].id, null)
    expect(await valuesOf(rank.id)).toEqual([[anna.id, s[0].id, 'Bosun'], [anna.id, s[2].id, null]].sort((a, b) => String(a[1]).localeCompare(String(b[1]))))
    expect((await db.fieldValues.get(fieldValueId(rank.id, anna.id, s[0].id)))?.sortKey).toBeTypeOf('number')

    await unsayFieldValue(rank.id, anna.id, s[2].id)
    expect(await valuesOf(rank.id)).toEqual([[anna.id, s[0].id, 'Bosun']])
    await undoLast(world.id)
    expect(await db.fieldValues.where('defId').equals(rank.id).count()).toBe(2)
    await expect(sayFieldValue(world.id, rank.id, anna.id, s[1].id, 'Two\nlines')).rejects.toThrow('one line')
  })

  it('goes with its scene, its entity and its world; moves with a join; and is rekeyed when its scene moves', async () => {
    const { world, anna, ship, port, s } = await book(4)
    const rank = await createFieldDef(world.id, 'character', { name: 'Rank', type: 'text', overTime: true })
    const crew = await createFieldDef(world.id, 'item', { name: 'Crew', type: 'number', overTime: true })
    const ruler = await createFieldDef(world.id, 'place', { name: 'Ruler', type: 'link', overTime: true, linkKind: 'character' })
    await sayFieldValue(world.id, rank.id, anna.id, s[0].id, 'Mate')
    await sayFieldValue(world.id, rank.id, anna.id, s[1].id, 'Bosun')
    await sayFieldValue(world.id, rank.id, anna.id, s[2].id, 'Captain')
    await sayFieldValue(world.id, crew.id, ship.id, s[0].id, 12)
    await sayFieldValue(world.id, ruler.id, port.id, s[0].id, anna.id)

    // A join keeps the later scene's word, on the joined scene.
    await joinWithNext(s[1].id)
    expect(await valuesOf(rank.id)).toEqual([[anna.id, s[0].id, 'Mate'], [anna.id, s[1].id, 'Captain']].sort((a, b) => String(a[1]).localeCompare(String(b[1]))))
    await undoLast(world.id)
    expect(await db.fieldValues.where('defId').equals(rank.id).count()).toBe(3)

    // Moving a scene rekeys what is said there.
    const before = (await db.fieldValues.get(fieldValueId(rank.id, anna.id, s[0].id)))!.sortKey
    await moveSceneStep(s[0].id, 'down')
    expect((await db.fieldValues.get(fieldValueId(rank.id, anna.id, s[0].id)))!.sortKey).toBeGreaterThan(before!)

    await deleteEvent(s[2].id)
    expect((await valuesOf(rank.id)).map((v) => v[2])).toEqual(expect.arrayContaining(['Mate', 'Bosun']))
    expect(await db.fieldValues.where('eventId').equals(s[2].id).count()).toBe(0)

    await deleteItem(ship.id)
    expect(await db.fieldValues.where('defId').equals(crew.id).count()).toBe(0)
    await deleteLocationMarker(port.id)
    expect(await db.fieldValues.where('defId').equals(ruler.id).count()).toBe(0)
    await deleteCharacter(anna.id)
    expect(await db.fieldValues.where('defId').equals(rank.id).count()).toBe(0)
    await undoLast(world.id)
    expect(await db.fieldValues.where('defId').equals(rank.id).count()).toBe(2)

    await deleteWorld(world.id)
    expect([await db.customFieldDefs.count(), await db.fieldValues.count()]).toEqual([0, 0])
  })
})

describe('a field changed or deleted', () => {
  it('changes its type only while it holds no values; a choice taken out leaves every value that picked it, in one undo', async () => {
    const { world, anna, bo, s } = await book()
    const race = await createFieldDef(world.id, 'character', { name: 'Race', type: 'choices', overTime: false, options: ['Elf', 'Dwarf'] })
    const [elf, dwarf] = race.options!.map((o) => o.id)
    const mood = await createFieldDef(world.id, 'character', { name: 'Mood', type: 'choice', overTime: true, options: ['Calm', 'Wild'] })
    const [calm, wild] = mood.options!.map((o) => o.id)

    await updateFieldDef(race.id, { type: 'text' })
    expect((await db.customFieldDefs.get(race.id))?.type).toBe('text')
    await updateFieldDef(race.id, { type: 'choices', options: ['Elf', 'Dwarf'] })
    const again = (await db.customFieldDefs.get(race.id))!
    const [elf2, dwarf2] = again.options!.map((o) => o.id)
    void elf; void dwarf
    await setFixedValue(world.id, race.id, anna.id, [elf2, dwarf2])
    await setFixedValue(world.id, race.id, bo.id, [dwarf2])
    await expect(updateFieldDef(race.id, { type: 'text' })).rejects.toThrow('Race holds values')
    await expect(updateFieldDef(race.id, { overTime: true })).rejects.toThrow('Race holds values')
    // Renaming a choice keeps every value.
    await updateFieldDef(race.id, { options: [{ id: elf2, label: 'Wood elf' }, { id: dwarf2, label: 'Dwarf' }] })
    expect((await db.characters.get(anna.id))?.customValues?.[race.id]).toEqual([elf2, dwarf2])

    await sayFieldValue(world.id, mood.id, anna.id, s[0].id, wild)
    await sayFieldValue(world.id, mood.id, anna.id, s[1].id, calm)
    await updateFieldDef(race.id, { options: [{ id: elf2, label: 'Wood elf' }] })
    await updateFieldDef(mood.id, { options: [{ id: calm, label: 'Calm' }] })
    expect((await db.characters.get(anna.id))?.customValues?.[race.id]).toEqual([elf2])
    expect((await db.characters.get(bo.id))?.customValues).toBeUndefined()
    expect((await valuesOf(mood.id)).map((v) => v[2]).sort()).toEqual([calm, null].sort())
    await undoLast(world.id)
    expect((await valuesOf(mood.id)).map((v) => v[2]).sort()).toEqual([calm, wild].sort())
    await undoLast(world.id)
    expect((await db.characters.get(bo.id))?.customValues?.[race.id]).toEqual([dwarf2])
  })

  it('deleted, takes every value with it, says how many first, and one undo brings it all back', async () => {
    const { world, anna, bo, s } = await book()
    const rank = await createFieldDef(world.id, 'character', { name: 'Rank', type: 'text', overTime: true })
    const magic = await createFieldDef(world.id, 'character', { name: 'Magic', type: 'text', overTime: false })
    await setFixedValue(world.id, magic.id, anna.id, 'Fire')
    await setFixedValue(world.id, magic.id, bo.id, 'Frost')
    await sayFieldValue(world.id, rank.id, anna.id, s[0].id, 'Mate')
    await sayFieldValue(world.id, rank.id, bo.id, s[1].id, 'Cook')
    expect(await fieldUse(magic.id)).toEqual({ fixed: 2, overTime: 0 })
    expect(await fieldUse(rank.id)).toEqual({ fixed: 0, overTime: 2 })

    await deleteFieldDef(rank.id)
    await deleteFieldDef(magic.id)
    expect([await db.customFieldDefs.count(), await db.fieldValues.count()]).toEqual([0, 0])
    expect((await db.characters.get(anna.id))?.customValues).toBeUndefined()
    expect(await db.tombstones.where('entityType').equals('fieldValue').count()).toBe(2)
    expect(await db.tombstones.where('entityType').equals('customFieldDef').count()).toBe(2)

    await undoLast(world.id)
    expect((await db.characters.get(bo.id))?.customValues).toEqual({ [magic.id]: 'Frost' })
    await undoLast(world.id)
    expect(await valuesOf(rank.id)).toEqual([[anna.id, s[0].id, 'Mate'], [bo.id, s[1].id, 'Cook']].sort((a, b) => String(a[1]).localeCompare(String(b[1]))))
  })
})

describe('custom fields in a backup', () => {
  it('travel in the file; a file without them imports as none', async () => {
    const { world, anna, s } = await book()
    const rank = await createFieldDef(world.id, 'character', { name: 'Rank', type: 'text', overTime: true })
    const magic = await createFieldDef(world.id, 'character', { name: 'Magic', type: 'text', overTime: false })
    await setFixedValue(world.id, magic.id, anna.id, 'Fire')
    await sayFieldValue(world.id, rank.id, anna.id, s[0].id, 'Mate')
    const exported = JSON.parse(await serializeWorldForSync(world.id))
    expect(exported.version).toBe(22)
    expect(exported.customFieldDefs.map((d: { name: string }) => d.name).sort()).toEqual(['Magic', 'Rank'])
    expect(exported.fieldValues).toHaveLength(1)

    await deleteWorld(world.id)
    await importWorldFromJson(JSON.stringify(exported))
    expect((await db.characters.get(anna.id))?.customValues).toEqual({ [magic.id]: 'Fire' })
    expect(await valuesOf(rank.id)).toEqual([[anna.id, s[0].id, 'Mate']])

    const older = { ...exported, version: 21 }
    delete older.customFieldDefs
    delete older.fieldValues
    await importWorldFromJson(JSON.stringify(older))
    expect([await db.customFieldDefs.count(), await db.fieldValues.count()]).toEqual([0, 0])
    await expect(importWorldFromJson(JSON.stringify({ ...exported, fieldValues: {} }))).rejects.toThrow('fieldValues is not an array')
  })

  it('merge: a value said there arrives, and a field deleted here is not brought back with its values', async () => {
    const { world, anna, bo, s } = await book()
    const rank = await createFieldDef(world.id, 'character', { name: 'Rank', type: 'text', overTime: true })
    const gone = await createFieldDef(world.id, 'character', { name: 'Gone', type: 'text', overTime: true })
    await sayFieldValue(world.id, rank.id, anna.id, s[0].id, 'Mate')
    await sayFieldValue(world.id, gone.id, anna.id, s[0].id, 'x')
    const theirs = JSON.parse(await serializeWorldForSync(world.id))
    const said = { ...theirs.fieldValues.find((v: { defId: string }) => v.defId === rank.id), id: fieldValueId(rank.id, bo.id, s[1].id), entityId: bo.id, eventId: s[1].id, value: 'Cook' }
    theirs.fieldValues.push(said)
    await deleteFieldDef(gone.id)

    await applyWorldImport((await previewWorldMerge(JSON.stringify(theirs))).parsed, 'merge')
    expect(await db.customFieldDefs.get(gone.id)).toBeUndefined()
    expect(await db.fieldValues.where('defId').equals(gone.id).count()).toBe(0)
    expect(await valuesOf(rank.id)).toEqual([[anna.id, s[0].id, 'Mate'], [bo.id, s[1].id, 'Cook']].sort((a, b) => String(a[1]).localeCompare(String(b[1]))))
  })
})

describe('custom fields in a series', () => {
  it('are the series’; values over time are each book’s, and the next book opens on the last one’s', async () => {
    const { world: one, anna, s } = await book()
    const rank = await createFieldDef(one.id, 'character', { name: 'Rank', type: 'text', overTime: true })
    await sayFieldValue(one.id, rank.id, anna.id, s[0].id, 'Mate')
    await sayFieldValue(one.id, rank.id, anna.id, s[2].id, 'Captain')
    const series = await makeSeries(one.id, 'Saltmouth')
    expect((await db.customFieldDefs.get(rank.id))?.worldId).toBe(series.id)
    expect((await db.fieldValues.toArray()).every((v) => v.worldId === one.id)).toBe(true)

    const two = await addBook(series.id, 'Two')
    // A field made in the second book is the series' too.
    const made = await createFieldDef(two.id, 'character', { name: 'Ship', type: 'text', overTime: false })
    expect(made.worldId).toBe(series.id)
    const opening = await openingOf(two.id)
    expect(opening.fields.map((f) => [f.defId, f.entityId, f.value])).toEqual([[rank.id, anna.id, 'Captain']])
    // Cleared at the end of book one: book two opens on nothing.
    await sayFieldValue(one.id, rank.id, anna.id, s[2].id, null)
    expect((await openingOf(two.id)).fields).toEqual([])

    // Deleting the field reaches every book's values.
    await deleteFieldDef(rank.id)
    expect(await db.fieldValues.count()).toBe(0)
  })

  it('a book leaving takes its own copy of each field, its values pointed at the copies', async () => {
    const { world: one, anna, s } = await book()
    const rank = await createFieldDef(one.id, 'character', { name: 'Rank', type: 'text', overTime: true })
    const magic = await createFieldDef(one.id, 'character', { name: 'Magic', type: 'text', overTime: false })
    await setFixedValue(one.id, magic.id, anna.id, 'Fire')
    await sayFieldValue(one.id, rank.id, anna.id, s[0].id, 'Mate')
    const series = await makeSeries(one.id, 'Saltmouth')
    await addBook(series.id, 'Two')
    await leaveSeries(one.id)

    const mine = await db.customFieldDefs.where('worldId').equals(one.id).toArray()
    expect(mine.map((d) => d.name).sort()).toEqual(['Magic', 'Rank'])
    const myMagic = mine.find((d) => d.name === 'Magic')!
    const myRank = mine.find((d) => d.name === 'Rank')!
    expect(myMagic.id).not.toBe(magic.id)
    const myAnna = (await db.characters.where('worldId').equals(one.id).toArray()).find((c) => c.name === 'Anna')!
    expect(myAnna.customValues).toEqual({ [myMagic.id]: 'Fire' })
    expect((await db.fieldValues.where('worldId').equals(one.id).toArray()).map((v) => [v.defId, v.entityId, v.value])).toEqual([[myRank.id, myAnna.id, 'Mate']])
  })

  it('a sequel joining a series brings what its copies say, pointed at the series’ records', async () => {
    const { world: one, anna, bo, s, guild } = await book()
    const sworn = await createFieldDef(one.id, 'character', { name: 'Sworn to', type: 'link', overTime: false, linkKind: 'faction' })
    await setFixedValue(one.id, sworn.id, bo.id, guild.id)
    void anna; void s
    const twoId = await createSequelWorld(one.id, { characterIds: [anna.id, bo.id], itemIds: [], factionIds: [guild.id], mapLayerIds: [] }, { name: 'Two' })
    const series = await makeSeries(one.id, 'Saltmouth')
    await joinSeries(twoId, series.id, suggestedPairs(await joinOffers(twoId, series.id)))
    // Bo is the series' own Bo again, and still says he is sworn to the Guild: the series' Guild, through the sequel's field.
    const values = (await db.characters.get(bo.id))?.customValues ?? {}
    expect(Object.values(values)).toEqual(expect.arrayContaining([guild.id, guild.id]))
    expect(Object.keys(values)).toHaveLength(2)
  })
})

describe('custom fields in a sequel', () => {
  it('come under new ids; values come with what they are on, and a link only where what it names came too', async () => {
    const { world: one, anna, bo, ship, guild, s } = await book()
    const race = await createFieldDef(one.id, 'character', { name: 'Race', type: 'choice', overTime: false, options: ['Elf'] })
    const sworn = await createFieldDef(one.id, 'character', { name: 'Sworn to', type: 'link', overTime: false, linkKind: 'faction' })
    const rank = await createFieldDef(one.id, 'character', { name: 'Rank', type: 'text', overTime: true })
    const captain = await createFieldDef(one.id, 'item', { name: 'Captain', type: 'link', overTime: true, linkKind: 'character' })
    await setFixedValue(one.id, race.id, anna.id, race.options![0].id)
    await setFixedValue(one.id, sworn.id, anna.id, guild.id)
    await sayFieldValue(one.id, rank.id, anna.id, s[0].id, 'Mate')
    await sayFieldValue(one.id, rank.id, anna.id, s[2].id, 'Captain')
    await sayFieldValue(one.id, rank.id, bo.id, s[0].id, 'Cook')
    await sayFieldValue(one.id, rank.id, bo.id, s[1].id, null)
    await sayFieldValue(one.id, captain.id, ship.id, s[0].id, bo.id)

    // Anna and the ship come; Bo and the Guild do not.
    const twoId = await createSequelWorld(one.id, { characterIds: [anna.id], itemIds: [ship.id], factionIds: [], mapLayerIds: [] }, { name: 'Two', seedOpeningChapter: true })
    const defs = await db.customFieldDefs.where('worldId').equals(twoId).toArray()
    expect(defs.map((d) => d.name).sort()).toEqual(['Captain', 'Race', 'Rank', 'Sworn to'])
    expect(defs.some((d) => [race.id, sworn.id, rank.id, captain.id].includes(d.id))).toBe(false)
    const newRace = defs.find((d) => d.name === 'Race')!
    const newRank = defs.find((d) => d.name === 'Rank')!
    const newAnna = (await db.characters.where('worldId').equals(twoId).first())!
    // The choice keeps its option; the link to a Guild left behind is not carried.
    expect(newAnna.customValues).toEqual({ [newRace.id]: newRace.options![0].id })
    // Over time: Anna opens as she ended; Bo did not come, and the ship's captain, Bo, does not either.
    const opening = (await db.events.where('worldId').equals(twoId).first())!
    expect((await db.fieldValues.where('worldId').equals(twoId).toArray()).map((v) => [v.defId, v.entityId, v.eventId, v.value])).toEqual([[newRank.id, newAnna.id, opening.id, 'Captain']])
  })
})
