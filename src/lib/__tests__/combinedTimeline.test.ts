import { describe, it, expect } from 'vitest'
import { buildCombinedChronology } from '@/lib/combinedTimeline'
import type { WorldEvent, Chapter, Timeline } from '@/types'

function tl(id: string, createdAt: number): Timeline {
  return { id, worldId: 'w', name: id, description: '', color: '#000', createdAt }
}
function ch(id: string, timelineId: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId, number, title: id, synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function ev(id: string, timelineId: string, chapterId: string, opts: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId, title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
    tags: [], sortOrder: 0, travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
    threadIds: [], status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0,
    ...opts,
  }
}

describe('buildCombinedChronology', () => {
  const tA = tl('A', 1)
  const tB = tl('B', 2)
  const cA1 = ch('cA1', 'A', 1)
  const cB1 = ch('cB1', 'B', 1)

  it('interleaves two timelines by their in-world day', () => {
    // A: day 0, then +5 → day 5.  B: day 0, then +2 → day 2.
    const a0 = ev('a0', 'A', 'cA1', { sortOrder: 0 })
    const a5 = ev('a5', 'A', 'cA1', { sortOrder: 1, travelDays: 5 })
    const b0 = ev('b0', 'B', 'cB1', { sortOrder: 0 })
    const b2 = ev('b2', 'B', 'cB1', { sortOrder: 1, travelDays: 2 })

    const rows = buildCombinedChronology([a5, b2, a0, b0], [cA1, cB1], [tA, tB])
    expect(rows.map((r) => r.event.id)).toEqual(['a0', 'b0', 'b2', 'a5'])
    expect(rows.map((r) => r.day)).toEqual([0, 0, 2, 5])
  })

  it('labels each row with its own timeline and chapter', () => {
    const a0 = ev('a0', 'A', 'cA1')
    const b0 = ev('b0', 'B', 'cB1')
    const rows = buildCombinedChronology([a0, b0], [cA1, cB1], [tA, tB])
    const byEvent = new Map(rows.map((r) => [r.event.id, r]))
    expect(byEvent.get('a0')!.timeline).toBe(tA)
    expect(byEvent.get('a0')!.chapter).toBe(cA1)
    expect(byEvent.get('b0')!.timeline).toBe(tB)
    expect(byEvent.get('b0')!.chapter).toBe(cB1)
  })

  it('breaks same-day ties by timeline creation order', () => {
    // Both on day 0; A was created before B, so A comes first.
    const a0 = ev('a0', 'A', 'cA1')
    const b0 = ev('b0', 'B', 'cB1')
    const rows = buildCombinedChronology([b0, a0], [cA1, cB1], [tA, tB])
    expect(rows.map((r) => r.event.id)).toEqual(['a0', 'b0'])
  })

  it('marks an unpinned flashback so it can be shown as such', () => {
    const fb = ev('fb', 'A', 'cA1', { isFlashback: true })
    const pinned = ev('pinned', 'A', 'cA1', { isFlashback: true, inWorldTime: 3, sortOrder: 1 })
    const rows = buildCombinedChronology([fb, pinned], [cA1], [tA])
    const byEvent = new Map(rows.map((r) => [r.event.id, r]))
    expect(byEvent.get('fb')!.pinnedFlashback).toBe(true)
    expect(byEvent.get('pinned')!.pinnedFlashback).toBe(false)
  })

  it('returns an empty list when there are no events', () => {
    expect(buildCombinedChronology([], [cA1], [tA])).toEqual([])
  })
})
