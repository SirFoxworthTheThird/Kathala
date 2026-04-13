import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { resolveItemSnapshot, upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import type { ItemSnapshot } from '@/types'

// ── shared fixtures ───────────────────────────────────────────────────────────

const CHAPTERS = [
  { id: 'ch-1', number: 1 },
  { id: 'ch-3', number: 3 },
  { id: 'ch-5', number: 5 },
  { id: 'ch-7', number: 7 },
]

const EVENTS = [
  { id: 'ev-ch1', chapterId: 'ch-1', sortOrder: 0 },
  { id: 'ev-ch3', chapterId: 'ch-3', sortOrder: 0 },
  { id: 'ev-ch5', chapterId: 'ch-5', sortOrder: 0 },
  { id: 'ev-ch7', chapterId: 'ch-7', sortOrder: 0 },
  { id: 'ev-ch5-b', chapterId: 'ch-5', sortOrder: 1 },
]

const NOW = Date.now()

function makeSnap(
  overrides: Partial<ItemSnapshot> & { itemId: string; eventId: string }
): ItemSnapshot {
  return {
    id: `snap-${Math.random()}`,
    worldId: 'world-1',
    condition: 'pristine',
    notes: '',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

// ── resolveItemSnapshot ───────────────────────────────────────────────────────

describe('resolveItemSnapshot', () => {
  it('returns undefined when all is empty', () => {
    expect(resolveItemSnapshot([], 'ev-ch3', EVENTS, CHAPTERS)).toBeUndefined()
  })

  it('returns undefined when activeEventId is null', () => {
    const snaps = [makeSnap({ itemId: 'item-1', eventId: 'ev-ch1' })]
    expect(resolveItemSnapshot(snaps, null, EVENTS, CHAPTERS)).toBeUndefined()
  })

  it('returns the exact snapshot for the active event', () => {
    const snaps = [
      makeSnap({ itemId: 'item-1', eventId: 'ev-ch1', condition: 'pristine' }),
      makeSnap({ itemId: 'item-1', eventId: 'ev-ch3', condition: 'damaged' }),
    ]
    const result = resolveItemSnapshot(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result!.condition).toBe('damaged')
    expect(result!.eventId).toBe('ev-ch3')
  })

  it('inherits from the most recent earlier event', () => {
    const snaps = [
      makeSnap({ itemId: 'item-1', eventId: 'ev-ch1', condition: 'pristine' }),
      makeSnap({ itemId: 'item-1', eventId: 'ev-ch3', condition: 'worn' }),
    ]
    const result = resolveItemSnapshot(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result!.condition).toBe('worn')
    expect(result!.eventId).toBe('ev-ch3')
  })

  it('does not inherit from future events', () => {
    const snaps = [
      makeSnap({ itemId: 'item-1', eventId: 'ev-ch7', condition: 'destroyed' }),
    ]
    expect(resolveItemSnapshot(snaps, 'ev-ch3', EVENTS, CHAPTERS)).toBeUndefined()
  })

  it('exact-event snapshot wins over earlier inherited', () => {
    const snaps = [
      makeSnap({ itemId: 'item-1', eventId: 'ev-ch1', condition: 'pristine' }),
      makeSnap({ itemId: 'item-1', eventId: 'ev-ch5', condition: 'broken' }),
    ]
    expect(resolveItemSnapshot(snaps, 'ev-ch5', EVENTS, CHAPTERS)!.condition).toBe('broken')
  })

  it('falls back to exact match when active event is unknown', () => {
    const snaps = [
      makeSnap({ itemId: 'item-1', eventId: 'ev-ch1', condition: 'pristine' }),
      makeSnap({ itemId: 'item-1', eventId: 'ev-unknown', condition: 'lost' }),
    ]
    expect(resolveItemSnapshot(snaps, 'ev-unknown', EVENTS, CHAPTERS)!.condition).toBe('lost')
  })

  it('returns undefined when active event unknown and no exact match', () => {
    const snaps = [makeSnap({ itemId: 'item-1', eventId: 'ev-ch1' })]
    expect(resolveItemSnapshot(snaps, 'ev-unknown', EVENTS, CHAPTERS)).toBeUndefined()
  })

  it('resolves correctly across two events in the same chapter', () => {
    const snaps = [
      makeSnap({ itemId: 'item-1', eventId: 'ev-ch5', condition: 'good' }),
      makeSnap({ itemId: 'item-1', eventId: 'ev-ch5-b', condition: 'damaged' }),
    ]
    expect(resolveItemSnapshot(snaps, 'ev-ch5', EVENTS, CHAPTERS)!.condition).toBe('good')
    expect(resolveItemSnapshot(snaps, 'ev-ch5-b', EVENTS, CHAPTERS)!.condition).toBe('damaged')
  })

  it('ignores snapshots with orphaned eventId (order -1)', () => {
    const snaps = [
      makeSnap({ itemId: 'item-1', eventId: 'ev-orphan', condition: 'unknown' }),
      makeSnap({ itemId: 'item-1', eventId: 'ev-ch1', condition: 'pristine' }),
    ]
    const result = resolveItemSnapshot(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result!.condition).toBe('pristine')
  })
})

// ── upsertItemSnapshot deduplication ─────────────────────────────────────────

describe('upsertItemSnapshot — deduplication', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterAll(async () => {
    await db.delete()
  })

  async function setup() {
    const tl = await createTimeline({ worldId: 'w', name: 'T', description: '', color: '#000' })
    const ch = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch 1', synopsis: '' })
    const ev1 = await createEvent({
      worldId: 'w', timelineId: tl.id, chapterId: ch.id,
      title: 'Ev1', description: '', locationMarkerId: null,
      involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
    })
    const ev2 = await createEvent({
      worldId: 'w', timelineId: tl.id, chapterId: ch.id,
      title: 'Ev2', description: '', locationMarkerId: null,
      involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 1,
    })
    return { ev1, ev2 }
  }

  it('skips write when new state matches prior snapshot (same condition + notes)', async () => {
    const { ev1, ev2 } = await setup()

    await upsertItemSnapshot({ worldId: 'w', itemId: 'item-1', eventId: ev1.id, condition: 'good', notes: '' })
    const result = await upsertItemSnapshot({ worldId: 'w', itemId: 'item-1', eventId: ev2.id, condition: 'good', notes: '' })

    expect(await db.itemSnapshots.count()).toBe(1)
    expect(result.eventId).toBe(ev1.id) // returned the prior snap
  })

  it('writes new record when condition changes', async () => {
    const { ev1, ev2 } = await setup()

    await upsertItemSnapshot({ worldId: 'w', itemId: 'item-1', eventId: ev1.id, condition: 'good', notes: '' })
    await upsertItemSnapshot({ worldId: 'w', itemId: 'item-1', eventId: ev2.id, condition: 'damaged', notes: '' })

    expect(await db.itemSnapshots.count()).toBe(2)
  })

  it('writes new record when notes change alone', async () => {
    const { ev1, ev2 } = await setup()

    await upsertItemSnapshot({ worldId: 'w', itemId: 'item-1', eventId: ev1.id, condition: 'good', notes: '' })
    await upsertItemSnapshot({ worldId: 'w', itemId: 'item-1', eventId: ev2.id, condition: 'good', notes: 'scratched' })

    expect(await db.itemSnapshots.count()).toBe(2)
  })

  it('updates in-place when the same (itemId + eventId) is upserted again', async () => {
    const { ev1 } = await setup()

    const first = await upsertItemSnapshot({ worldId: 'w', itemId: 'item-1', eventId: ev1.id, condition: 'good', notes: '' })
    await new Promise(r => setTimeout(r, 5))
    const second = await upsertItemSnapshot({ worldId: 'w', itemId: 'item-1', eventId: ev1.id, condition: 'broken', notes: 'smashed' })

    expect(second.id).toBe(first.id)
    expect(second.condition).toBe('broken')
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt)
    expect(await db.itemSnapshots.count()).toBe(1)
  })
})
