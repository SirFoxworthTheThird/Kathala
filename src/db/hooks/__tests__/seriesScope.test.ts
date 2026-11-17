import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createCharacter, updateCharacter } from '@/db/hooks/useCharacters'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { makeSeries, addBook, appearancesIn } from '@/db/hooks/useSeries'
import { sayPerson } from '@/db/hooks/useSnapshots'
import { collectWorldData } from '@/lib/exportImport'

/*
  Part 4 of the series bible (issue #698): where each shared person appears,
  read across the books, and a book's export without what is kept to another.
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

/** Book one with Anna in a scene; book two with Anna and Cara, Cara made there; Bo in no scene. */
async function twoBooks() {
  const one = await createWorld({ name: 'The Salt Road', description: '' })
  const anna = await createCharacter({ worldId: one.id, name: 'Anna', description: '' })
  const bo = await createCharacter({ worldId: one.id, name: 'Bo', description: '' })
  await scene(one.id, [anna.id])
  const series = await makeSeries(one.id, 'The Salt Books')
  const two = await addBook(series.id, 'The Second Road')
  const cara = await createCharacter({ worldId: two.id, name: 'Cara', description: '' })
  await scene(two.id, [anna.id, cara.id])
  return { one, two, series, anna, bo, cara }
}

describe('where each shared person appears', () => {
  it('book by book, in reading order; one in no scene has no appearances', async () => {
    const { one, two, series, anna, bo, cara } = await twoBooks()
    // Dan is in no scene's cast in book two, but a state of his is recorded at its scene: that is an appearance too.
    const dan = await createCharacter({ worldId: two.id, name: 'Dan', description: '' })
    const [twoScene] = await db.events.where('worldId').equals(two.id).toArray()
    await sayPerson(two.id, dan.id, twoScene.id, { isAlive: false }, { says: ['alive'] })
    const all = await appearancesIn(series.id)
    expect(all.get(dan.id)?.map((a) => [a.bookName, a.scenes])).toEqual([['The Second Road', 1]])
    expect(all.get(anna.id)?.map((a) => [a.bookId, a.scenes])).toEqual([[one.id, 1], [two.id, 1]])
    expect(all.get(cara.id)?.map((a) => a.bookName)).toEqual(['The Second Road'])
    expect(all.has(bo.id)).toBe(false)
  })
})

describe('a book’s export, with one kept to another book', () => {
  it('book one goes out without Cara, kept to book two, nor her relationship; book two goes out with her, unmarked', async () => {
    const { one, two, anna, cara } = await twoBooks()
    await updateCharacter(cara.id, { onlyInBook: two.id })
    await db.relationships.add({ id: 'r1', worldId: one.id, characterAId: anna.id, characterBId: cara.id, label: 'friends', strength: 'moderate', sentiment: 'positive', description: '', isBidirectional: true, startEventId: null, createdAt: 0, updatedAt: 0 } as never)

    const fromOne = await collectWorldData(one.id)
    expect(fromOne.characters.map((c) => c.name).sort()).toEqual(['Anna', 'Bo'])
    expect(fromOne.relationships).toEqual([])

    const fromTwo = await collectWorldData(two.id)
    expect(fromTwo.characters.map((c) => c.name).sort()).toEqual(['Anna', 'Bo', 'Cara'])
    expect(fromTwo.relationships).toHaveLength(1)
    // The file is a book on its own: the mark means nothing outside the series.
    expect(fromTwo.characters.find((c) => c.name === 'Cara')).not.toHaveProperty('onlyInBook')
  })
})
