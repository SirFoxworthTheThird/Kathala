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
  relationshipId: string; chapterId: string; worldId?: string
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

const CHAPTERS = [
  { id: 'ch-1', number: 1 },
  { id: 'ch-3', number: 3 },
  { id: 'ch-5', number: 5 },
  { id: 'ch-7', number: 7 },
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
      chapterId: 'ch-1',
      label: 'Allies',
      strength: 'strong',
      sentiment: 'positive',
      description: 'United against the enemy',
      isActive: true,
    })

    expect(snap.id).toBeTruthy()
    expect(snap.label).toBe('Allies')
    expect(snap.chapterId).toBe('ch-1')
    expect(snap.createdAt).toBeGreaterThan(0)
    expect(snap.updatedAt).toBe(snap.createdAt)

    const stored = await db.relationshipSnapshots.get(snap.id)
    expect(stored?.label).toBe('Allies')
  })

  it('updates an existing snapshot for the same relationship+chapter', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true,
    })

    const first = await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, chapterId: 'ch-1',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isActive: true,
    })

    await new Promise((r) => setTimeout(r, 5))

    const second = await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, chapterId: 'ch-1',
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

  it('keeps separate snapshots for different chapters', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true,
    })

    await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, chapterId: 'ch-1',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isActive: true,
    })
    await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, chapterId: 'ch-5',
      label: 'Enemies', strength: 'strong', sentiment: 'negative',
      description: 'Betrayal', isActive: true,
    })

    const all = await db.relationshipSnapshots.toArray()
    expect(all).toHaveLength(2)
    expect(all.find(s => s.chapterId === 'ch-1')?.label).toBe('Friends')
    expect(all.find(s => s.chapterId === 'ch-5')?.label).toBe('Enemies')
  })

  it('can mark a relationship as ended (isActive false)', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'Friends', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true,
    })

    const snap = await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, chapterId: 'ch-5',
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
      worldId: 'world-1', relationshipId: rel.id, chapterId: 'ch-1',
      label: 'Friends', strength: 'moderate', sentiment: 'positive', description: '', isActive: true,
    })
    await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, chapterId: 'ch-5',
      label: 'Enemies', strength: 'strong', sentiment: 'negative', description: '', isActive: true,
    })

    await deleteRelationshipSnapshot(s1.id)

    const remaining = await db.relationshipSnapshots.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].chapterId).toBe('ch-5')
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
      worldId: 'world-1', relationshipId: rel.id, chapterId: 'ch-1',
      label: 'Friends', strength: 'moderate', sentiment: 'positive', description: '', isActive: true,
    })
    await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: rel.id, chapterId: 'ch-5',
      label: 'Enemies', strength: 'strong', sentiment: 'negative', description: '', isActive: true,
    })
    await upsertRelationshipSnapshot({
      worldId: 'world-1', relationshipId: other.id, chapterId: 'ch-1',
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
    expect(selectBestSnapshots([], 'ch-3', CHAPTERS)).toEqual([])
  })

  it('returns exact chapter snapshot when one exists', () => {
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', chapterId: 'ch-3', sentiment: 'negative', label: 'Enemies' }),
    ]
    const result = selectBestSnapshots(snaps, 'ch-3', CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Enemies')
    expect(result[0].chapterId).toBe('ch-3')
  })

  it('inherits snapshot from an earlier chapter when no exact match', () => {
    // Snapshot exists for ch-1, user is viewing ch-5
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', chapterId: 'ch-1', sentiment: 'positive', label: 'Friends' }),
    ]
    const result = selectBestSnapshots(snaps, 'ch-5', CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Friends')
    expect(result[0].chapterId).toBe('ch-1') // inherited
  })

  it('inherits from the most recent earlier chapter, not the oldest', () => {
    // ch-1: Friends, ch-3: Rivals — viewing ch-5 should see ch-3 (Rivals)
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', chapterId: 'ch-1', label: 'Friends', updatedAt: 100 }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-1', chapterId: 'ch-3', label: 'Rivals', updatedAt: 200 }),
    ]
    const result = selectBestSnapshots(snaps, 'ch-5', CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Rivals')
    expect(result[0].chapterId).toBe('ch-3')
  })

  it('exact chapter match wins over any inherited snapshot', () => {
    // ch-1: Friends, ch-3: Rivals, ch-5: Allies (exact) — viewing ch-5
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', chapterId: 'ch-1', label: 'Friends' }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-1', chapterId: 'ch-3', label: 'Rivals' }),
      makeSnap({ id: 'snap-3', relationshipId: 'rel-1', chapterId: 'ch-5', label: 'Allies' }),
    ]
    const result = selectBestSnapshots(snaps, 'ch-5', CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Allies')
    expect(result[0].chapterId).toBe('ch-5')
  })

  it('does not inherit from future chapters', () => {
    // Snapshot only exists for ch-7, viewing ch-3 → no result
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', chapterId: 'ch-7', label: 'Future state' }),
    ]
    const result = selectBestSnapshots(snaps, 'ch-3', CHAPTERS)
    expect(result).toHaveLength(0)
  })

  it('handles multiple relationships independently', () => {
    // rel-1: snapshot in ch-1 (Friends), rel-2: snapshot in ch-3 (Rivals)
    // viewing ch-5 → both should be inherited
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', chapterId: 'ch-1', label: 'Friends' }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-2', chapterId: 'ch-3', label: 'Rivals' }),
    ]
    const result = selectBestSnapshots(snaps, 'ch-5', CHAPTERS)
    expect(result).toHaveLength(2)
    const r1 = result.find(s => s.relationshipId === 'rel-1')!
    const r2 = result.find(s => s.relationshipId === 'rel-2')!
    expect(r1.label).toBe('Friends')
    expect(r2.label).toBe('Rivals')
  })

  it('inherits isActive false — ended relationships carry forward', () => {
    // rel ended in ch-3, viewing ch-5 → should still be inactive
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', chapterId: 'ch-3', isActive: false, label: 'Ended' }),
    ]
    const result = selectBestSnapshots(snaps, 'ch-5', CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].isActive).toBe(false)
    expect(result[0].chapterId).toBe('ch-3')
  })

  it('can reactivate a relationship in a later chapter', () => {
    // ch-3: ended, ch-5: reactivated (new snapshot with isActive true)
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', chapterId: 'ch-3', isActive: false, label: 'Ended' }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-1', chapterId: 'ch-5', isActive: true, label: 'Rekindled' }),
    ]
    const result = selectBestSnapshots(snaps, 'ch-5', CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].isActive).toBe(true)
    expect(result[0].label).toBe('Rekindled')
  })

  it('with no active chapter returns the most recently updated snapshot per relationship', () => {
    const now = Date.now()
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', chapterId: 'ch-1', label: 'Old', updatedAt: now - 1000 }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-1', chapterId: 'ch-5', label: 'Recent', updatedAt: now }),
    ]
    const result = selectBestSnapshots(snaps, null, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Recent')
  })

  it('returns exact chapter snapshot even when an older chapter had a different state', () => {
    // Edge case: viewing ch-3, only ch-1 and ch-5 have snapshots
    const snaps = [
      makeSnap({ id: 'snap-1', relationshipId: 'rel-1', chapterId: 'ch-1', label: 'ch1 state' }),
      makeSnap({ id: 'snap-2', relationshipId: 'rel-1', chapterId: 'ch-5', label: 'ch5 state' }),
    ]
    const result = selectBestSnapshots(snaps, 'ch-3', CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('ch1 state') // ch-5 is future, ignored; ch-1 inherited
    expect(result[0].chapterId).toBe('ch-1')
  })
})

// ─── startChapterId — relationship visibility per chapter ─────────────────────

describe('startChapterId: relationships created in a specific chapter', () => {
  it('stores startChapterId when provided', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'New bond', strength: 'moderate', sentiment: 'positive',
      description: '', isBidirectional: true,
      startChapterId: 'ch-5',
    })
    expect(rel.startChapterId).toBe('ch-5')
    const stored = await db.relationships.get(rel.id)
    expect(stored?.startChapterId).toBe('ch-5')
  })

  it('defaults startChapterId to null when not provided', async () => {
    const rel = await createRelationship({
      worldId: 'world-1', characterAId: 'a', characterBId: 'b',
      label: 'Old bond', strength: 'strong', sentiment: 'neutral',
      description: '', isBidirectional: true,
    })
    expect(rel.startChapterId).toBeNull()
  })
})

// ─── graph edge visibility logic (simulated) ─────────────────────────────────

describe('graph edge filtering by startChapterId', () => {
  /** Mirrors the filtering logic in RelationshipGraphView's useEffect */
  function filterRelationshipsForChapter(
    relationships: Array<{ id: string; startChapterId: string | null }>,
    activeChapterId: string | null,
    chapters: Array<{ id: string; number: number }>
  ) {
    const chapterNumberById = new Map(chapters.map((c) => [c.id, c.number]))
    const activeChapterNum = activeChapterId ? (chapterNumberById.get(activeChapterId) ?? null) : null

    return relationships.filter((r) => {
      if (activeChapterNum !== null && r.startChapterId) {
        const startNum = chapterNumberById.get(r.startChapterId)
        if (startNum !== undefined && activeChapterNum < startNum) return false
      }
      return true
    })
  }

  const rels = [
    { id: 'rel-always', startChapterId: null },          // exists from the beginning
    { id: 'rel-from-ch3', startChapterId: 'ch-3' },     // starts at chapter 3
    { id: 'rel-from-ch5', startChapterId: 'ch-5' },     // starts at chapter 5
  ]

  it('shows all relationships when no chapter is active', () => {
    const result = filterRelationshipsForChapter(rels, null, CHAPTERS)
    expect(result.map(r => r.id)).toEqual(['rel-always', 'rel-from-ch3', 'rel-from-ch5'])
  })

  it('hides relationships that start after the active chapter', () => {
    // Viewing ch-1: only rel-always should show
    const result = filterRelationshipsForChapter(rels, 'ch-1', CHAPTERS)
    expect(result.map(r => r.id)).toEqual(['rel-always'])
  })

  it('shows a relationship in the exact chapter it starts', () => {
    // Viewing ch-3: rel-always and rel-from-ch3 should show
    const result = filterRelationshipsForChapter(rels, 'ch-3', CHAPTERS)
    expect(result.map(r => r.id)).toEqual(['rel-always', 'rel-from-ch3'])
  })

  it('shows all relationships in a later chapter', () => {
    // Viewing ch-7: all three should show
    const result = filterRelationshipsForChapter(rels, 'ch-7', CHAPTERS)
    expect(result.map(r => r.id)).toEqual(['rel-always', 'rel-from-ch3', 'rel-from-ch5'])
  })

  it('shows relationships with null startChapterId in every chapter', () => {
    for (const ch of CHAPTERS) {
      const result = filterRelationshipsForChapter([{ id: 'rel-always', startChapterId: null }], ch.id, CHAPTERS)
      expect(result).toHaveLength(1)
    }
  })
})
