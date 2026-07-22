import { describe, it, expect } from 'vitest'
import { buildCombinedChronology, buildCombinedSequence, groupChapterRuns } from '@/lib/combinedTimeline'
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

describe('buildCombinedSequence — chapter order', () => {
  const tA = tl('A', 1)
  const tB = tl('B', 2)
  const cA1 = ch('cA1', 'A', 1)
  const cB1 = ch('cB1', 'B', 1)

  it('orders by timeline then chapter, ignoring in-world day', () => {
    // Even though B's events happen earlier in-world, chapter order keeps each
    // timeline's chapters together (A first — created first).
    const a0 = ev('a0', 'A', 'cA1', { sortOrder: 0 })
    const a1 = ev('a1', 'A', 'cA1', { sortOrder: 1, travelDays: 9 })
    const b0 = ev('b0', 'B', 'cB1', { sortOrder: 0 })
    const rows = buildCombinedSequence([b0, a1, a0], [cA1, cB1], [tA, tB], 'chapter')
    expect(rows.map((r) => r.event.id)).toEqual(['a0', 'a1', 'b0'])
  })
})

describe('groupChapterRuns', () => {
  const tA = tl('A', 1)
  const tB = tl('B', 2)
  const cA1 = ch('cA1', 'A', 1)
  const cB1 = ch('cB1', 'B', 1)

  it('collapses each chapter into one run in chapter order', () => {
    const rows = buildCombinedSequence(
      [ev('a0', 'A', 'cA1', { sortOrder: 0 }), ev('a1', 'A', 'cA1', { sortOrder: 1 }), ev('b0', 'B', 'cB1')],
      [cA1, cB1], [tA, tB], 'chapter',
    )
    const runs = groupChapterRuns(rows)
    expect(runs.map((r) => r.chapter!.id)).toEqual(['cA1', 'cB1'])
    expect(runs[0].events.map((e) => e.id)).toEqual(['a0', 'a1'])
    expect(runs[0].timeline).toBe(tA)
  })

  it('lets a chapter recur when scenes are braided in chrono order', () => {
    // A day0, B day0, A day5, B day3 → chrono: a0, b0, b3, a5 → runs A,B,A.
    const a0 = ev('a0', 'A', 'cA1', { sortOrder: 0 })
    const a5 = ev('a5', 'A', 'cA1', { sortOrder: 1, travelDays: 5 })
    const b0 = ev('b0', 'B', 'cB1', { sortOrder: 0 })
    const b3 = ev('b3', 'B', 'cB1', { sortOrder: 1, travelDays: 3 })
    const rows = buildCombinedSequence([a0, a5, b0, b3], [cA1, cB1], [tA, tB], 'chrono')
    const runs = groupChapterRuns(rows)
    expect(runs.map((r) => r.chapter!.id)).toEqual(['cA1', 'cB1', 'cA1'])
  })
})
