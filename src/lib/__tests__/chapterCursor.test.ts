import { describe, it, expect } from 'vitest'
import { cursorForChapter } from '@/lib/chapterCursor'

const ev = (id: string, sortOrder: number) => ({ id, sortOrder })

describe('cursorForChapter', () => {
  it('opens a chapter at its first moment when the cursor is elsewhere', () => {
    const events = [ev('b', 1), ev('a', 0), ev('c', 2)]
    expect(cursorForChapter(events, 'somewhere-else')).toBe('a')
  })

  it('does the same when no cursor is set at all', () => {
    // "All chapters" is the state a brand-new world starts in, and the state
    // the first-run guide used to leave behind.
    expect(cursorForChapter([ev('a', 0), ev('b', 1)], null)).toBe('a')
  })

  it('leaves the cursor alone when it is already in this chapter', () => {
    // A writer who set the cursor to a scene and then opened its chapter has
    // already said where they want to be.
    const events = [ev('a', 0), ev('b', 1), ev('c', 2)]
    expect(cursorForChapter(events, 'b')).toBeNull()
    expect(cursorForChapter(events, 'a')).toBeNull()
    expect(cursorForChapter(events, 'c')).toBeNull()
  })

  it('has nothing to point at in an empty chapter', () => {
    expect(cursorForChapter([], null)).toBeNull()
    expect(cursorForChapter([], 'anything')).toBeNull()
  })

  it('breaks ties on id, so the answer does not depend on query order', () => {
    const one = [ev('z', 0), ev('a', 0)]
    const other = [ev('a', 0), ev('z', 0)]
    expect(cursorForChapter(one, null)).toBe('a')
    expect(cursorForChapter(other, null)).toBe('a')
  })

  it('does not mutate the list it is given', () => {
    const events = [ev('b', 1), ev('a', 0)]
    cursorForChapter(events, null)
    expect(events.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('uses sortOrder rather than position', () => {
    // The first event in the array is not necessarily the first in the chapter.
    expect(cursorForChapter([ev('late', 9), ev('early', 1)], null)).toBe('early')
  })
})
