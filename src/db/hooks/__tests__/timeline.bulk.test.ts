import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import {
  createTimeline,
  createChapter,
  createEvent,
  bulkDeleteEvents,
  bulkMoveEvents,
  bulkAddTag,
} from '@/db/hooks/useTimeline'

// ── Shared fixture helpers ────────────────────────────────────────────────────

async function seedTimeline() {
  const tl = await createTimeline({ worldId: 'w', name: 'TL', description: '', color: null })
  const ch = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch 1', synopsis: '' })
  return { tl, ch }
}

async function addEvent(timelineId: string, chapterId: string, sortOrder: number) {
  return createEvent({
    worldId: 'w',
    timelineId,
    chapterId,
    description: `event ${sortOrder}`,
    sortOrder,
    locationMarkerId: null,
    involvedCharacterIds: [],
    involvedItemIds: [],
    tags: [],
  })
}

const now = Date.now()

function makeCharSnap(eventId: string) {
  return {
    id: `cs-${eventId}`,
    worldId: 'w',
    characterId: 'char-1',
    eventId,
    isAlive: true,
    currentLocationMarkerId: null,
    currentMapLayerId: null,
    inventoryItemIds: [],
    inventoryNotes: '',
    statusNotes: '',
    travelModeId: null,
    createdAt: now,
    updatedAt: now,
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

// ── bulkDeleteEvents ──────────────────────────────────────────────────────────

describe('bulkDeleteEvents', () => {
  it('is a no-op for an empty id list', async () => {
    const { tl, ch } = await seedTimeline()
    const ev = await addEvent(tl.id, ch.id, 0)
    await bulkDeleteEvents([])
    expect(await db.events.get(ev.id)).toBeDefined()
  })

  it('deletes each specified event', async () => {
    const { tl, ch } = await seedTimeline()
    const evA = await addEvent(tl.id, ch.id, 0)
    const evB = await addEvent(tl.id, ch.id, 1)
    const evC = await addEvent(tl.id, ch.id, 2)

    await bulkDeleteEvents([evA.id, evB.id])

    expect(await db.events.get(evA.id)).toBeUndefined()
    expect(await db.events.get(evB.id)).toBeUndefined()
    expect(await db.events.get(evC.id)).toBeDefined()
  })

  it('cascades deletion to characterSnapshots', async () => {
    const { tl, ch } = await seedTimeline()
    const ev = await addEvent(tl.id, ch.id, 0)
    await db.characterSnapshots.add(makeCharSnap(ev.id))

    await bulkDeleteEvents([ev.id])

    expect(await db.characterSnapshots.get(`cs-${ev.id}`)).toBeUndefined()
  })

  it('leaves snapshots for non-deleted events untouched', async () => {
    const { tl, ch } = await seedTimeline()
    const evA = await addEvent(tl.id, ch.id, 0)
    const evB = await addEvent(tl.id, ch.id, 1)
    await db.characterSnapshots.add(makeCharSnap(evA.id))
    await db.characterSnapshots.add({ ...makeCharSnap(evB.id), id: `cs-${evB.id}` })

    await bulkDeleteEvents([evA.id])

    expect(await db.characterSnapshots.get(`cs-${evA.id}`)).toBeUndefined()
    expect(await db.characterSnapshots.get(`cs-${evB.id}`)).toBeDefined()
  })
})

// ── bulkMoveEvents ────────────────────────────────────────────────────────────

describe('bulkMoveEvents', () => {
  it('is a no-op for an empty id list', async () => {
    const { tl } = await seedTimeline()
    const chTarget = await createChapter({ worldId: 'w', timelineId: tl.id, number: 2, title: 'Ch 2', synopsis: '' })
    await bulkMoveEvents([], chTarget.id)
    expect(await db.events.where('chapterId').equals(chTarget.id).count()).toBe(0)
  })

  it('is a no-op when the target chapter does not exist', async () => {
    const { tl, ch } = await seedTimeline()
    const ev = await addEvent(tl.id, ch.id, 0)
    await bulkMoveEvents([ev.id], 'no-such-chapter')
    const evAfter = await db.events.get(ev.id)
    expect(evAfter?.chapterId).toBe(ch.id) // unchanged
  })

  it('moves events to the target chapter', async () => {
    const { tl, ch: chSrc } = await seedTimeline()
    const chDst = await createChapter({ worldId: 'w', timelineId: tl.id, number: 2, title: 'Ch 2', synopsis: '' })
    const evA = await addEvent(tl.id, chSrc.id, 0)
    const evB = await addEvent(tl.id, chSrc.id, 1)

    await bulkMoveEvents([evA.id, evB.id], chDst.id)

    const afterA = await db.events.get(evA.id)
    const afterB = await db.events.get(evB.id)
    expect(afterA?.chapterId).toBe(chDst.id)
    expect(afterB?.chapterId).toBe(chDst.id)
  })

  it('updates timelineId along with chapterId when moving across timelines', async () => {
    const tl1 = await createTimeline({ worldId: 'w', name: 'TL1', description: '', color: null })
    const tl2 = await createTimeline({ worldId: 'w', name: 'TL2', description: '', color: null })
    const ch1 = await createChapter({ worldId: 'w', timelineId: tl1.id, number: 1, title: '', synopsis: '' })
    const ch2 = await createChapter({ worldId: 'w', timelineId: tl2.id, number: 1, title: '', synopsis: '' })
    const ev = await addEvent(tl1.id, ch1.id, 0)

    await bulkMoveEvents([ev.id], ch2.id)

    const after = await db.events.get(ev.id)
    expect(after?.chapterId).toBe(ch2.id)
    expect(after?.timelineId).toBe(tl2.id)
  })

  it('appends after the highest existing sortOrder in the destination', async () => {
    const { tl, ch: chSrc } = await seedTimeline()
    const chDst = await createChapter({ worldId: 'w', timelineId: tl.id, number: 2, title: '', synopsis: '' })
    // Pre-populate destination with sortOrder 0..4
    for (let i = 0; i < 5; i++) await addEvent(tl.id, chDst.id, i)
    const evToMove = await addEvent(tl.id, chSrc.id, 0)

    await bulkMoveEvents([evToMove.id], chDst.id)

    const after = await db.events.get(evToMove.id)
    expect(after?.sortOrder).toBeGreaterThanOrEqual(5)
  })

  it('assigns consecutive sortOrders when moving multiple events', async () => {
    const { tl, ch: chSrc } = await seedTimeline()
    const chDst = await createChapter({ worldId: 'w', timelineId: tl.id, number: 2, title: '', synopsis: '' })
    const evA = await addEvent(tl.id, chSrc.id, 0)
    const evB = await addEvent(tl.id, chSrc.id, 1)

    await bulkMoveEvents([evA.id, evB.id], chDst.id)

    const afterA = await db.events.get(evA.id)
    const afterB = await db.events.get(evB.id)
    // Should be consecutive (0, 1 since destination was empty)
    expect(afterB!.sortOrder).toBe(afterA!.sortOrder + 1)
  })
})

// ── bulkAddTag ────────────────────────────────────────────────────────────────

describe('bulkAddTag', () => {
  it('is a no-op for an empty id list', async () => {
    const { tl, ch } = await seedTimeline()
    const ev = await addEvent(tl.id, ch.id, 0)
    await bulkAddTag([], 'battle')
    const after = await db.events.get(ev.id)
    expect(after?.tags).toEqual([])
  })

  it('is a no-op for a blank / whitespace-only tag', async () => {
    const { tl, ch } = await seedTimeline()
    const ev = await addEvent(tl.id, ch.id, 0)
    await bulkAddTag([ev.id], '   ')
    const after = await db.events.get(ev.id)
    expect(after?.tags).toEqual([])
  })

  it('adds the tag to all specified events', async () => {
    const { tl, ch } = await seedTimeline()
    const evA = await addEvent(tl.id, ch.id, 0)
    const evB = await addEvent(tl.id, ch.id, 1)

    await bulkAddTag([evA.id, evB.id], 'battle')

    expect((await db.events.get(evA.id))?.tags).toContain('battle')
    expect((await db.events.get(evB.id))?.tags).toContain('battle')
  })

  it('trims whitespace from the tag', async () => {
    const { tl, ch } = await seedTimeline()
    const ev = await addEvent(tl.id, ch.id, 0)
    await bulkAddTag([ev.id], '  battle  ')
    const after = await db.events.get(ev.id)
    expect(after?.tags).toContain('battle')
    expect(after?.tags).not.toContain('  battle  ')
  })

  it('does not add a duplicate tag', async () => {
    const { tl, ch } = await seedTimeline()
    const ev = await createEvent({ worldId: 'w', timelineId: tl.id, chapterId: ch.id, description: '', sortOrder: 0, locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: ['battle'] })
    await bulkAddTag([ev.id], 'battle')
    const after = await db.events.get(ev.id)
    expect(after?.tags.filter((t) => t === 'battle').length).toBe(1)
  })

  it('preserves existing tags when adding a new one', async () => {
    const { tl, ch } = await seedTimeline()
    const ev = await createEvent({ worldId: 'w', timelineId: tl.id, chapterId: ch.id, description: '', sortOrder: 0, locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: ['magic'] })
    await bulkAddTag([ev.id], 'battle')
    const after = await db.events.get(ev.id)
    expect(after?.tags).toContain('magic')
    expect(after?.tags).toContain('battle')
  })

  it('skips events that no longer exist without throwing', async () => {
    const { tl, ch } = await seedTimeline()
    const ev = await addEvent(tl.id, ch.id, 0)
    await expect(bulkAddTag([ev.id, 'ghost-id'], 'battle')).resolves.toBeUndefined()
    expect((await db.events.get(ev.id))?.tags).toContain('battle')
  })
})
