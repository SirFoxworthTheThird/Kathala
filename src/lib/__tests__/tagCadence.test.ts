import { describe, it, expect } from 'vitest'
import { computeTagCadence } from '@/lib/tagCadence'
import type { WorldEvent, Chapter, Motif } from '@/types'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, motifIds: string[] = []): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [], tags: [],
    threadIds: [], motifIds, sortOrder: 0,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
    status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0,
  }
}
function motif(id: string, name: string): Motif {
  return { id, worldId: 'w', name, color: '#f00', description: '', createdAt: 0, updatedAt: 0 }
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3), chapter('c4', 4)]
const tagIdsOf = (e: WorldEvent) => e.motifIds ?? []

describe('computeTagCadence', () => {
  it('maps an entity to the chapters where it recurs, with a mid-story gap', () => {
    const mirrors = motif('mirrors', 'Mirrors')
    const events = [event('e1', 'c1', ['mirrors']), event('e2', 'c2'), event('e4', 'c4', ['mirrors'])]
    const { rows, chapterCount } = computeTagCadence({ entities: [mirrors], events, chapters, tagIdsOf })
    expect(chapterCount).toBe(4)
    const r = rows[0]
    expect(r.entity.id).toBe('mirrors')
    expect(r.eventCount).toBe(2)
    expect(r.presenceByChapter).toEqual([true, false, false, true])
    expect(r.firstChapterNumber).toBe(1)
    expect(r.lastChapterNumber).toBe(4)
    expect(r.longestDormancy).toBe(2) // ch2, ch3 empty between first and last
    expect(r.trailingGap).toBe(0)
  })

  it('reports a trailing gap for an entity that fades out early', () => {
    const red = motif('red', 'The colour red')
    const events = [event('e1', 'c1', ['red'])] // only in ch1 of 4
    const { rows } = computeTagCadence({ entities: [red], events, chapters, tagIdsOf })
    expect(rows[0].trailingGap).toBe(3) // ch2, ch3, ch4 without it
    expect(rows[0].longestDormancy).toBe(0)
  })

  it('orders rows by first appearance, untagged entities last', () => {
    const a = motif('a', 'Alpha')   // appears ch3
    const b = motif('b', 'Beta')    // appears ch1
    const c = motif('c', 'Gamma')   // never tagged
    const events = [event('e1', 'c1', ['b']), event('e3', 'c3', ['a'])]
    const { rows } = computeTagCadence({ entities: [a, b, c], events, chapters, tagIdsOf })
    expect(rows.map((r) => r.entity.id)).toEqual(['b', 'a', 'c'])
    expect(rows[2].firstChapterNumber).toBeNull()
    expect(rows[2].eventCount).toBe(0)
  })

  it('counts multiple beats within the same chapter once for presence', () => {
    const m = motif('m', 'Exile')
    const events = [event('e1', 'c1', ['m']), event('e2', 'c1', ['m'])]
    const { rows } = computeTagCadence({ entities: [m], events, chapters, tagIdsOf })
    expect(rows[0].eventCount).toBe(2)
    expect(rows[0].presenceByChapter).toEqual([true, false, false, false])
  })
})
