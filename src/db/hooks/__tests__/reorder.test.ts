import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent, moveChapterTo, moveSceneStep } from '@/db/hooks/useTimeline'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { undoLast } from '@/db/hooks/useOperations'
import { computeSortKey } from '@/lib/sortKey'
import { compareByPosition } from '@/lib/fractionalOrder'

/**
 * Moving chapters and scenes — against the real hooks, because the claims are
 * about what is written: which numbers and positions change, whether the
 * snapshots follow, and whether one undo takes it all back.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function seed(numbers: number[], scenesPer: Record<number, string[]> = {}) {
  const world = await createWorld({ name: 'W', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const chapters = []
  const scenes: Record<string, string> = {}
  for (const n of numbers) {
    const c = await createChapter({ worldId: world.id, timelineId: tl.id, number: n, title: `Was ${n}`, synopsis: '' })
    chapters.push(c)
    let i = 0
    for (const title of scenesPer[n] ?? []) {
      const e = await createEvent({
        worldId: world.id, chapterId: c.id, timelineId: tl.id, title, description: '',
        locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: ++i,
      })
      scenes[title] = e.id
    }
  }
  return { world, tl, chapters, scenes }
}

const numbering = async (timelineId: string) =>
  (await db.chapters.where('timelineId').equals(timelineId).sortBy('number')).map((c) => `${c.number}:${c.title}`)

/** Every chapter's scenes, in order: "Was 1: a b | Was 2: c". */
const book = async (timelineId: string) => {
  const chapters = await db.chapters.where('timelineId').equals(timelineId).sortBy('number')
  const parts = []
  for (const c of chapters) {
    const scenes = (await db.events.where('chapterId').equals(c.id).toArray()).sort(compareByPosition)
    parts.push(`${c.title}: ${scenes.map((e) => e.title).join(' ')}`.trim())
  }
  return parts.join(' | ')
}

async function withSnapshot(worldId: string, eventId: string) {
  await db.characters.add({
    id: 'wren', worldId, name: 'Wren', description: '', aliases: [], tags: [],
    portraitImageId: null, isAlive: true, color: null, createdAt: 0, updatedAt: 0,
  } as never)
  await upsertSnapshot({
    worldId, characterId: 'wren', eventId, currentLocationMarkerId: null,
    currentMapLayerId: null, inventoryItemIds: [], isAlive: true, statusNotes: 'here', travelModeId: null,
  } as never, { confirmUnchanged: true })
  return (await db.characterSnapshots.where('eventId').equals(eventId).first())!.sortKey
}

describe('moveChapterTo', () => {
  it('moves a chapter and renumbers only the run it passes, keeping the gap', async () => {
    const { tl, chapters } = await seed([1, 2, 4, 5])
    expect(await moveChapterTo(chapters[3].id, 0)).toBe(true)
    expect(await numbering(tl.id)).toEqual(['1:Was 5', '2:Was 1', '4:Was 2', '5:Was 4'])
  })

  it('carries the snapshots in every renumbered chapter, and one undo puts it all back', async () => {
    const { world, tl, chapters, scenes } = await seed([1, 2], { 2: ['in two'] })
    const keyBefore = await withSnapshot(world.id, scenes['in two'])

    await moveChapterTo(chapters[1].id, 0)
    const after = (await db.characterSnapshots.where('eventId').equals(scenes['in two']).first())!.sortKey
    expect(after, 'the chapter is first now, so its snapshot is earlier').toBeLessThan(keyBefore!)
    expect(after).toBe(await computeSortKey(scenes['in two']))

    await undoLast(world.id)
    expect(await numbering(tl.id)).toEqual(['1:Was 1', '2:Was 2'])
    expect((await db.characterSnapshots.where('eventId').equals(scenes['in two']).first())!.sortKey).toBe(keyBefore)
  })

  it('writes nothing for a move to where it already is', async () => {
    const { chapters } = await seed([1, 2, 3])
    await db.operations.clear()
    expect(await moveChapterTo(chapters[1].id, 1)).toBe(false)
    expect(await db.operations.count()).toBe(0)
  })

  it('leaves another timeline alone', async () => {
    const { world, chapters } = await seed([1, 2])
    const other = await createTimeline({ worldId: world.id, name: 'Other', description: '', color: '#000' })
    await createChapter({ worldId: world.id, timelineId: other.id, number: 1, title: 'Elsewhere', synopsis: '' })
    await moveChapterTo(chapters[1].id, 0)
    expect(await numbering(other.id)).toEqual(['1:Elsewhere'])
  })
})

describe('moveSceneStep', () => {
  it('steps past a neighbour within the chapter', async () => {
    const { tl, scenes } = await seed([1], { 1: ['a', 'b', 'c'] })
    expect(await moveSceneStep(scenes.a, 'down')).toBe(true)
    expect(await book(tl.id)).toBe('Was 1: b a c')
    expect(await moveSceneStep(scenes.c, 'up')).toBe(true)
    expect(await book(tl.id)).toBe('Was 1: b c a')
  })

  it('crosses into the chapter before or after, by number, at the edges', async () => {
    const { tl, scenes } = await seed([1, 3], { 1: ['a', 'b'], 3: ['c'] })
    await moveSceneStep(scenes.b, 'down')
    expect(await book(tl.id)).toBe('Was 1: a | Was 3: b c')
    await moveSceneStep(scenes.b, 'up')
    expect(await book(tl.id)).toBe('Was 1: a b | Was 3: c')
  })

  it('goes nowhere from the first or last scene of the book, and writes nothing', async () => {
    const { scenes } = await seed([1, 2], { 1: ['a'], 2: ['b'] })
    await db.operations.clear()
    expect(await moveSceneStep(scenes.a, 'up')).toBe(false)
    expect(await moveSceneStep(scenes.b, 'down')).toBe(false)
    expect(await db.operations.count()).toBe(0)
  })

  it('moves past a neighbour that shares its position', async () => {
    const { tl, scenes } = await seed([1], { 1: ['a', 'b'] })
    // Older data can hold ties; a swap of two equal numbers would change nothing.
    await db.events.update(scenes.b, { sortOrder: 1 })
    const [first, second] = (await db.events.where('chapterId').equals((await db.events.get(scenes.a))!.chapterId).toArray())
      .sort(compareByPosition)
    await moveSceneStep(first.id, 'down')
    const order = (await book(tl.id)).replace('Was 1: ', '').split(' ')
    expect(order).toEqual([second.title, first.title])
  })

  it('is one undo, across a chapter boundary too', async () => {
    const { world, tl, scenes } = await seed([1, 2], { 1: ['a', 'b'], 2: ['c'] })
    await moveSceneStep(scenes.b, 'down')
    await undoLast(world.id)
    expect(await book(tl.id)).toBe('Was 1: a b | Was 2: c')
  })
})
