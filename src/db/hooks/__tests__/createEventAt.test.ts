import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent, createEventAt } from '@/db/hooks/useTimeline'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { undoLast } from '@/db/hooks/useOperations'
import { computeSortKey } from '@/lib/sortKey'

/**
 * The binder's Enter: a new scene on the line below the row you are on.
 *
 * Against the real hooks and a real (fake) IndexedDB, because the claims worth
 * making are about what gets written — which rows, how many journal entries,
 * and whether a stored sortKey still agrees with the event it belongs to.
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
  const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 3, title: 'Three', synopsis: '' })
  const mk = (title: string, sortOrder: number) =>
    createEvent({
      worldId: world.id, chapterId: ch.id, timelineId: tl.id, title, description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder,
    })
  return { world, tl, ch, mk }
}

async function orderOf(chapterId: string): Promise<string[]> {
  const events = await db.events.where('chapterId').equals(chapterId).toArray()
  return events.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map((e) => e.title)
}

describe('createEventAt', () => {
  it('puts the new scene on the line below, and writes nothing else', async () => {
    const { ch, mk } = await seed()
    await mk('A', 1)
    await mk('B', 2)
    await mk('C', 3)
    await db.operations.clear()

    const created = await createEventAt(ch.id, 1, 'After A')

    expect(await orderOf(ch.id)).toEqual(['A', 'After A', 'B', 'C'])
    // One operation, and it is the create: the neighbours were not renumbered,
    // so another device reordering them at the same time loses nothing.
    const ops = await db.operations.toArray()
    expect(ops.map((o) => `${o.type}:${o.entityId === created?.id ? 'new' : 'other'}`)).toEqual(['create:new'])
  })

  it('takes the top of the chapter at index 0, which is Enter on the chapter row', async () => {
    const { ch, mk } = await seed()
    await mk('A', 1)
    await mk('B', 2)
    await createEventAt(ch.id, 0, 'Opening')
    expect(await orderOf(ch.id)).toEqual(['Opening', 'A', 'B'])
  })

  it('gives an empty chapter its first scene', async () => {
    const { ch } = await seed()
    await createEventAt(ch.id, 0, 'First')
    expect(await orderOf(ch.id)).toEqual(['First'])
  })

  it('lands at the end when the index is past it', async () => {
    const { ch, mk } = await seed()
    await mk('A', 1)
    await createEventAt(ch.id, 99, 'Last')
    expect(await orderOf(ch.id)).toEqual(['A', 'Last'])
  })

  it('renumbers a gap that has run out, and keeps stored sort keys true', async () => {
    /*
      Two neighbours a millionth apart leave no midpoint to use. The chapter is
      spread out again — and every snapshot on a scene whose position changed
      has to be rekeyed, or it goes on claiming the old position and reads as
      earlier or later than it is.
    */
    const { world, ch, mk } = await seed()
    const a = await mk('A', 1)
    const b = await mk('B', 1 + 1e-7)
    const ch2 = await db.characters.add({
      id: 'wren', worldId: world.id, name: 'Wren', description: '', aliases: [], tags: [],
      portraitImageId: null, isAlive: true, color: null, createdAt: 0, updatedAt: 0,
    } as never)
    await upsertSnapshot({
      worldId: world.id, characterId: String(ch2), eventId: b.id,
      currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
      isAlive: true, statusNotes: 'at the ford', travelModeId: null,
    } as never, { confirmUnchanged: true })

    const keyBefore = (await db.characterSnapshots.where('eventId').equals(b.id).first())!.sortKey

    await createEventAt(ch.id, 1, 'Between')

    expect(await orderOf(ch.id)).toEqual(['A', 'Between', 'B'])
    const bNow = await db.events.get(b.id)
    const snap = await db.characterSnapshots.where('eventId').equals(b.id).first()
    expect(bNow!.sortOrder, 'B had to move to make room').not.toBe(1 + 1e-7)
    // The stored key moved with the event, and agrees with what it would be
    // computed as now — a key left behind would read as the old position.
    expect(snap!.sortKey).not.toBe(keyBefore)
    expect(snap!.sortKey).toBe(await computeSortKey(b.id))
    expect(a.sortOrder).toBe(1)
  })

  it('is one undo, renumbering and all', async () => {
    const { world, ch, mk } = await seed()
    await mk('A', 1)
    await mk('B', 1 + 1e-7)
    const before = await orderOf(ch.id)
    const positionsBefore = (await db.events.toArray()).map((e) => e.sortOrder).sort()

    await createEventAt(ch.id, 1, 'Mistake')
    expect(await orderOf(ch.id)).toEqual(['A', 'Mistake', 'B'])

    await undoLast(world.id)
    expect(await orderOf(ch.id)).toEqual(before)
    expect((await db.events.toArray()).map((e) => e.sortOrder).sort()).toEqual(positionsBefore)
  })

  it('does nothing for a chapter that does not exist', async () => {
    await seed()
    expect(await createEventAt('nope', 0, 'Orphan')).toBeUndefined()
    expect(await db.events.filter((e) => e.title === 'Orphan').count()).toBe(0)
  })
})
