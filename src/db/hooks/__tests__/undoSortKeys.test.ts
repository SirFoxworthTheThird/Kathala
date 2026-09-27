import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent, moveEventOnBoard } from '@/db/hooks/useTimeline'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { undoLast, redoLast } from '@/db/hooks/useOperations'
import { computeSortKey } from '@/lib/sortKey'

/**
 * A snapshot stores its position — chapter number plus the scene's place in
 * it — so that "last known state" can be read without joining. Every write that
 * moves a scene recomputes it. Undo did not: it put the scene back and left
 * every snapshot on it claiming the position it had been moved to.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function seed() {
  const world = await createWorld({ name: 'W', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const ch1 = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const ch2 = await createChapter({ worldId: world.id, timelineId: tl.id, number: 2, title: 'Two', synopsis: '' })
  const mk = (chapterId: string, title: string, sortOrder: number) => createEvent({
    worldId: world.id, chapterId, timelineId: tl.id, title, description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder,
  })
  await db.characters.add({
    id: 'wren', worldId: world.id, name: 'Wren', description: '', aliases: [], tags: [],
    portraitImageId: null, isAlive: true, color: null, createdAt: 0, updatedAt: 0,
  } as never)
  const snapAt = (eventId: string) => upsertSnapshot({
    worldId: world.id, characterId: 'wren', eventId,
    currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
    isAlive: true, statusNotes: `at ${eventId}`, travelModeId: null,
  } as never, { confirmUnchanged: true })
  return { world, ch1, ch2, mk, snapAt }
}

/** Every snapshot on `eventId` agrees with where the event is now. */
async function keysTrue(eventId: string) {
  const snaps = await db.characterSnapshots.where('eventId').equals(eventId).toArray()
  const want = await computeSortKey(eventId)
  return snaps.length > 0 && snaps.every((s) => s.sortKey === want)
}

describe('undo and redo keep stored positions true', () => {
  it('after a scene is moved to another chapter and back', async () => {
    const { world, ch1, ch2, mk, snapAt } = await seed()
    const a = await mk(ch1.id, 'A', 1)
    await mk(ch2.id, 'B', 1)
    await snapAt(a.id)

    await moveEventOnBoard(a.id, ch2.id, 1)
    expect(await keysTrue(a.id), 'the move itself rekeys').toBe(true)

    await undoLast(world.id)
    expect((await db.events.get(a.id))!.chapterId, 'undo put the scene back').toBe(ch1.id)
    expect(await keysTrue(a.id), 'and its snapshot says where it is again').toBe(true)

    await redoLast(world.id)
    expect((await db.events.get(a.id))!.chapterId).toBe(ch2.id)
    expect(await keysTrue(a.id), 'redo too').toBe(true)
  })
})
