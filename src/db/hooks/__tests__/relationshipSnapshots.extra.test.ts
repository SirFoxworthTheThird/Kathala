import { describe, it, expect } from 'vitest'
import { selectBestSnapshots } from '@/db/hooks/useRelationshipSnapshots'
import type { RelationshipSnapshot } from '@/types'

// Covers the branch in selectBestSnapshots where activeEventId is provided
// but is NOT found in allEvents (events not loaded yet).

const NOW = Date.now()

function makeSnap(overrides: Partial<RelationshipSnapshot> & {
  relationshipId: string; eventId: string
}): RelationshipSnapshot {
  return {
    id: `snap-${Math.random()}`,
    worldId: 'world-1',
    label: 'Friends',
    strength: 'moderate',
    sentiment: 'positive',
    description: '',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

const CHAPTERS = [
  { id: 'ch-1', number: 1 },
  { id: 'ch-3', number: 3 },
]

const EVENTS = [
  { id: 'ev-ch1', chapterId: 'ch-1', sortOrder: 0 },
  { id: 'ev-ch3', chapterId: 'ch-3', sortOrder: 0 },
]

describe('selectBestSnapshots — edge case: event not found in allEvents', () => {
  it('falls back to exact-match only when activeEventId is not in allEvents', () => {
    // 'ev-99' is not in EVENTS, so exact-match fallback applies
    const snaps = [
      makeSnap({ relationshipId: 'rel-1', eventId: 'ev-ch1', label: 'Earlier' }),
      makeSnap({ relationshipId: 'rel-1', eventId: 'ev-99', label: 'Exact match on unknown event' }),
    ]
    const result = selectBestSnapshots(snaps, 'ev-99', EVENTS, CHAPTERS)
    // Only the exact match for 'ev-99' should be returned
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Exact match on unknown event')
    expect(result[0].eventId).toBe('ev-99')
  })

  it('returns empty array when activeEventId is unknown and no exact match exists', () => {
    const snaps = [
      makeSnap({ relationshipId: 'rel-1', eventId: 'ev-ch1', label: 'Earlier' }),
    ]
    // 'ev-99' not in EVENTS, and no snap has eventId === 'ev-99'
    const result = selectBestSnapshots(snaps, 'ev-99', EVENTS, CHAPTERS)
    expect(result).toHaveLength(0)
  })

  it('handles multiple relationships in exact-match fallback mode', () => {
    const snaps = [
      makeSnap({ relationshipId: 'rel-1', eventId: 'ev-99', label: 'Rel1' }),
      makeSnap({ relationshipId: 'rel-2', eventId: 'ev-ch1', label: 'Rel2 no match' }),
    ]
    const result = selectBestSnapshots(snaps, 'ev-99', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].relationshipId).toBe('rel-1')
  })
})

describe('selectBestSnapshots — empty all[] fast path', () => {
  it('returns the same empty array reference immediately', () => {
    const empty: RelationshipSnapshot[] = []
    const result = selectBestSnapshots(empty, 'ev-ch1', EVENTS, CHAPTERS)
    expect(result).toBe(empty) // identity check: same reference returned
  })
})
