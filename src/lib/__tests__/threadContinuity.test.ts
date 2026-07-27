import { describe, it, expect } from 'vitest'
import { computeThreadIssues } from '@/lib/threadContinuity'
import type { Chapter, PlotThread, WorldEvent } from '@/types'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, threadIds: string[] = []): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
    tags: [], threadIds, sortOrder: 0, travelDays: null, inWorldTime: null, tension: null,
    structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
    createdAt: 0, updatedAt: 0,
  }
}
function thread(id: string, name: string): PlotThread {
  return { id, worldId: 'w', name, color: '#f00', description: '', createdAt: 0, updatedAt: 0 }
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3), chapter('c4', 4), chapter('c5', 5)]

describe('computeThreadIssues', () => {
  it('flags a thread raised early and never resolved', () => {
    const heist = thread('heist', 'The Heist')
    const events = [event('e1', 'c1', ['heist'])] // introduced, then silence
    const issues = computeThreadIssues({ threads: [heist], events, chapters })
    expect(issues).toHaveLength(1)
    expect(issues[0].kind).toBe('dangling')
    expect(issues[0].threadId).toBe('heist')
    expect(issues[0].message).toContain('The Heist')
    expect(issues[0].chapterNumber).toBe(1)
  })

  it('flags a thread that goes quiet mid-story', () => {
    const romance = thread('romance', 'The Romance')
    const events = [event('e1', 'c1', ['romance']), event('e5', 'c5', ['romance'])]
    const issues = computeThreadIssues({ threads: [romance], events, chapters })
    // Ch2–4 have no beat → a 3-chapter dormancy; it ends in the final chapter,
    // so there's no trailing gap.
    expect(issues.map((i) => i.kind)).toEqual(['dormant'])
    expect(issues[0].detail).toContain('3 chapters')
  })

  it('flags a thread that exists but was never tagged', () => {
    const ghost = thread('ghost', 'Unused')
    const issues = computeThreadIssues({ threads: [ghost], events: [], chapters })
    expect(issues.map((i) => i.kind)).toEqual(['unstarted'])
    expect(issues[0].chapterNumber).toBeNull()
  })

  it('says nothing about a thread carried steadily to the end', () => {
    const main = thread('main', 'A-plot')
    const events = chapters.map((c, i) => event(`e${i}`, c.id, ['main']))
    expect(computeThreadIssues({ threads: [main], events, chapters })).toEqual([])
  })

  it('respects configurable thresholds', () => {
    const heist = thread('heist', 'The Heist')
    const events = [event('e1', 'c1', ['heist'])]
    // A 4-chapter trailing gap is under a threshold of 5.
    expect(computeThreadIssues({ threads: [heist], events, chapters, trailingChapters: 5 })).toEqual([])
  })

  it('returns nothing when there are no threads or no chapters', () => {
    expect(computeThreadIssues({ threads: [], events: [], chapters })).toEqual([])
    expect(computeThreadIssues({ threads: [thread('t', 'T')], events: [], chapters: [] })).toEqual([])
  })
})
