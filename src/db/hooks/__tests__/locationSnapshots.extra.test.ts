import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import {
  resolveLocationSnapshot,
  selectBestLocationSnapshots,
  upsertLocationSnapshot,
} from '@/db/hooks/useLocationSnapshots'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import type { LocationSnapshot } from '@/types'

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
  overrides: Partial<LocationSnapshot> & { locationMarkerId: string; eventId: string }
): LocationSnapshot {
  return {
    id: `snap-${Math.random()}`,
    worldId: 'world-1',
    status: 'active',
    notes: '',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

// ── resolveLocationSnapshot ───────────────────────────────────────────────────

describe('resolveLocationSnapshot', () => {
  it('returns undefined when all is empty', () => {
    expect(resolveLocationSnapshot([], 'ev-ch3', EVENTS, CHAPTERS)).toBeUndefined()
  })

  it('returns undefined when activeEventId is null', () => {
    const snaps = [makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch1' })]
    expect(resolveLocationSnapshot(snaps, null, EVENTS, CHAPTERS)).toBeUndefined()
  })

  it('returns the exact snapshot for the active event', () => {
    const snaps = [
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch1', status: 'active' }),
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch3', status: 'sieged' }),
    ]
    const result = resolveLocationSnapshot(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result!.status).toBe('sieged')
    expect(result!.eventId).toBe('ev-ch3')
  })

  it('inherits from the most recent earlier event', () => {
    const snaps = [
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch1', status: 'active' }),
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch3', status: 'occupied' }),
    ]
    const result = resolveLocationSnapshot(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result!.status).toBe('occupied')
    expect(result!.eventId).toBe('ev-ch3')
  })

  it('does not inherit from future events', () => {
    const snaps = [
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch7', status: 'ruined' }),
    ]
    expect(resolveLocationSnapshot(snaps, 'ev-ch3', EVENTS, CHAPTERS)).toBeUndefined()
  })

  it('falls back to exact match when active event is not in EVENTS', () => {
    const snaps = [
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch1', status: 'active' }),
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-unknown', status: 'destroyed' }),
    ]
    const result = resolveLocationSnapshot(snaps, 'ev-unknown', EVENTS, CHAPTERS)
    expect(result!.status).toBe('destroyed')
  })

  it('returns undefined when event unknown and no exact match', () => {
    const snaps = [makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch1' })]
    expect(resolveLocationSnapshot(snaps, 'ev-unknown', EVENTS, CHAPTERS)).toBeUndefined()
  })

  it('resolves correctly across two events in same chapter', () => {
    const snaps = [
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch5', status: 'active' }),
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch5-b', status: 'abandoned' }),
    ]
    expect(resolveLocationSnapshot(snaps, 'ev-ch5', EVENTS, CHAPTERS)!.status).toBe('active')
    expect(resolveLocationSnapshot(snaps, 'ev-ch5-b', EVENTS, CHAPTERS)!.status).toBe('abandoned')
  })
})

// ── selectBestLocationSnapshots ───────────────────────────────────────────────

describe('selectBestLocationSnapshots', () => {
  it('returns same empty array reference when all is empty', () => {
    const empty: LocationSnapshot[] = []
    expect(selectBestLocationSnapshots(empty, 'ev-ch3', EVENTS, CHAPTERS)).toBe(empty)
  })

  it('returns best snapshot per marker at the active event', () => {
    const snaps = [
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch1', status: 'active' }),
      makeSnap({ locationMarkerId: 'loc-2', eventId: 'ev-ch3', status: 'occupied' }),
    ]
    const result = selectBestLocationSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(2)
    expect(result.find(s => s.locationMarkerId === 'loc-1')!.status).toBe('active')
    expect(result.find(s => s.locationMarkerId === 'loc-2')!.status).toBe('occupied')
  })

  it('exact-event snapshot overrides inherited for the same marker', () => {
    const snaps = [
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch1', status: 'active' }),
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch3', status: 'sieged' }),
    ]
    const result = selectBestLocationSnapshots(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('sieged')
    expect(result[0].eventId).toBe('ev-ch3')
  })

  it('excludes markers whose only snapshots are in the future', () => {
    const snaps = [
      makeSnap({ locationMarkerId: 'loc-future', eventId: 'ev-ch7', status: 'active' }),
      makeSnap({ locationMarkerId: 'loc-past', eventId: 'ev-ch1', status: 'ruined' }),
    ]
    const result = selectBestLocationSnapshots(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].locationMarkerId).toBe('loc-past')
  })

  it('with no active event returns most recently updated per marker', () => {
    const snaps = [
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch1', status: 'active', updatedAt: NOW - 1000 }),
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch5', status: 'abandoned', updatedAt: NOW }),
    ]
    const result = selectBestLocationSnapshots(snaps, null, EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('abandoned')
  })

  it('falls back to exact match when active event is unknown', () => {
    const snaps = [
      makeSnap({ locationMarkerId: 'loc-1', eventId: 'ev-ch1', status: 'active' }),
      makeSnap({ locationMarkerId: 'loc-2', eventId: 'ev-unknown', status: 'ruined' }),
    ]
    const result = selectBestLocationSnapshots(snaps, 'ev-unknown', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].locationMarkerId).toBe('loc-2')
  })
})

// ── upsertLocationSnapshot deduplication ──────────────────────────────────────

describe('upsertLocationSnapshot — deduplication', () => {
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

  it('skips write when new state matches prior snapshot', async () => {
    const { ev1, ev2 } = await setup()

    await upsertLocationSnapshot({ worldId: 'w', locationMarkerId: 'loc-1', eventId: ev1.id, status: 'active', notes: '' })
    // Same status + notes at ev2 → should deduplicate
    const result = await upsertLocationSnapshot({ worldId: 'w', locationMarkerId: 'loc-1', eventId: ev2.id, status: 'active', notes: '' })

    const all = await db.locationSnapshots.where('locationMarkerId').equals('loc-1').toArray()
    expect(all).toHaveLength(1) // only ev1 record; ev2 was deduped
    expect(result.eventId).toBe(ev1.id) // returns prior snap
  })

  it('writes new record when state differs from prior snapshot', async () => {
    const { ev1, ev2 } = await setup()

    await upsertLocationSnapshot({ worldId: 'w', locationMarkerId: 'loc-1', eventId: ev1.id, status: 'active', notes: '' })
    await upsertLocationSnapshot({ worldId: 'w', locationMarkerId: 'loc-1', eventId: ev2.id, status: 'ruined', notes: '' })

    const all = await db.locationSnapshots.where('locationMarkerId').equals('loc-1').toArray()
    expect(all).toHaveLength(2)
    expect(all.find(s => s.eventId === ev2.id)!.status).toBe('ruined')
  })

  it('updates in-place when same (locationMarkerId + eventId) is upserted again', async () => {
    const { ev1 } = await setup()

    const first = await upsertLocationSnapshot({ worldId: 'w', locationMarkerId: 'loc-1', eventId: ev1.id, status: 'active', notes: '' })
    await new Promise(r => setTimeout(r, 5))
    const second = await upsertLocationSnapshot({ worldId: 'w', locationMarkerId: 'loc-1', eventId: ev1.id, status: 'destroyed', notes: 'burned' })

    expect(second.id).toBe(first.id)
    expect(second.status).toBe('destroyed')
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt)
    expect(await db.locationSnapshots.count()).toBe(1)
  })

  it('notes change alone triggers a new record (not deduped)', async () => {
    const { ev1, ev2 } = await setup()

    await upsertLocationSnapshot({ worldId: 'w', locationMarkerId: 'loc-1', eventId: ev1.id, status: 'active', notes: '' })
    await upsertLocationSnapshot({ worldId: 'w', locationMarkerId: 'loc-1', eventId: ev2.id, status: 'active', notes: 'garrison stationed' })

    expect(await db.locationSnapshots.count()).toBe(2)
  })
})
