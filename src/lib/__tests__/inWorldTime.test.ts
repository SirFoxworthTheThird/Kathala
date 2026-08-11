import { describe, it, expect } from 'vitest'
import { computeInWorldDays, provisionallyDatedEvents } from '@/lib/inWorldTime'
import type { WorldEvent, Chapter } from '@/types'

function chapter(id: string, number: number, timelineId = 't1'): Chapter {
  return { id, worldId: 'w', timelineId, number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}

function event(id: string, chapterId: string, sortOrder: number, opts: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: opts.timelineId ?? 't1', title: '', description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], threadIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
    createdAt: 0, updatedAt: 0, ...opts,
  }
}

describe('computeInWorldDays', () => {
  it('accumulates travelDays along narrative order', () => {
    const chapters = [chapter('c1', 1), chapter('c2', 2)]
    const events = [
      event('e1', 'c1', 0),                         // day 0 (start)
      event('e2', 'c1', 1, { travelDays: 3 }),      // +3 -> day 3
      event('e3', 'c2', 0, { travelDays: 2 }),      // +2 -> day 5
    ]
    const days = computeInWorldDays(events, chapters)
    expect(days.get('e1')).toBe(0)
    expect(days.get('e2')).toBe(3)
    expect(days.get('e3')).toBe(5)
  })

  it('treats null travelDays as zero', () => {
    const chapters = [chapter('c1', 1)]
    const events = [event('e1', 'c1', 0), event('e2', 'c1', 1)]
    const days = computeInWorldDays(events, chapters)
    expect(days.get('e1')).toBe(0)
    expect(days.get('e2')).toBe(0)
  })

  it('does not advance the clock for flashbacks', () => {
    const chapters = [chapter('c1', 1)]
    const events = [
      event('e1', 'c1', 0, { travelDays: 5 }),                    // day 5
      event('e2', 'c1', 1, { travelDays: 100, isFlashback: true }),// flashback: stays at 5
      event('e3', 'c1', 2, { travelDays: 2 }),                    // +2 -> day 7
    ]
    const days = computeInWorldDays(events, chapters)
    expect(days.get('e1')).toBe(5)
    expect(days.get('e2')).toBe(5)
    expect(days.get('e3')).toBe(7)
  })

  it('orders by chapter number then sortOrder, not array order', () => {
    const chapters = [chapter('c1', 1), chapter('c2', 2)]
    const events = [
      event('e3', 'c2', 0, { travelDays: 2 }),
      event('e1', 'c1', 0),
      event('e2', 'c1', 1, { travelDays: 3 }),
    ]
    const days = computeInWorldDays(events, chapters)
    expect(days.get('e1')).toBe(0)
    expect(days.get('e2')).toBe(3)
    expect(days.get('e3')).toBe(5)
  })

  it('honors an explicit inWorldTime and does not let it disturb the derived clock', () => {
    const chapters = [chapter('c1', 1)]
    const events = [
      event('e1', 'c1', 0, { travelDays: 2 }),                         // day 2
      event('e2', 'c1', 1, { isFlashback: true, inWorldTime: 0 }),     // pinned to day 0
      event('e3', 'c1', 2, { travelDays: 3 }),                         // 2 + 3 -> day 5 (unaffected by e2)
    ]
    const days = computeInWorldDays(events, chapters)
    expect(days.get('e1')).toBe(2)
    expect(days.get('e2')).toBe(0)
    expect(days.get('e3')).toBe(5)
  })

  it('keeps a separate clock per timeline', () => {
    const chapters = [chapter('c1', 1, 't1'), chapter('c2', 1, 't2')]
    const events = [
      event('a1', 'c1', 0, { travelDays: 4, timelineId: 't1' }),
      event('b1', 'c2', 0, { travelDays: 9, timelineId: 't2' }),
    ]
    const days = computeInWorldDays(events, chapters)
    expect(days.get('a1')).toBe(4)
    expect(days.get('b1')).toBe(9)
  })
})

describe('computeInWorldDays — per-timeline day offsets', () => {
  const chapters = [chapter('c1', 1, 't1'), chapter('c2', 1, 't2')]

  it('starts each timeline clock at its dayOffset', () => {
    const events = [
      event('a1', 'c1', 0, { timelineId: 't1' }),
      event('a2', 'c1', 1, { travelDays: 3, timelineId: 't1' }),
      event('b1', 'c2', 0, { timelineId: 't2' }),
    ]
    const days = computeInWorldDays(events, chapters, [
      { id: 't1', dayOffset: 0 },
      { id: 't2', dayOffset: 1000 },
    ])
    expect(days.get('a1')).toBe(0)
    expect(days.get('a2')).toBe(3)
    expect(days.get('b1')).toBe(1000)
  })

  it('applies the offset to pinned inWorldTime too (pins are on the timeline clock)', () => {
    const events = [event('b1', 'c2', 0, { timelineId: 't2', inWorldTime: 7 })]
    const days = computeInWorldDays(events, chapters, [{ id: 't2', dayOffset: 1000 }])
    expect(days.get('b1')).toBe(1007)
  })

  it('is unchanged when timelines are omitted or the offset is undefined', () => {
    const events = [event('b1', 'c2', 0, { travelDays: 2, timelineId: 't2' })]
    expect(computeInWorldDays(events, chapters).get('b1')).toBe(2)
    expect(computeInWorldDays(events, chapters, [{ id: 't2' }]).get('b1')).toBe(2)
  })
})

/**
 * HB-5. Five events with nothing said about their timing all landed on
 * January 1 and the page said nothing about it, so the calendar read
 * authoritative while mostly reflecting missing data. The stacking is correct;
 * what was missing was the writer being told which dates nobody chose.
 */
describe('provisionallyDatedEvents', () => {
  const chapters = [chapter('c1', 1), chapter('c2', 2)]

  it('flags the run that says nothing, and only that run', () => {
    const events = [
      event('e1', 'c1', 0),                     // first: starts the clock
      event('e2', 'c1', 1, { travelDays: 2 }),  // stated
      event('e3', 'c1', 2),                     // says nothing
      event('e4', 'c2', 0),                     // says nothing
    ]
    expect([...provisionallyDatedEvents(events, chapters)].sort()).toEqual(['e3', 'e4'])
  })

  it('counts the first event on a timeline as stated, because it cannot say anything', () => {
    // `travelDays` is days since the *previous* event, and there is none — the
    // event starts the clock, so leaving it empty is not a gap.
    const events = [event('e1', 'c1', 0)]
    expect(provisionallyDatedEvents(events, chapters).size).toBe(0)
  })

  it('treats zero as a statement, not an absence', () => {
    const stated = [event('e1', 'c1', 0), event('e2', 'c1', 1, { travelDays: 0 })]
    const absent = [event('e1', 'c1', 0), event('e2', 'c1', 1)]
    expect(provisionallyDatedEvents(stated, chapters).has('e2')).toBe(false)
    expect(provisionallyDatedEvents(absent, chapters).has('e2')).toBe(true)
  })

  it('takes a pin as stated even with no travel days', () => {
    const events = [event('e1', 'c1', 0), event('e2', 'c1', 1, { inWorldTime: 40 })]
    expect(provisionallyDatedEvents(events, chapters).has('e2')).toBe(false)
  })

  it('flags an unpinned flashback wherever it sits, including first', () => {
    // A flashback never advances the clock and reports the surrounding day,
    // which is precisely not its own date — so travelDays cannot rescue it and
    // being first does not either.
    const events = [
      event('e1', 'c1', 0, { isFlashback: true }),
      event('e2', 'c1', 1, { travelDays: 3, isFlashback: true }),
      event('e3', 'c1', 2, { isFlashback: true, inWorldTime: -100 }),
    ]
    expect([...provisionallyDatedEvents(events, chapters)].sort()).toEqual(['e1', 'e2'])
  })

  it('starts each timeline over, so a second timeline gets its own free first event', () => {
    const chs = [chapter('c1', 1), chapter('c2', 1, 't2')]
    const events = [
      event('a1', 'c1', 0),
      event('a2', 'c1', 1),
      event('b1', 'c2', 0, { timelineId: 't2' }),
    ]
    // a2 says nothing; a1 and b1 are each first on their own timeline.
    expect([...provisionallyDatedEvents(events, chs)]).toEqual(['a2'])
  })

  it('agrees with the clock about which event is first when sortOrder is shuffled', () => {
    // The two order events the same way on purpose; if they drifted, the clock
    // would start on one event and this would exempt another.
    const events = [
      event('later', 'c1', 5),
      event('first', 'c1', 1),
    ]
    expect(computeInWorldDays(events, chapters).get('first')).toBe(0)
    expect([...provisionallyDatedEvents(events, chapters)]).toEqual(['later'])
  })
})
