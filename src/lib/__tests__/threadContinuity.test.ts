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

/**
 * A longer book, for the checks that are about a thread's *rhythm*.
 *
 * Dormancy is measured against the thread's own span as well as an absolute
 * floor, so a gap has to be both long and a big share of that thread's life.
 * Three quiet chapters in a five-chapter book is not it — nor, on the shipped
 * Monte Cristo, were 7 quiet chapters across the 101 that the book's main
 * thread runs over.
 */
const longBook = Array.from({ length: 20 }, (_, i) => chapter(`b${i + 1}`, i + 1))

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
    // Beats in Ch. 1 and Ch. 20: eighteen quiet chapters out of the twenty it
    // runs across. It ends in the final chapter, so there is no trailing gap.
    const events = [event('e1', 'b1', ['romance']), event('e20', 'b20', ['romance'])]
    const issues = computeThreadIssues({ threads: [romance], events, chapters: longBook })
    expect(issues.map((i) => i.kind)).toEqual(['dormant'])
    expect(issues[0].detail).toContain('18 chapters')
  })

  /**
   * The other half of the rule, and the finding it came from: a flat three
   * chapters reported 9 of Monte Cristo's 14 threads, including the spine of
   * the book — 52 beats across 101 chapters, longest silence 7.
   */
  it('says nothing about a thread that is merely breathing', () => {
    const spine = thread('spine', 'The Spine')
    // A beat every other chapter: gaps of one, all the way to the end.
    const events = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 20].map((n) => event(`e${n}`, `b${n}`, ['spine']))
    expect(computeThreadIssues({ threads: [spine], events, chapters: longBook })).toEqual([])
  })

  /**
   * The floor's own case, which the share alone would not catch: three quiet
   * chapters is 60% of a five-chapter thread's life, and still not something to
   * tell a writer about. Both halves of the rule have to hold.
   */
  it('and nothing about a big share of a very short thread', () => {
    const brief = thread('brief', 'The Brief Affair')
    const events = [event('e1', 'c1', ['brief']), event('e5', 'c5', ['brief'])]
    expect(computeThreadIssues({ threads: [brief], events, chapters })).toEqual([])
  })

  it('and nothing about a long gap that is still a small share of a long thread', () => {
    const wide = thread('wide', 'The Long Game')
    /*
      Five quiet chapters — over the floor — but the thread runs across all
      twenty, so five is under a third of its life. This is Monte Cristo's
      "Four Debts of Revenge": 7 quiet chapters out of the 101 it spans.
    */
    const events = [1, 2, 3, 9, 10, 11, 12, 14, 16, 18, 20].map((n) => event(`e${n}`, `b${n}`, ['wide']))
    expect(computeThreadIssues({ threads: [wide], events, chapters: longBook })).toEqual([])
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

/**
 * A writer needs a way to *answer* this, not just to dismiss it. The report
 * told them to "resolve it or carry it into a later scene", and resolving one
 * was not something the app could do — so the only way to clear the warning was
 * to tag a late scene, which is a lie about a subplot that genuinely lands in
 * Ch. 40 of 117.
 *
 * Measured on the shipped Monte Cristo, this rule alone was 10 of the checker's
 * 50 findings, none of them actionable.
 */
describe('a thread that says where it lands', () => {
  const events = [event('e1', 'c1', ['heist'])]

  it('does not dangle once the writer says where it resolves', () => {
    const heist: PlotThread = { ...thread('heist', 'The Heist'), resolvedEventId: 'e1' }
    expect(computeThreadIssues({ threads: [heist], events, chapters })).toEqual([])
  })

  it('and does dangle until they do — the pair, so neither half is vacuous', () => {
    const heist = thread('heist', 'The Heist')
    expect(computeThreadIssues({ threads: [heist], events, chapters })[0].kind).toBe('dangling')
  })

  it('treats an explicit null the way it treats an absent field', () => {
    // Reopening writes null rather than deleting the key.
    const reopened: PlotThread = { ...thread('heist', 'The Heist'), resolvedEventId: null }
    expect(computeThreadIssues({ threads: [reopened], events, chapters })[0].kind).toBe('dangling')
  })

  /**
   * Resolution answers "never resolved". It does not answer "went quiet for ten
   * chapters in the middle", which is a different observation about a different
   * part of the book — and silencing it here would be dismissal wearing the
   * costume of an answer.
   */
  it('does not silence a mid-story gap, which it has not answered', () => {
    const slow: PlotThread = { ...thread('slow', 'The Slow Burn'), resolvedEventId: 'e20' }
    const spread = [event('e1', 'b1', ['slow']), event('e20', 'b20', ['slow'])]
    const kinds = computeThreadIssues({ threads: [slow], events: spread, chapters: longBook }).map((i) => i.kind)
    expect(kinds).toEqual(['dormant'])
  })

  it('still says a resolved thread has no scenes, since that is not resolution either', () => {
    const ghost: PlotThread = { ...thread('ghost', 'The Ghost'), resolvedEventId: 'e1' }
    expect(computeThreadIssues({ threads: [ghost], events: [], chapters })[0].kind).toBe('unstarted')
  })

  it('names the scene a writer would resolve at — its own last beat', () => {
    const heist = thread('heist', 'The Heist')
    const twoBeats = [event('e1', 'c1', ['heist']), event('e2', 'c2', ['heist'])]
    const issue = computeThreadIssues({ threads: [heist], events: twoBeats, chapters })[0]
    expect(issue.lastEventId).toBe('e2')
  })
})
