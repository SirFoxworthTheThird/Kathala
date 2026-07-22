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

  it('breaks a same chapter-number tie by timeline, ignoring in-world day', () => {
    // Both are chapter 1; A comes first (created first). B's earlier in-world
    // day is irrelevant to chapter order.
    const a0 = ev('a0', 'A', 'cA1', { sortOrder: 0 })
    const a1 = ev('a1', 'A', 'cA1', { sortOrder: 1, travelDays: 9 })
    const b0 = ev('b0', 'B', 'cB1', { sortOrder: 0 })
    const rows = buildCombinedSequence([b0, a1, a0], [cA1, cB1], [tA, tB], 'chapter')
    expect(rows.map((r) => r.event.id)).toEqual(['a0', 'a1', 'b0'])
  })

  it('follows global chapter number for continuously-numbered timelines (The Two Towers)', () => {
    // Two same-timestamp timelines: "Rohan" = ch1–2, "Road" = ch12–13. Chapter
    // order must read 1,2,12,13 no matter which timeline sorts first — the bug
    // was that an equal-timestamp tie could start the merge at chapter 12.
    const rohan = tl('rohan', 1000)
    const road  = tl('road', 1000) // identical createdAt
    const cR1 = ch('cR1', 'rohan', 1)
    const cR2 = ch('cR2', 'rohan', 2)
    const cD12 = ch('cD12', 'road', 12)
    const cD13 = ch('cD13', 'road', 13)
    const evs = [
      ev('d12', 'road', 'cD12'), ev('d13', 'road', 'cD13'),
      ev('r1', 'rohan', 'cR1'), ev('r2', 'rohan', 'cR2'),
    ]
    // Pass Road first — the order that used to start the merge at chapter 12.
    const rows = buildCombinedSequence(evs, [cD12, cD13, cR1, cR2], [road, rohan], 'chapter')
    expect(rows.map((r) => r.chapter!.number)).toEqual([1, 2, 12, 13])
    expect(rows[0].event.id).toBe('r1')
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
