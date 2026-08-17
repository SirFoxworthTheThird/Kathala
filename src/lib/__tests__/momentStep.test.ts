import { describe, it, expect } from 'vitest'
import { neighbouringMoments } from '@/lib/momentStep'

/**
 * WRUN-12. What the Writer's Brief's own prev/next controls step to.
 */
describe('neighbouringMoments', () => {
  const ordered = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('gives both neighbours in the middle of the book', () => {
    expect(neighbouringMoments(ordered, 'b')).toEqual({ prev: { id: 'a' }, next: { id: 'c' } })
  })

  it('has nothing before the first moment or after the last', () => {
    expect(neighbouringMoments(ordered, 'a').prev).toBeNull()
    expect(neighbouringMoments(ordered, 'c').next).toBeNull()
    // Paired, so "null" cannot pass for a function that returns null throughout.
    expect(neighbouringMoments(ordered, 'a').next).toEqual({ id: 'b' })
    expect(neighbouringMoments(ordered, 'c').prev).toEqual({ id: 'b' })
  })

  it('steps forward from "all chapters" into the first moment', () => {
    // No cursor is not a position in the book; forward means "begin", which is
    // what the top bar's own control does from the same state.
    expect(neighbouringMoments(ordered, null)).toEqual({ prev: null, next: { id: 'a' } })
  })

  it('offers nothing at all in a world with no scenes', () => {
    expect(neighbouringMoments([], null)).toEqual({ prev: null, next: null })
    expect(neighbouringMoments([], 'a')).toEqual({ prev: null, next: null })
  })

  it('offers nothing for a cursor pointing at a scene that is gone', () => {
    // Deleted from another screen while the panel is open. Better both controls
    // go quiet than that "next" silently restarts the book.
    expect(neighbouringMoments(ordered, 'deleted')).toEqual({ prev: null, next: null })
  })

  it('follows the order it is given, not the ids', () => {
    // The caller sorts with `eventsInReadingOrder`; this must not re-sort or
    // assume anything about how ids compare.
    const shuffled = [{ id: 'c' }, { id: 'a' }, { id: 'b' }]
    expect(neighbouringMoments(shuffled, 'a')).toEqual({ prev: { id: 'c' }, next: { id: 'b' } })
  })

  it('works in a book of one moment', () => {
    expect(neighbouringMoments([{ id: 'only' }], 'only')).toEqual({ prev: null, next: null })
  })
})
