import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { makeSeries, addBook } from '@/db/hooks/useSeries'
import { characterNamed, createCharacter } from '@/db/hooks/useCharacters'

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterAll(async () => { await db.delete() })

/*
  UX-1-6, D-7: book two of a series asked for "the first character", and Anna
  Brisk typed there made a second Anna beside the series' own.
*/
describe('characterNamed', () => {
  it('in a book of a series, a name its cast has is that person', async () => {
    const one = await createWorld({ name: 'The Salt Road', description: '' })
    const anna = await createCharacter({ worldId: one.id, name: 'Anna Brisk', description: '' })
    const series = await makeSeries(one.id, 'The Salt Books')
    const two = await addBook(series.id, 'The Second Road')

    const got = await characterNamed({ worldId: two.id, name: 'anna brisk', description: '' })
    expect(got).toMatchObject({ existing: true, character: { id: anna.id } })
    expect(await db.characters.count()).toBe(1)

    // A new name is a new person, in the series' cast.
    const tobin = await characterNamed({ worldId: two.id, name: 'Tobin', description: '' })
    expect(tobin.existing).toBe(false)
    expect(await db.characters.count()).toBe(2)
  })

  it('outside a series, two people may share a name', async () => {
    const w = await createWorld({ name: 'Alone', description: '' })
    await createCharacter({ worldId: w.id, name: 'Anna Brisk', description: '' })
    const got = await characterNamed({ worldId: w.id, name: 'Anna Brisk', description: '' })
    expect(got.existing).toBe(false)
    expect(await db.characters.count()).toBe(2)
  })
})
