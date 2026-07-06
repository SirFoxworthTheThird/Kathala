import { describe, it, expect } from 'vitest'
import { computeThreadCadence } from '@/lib/plotThreads'
import type { WorldEvent, Chapter, PlotThread } from '@/types'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, threadIds: string[] = []): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [], tags: [], threadIds, sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
    status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0,
  }
}
function thread(id: string, name: string): PlotThread {
  return { id, worldId: 'w', name, color: '#f00', description: '', createdAt: 0, updatedAt: 0 }
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3), chapter('c4', 4)]

describe('computeThreadCadence', () => {
  it('maps a thread to the chapters where it is advanced', () => {
    const romance = thread('romance', 'The Romance')
    const events = [
      event('e1', 'c1', 0, ['romance']),
      event('e2', 'c2', 0, []),
      event('e4', 'c4', 0, ['romance']),
    ]
    const { rows, chapterCount } = computeThreadCadence({ threads: [romance], events, chapters })
    expect(chapterCount).toBe(4)
    const r = rows[0]
    expect(r.eventCount).toBe(2)
    expect(r.presenceByChapter).toEqual([true, false, false, true])
    expect(r.firstChapterNumber).toBe(1)
    expect(r.lastChapterNumber).toBe(4)
    expect(r.longestDormancy).toBe(2)  // ch2, ch3 with no beat
    expect(r.trailingGap).toBe(0)
  })

  it('flags a dangling thread via trailing gap', () => {
    const heist = thread('heist', 'The Heist')
    const events = [event('e1', 'c1', 0, ['heist'])]  // introduced, never returned to
    const { rows } = computeThreadCadence({ threads: [heist], events, chapters })
    expect(rows[0].trailingGap).toBe(3)
    expect(rows[0].longestDormancy).toBe(0)
  })

  it('orders threads by first appearance, unstarted ones last', () => {
    const a = thread('a', 'Alpha')       // starts ch3
    const b = thread('b', 'Beta')        // starts ch1
    const c = thread('c', 'Unstarted')   // never tagged
    const events = [
      event('e1', 'c1', 0, ['b']),
      event('e3', 'c3', 0, ['a']),
    ]
    const { rows } = computeThreadCadence({ threads: [a, b, c], events, chapters })
    expect(rows.map((r) => r.thread.id)).toEqual(['b', 'a', 'c'])
    expect(rows[2].firstChapterNumber).toBeNull()
    expect(rows[2].eventCount).toBe(0)
  })
})
