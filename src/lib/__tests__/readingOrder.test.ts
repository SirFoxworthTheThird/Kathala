import { describe, it, expect } from 'vitest'
import { eventsInReadingOrder } from '@/lib/readingOrder'

/**
 * W-3. The rule every list of scenes has to apply before showing it to a
 * writer, because the hooks return them in Dexie's order — by primary key,
 * which has no relation to the story.
 */
describe('eventsInReadingOrder', () => {
  const chapters = [
    { id: 'c1', number: 1 },
    { id: 'c2', number: 2 },
    { id: 'c3', number: 3 },
  ]
  // Deliberately shuffled, and shuffled *across* chapters, so a function that
  // sorted only within a chapter would still be caught.
  const events = [
    { id: 'e6', chapterId: 'c3', sortOrder: 1 },
    { id: 'e1', chapterId: 'c1', sortOrder: 0 },
    { id: 'e4', chapterId: 'c2', sortOrder: 1 },
    { id: 'e5', chapterId: 'c3', sortOrder: 0 },
    { id: 'e2', chapterId: 'c1', sortOrder: 1 },
    { id: 'e3', chapterId: 'c2', sortOrder: 0 },
  ]
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

  it('orders by chapter number, then by position within the chapter', () => {
    expect(ids(eventsInReadingOrder(events, chapters))).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6'])
  })

  it('follows the chapter number, not the order chapters were stored', () => {
    // The number is the story's order; the array's order is an accident of the
    // database. Reversing the chapter list must change nothing.
    expect(ids(eventsInReadingOrder(events, [...chapters].reverse())))
      .toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6'])
  })

  it('gives the same answer whatever order it is handed', () => {
    const forwards = ids(eventsInReadingOrder(events, chapters))
    const backwards = ids(eventsInReadingOrder([...events].reverse(), chapters))
    expect(backwards).toEqual(forwards)
  })

  it('does not mutate the array it is given', () => {
    const original = [...events]
    eventsInReadingOrder(events, chapters)
    expect(events).toEqual(original)
  })

  it('keeps scenes of an unknown chapter rather than dropping them', () => {
    // A scene whose chapter is missing sorts as chapter 0 — first, and still
    // listed. Losing it silently would be worse than showing it early.
    const orphan = { id: 'orphan', chapterId: 'gone', sortOrder: 0 }
    const out = eventsInReadingOrder([...events, orphan], chapters)
    expect(out).toHaveLength(events.length + 1)
    expect(out[0].id).toBe('orphan')
  })

  it('is stable for two scenes at the same position', () => {
    const tie = [
      { id: 'first', chapterId: 'c1', sortOrder: 0 },
      { id: 'second', chapterId: 'c1', sortOrder: 0 },
    ]
    expect(ids(eventsInReadingOrder(tie, chapters))).toEqual(['first', 'second'])
  })
})
