import { describe, it, expect } from 'vitest'
import { eventsInReadingOrder, byReadingPosition } from '@/lib/readingOrder'

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

/**
 * F-8. The same fault one list along: a fact's *Known by* list came back in
 * primary-key order, so a secret learned in chapters 1, 2 and 3 read
 * "Ch.3, Ch.1, Ch.2".
 */
describe('byReadingPosition', () => {
  // Positions as `eventsInReadingOrder` would produce them.
  const position = new Map([['e1', 0], ['e2', 1], ['e3', 2]])
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

  it('puts records in the order their events are read', () => {
    const reveals = [
      { id: 'r-third', eventId: 'e3' },
      { id: 'r-first', eventId: 'e1' },
      { id: 'r-second', eventId: 'e2' },
    ]
    expect(ids(byReadingPosition(reveals, position))).toEqual(['r-first', 'r-second', 'r-third'])
  })

  /*
    Two people learning it in the same scene cannot be separated by the read,
    so they keep the order they arrived in. Asserting this is what stops a
    "tidier" secondary sort being added later on a key the reader cannot see.
  */
  it('keeps records on the same event in the order given', () => {
    const together = [
      { id: 'kel', eventId: 'e2' },
      { id: 'ilva', eventId: 'e2' },
      { id: 'sarn', eventId: 'e2' },
    ]
    expect(ids(byReadingPosition(together, position))).toEqual(['kel', 'ilva', 'sarn'])
  })

  it('sorts a record whose event is unknown last, rather than dropping it', () => {
    const withOrphan = [
      { id: 'orphan', eventId: 'gone' },
      { id: 'r-second', eventId: 'e2' },
      { id: 'r-first', eventId: 'e1' },
    ]
    expect(ids(byReadingPosition(withOrphan, position))).toEqual(['r-first', 'r-second', 'orphan'])
  })

  /*
    A pair, both ways round, and this is the shape that actually pins the rule
    down. The three-record case above cannot: break the comparator so that an
    unknown event sorts *first* and it becomes self-contradictory — orphan
    before known by one comparison, known before orphan by another — and what
    V8 does with three elements after that is undefined, which for this fixture
    happened to be the right answer. Two elements is one comparison, and each
    ordering exercises a different branch of it.
  */
  it.each([
    ['unknown first', [{ id: 'orphan', eventId: 'gone' }, { id: 'known', eventId: 'e1' }]],
    ['unknown second', [{ id: 'known', eventId: 'e1' }, { id: 'orphan', eventId: 'gone' }]],
  ])('puts the known record ahead of the unknown one, given %s', (_label, pair) => {
    expect(ids(byReadingPosition(pair, position))).toEqual(['known', 'orphan'])
  })

  it('keeps two unknown events together rather than reordering them', () => {
    const bothGone = [{ id: 'a', eventId: 'x' }, { id: 'b', eventId: 'y' }]
    expect(ids(byReadingPosition(bothGone, position))).toEqual(['a', 'b'])
  })

  it('does not mutate the array it is given', () => {
    const reveals = [{ id: 'b', eventId: 'e2' }, { id: 'a', eventId: 'e1' }]
    const original = [...reveals]
    byReadingPosition(reveals, position)
    expect(reveals).toEqual(original)
  })

  it('returns an empty list unchanged', () => {
    expect(byReadingPosition([], position)).toEqual([])
  })
})
