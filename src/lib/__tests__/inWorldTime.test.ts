import { describe, it, expect } from 'vitest'
import { computeInWorldDays } from '@/lib/inWorldTime'
import type { WorldEvent, Chapter } from '@/types'

function chapter(id: string, number: number, timelineId = 't1'): Chapter {
  return { id, worldId: 'w', timelineId, number, title: '', synopsis: '', notes: '', createdAt: 0, updatedAt: 0 }
}

function event(id: string, chapterId: string, sortOrder: number, opts: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: opts.timelineId ?? 't1', title: '', description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, status: 'draft', povCharacterId: null, isFlashback: false,
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
