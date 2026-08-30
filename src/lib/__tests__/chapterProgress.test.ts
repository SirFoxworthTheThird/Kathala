import { describe, it, expect } from 'vitest'
import { chapterProgress, describeProgress, describeStatus, describeBoard } from '../chapterProgress'
import type { WorldEvent } from '@/types'

function ev(id: string, status?: string): WorldEvent {
  return {
    id,
    worldId: 'w',
    timelineId: 't',
    chapterId: 'c',
    title: id,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    ...(status ? { status: status as WorldEvent['status'] } : {}),
  } as WorldEvent
}

describe('chapterProgress', () => {
  it('counts scenes and sums their words', () => {
    const p = chapterProgress(
      [ev('a'), ev('b'), ev('c')],
      new Map([['a', 400], ['b', 840]]),
    )
    expect(p.scenes).toBe(3)
    // 'c' has no prose stored at all, which counts as zero rather than dropping
    // the scene from the tally.
    expect(p.words).toBe(1240)
  })

  it('reports the shared status when every scene agrees', () => {
    const p = chapterProgress([ev('a', 'final'), ev('b', 'final')], new Map())
    expect(p.status).toBe('final')
    expect(p.mixed).toBe(false)
  })

  it('rolls up to the least-advanced scene, not an average', () => {
    const p = chapterProgress(
      [ev('a', 'final'), ev('b', 'final'), ev('c', 'final'), ev('d', 'idea')],
      new Map(),
    )
    expect(p.status).toBe('idea')
    expect(p.mixed).toBe(true)
  })

  it('ranks an unrecognised status below every known one', () => {
    // A `.pwk` can carry any string; the one thing we cannot claim about a
    // status we do not know is that it is finished.
    const p = chapterProgress([ev('a', 'final'), ev('b', 'published')], new Map())
    expect(p.status).toBe('published')
    expect(p.mixed).toBe(true)
  })

  it('treats a scene with no status as a draft', () => {
    const p = chapterProgress([ev('a'), ev('b', 'draft')], new Map())
    expect(p.status).toBe('draft')
    expect(p.mixed).toBe(false)
  })

  it('has no status at all for a chapter with no scenes', () => {
    const p = chapterProgress([], new Map([['a', 500]]))
    expect(p).toEqual({ scenes: 0, words: 0, status: null, mixed: false })
  })
})

describe('describeProgress', () => {
  it('names both numbers, and pluralises each on its own count', () => {
    expect(describeProgress({ scenes: 3, words: 1240, status: 'draft', mixed: false }))
      .toBe('3 scenes · 1,240 words')
    expect(describeProgress({ scenes: 1, words: 1, status: 'draft', mixed: false }))
      .toBe('1 scene · 1 word')
  })

  it('omits the word count for a chapter that is outlined but not written', () => {
    expect(describeProgress({ scenes: 4, words: 0, status: 'outline', mixed: false }))
      .toBe('4 scenes')
  })

  it('says an empty chapter is empty rather than showing nothing', () => {
    // A collapsed row that showed nothing would be indistinguishable from one
    // that is full.
    expect(describeProgress({ scenes: 0, words: 0, status: null, mixed: false }))
      .toBe('No scenes')
  })
})

describe('describeBoard', () => {
  it('leads with the chapters, because chapters are the columns', () => {
    expect(describeBoard(17, 74)).toBe('17 chapters · 74 scenes')
    expect(describeBoard(1, 1)).toBe('1 chapter · 1 scene')
  })

  it('says nothing about scenes when there are none to count', () => {
    expect(describeBoard(3, 0)).toBe('3 chapters')
  })
})

describe('describeStatus', () => {
  it('distinguishes "all of them" from "the worst of them"', () => {
    // The pill shows one word either way, so the sentence is the only thing
    // separating a finished chapter from one with a single unwritten scene.
    expect(describeStatus({ scenes: 5, words: 0, status: 'final', mixed: false }))
      .toBe('Every scene is Final')
    expect(describeStatus({ scenes: 5, words: 0, status: 'idea', mixed: true }))
      .toBe('Least advanced of 5 scenes: Idea')
  })

  it('names an unrecognised status as itself', () => {
    expect(describeStatus({ scenes: 1, words: 0, status: 'published', mixed: false }))
      .toBe('Every scene is published')
  })

  it('has nothing to say about a chapter with no scenes', () => {
    expect(describeStatus({ scenes: 0, words: 0, status: null, mixed: false })).toBeNull()
  })
})
