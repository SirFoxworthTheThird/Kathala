import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { createWorld, updateWorld } from '@/db/hooks/useWorlds'
import { createCharacter } from '@/db/hooks/useCharacters'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { makeSeries, addBook } from '@/db/hooks/useSeries'
import { metEarlier } from '@/db/hooks/useReading'

/*
  Reading mode in a series (issue #698, D-3): what a reader of a later book has
  already met, by the books before it, according to what they said.
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

/** Book one meets Anna; book two meets Bo; book three meets Cara. */
async function threeBooks() {
  const one = await createWorld({ name: 'One', description: '' })
  const anna = await createCharacter({ worldId: one.id, name: 'Anna', description: '' })
  const bo = await createCharacter({ worldId: one.id, name: 'Bo', description: '' })
  const cara = await createCharacter({ worldId: one.id, name: 'Cara', description: '' })
  await scene(one.id, [anna.id])
  const series = await makeSeries(one.id, 'S')
  const two = await addBook(series.id, 'Two')
  await scene(two.id, [bo.id])
  const three = await addBook(series.id, 'Three')
  await scene(three.id, [cara.id])
  return { one, two, three, anna, bo, cara }
}

describe('what the earlier books met', () => {
  it('for book three, everything books one and two met, while the reader has not said, and when they say they have read them', async () => {
    const { three, anna, bo, cara } = await threeBooks()
    expect((await metEarlier(three.id)).sort()).toEqual([anna.id, bo.id].sort())
    await updateWorld(three.id, { readEarlierBooks: true })
    expect((await metEarlier(three.id)).sort()).toEqual([anna.id, bo.id].sort())
    // Book three's own meetings are its own, not the earlier books'.
    expect(await metEarlier(three.id)).not.toContain(cara.id)
  })

  it('nothing, when the reader says they have not read them', async () => {
    const { three } = await threeBooks()
    await updateWorld(three.id, { readEarlierBooks: false })
    expect(await metEarlier(three.id)).toEqual([])
  })

  it('only the books before: book two has met what book one met, not what book three did', async () => {
    const { two, anna } = await threeBooks()
    expect(await metEarlier(two.id)).toEqual([anna.id])
  })

  it('nothing for a first book, or a book on its own', async () => {
    const { one } = await threeBooks()
    expect(await metEarlier(one.id)).toEqual([])
    const alone = await createWorld({ name: 'Alone', description: '' })
    expect(await metEarlier(alone.id)).toEqual([])
  })
})
