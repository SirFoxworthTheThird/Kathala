import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createThreadForScene } from '@/db/hooks/usePlotThreads'
import { createMotifForScene } from '@/db/hooks/useMotifs'
import { THREAD_COLORS, MOTIF_COLORS } from '@/lib/tagColors'

/** A plot thread or motif made from a scene's own field: made, tagged on that scene, coloured in turn, and one undo step. */

const now = Date.now()

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.events.add({
    id: 'e1', worldId: 'w', chapterId: 'c1', timelineId: 'tl', title: 'The door', description: '', sortOrder: 1,
    tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
    threadIds: ['old'], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
    povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
  })
  await db.plotThreads.add({ id: 'old', worldId: 'w', name: 'The debt', description: '', color: THREAD_COLORS[0], createdAt: now, updatedAt: now })
})
afterAll(async () => { await db.delete() })

describe('made from a scene', () => {
  it('a thread: made in the next colour, tagged on the scene beside the ones it had, in one undo step', async () => {
    const made = await createThreadForScene('e1', 'The rebellion')
    expect(made).toMatchObject({ worldId: 'w', name: 'The rebellion', color: THREAD_COLORS[1] })
    expect((await db.events.get('e1'))?.threadIds).toEqual(['old', made!.id])
    const ops = await db.operations.toArray()
    expect(ops.map((o) => o.entityType).sort()).toEqual(['event', 'plotThread'])
    expect(new Set(ops.map((o) => o.groupId)).size).toBe(1)
    expect(ops[0].groupId).toBeTruthy()
  })

  it('a motif: the same', async () => {
    const made = await createMotifForScene('e1', 'Drowned bells')
    expect(made).toMatchObject({ worldId: 'w', name: 'Drowned bells', color: MOTIF_COLORS[0] })
    expect((await db.events.get('e1'))?.motifIds).toEqual([made!.id])
    const ops = await db.operations.toArray()
    expect(ops.map((o) => o.entityType).sort()).toEqual(['event', 'motif'])
    // One group, and a real one: with no group at all every id is undefined, which is also "one".
    expect(new Set(ops.map((o) => o.groupId)).size).toBe(1)
    expect(ops[0].groupId).toBeTruthy()
  })

  it('a scene that is gone makes nothing', async () => {
    expect(await createThreadForScene('nope', 'Lost')).toBeNull()
    expect(await db.plotThreads.count()).toBe(1)
  })
})
