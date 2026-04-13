import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createRelationship } from '@/db/hooks/useRelationships'
import {
  upsertRelationshipSnapshot,
  deleteRelationshipSnapshot,
  deleteRelationshipSnapshotsForRelationship,
  selectBestSnapshots,
} from '@/db/hooks/useRelationshipSnapshots'
import type { RelationshipSnapshot } from '@/types'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSnap(overrides: Partial<RelationshipSnapshot> & {
  relationshipId: string; eventId: string; worldId?: string
}): RelationshipSnapshot {
  return {
    id: `snap-${Math.random()}`,
    worldId: 'world-1',
    label: 'Friends',
    strength: 'moderate',
    sentiment: 'positive',
    description: '',
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

// Events and chapters for selectBestSnapshots tests.
// Ordering: chapter.number * 10_000 + event.sortOrder
const CHAPTERS = [
  { id: 'ch-1', number: 1 },
  { id: 'ch-3', number: 3 },
  { id: 'ch-5', number: 5 },
  { id: 'ch-7', number: 7 },
]

// Each event sits in a chapter; sortOrder is 0 for simplicity
const EVENTS = [
  { id: 'ev-ch1', chapterId: 'ch-1', sortOrder: 0 },
  { id: 'ev-ch3', chapterId: 'ch-3', sortOrder: 0 },
  { id: 'ev-ch5', chapterId: 'ch-5', sortOrder: 0 },
  { id: 'ev-ch7', chapterId: 'ch-7', sortOrder: 0 },
]

// ─── upsertRelationshipSnapshot ───────────────────────────────────────────────

describe('upsertRelationshipSnapshot', () => {
  it('creates a new snapshot when none exists', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true,
    })

    const snap = await upsertRelationshipSnapshot({
      worldId: 'world-1',
      relationshipId: rel.id,
      eventId: 'ev-ch1',
      label: 'Allies',
      strength: 'strong',
      sentiment: 'positive',
      description: 'United against the enemy',
      isActive: true,
    })

    expect(snap.id).toBeTruthy()
    expect(snap.label).toBe('Allies')
    expect(snap.eventId).toBe('ev-ch1')
    expect(snap.createdAt).toBeGreaterThan(0)
    expect(snap.updatedAt).toBe(snap.createdAt)

    const stored = await db.relationshipSnapshots.get(snap.id)
    expect(stored?.label).toBe('Allies')
  })

  it('updates an existing snapshot for the same relationship+event', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true,
    })

    const first = await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, eventId: 'ev-ch1',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isActive: true,
    })

    await new Promise((r) => setTimeout(r, 5))

    const second = await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, eventId: 'ev-ch1',
      label: 'Rivals', strength: 'strong', sentiment: 'negative',
      description: 'Fell out', isActive: true,
    })

    expect(second.id).toBe(first.id)
    expect(second.label).toBe('Rivals')
    expect(second.sentiment).toBe('negative')
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt)

    const all = await db.relationshipSnapshots.toArray()
    expect(all).toHaveLength(1)
  })

  it('keeps separate snapshots for different events', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true,
    })

    await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, eventId: 'ev-ch1',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isActive: true,
    })
    await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, eventId: 'ev-ch5',
      label: 'Enemies', strength: 'strong', sentiment: 'negative',
      description: 'Betrayal', isActive: true,
    })

    const all = await db.relationshipSnapshots.toArray()
    expect(all).toHaveLength(2)
    expect(all.find(s => s.eventId === 'ev-ch1')?.label).toBe('Friends')
    expect(all.find(s => s.eventId === 'ev-ch5')?.label).toBe('Enemies')
  })

  it('can mark a relationship as ended (isActive false)', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true,
    })

    const snap = await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, eventId: 'ev-ch5',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isActive: false,
    })

    expect(snap.isActive).toBe(false)
  })
})

// ─── deleteRelationshipSnapshot ───────────────────────────────────────────────

describe('deleteRelationshipSnapshot', () => {
  it('removes only the targeted snapshot', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true,
    })

    const s1 = await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, eventId: 'ev-ch1',
      label: 'Friends', strength: 'moderate', sentiment: 'positive', description: '', isActive: true,
    })
    await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, eventId: 'ev-ch5',
      label: 'Enemies', strength: 'strong', sentiment: 'negative', description: '', isActive: true,
    })

    await deleteRelationshipSnapshot(s1.id)

    const remaining = await db.relationshipSnapshots.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].eventId).toBe('ev-ch5')
  })
})

describe('deleteRelationshipSnapshotsForRelationship', () => {
  it('removes all snapshots for that relationship', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true,
    })
    const other = await createRelationship({
      worldId: 'world-1', characterAId: 'c', characterBId: 'd',
      label: 'Rivals', strength: 'weak', sentiment: 'negative',
      description: '', isBidirectional: false,
    })

    await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, eventId: 'ev-ch1',
      label: 'Friends', strength: 'moderate', sentiment: 'positive', description: '', isActive: true,
    })
    await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, eventId: 'ev-ch5',
      label: 'Enemies', strength: 'strong', sentiment: 'negative', description: '', isActive: true,
    })
    await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: other.id, eventId: 'ev-ch1',
      label: 'Rivals', strength: 'weak', sentiment: 'negative', description: '', isActive: true,
    })

    await deleteRelationshipSnapshotsForRelationship(rel.id)

    const remaining = await db.relationshipSnapshots.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].relationshipId).toBe(other.id)
  })
})

// ─── selectBestSnapshots — inheritance logic ──────────────────────────────────

describe('selectBestSnapshots', () => {
  it('returns empty array when there are no snapshots', () => {
    expect(selectBestSnapshots([], 'ev-ch3', EVENTS, CHAPTERS)).toEqual([])
  })

  it('returns exact event snapshot when one exists', () => {
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', eventId: 'ev-ch3', sentiment: 'negative', label: 'Enemies' }),
    ]
    const result = selectBestSnapshots(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Enemies')
    expect(result[0].eventId).toBe('ev-ch3')
  })

  it('inherits snapshot from an earlier event when no exact match', () => {
    // Snapshot exists for ev-ch1, user is viewing ev-ch5
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', eventId: 'ev-ch1', sentiment: 'positive', label: 'Friends' }),
    ]
    const result = selectBestSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Friends')
    expect(result[0].eventId).toBe('ev-ch1') // inherited
  })

  it('inherits from the most recent earlier event, not the oldest', () => {
    // ev-ch1: Friends, ev-ch3: Rivals — viewing ev-ch5 should see ev-ch3 (Rivals)
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', eventId: 'ev-ch1', label: 'Friends', updatedAt: 100 }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-1', eventId: 'ev-ch3', label: 'Rivals', updatedAt: 200 }),
    ]
    const result = selectBestSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Rivals')
    expect(result[0].eventId).toBe('ev-ch3')
  })

  it('exact event match wins over any inherited snapshot', () => {
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', eventId: 'ev-ch1', label: 'Friends' }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-1', eventId: 'ev-ch3', label: 'Rivals' }),
      makeSnap({ id: 'snap-3', relationshipId: 'rel-1', eventId: 'ev-ch5', label: 'Allies' }),
    ]
    const result = selectBestSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Allies')
    expect(result[0].eventId).toBe('ev-ch5')
  })

  it('does not inherit from future events', () => {
    // Snapshot only exists for ev-ch7, viewing ev-ch3 → no result
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', eventId: 'ev-ch7', label: 'Future state' }),
    ]
    const result = selectBestSnapshots(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result).toHaveLength(0)
  })

  it('handles multiple relationships independently', () => {
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', eventId: 'ev-ch1', label: 'Friends' }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-2', eventId: 'ev-ch3', label: 'Rivals' }),
    ]
    const result = selectBestSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(2)
    const r1 = result.find(s => s.relationshipId === 'rel-1')!
    const r2 = result.find(s => s.relationshipId === 'rel-2')!
    expect(r1.label).toBe('Friends')
    expect(r2.label).toBe('Rivals')
  })

  it('inherits isActive false — ended relationships carry forward', () => {
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', eventId: 'ev-ch3', isActive: false, label: 'Ended' }),
    ]
    const result = selectBestSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].isActive).toBe(false)
    expect(result[0].eventId).toBe('ev-ch3')
  })

  it('can reactivate a relationship in a later event', () => {
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', eventId: 'ev-ch3', isActive: false, label: 'Ended' }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-1', eventId: 'ev-ch5', isActive: true, label: 'Rekindled' }),
    ]
    const result = selectBestSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].isActive).toBe(true)
    expect(result[0].label).toBe('Rekindled')
  })

  it('with no active event returns the most recently updated snapshot per relationship', () => {
    const now = Date.now()
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', eventId: 'ev-ch1', label: 'Old', updatedAt: now - 1000 }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-1', eventId: 'ev-ch5', label: 'Recent', updatedAt: now }),
    ]
    const result = selectBestSnapshots(snaps, null, EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Recent')
  })

  it('returns inherited snapshot from earlier event when active event has no snapshot', () => {
    // ev-ch1 and ev-ch5 have snapshots, viewing ev-ch3 → inherits from ev-ch1
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', eventId: 'ev-ch1', label: 'ch1 state' }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-1', eventId: 'ev-ch5', label: 'ch5 state' }),
    ]
    const result = selectBestSnapshots(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('ch1 state') // ev-ch5 is future, ignored; ev-ch1 inherited
    expect(result[0].eventId).toBe('ev-ch1')
  })
})

// ─── startEventId — relationship visibility per event ─────────────────────────

describe('startEventId: relationships created in a specific event', () => {
  it('stores startEventId when provided', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'New bond', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true,
      startEventId: 'ev-ch5',
    })
    expect(rel.startEventId).toBe('ev-ch5')
    const stored = await db.relationships.get(rel.id)
    expect(stored?.startEventId).toBe('ev-ch5')
  })

  it('defaults startEventId to null when not provided', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'Old bond', strength: 'strong', sentiment: 'neutral',
      description: '', isBidirectional: true,
    })
    expect(rel.startEventId).toBeNull()
  })
})

// ─── graph edge visibility logic (simulated) ─────────────────────────────────

describe('graph edge filtering by startEventId using global order', () => {
  /** Mirrors what RelationshipGraphView will use after the Option A migration */
  function filterRelationshipsForEvent(
    relationships: Array<{ id: string; startEventId: string | null }>,
    activeEventId: string | null,
    events: Array<{ id: string; chapterId: string; sortOrder: number }>,
    chapters: Array<{ id: string; number: number }>
  ) {
    if (!activeEventId) return relationships

    const chapterNumberById = new Map(chapters.map((c) => [c.id, c.number]))
    const eventById = new Map(events.map((e) => [e.id, e]))

    function order(eventId: string) {
      const ev = eventById.get(eventId)
      if (!ev) return -1
      return (chapterNumberById.get(ev.chapterId) ?? -1) * 10_000 + ev.sortOrder
    }

    const activeOrder = order(activeEventId)

    return relationships.filter((r) => {
      if (!r.startEventId) return true
      const startOrder = order(r.startEventId)
      return startOrder === -1 || activeOrder >= startOrder
    })
  }

  const rels = [
    { id: 'rel-always', startEventId: null },
    { id: 'rel-from-ch3', startEventId: 'ev-ch3' },
    { id: 'rel-from-ch5', startEventId: 'ev-ch5' },
  ]

  it('shows all relationships when no event is active', () => {
    const result = filterRelationshipsForEvent(rels, null, EVENTS, CHAPTERS)
    expect(result.map(r => r.id)).toEqual(['rel-always', 'rel-from-ch3', 'rel-from-ch5'])
  })

  it('hides relationships that start after the active event', () => {
    const result = filterRelationshipsForEvent(rels, 'ev-ch1', EVENTS, CHAPTERS)
    expect(result.map(r => r.id)).toEqual(['rel-always'])
  })

  it('shows a relationship in the exact event it starts', () => {
    const result = filterRelationshipsForEvent(rels, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result.map(r => r.id)).toEqual(['rel-always', 'rel-from-ch3'])
  })

  it('shows all relationships in a later event', () => {
    const result = filterRelationshipsForEvent(rels, 'ev-ch7', EVENTS, CHAPTERS)
    expect(result.map(r => r.id)).toEqual(['rel-always', 'rel-from-ch3', 'rel-from-ch5'])
  })

  it('shows relationships with null startEventId in every event', () => {
    for (const ev of EVENTS) {
      const result = filterRelationshipsForEvent([{ id: 'rel-always', startEventId: null }], ev.id, EVENTS, CHAPTERS)
      expect(result).toHaveLength(1)
    }
  })
})
