import { describe, it, expect, vi } from 'vitest'
import { aheadOfReader, firstSceneId, cursorForScene, seedReadingStart } from '../readingPosition'
import { computeSortKeySync } from '../sortKey'

const chapters = [
  { id: 'c2', number: 2 },
  { id: 'c1', number: 1 },
]
const events = [
  { id: 'e1b', chapterId: 'c1', sortOrder: 2 },
  { id: 'e2a', chapterId: 'c2', sortOrder: 1 },
  { id: 'e1a', chapterId: 'c1', sortOrder: 1 },
]

describe('firstSceneId', () => {
  it('finds the opening scene in story order, not array order', () => {
    expect(firstSceneId(chapters, events)).toBe('e1a')
  })

  it('has nothing to open at in an empty world', () => {
    expect(firstSceneId([], [])).toBeNull()
    expect(firstSceneId(chapters, [])).toBeNull()
  })

  it('skips an event whose chapter is missing rather than letting it win', () => {
    // An unplaceable event sorts to -1, which would otherwise be the lowest key
    // in the book and open every world on an orphan.
    const orphaned = [{ id: 'lost', chapterId: 'gone', sortOrder: 0 }, ...events]
    expect(firstSceneId(chapters, orphaned)).toBe('e1a')
  })
})

/**
 * The two rules that keep an automatically-moving cursor from taking something
 * away from the reader. Both were written for a specific way of losing: a
 * reader who chose to see the whole book having it closed again, and a reader
 * turning back a page watching what they had learned disappear.
 */
describe('cursorForScene', () => {
  it('moves the cursor on when the reader reaches a later scene', () => {
    expect(cursorForScene({ cursor: 1.000001, scene: { id: 'e2', sortKey: 1.000002 } })).toBe('e2')
  })

  it('never moves a null cursor, because null is a choice to see everything', () => {
    expect(cursorForScene({ cursor: null, scene: { id: 'e2', sortKey: 9 } })).toBeNull()
  })

  it('never goes backwards when the reader turns back', () => {
    expect(cursorForScene({ cursor: 5, scene: { id: 'earlier', sortKey: 2 } })).toBeNull()
  })

  it('stays put on the scene it is already on', () => {
    expect(cursorForScene({ cursor: 3, scene: { id: 'same', sortKey: 3 } })).toBeNull()
  })
})

describe('seedReadingStart', () => {
  const deps = (readingMode: boolean, load = { chapters, events }) => ({
    isReadingMode: vi.fn(async () => readingMode),
    load: vi.fn(async () => load),
    seed: vi.fn(),
  })

  it('opens a reading-mode world at its first scene', async () => {
    const d = deps(true)
    await expect(seedReadingStart('w', d)).resolves.toBe('e1a')
    expect(d.seed).toHaveBeenCalledWith('w', 'e1a')
  })

  it('leaves a world that is not in reading mode alone', async () => {
    const d = deps(false)
    await expect(seedReadingStart('w', d)).resolves.toBeNull()
    expect(d.seed).not.toHaveBeenCalled()
    // And does not even ask for its chapters.
    expect(d.load).not.toHaveBeenCalled()
  })

  it('leaves an empty world alone, since there is no scene to open at', async () => {
    const d = deps(true, { chapters: [], events: [] })
    await expect(seedReadingStart('w', d)).resolves.toBeNull()
    expect(d.seed).not.toHaveBeenCalled()
  })
})

describe('aheadOfReader: a link in reading mode, against the reader\'s place', () => {
  // Chapter 1 has scenes a and b, chapter 2 scene c, chapter 3 none yet.
  const eventById = new Map([
    ['a', { chapterId: 'c1', sortOrder: 1 }],
    ['b', { chapterId: 'c1', sortOrder: 2 }],
    ['c', { chapterId: 'c2', sortOrder: 1 }],
  ])
  const chapterNumberById = new Map([['c1', 1], ['c2', 2], ['c3', 3]])
  const at = (id: string) => computeSortKeySync(id, eventById, chapterNumberById)
  const ahead = (cursor: string | null, target: string) =>
    aheadOfReader(cursor === null ? null : at(cursor), target, eventById, chapterNumberById)

  it('a scene or a chapter past the place is ahead; at or before it, not', () => {
    expect(ahead('a', 'b')).toBe(true)
    expect(ahead('a', 'c2')).toBe(true)
    expect(ahead('b', 'a')).toBe(false)
    expect(ahead('b', 'b')).toBe(false)
    // The chapter the reader is in, by its first scene: going to its start is looking back.
    expect(ahead('b', 'c1')).toBe(false)
  })

  it('a chapter with no scenes by its number; all chapters shown, or a link to nothing known, never ahead', () => {
    expect(ahead('c', 'c3')).toBe(true)
    expect(ahead(null, 'c2')).toBe(false)
    expect(ahead('a', 'nowhere')).toBe(false)
  })
})
