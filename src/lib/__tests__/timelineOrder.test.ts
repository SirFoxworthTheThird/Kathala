import { describe, it, expect } from 'vitest'
import { compareTimelines, inBookChapterOrder, inTimelineOrder, movedOrder } from '@/lib/timelineOrder'

const tl = (id: string, createdAt: number, position?: number) => ({ id, createdAt, ...(position === undefined ? {} : { position }) })

describe('the order of a world’s timelines', () => {
  it('follows the writer’s positions, not creation or id', () => {
    const ts = [tl('a', 1, 2), tl('b', 2, 0), tl('c', 3, 1)]
    expect(inTimelineOrder(ts).map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })

  it('puts a timeline with no position, from an older file, after the placed ones, by creation', () => {
    const ts = [tl('old2', 5), tl('placed', 9, 0), tl('old1', 4)]
    expect(inTimelineOrder(ts).map((t) => t.id)).toEqual(['placed', 'old1', 'old2'])
    expect(compareTimelines(tl('x', 1), tl('y', 1))).toBeLessThan(0)
  })

  it('moves one to an index, clamped to the ends', () => {
    const ts = [tl('compact', 1, 0), tl('mercy', 2, 1), tl('quiet', 3, 2)]
    expect(movedOrder(ts, 'mercy', 0)).toEqual(['mercy', 'compact', 'quiet'])
    expect(movedOrder(ts, 'compact', 2)).toEqual(['mercy', 'quiet', 'compact'])
    expect(movedOrder(ts, 'compact', 99)).toEqual(['mercy', 'quiet', 'compact'])
    expect(movedOrder(ts, 'quiet', -1)).toEqual(['quiet', 'compact', 'mercy'])
    expect(movedOrder(ts, 'nobody', 0)).toEqual(['compact', 'mercy', 'quiet'])
  })
})

describe('the book’s chapters in reading order', () => {
  it('by number, and where two timelines share one, in the timelines’ order', () => {
    const timelines = [tl('mercy', 1, 1), tl('compact', 2, 0)]
    const ch = (id: string, number: number, timelineId: string) => ({ id, number, timelineId })
    // Ids that sort the other way, so the timelines' order is what decides.
    const order = inBookChapterOrder([ch('a2', 2, 'mercy'), ch('z2', 2, 'compact'), ch('m1', 1, 'mercy'), ch('x3', 3, 'gone')], timelines)
    expect(order.map((c) => c.id)).toEqual(['m1', 'z2', 'a2', 'x3'])
  })
})
