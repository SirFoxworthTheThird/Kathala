import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import {
  createTimeline, createChapter, createEvent, moveEventOnBoard,
} from '@/db/hooks/useTimeline'

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
  const mk = async (chapterId: string, title: string, sortOrder: number) =>
    createEvent({
      worldId: world.id, chapterId, timelineId: tl.id, title, description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder,
    })
  return { world, tl, ch1, ch2, mk }
}

async function orderOf(chapterId: string): Promise<string[]> {
  const events = await db.events.where('chapterId').equals(chapterId).toArray()
  return events.sort((a, b) => a.sortOrder - b.sortOrder).map((e) => e.title)
}

describe('moveEventOnBoard', () => {
  it('reorders cards within a chapter by moving one row, not renumbering the column', async () => {
    const { ch1, mk } = await seed()
    await mk(ch1.id, 'A', 0)
    await mk(ch1.id, 'B', 1)
    const c = await mk(ch1.id, 'C', 2)

    await db.operations.clear()
    await moveEventOnBoard(c.id, ch1.id, 0)
    expect(await orderOf(ch1.id)).toEqual(['C', 'A', 'B'])

    // The point of fractional positions: A and B were not touched, so another
    // device's moves cannot be overwritten by this one. Positions are no longer
    // contiguous — only distinct and increasing, which is all ordering needs.
    const touched = new Set((await db.operations.where('entityType').equals('event').toArray())
      .map((o) => o.entityId))
    expect([...touched]).toEqual([c.id])

    const sorts = (await db.events.where('chapterId').equals(ch1.id).toArray())
      .map((e) => e.sortOrder).sort((a, b) => a - b)
    expect(new Set(sorts).size).toBe(sorts.length)
  })

  it('moves a card to another chapter at a given index and renumbers both', async () => {
    const { ch1, ch2, mk } = await seed()
    const a = await mk(ch1.id, 'A', 0)
    await mk(ch1.id, 'B', 1)
    await mk(ch2.id, 'X', 0)
    await mk(ch2.id, 'Y', 1)

    // Move A from ch1 into ch2 between X and Y.
    await moveEventOnBoard(a.id, ch2.id, 1)

    expect(await orderOf(ch1.id)).toEqual(['B'])
    expect(await orderOf(ch2.id)).toEqual(['X', 'A', 'Y'])

    const moved = (await db.events.get(a.id))!
    expect(moved.chapterId).toBe(ch2.id)

    // The source column is deliberately left alone. Taking a card out from
    // between two positions leaves the rest in order, so there is no gap to
    // close — and not writing those rows is what keeps a concurrent reorder
    // over there from being clobbered by a move over here.
    const b = (await db.events.where('chapterId').equals(ch1.id).first())!
    expect(b.sortOrder).toBe(1)
  })

  it('updates snapshot sortKeys when a card changes chapter', async () => {
    const { world, ch1, ch2, mk } = await seed()
    const a = await mk(ch1.id, 'A', 0)
    // A character snapshot on event A; sortKey ≈ chapter.number + sortOrder/1e6.
    await db.characterSnapshots.add({
      id: 'snap1', worldId: world.id, characterId: 'c1', eventId: a.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      sortKey: 1, createdAt: 0, updatedAt: 0,
    })

    await moveEventOnBoard(a.id, ch2.id, 0)

    const snap = (await db.characterSnapshots.get('snap1'))!
    // Chapter 2 → sortKey should now be ~2 (was ~1).
    expect(snap.sortKey).toBeGreaterThanOrEqual(2)
    expect(snap.sortKey).toBeLessThan(3)
  })
})
