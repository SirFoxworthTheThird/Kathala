import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import {
  computeSortKey,
  computeSortKeySync,
  recomputeSnapshotSortKeysForEvent,
  recomputeSnapshotSortKeysForChapter,
} from '@/lib/sortKey'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const now = Date.now()

async function seedWorld() {
  const tl = await createTimeline({
    worldId: 'w',
    name: 'Main',
    description: '',
    color: null,
  })
  const ch = await createChapter({
    worldId: 'w',
    timelineId: tl.id,
    number: 3,
    title: 'Three',
    synopsis: '',
  })
  const ev = await createEvent({
    worldId: 'w',
    timelineId: tl.id,
    chapterId: ch.id,
    description: 'test event',
    sortOrder: 7,
    locationMarkerId: null,
    involvedCharacterIds: [],
    involvedItemIds: [],
    tags: [],
  })
  return { tl, ch, ev }
}

function makeCharSnap(eventId: string, sortKey?: number) {
  return {
    id: `cs-${eventId}`,
    worldId: 'w',
    characterId: 'char-1',
    eventId,
    sortKey,
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

function makeLocSnap(eventId: string, sortKey?: number) {
  return {
    id: `ls-${eventId}`,
    worldId: 'w',
    locationMarkerId: 'loc-1',
    eventId,
    sortKey,
    status: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

function makeItemSnap(eventId: string, sortKey?: number) {
  return {
    id: `is-${eventId}`,
    worldId: 'w',
    itemId: 'item-1',
    eventId,
    sortKey,
    condition: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

function makeRelSnap(eventId: string, sortKey?: number) {
  return {
    id: `rs-${eventId}`,
    worldId: 'w',
    relationshipId: 'rel-1',
    eventId,
    sortKey,
    label: '',
    strength: 'neutral' as const,
    sentiment: 'neutral' as const,
    description: '',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
}

function makeItemPlacement(eventId: string, sortKey?: number) {
  return {
    id: `ip-${eventId}`,
    worldId: 'w',
    itemId: 'item-1',
    eventId,
    locationMarkerId: 'loc-1',
    sortKey,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

function makeCharMovement(eventId: string, sortKey?: number) {
  return {
    id: `cm-${eventId}`,
    worldId: 'w',
    characterId: 'char-1',
    eventId,
    sortKey,
    fromLocationMarkerId: null,
    toLocationMarkerId: null,
    travelModeId: null,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

function makeRegionSnap(eventId: string, sortKey?: number) {
  return {
    id: `rgs-${eventId}`,
    worldId: 'w',
    regionId: 'region-1',
    eventId,
    sortKey,
    status: 'active',
    notes: '',
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

// ── computeSortKey ────────────────────────────────────────────────────────────

describe('computeSortKey', () => {
  it('returns 0 when the event does not exist', async () => {
    const key = await computeSortKey('no-such-event')
    expect(key).toBe(0)
  })

  it('returns sortOrder / 1_000_000 when the chapter cannot be found', async () => {
    await db.events.add({
      id: 'ev-orphan',
      worldId: 'w',
      timelineId: 'tl',
      chapterId: 'missing-chapter',
      description: '',
      sortOrder: 5,
      locationMarkerId: null,
      involvedCharacterIds: [],
      involvedItemIds: [],
      tags: [],
      travelDays: null,
      status: 'draft',
      povCharacterId: null,
      createdAt: now,
      updatedAt: now,
    })
    const key = await computeSortKey('ev-orphan')
    expect(key).toBe(5 / 1_000_000)
  })

  it('returns chapter.number + event.sortOrder / 1_000_000', async () => {
    const { ev, ch } = await seedWorld()
    // ch.number = 3, ev.sortOrder = 7 → 3.000007
    const key = await computeSortKey(ev.id)
    expect(key).toBe(ch.number + ev.sortOrder / 1_000_000)
    expect(key).toBe(3.000007)
  })

  it('is sensitive to both components', async () => {
    const tl = await createTimeline({ worldId: 'w', name: 'TL', description: '', color: null })
    const ch1 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: '', synopsis: '' })
    const ch2 = await createChapter({ worldId: 'w', timelineId: tl.id, number: 2, title: '', synopsis: '' })
    const evA = await createEvent({ worldId: 'w', timelineId: tl.id, chapterId: ch1.id, description: '', sortOrder: 5, locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [] })
    const evB = await createEvent({ worldId: 'w', timelineId: tl.id, chapterId: ch2.id, description: '', sortOrder: 5, locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [] })
    expect(await computeSortKey(evA.id)).toBe(1.000005)
    expect(await computeSortKey(evB.id)).toBe(2.000005)
  })
})

// ── computeSortKeySync ────────────────────────────────────────────────────────

describe('computeSortKeySync', () => {
  it('returns -1 when the event is not in the map', () => {
    const result = computeSortKeySync('missing', new Map(), new Map())
    expect(result).toBe(-1)
  })

  it('returns -1 when the chapter is not in the map', () => {
    const eventById = new Map([['ev-1', { chapterId: 'ch-x', sortOrder: 3 }]])
    const chapterNumberById = new Map<string, number>() // chapter missing
    const result = computeSortKeySync('ev-1', eventById, chapterNumberById)
    expect(result).toBe(-1)
  })

  it('returns chapter.number + event.sortOrder / 1_000_000', () => {
    const eventById = new Map([['ev-1', { chapterId: 'ch-1', sortOrder: 7 }]])
    const chapterNumberById = new Map([['ch-1', 3]])
    const result = computeSortKeySync('ev-1', eventById, chapterNumberById)
    expect(result).toBe(3.000007)
  })

  it('handles sortOrder 0 correctly (not confused with missing)', () => {
    const eventById = new Map([['ev-1', { chapterId: 'ch-1', sortOrder: 0 }]])
    const chapterNumberById = new Map([['ch-1', 1]])
    const result = computeSortKeySync('ev-1', eventById, chapterNumberById)
    expect(result).toBe(1)
  })

  it('works with multiple events from different chapters', () => {
    const eventById = new Map([
      ['ev-a', { chapterId: 'ch-1', sortOrder: 2 }],
      ['ev-b', { chapterId: 'ch-2', sortOrder: 1 }],
    ])
    const chapterNumberById = new Map([['ch-1', 1], ['ch-2', 2]])
    expect(computeSortKeySync('ev-a', eventById, chapterNumberById)).toBe(1.000002)
    expect(computeSortKeySync('ev-b', eventById, chapterNumberById)).toBe(2.000001)
    expect(computeSortKeySync('ev-c', eventById, chapterNumberById)).toBe(-1)
  })
})

// ── recomputeSnapshotSortKeysForEvent ─────────────────────────────────────────

describe('recomputeSnapshotSortKeysForEvent', () => {
  it('updates sortKey on all seven snapshot/placement/movement table types', async () => {
    const { ev, ch } = await seedWorld()
    const expectedKey = ch.number + ev.sortOrder / 1_000_000 // 3.000007

    await db.characterSnapshots.add(makeCharSnap(ev.id, 0))
    await db.locationSnapshots.add(makeLocSnap(ev.id, 0))
    await db.itemSnapshots.add(makeItemSnap(ev.id, 0))
    await db.relationshipSnapshots.add(makeRelSnap(ev.id, 0))
    await db.itemPlacements.add(makeItemPlacement(ev.id, 0))
    await db.characterMovements.add(makeCharMovement(ev.id, 0))
    await db.mapRegionSnapshots.add(makeRegionSnap(ev.id, 0))

    await recomputeSnapshotSortKeysForEvent(ev.id)

    const cs  = await db.characterSnapshots.get(`cs-${ev.id}`)
    const ls  = await db.locationSnapshots.get(`ls-${ev.id}`)
    const is  = await db.itemSnapshots.get(`is-${ev.id}`)
    const rs  = await db.relationshipSnapshots.get(`rs-${ev.id}`)
    const ip  = await db.itemPlacements.get(`ip-${ev.id}`)
    const cm  = await db.characterMovements.get(`cm-${ev.id}`)
    const rgs = await db.mapRegionSnapshots.get(`rgs-${ev.id}`)

    expect(cs?.sortKey).toBe(expectedKey)
    expect(ls?.sortKey).toBe(expectedKey)
    expect(is?.sortKey).toBe(expectedKey)
    expect(rs?.sortKey).toBe(expectedKey)
    expect(ip?.sortKey).toBe(expectedKey)
    expect(cm?.sortKey).toBe(expectedKey)
    expect(rgs?.sortKey).toBe(expectedKey)
  })

  it('is a no-op when there are no snapshots for the event', async () => {
    const { ev } = await seedWorld()
    await expect(recomputeSnapshotSortKeysForEvent(ev.id)).resolves.toBeUndefined()
  })

  it('only updates snapshots for the given event, not others', async () => {
    const tl = await createTimeline({ worldId: 'w', name: 'TL', description: '', color: null })
    const ch = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: '', synopsis: '' })
    const evA = await createEvent({ worldId: 'w', timelineId: tl.id, chapterId: ch.id, description: '', sortOrder: 1, locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [] })
    const evB = await createEvent({ worldId: 'w', timelineId: tl.id, chapterId: ch.id, description: '', sortOrder: 2, locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [] })

    await db.characterSnapshots.add({ ...makeCharSnap(evA.id, 0), id: 'cs-a' })
    await db.characterSnapshots.add({ ...makeCharSnap(evB.id, 0), id: 'cs-b' })

    await recomputeSnapshotSortKeysForEvent(evA.id)

    const csA = await db.characterSnapshots.get('cs-a')
    const csB = await db.characterSnapshots.get('cs-b')
    expect(csA?.sortKey).toBe(1.000001)
    expect(csB?.sortKey).toBe(0) // untouched
  })
})

// ── recomputeSnapshotSortKeysForChapter ──────────────────────────────────────

describe('recomputeSnapshotSortKeysForChapter', () => {
  it('recomputes sortKey for all events in the chapter', async () => {
    const tl = await createTimeline({ worldId: 'w', name: 'TL', description: '', color: null })
    const ch = await createChapter({ worldId: 'w', timelineId: tl.id, number: 2, title: '', synopsis: '' })
    const evA = await createEvent({ worldId: 'w', timelineId: tl.id, chapterId: ch.id, description: '', sortOrder: 1, locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [] })
    const evB = await createEvent({ worldId: 'w', timelineId: tl.id, chapterId: ch.id, description: '', sortOrder: 3, locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [] })

    await db.characterSnapshots.add({ ...makeCharSnap(evA.id, 0), id: 'cs-a', characterId: 'char-1' })
    await db.characterSnapshots.add({ ...makeCharSnap(evB.id, 0), id: 'cs-b', characterId: 'char-1' })

    await recomputeSnapshotSortKeysForChapter(ch.id)

    const csA = await db.characterSnapshots.get('cs-a')
    const csB = await db.characterSnapshots.get('cs-b')
    expect(csA?.sortKey).toBe(2.000001) // ch 2 + sortOrder 1 / 1_000_000
    expect(csB?.sortKey).toBe(2.000003) // ch 2 + sortOrder 3 / 1_000_000
  })

  it('is a no-op when the chapter has no events', async () => {
    const tl = await createTimeline({ worldId: 'w', name: 'TL', description: '', color: null })
    const ch = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: '', synopsis: '' })
    await expect(recomputeSnapshotSortKeysForChapter(ch.id)).resolves.toBeUndefined()
  })

  it('does not touch events from other chapters', async () => {
    const tl = await createTimeline({ worldId: 'w', name: 'TL', description: '', color: null })
    const chA = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: '', synopsis: '' })
    const chB = await createChapter({ worldId: 'w', timelineId: tl.id, number: 5, title: '', synopsis: '' })
    const evA = await createEvent({ worldId: 'w', timelineId: tl.id, chapterId: chA.id, description: '', sortOrder: 1, locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [] })
    const evB = await createEvent({ worldId: 'w', timelineId: tl.id, chapterId: chB.id, description: '', sortOrder: 1, locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [] })

    await db.characterSnapshots.add({ ...makeCharSnap(evA.id, 0), id: 'cs-a', characterId: 'char-1' })
    await db.characterSnapshots.add({ ...makeCharSnap(evB.id, 0), id: 'cs-b', characterId: 'char-1' })

    await recomputeSnapshotSortKeysForChapter(chA.id)

    const csA = await db.characterSnapshots.get('cs-a')
    const csB = await db.characterSnapshots.get('cs-b')
    expect(csA?.sortKey).toBe(1.000001)
    expect(csB?.sortKey).toBe(0) // chB not touched
  })
})
