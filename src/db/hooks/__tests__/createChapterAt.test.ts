import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createChapterAt, createEvent } from '@/db/hooks/useTimeline'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { undoLast, redoLast } from '@/db/hooks/useOperations'
import { computeSortKey } from '@/lib/sortKey'

/**
 * A new chapter at a number the writer chose — against the real hooks, because
 * the claims are about what is written: which chapters move, whether the
 * snapshots in them follow, and whether one undo takes all of it back.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function seed(numbers: number[]) {
  const world = await createWorld({ name: 'W', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const chapters = []
  for (const n of numbers) {
    chapters.push(await createChapter({ worldId: world.id, timelineId: tl.id, number: n, title: `Was ${n}`, synopsis: '' }))
  }
  return { world, tl, chapters }
}

const numbering = async (timelineId: string) =>
  (await db.chapters.where('timelineId').equals(timelineId).sortBy('number')).map((c) => `${c.number}:${c.title}`)

describe('createChapterAt', () => {
  it('takes a free number and moves nobody', async () => {
    const { world, tl } = await seed([1, 2, 4])
    await db.operations.clear()
    await createChapterAt({ worldId: world.id, timelineId: tl.id, number: 3, title: 'New', synopsis: '' })
    expect(await numbering(tl.id)).toEqual(['1:Was 1', '2:Was 2', '3:New', '4:Was 4'])
    // Only the create: nothing that existed was rewritten.
    expect((await db.operations.toArray()).map((o) => `${o.entityType}:${o.type}`)).toEqual(['chapter:create'])
  })

  it('puts a chapter at a taken number and moves the run after it up to the gap', async () => {
    const { world, tl } = await seed([1, 2, 3, 5])
    await createChapterAt({ worldId: world.id, timelineId: tl.id, number: 2, title: 'New', synopsis: '' })
    expect(await numbering(tl.id)).toEqual(['1:Was 1', '2:New', '3:Was 2', '4:Was 3', '5:Was 5'])
  })

  it('takes 0 for a prologue, ahead of everything', async () => {
    const { world, tl } = await seed([1, 2])
    await createChapterAt({ worldId: world.id, timelineId: tl.id, number: 0, title: 'Prologue', synopsis: '' })
    expect(await numbering(tl.id)).toEqual(['0:Prologue', '1:Was 1', '2:Was 2'])
  })

  it('moves the snapshots in a moved chapter with it', async () => {
    const { world, tl, chapters } = await seed([1, 2])
    const ev = await createEvent({
      worldId: world.id, chapterId: chapters[1].id, timelineId: tl.id, title: 'In two', description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 1,
    })
    await db.characters.add({
      id: 'wren', worldId: world.id, name: 'Wren', description: '', aliases: [], tags: [],
      portraitImageId: null, isAlive: true, color: null, createdAt: 0, updatedAt: 0,
    } as never)
    await upsertSnapshot({
      worldId: world.id, characterId: 'wren', eventId: ev.id, currentLocationMarkerId: null,
      currentMapLayerId: null, inventoryItemIds: [], isAlive: true, statusNotes: 'here', travelModeId: null,
    } as never, { confirmUnchanged: true })
    const keyBefore = (await db.characterSnapshots.where('eventId').equals(ev.id).first())!.sortKey

    await createChapterAt({ worldId: world.id, timelineId: tl.id, number: 2, title: 'New', synopsis: '' })

    const snap = await db.characterSnapshots.where('eventId').equals(ev.id).first()
    expect(snap!.sortKey, 'the chapter moved, so its snapshot did').not.toBe(keyBefore)
    expect(snap!.sortKey).toBe(await computeSortKey(ev.id))

    // One undo takes the new chapter away, puts chapter 2 back at 2, and the
    // snapshot's stored key back with it.
    await undoLast(world.id)
    expect(await numbering(tl.id)).toEqual(['1:Was 1', '2:Was 2'])
    expect((await db.characterSnapshots.where('eventId').equals(ev.id).first())!.sortKey).toBe(keyBefore)

    await redoLast(world.id)
    expect(await numbering(tl.id)).toEqual(['1:Was 1', '2:New', '3:Was 2'])
    expect((await db.characterSnapshots.where('eventId').equals(ev.id).first())!.sortKey)
      .toBe(await computeSortKey(ev.id))
  })

  it('leaves another timeline’s chapters alone', async () => {
    const { world, tl } = await seed([1, 2])
    const other = await createTimeline({ worldId: world.id, name: 'Other', description: '', color: '#000' })
    await createChapter({ worldId: world.id, timelineId: other.id, number: 1, title: 'Elsewhere', synopsis: '' })
    await createChapterAt({ worldId: world.id, timelineId: tl.id, number: 1, title: 'New', synopsis: '' })
    expect(await numbering(other.id)).toEqual(['1:Elsewhere'])
  })
})
