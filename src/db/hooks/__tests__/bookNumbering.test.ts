import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createChapterAt, createEvent, moveChapterTo, numberChaptersAsOneBook } from '@/db/hooks/useTimeline'
import { startChapter } from '@/db/hooks/useSceneStructure'
import { undoLast } from '@/db/hooks/useOperations'

/**
 * One book, one numbering (docs/records/chapter-numbering-plan.md), against the
 * real hooks: which chapters move, in which timelines, and what one undo takes back.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterAll(async () => { await db.delete() })

/** A braid: era A's chapters 1 and 3, era B's 2 and 4, each with two scenes. */
async function braid(numbers: Record<string, Array<[string, number]>> = { A: [['A1', 1], ['A3', 3]], B: [['B2', 2], ['B4', 4]] }) {
  const world = await createWorld({ name: 'W', description: '' })
  const ids: Record<string, string> = {}
  const timelines: Record<string, string> = {}
  for (const [name, chapters] of Object.entries(numbers)) {
    const tl = await createTimeline({ worldId: world.id, name, description: '', color: '#fff' })
    timelines[name] = tl.id
    for (const [title, number] of chapters) {
      const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number, title, synopsis: '' })
      ids[title] = ch.id
      for (const s of ['x', 'y']) {
        const ev = await createEvent({ worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: `${title}${s}`, description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: s === 'x' ? 0 : 1, travelDays: null })
        ids[`${title}${s}`] = ev.id
      }
    }
  }
  return { world, ids, timelines }
}

const book = async (worldId: string) =>
  (await db.chapters.where('worldId').equals(worldId).sortBy('number')).map((c) => `${c.number}:${c.title}`)

describe('the book is numbered, not the timeline', () => {
  it('a chapter put at a taken number moves the book’s chapters after it up, in every timeline', async () => {
    const { world, timelines } = await braid()
    await createChapterAt({ worldId: world.id, timelineId: timelines.A, number: 2, title: 'New', synopsis: '' })
    expect(await book(world.id)).toEqual(['1:A1', '2:New', '3:B2', '4:A3', '5:B4'])
  })

  it('# after the last scene of a timeline’s last chapter goes at the end of the book', async () => {
    const { world, ids } = await braid()
    await startChapter({ chapterId: ids.A3, afterSceneId: ids.A3y, title: 'Next of A' })
    expect(await book(world.id)).toEqual(['1:A1', '2:B2', '3:A3', '4:B4', '5:Next of A'])
  })

  it('# anywhere else goes straight after the chapter it is typed in, and the book after it moves up', async () => {
    const { world, ids } = await braid()
    // After the last scene of A's first chapter, which is not A's last: straight after it.
    await startChapter({ chapterId: ids.A1, afterSceneId: ids.A1y, title: 'After A1' })
    expect(await book(world.id)).toEqual(['1:A1', '2:After A1', '3:B2', '4:A3', '5:B4'])
  })

  it('# in the middle of a timeline’s last chapter splits it, and the new chapter reads next to it', async () => {
    const { world, ids } = await braid()
    await startChapter({ chapterId: ids.A3, afterSceneId: ids.A3x, title: 'Rest of A3' })
    expect(await book(world.id)).toEqual(['1:A1', '2:B2', '3:A3', '4:Rest of A3', '5:B4'])
  })

  it('moving a chapter within its timeline leaves the other timelines’ numbers alone', async () => {
    const { world, ids } = await braid()
    await moveChapterTo(ids.A3, 0)
    expect(await book(world.id)).toEqual(['1:A3', '2:B2', '3:A1', '4:B4'])
  })
})

describe('numbering a book numbered per timeline as one', () => {
  it('in the order it reads now, ties in tab order; one undo puts it back', async () => {
    const { world, timelines } = await braid({ A: [['A1', 1], ['A2', 2]], B: [['B1', 1], ['B2', 2]] })
    const tabs = (await db.timelines.where('worldId').equals(world.id).toArray()).map((t) => t.id)
    const [first, second] = tabs[0] === timelines.A ? ['A', 'B'] : ['B', 'A']
    expect(await numberChaptersAsOneBook(world.id)).toBe(3)
    expect(await book(world.id)).toEqual([`1:${first}1`, `2:${second}1`, `3:${first}2`, `4:${second}2`])
    // A book numbered once has nothing to do.
    expect(await numberChaptersAsOneBook(world.id)).toBe(0)
    await undoLast(world.id)
    expect((await book(world.id)).sort()).toEqual(['1:A1', '1:B1', '2:A2', '2:B2'])
  })
})
