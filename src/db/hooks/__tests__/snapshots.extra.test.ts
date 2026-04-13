import { describe, it, expect } from 'vitest'
import { selectBestCharacterSnapshots, resolveCharacterSnapshot } from '@/db/hooks/useSnapshots'
import type { CharacterSnapshot } from '@/types'

// sortKey = chapter.number * 10_000 + event.sortOrder
// ch-1 → 10_000, ch-3 → 30_000, ch-5 → 50_000, ch-7 → 70_000
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
  // Two events in same chapter (ch-5)
  { id: 'ev-ch5-b', chapterId: 'ch-5', sortOrder: 1 },
]

const NOW = Date.now()

function makeSnap(
  overrides: Partial<CharacterSnapshot> & { characterId: string; eventId: string }
): CharacterSnapshot {
  return {
    id: `snap-${Math.random()}`,
    worldId: 'world-1',
    isAlive: true,
    currentLocationMarkerId: null,
    currentMapLayerId: null,
    inventoryItemIds: [],
    inventoryNotes: '',
    statusNotes: '',
    travelModeId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

// ── selectBestCharacterSnapshots ──────────────────────────────────────────────

describe('selectBestCharacterSnapshots', () => {
  it('returns the same empty array reference when all is empty', () => {
    const empty: CharacterSnapshot[] = []
    expect(selectBestCharacterSnapshots(empty, 'ev-ch3', EVENTS, CHAPTERS)).toBe(empty)
  })

  it('returns exact-event snapshot when one exists', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch3', statusNotes: 'at ch3' }),
    ]
    const result = selectBestCharacterSnapshots(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].statusNotes).toBe('at ch3')
    expect(result[0].eventId).toBe('ev-ch3')
  })

  it('inherits snapshot from an earlier event when no exact match', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'ch1 state' }),
    ]
    const result = selectBestCharacterSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].statusNotes).toBe('ch1 state')
    expect(result[0].eventId).toBe('ev-ch1') // inherited
  })

  it('inherits from the most recent earlier event, not the oldest', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'ch1' }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch3', statusNotes: 'ch3' }),
    ]
    const result = selectBestCharacterSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].statusNotes).toBe('ch3')
    expect(result[0].eventId).toBe('ev-ch3')
  })

  it('exact-event snapshot wins over an older inherited one', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'ch1' }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch3', statusNotes: 'ch3' }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch5', statusNotes: 'ch5 exact' }),
    ]
    const result = selectBestCharacterSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].statusNotes).toBe('ch5 exact')
    expect(result[0].eventId).toBe('ev-ch5')
  })

  it('does not inherit from future events', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch7', statusNotes: 'future' }),
    ]
    const result = selectBestCharacterSnapshots(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result).toHaveLength(0)
  })

  it('handles multiple characters independently', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'c1-ch1' }),
      makeSnap({ characterId: 'char-2', eventId: 'ev-ch3', statusNotes: 'c2-ch3' }),
    ]
    const result = selectBestCharacterSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(2)
    expect(result.find(s => s.characterId === 'char-1')!.statusNotes).toBe('c1-ch1')
    expect(result.find(s => s.characterId === 'char-2')!.statusNotes).toBe('c2-ch3')
  })

  it('alive/dead state carries forward via inheritance', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch3', isAlive: false }),
    ]
    const result = selectBestCharacterSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].isAlive).toBe(false)
    expect(result[0].eventId).toBe('ev-ch3')
  })

  it('with no active event returns the most recently updated snapshot per character', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'old', updatedAt: NOW - 1000 }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch5', statusNotes: 'recent', updatedAt: NOW }),
    ]
    const result = selectBestCharacterSnapshots(snaps, null, EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].statusNotes).toBe('recent')
  })

  it('with no active event picks latest per character across multiple characters', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', updatedAt: NOW - 500 }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch3', updatedAt: NOW }),
      makeSnap({ characterId: 'char-2', eventId: 'ev-ch5', updatedAt: NOW - 100 }),
    ]
    const result = selectBestCharacterSnapshots(snaps, null, EVENTS, CHAPTERS)
    expect(result).toHaveLength(2)
    expect(result.find(s => s.characterId === 'char-1')!.eventId).toBe('ev-ch3')
    expect(result.find(s => s.characterId === 'char-2')!.eventId).toBe('ev-ch5')
  })

  it('falls back to exact match when active event is not in allEvents', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'ch1' }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-unknown', statusNotes: 'exact unknown' }),
    ]
    const result = selectBestCharacterSnapshots(snaps, 'ev-unknown', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].statusNotes).toBe('exact unknown')
  })

  it('returns empty when active event is unknown and no exact match exists', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'ch1' }),
    ]
    const result = selectBestCharacterSnapshots(snaps, 'ev-unknown', EVENTS, CHAPTERS)
    expect(result).toHaveLength(0)
  })

  it('handles two events in the same chapter by sortOrder', () => {
    // ev-ch5 (sortOrder 0) < ev-ch5-b (sortOrder 1); viewing ev-ch5 should not see ev-ch5-b
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch5', statusNotes: 'first event ch5' }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch5-b', statusNotes: 'second event ch5' }),
    ]
    const resultAtFirst = selectBestCharacterSnapshots(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(resultAtFirst[0].statusNotes).toBe('first event ch5')

    const resultAtSecond = selectBestCharacterSnapshots(snaps, 'ev-ch5-b', EVENTS, CHAPTERS)
    expect(resultAtSecond[0].statusNotes).toBe('second event ch5')
  })

  it('ignores snapshots with unknown eventId (order === -1)', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-orphan', statusNotes: 'orphan' }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'real' }),
    ]
    const result = selectBestCharacterSnapshots(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result).toHaveLength(1)
    expect(result[0].statusNotes).toBe('real')
  })
})

// ── resolveCharacterSnapshot ──────────────────────────────────────────────────

describe('resolveCharacterSnapshot', () => {
  it('returns undefined when all is empty', () => {
    expect(resolveCharacterSnapshot([], 'ev-ch3', EVENTS, CHAPTERS)).toBeUndefined()
  })

  it('returns undefined when activeEventId is null', () => {
    const snaps = [makeSnap({ characterId: 'char-1', eventId: 'ev-ch1' })]
    expect(resolveCharacterSnapshot(snaps, null, EVENTS, CHAPTERS)).toBeUndefined()
  })

  it('returns the exact snapshot for the active event', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'ch1' }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch3', statusNotes: 'ch3' }),
    ]
    const result = resolveCharacterSnapshot(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result!.statusNotes).toBe('ch3')
    expect(result!.eventId).toBe('ev-ch3')
  })

  it('returns the most recent earlier snapshot when no exact match', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'ch1' }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch3', statusNotes: 'ch3' }),
    ]
    const result = resolveCharacterSnapshot(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result!.statusNotes).toBe('ch3')
    expect(result!.eventId).toBe('ev-ch3')
  })

  it('returns undefined when all snapshots are in the future', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch7', statusNotes: 'future' }),
    ]
    const result = resolveCharacterSnapshot(snaps, 'ev-ch3', EVENTS, CHAPTERS)
    expect(result).toBeUndefined()
  })

  it('exact event wins over an older inherited snapshot', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'old' }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch5', statusNotes: 'exact' }),
    ]
    const result = resolveCharacterSnapshot(snaps, 'ev-ch5', EVENTS, CHAPTERS)
    expect(result!.statusNotes).toBe('exact')
  })

  it('falls back to exact match when active event is unknown', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch1', statusNotes: 'ch1' }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-unknown', statusNotes: 'exact' }),
    ]
    const result = resolveCharacterSnapshot(snaps, 'ev-unknown', EVENTS, CHAPTERS)
    expect(result!.statusNotes).toBe('exact')
  })

  it('returns undefined when active event is unknown and no exact match', () => {
    const snaps = [makeSnap({ characterId: 'char-1', eventId: 'ev-ch1' })]
    expect(resolveCharacterSnapshot(snaps, 'ev-unknown', EVENTS, CHAPTERS)).toBeUndefined()
  })

  it('resolves correct snapshot across two events in the same chapter', () => {
    const snaps = [
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch5', statusNotes: 'first' }),
      makeSnap({ characterId: 'char-1', eventId: 'ev-ch5-b', statusNotes: 'second' }),
    ]
    expect(resolveCharacterSnapshot(snaps, 'ev-ch5', EVENTS, CHAPTERS)!.statusNotes).toBe('first')
    expect(resolveCharacterSnapshot(snaps, 'ev-ch5-b', EVENTS, CHAPTERS)!.statusNotes).toBe('second')
  })
})
