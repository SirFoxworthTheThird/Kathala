import { describe, it, expect, vi } from 'vitest'
import { firstSceneId, cursorForScene, seedReadingStart } from '../readingPosition'

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
