import { describe, it, expect } from 'vitest'
import {
  firstAppearances, firstEventId, hiddenCount, isRevealed, readingProgress, revealed, sortKeysByEvent,
} from '@/lib/spoilers'

const chapters = new Map([['ch1', 1], ['ch2', 2], ['ch3', 3]])
const events = [
  { id: 'e1', chapterId: 'ch1', sortOrder: 0 },
  { id: 'e2', chapterId: 'ch1', sortOrder: 1 },
  { id: 'e3', chapterId: 'ch2', sortOrder: 0 },
  { id: 'e4', chapterId: 'ch3', sortOrder: 0 },
]
const keys = sortKeysByEvent(events, chapters)

describe('sortKeysByEvent', () => {
  it('orders by chapter first, then position within it', () => {
    expect(keys.get('e1')!).toBeLessThan(keys.get('e2')!)
    expect(keys.get('e2')!).toBeLessThan(keys.get('e3')!)
    expect(keys.get('e3')!).toBeLessThan(keys.get('e4')!)
  })

  it('skips events whose chapter is missing rather than sorting them to zero', () => {
    // A key of 0 would place an orphan before chapter one and reveal it
    // immediately, which is the wrong way to fail.
    const out = sortKeysByEvent([{ id: 'x', chapterId: 'gone', sortOrder: 0 }], chapters)
    expect(out.has('x')).toBe(false)
  })
})

describe('firstAppearances', () => {
  it('records the earliest event an entity is used at', () => {
    const first = firstAppearances([
      { entityId: 'c1', eventId: 'e4' },
      { entityId: 'c1', eventId: 'e2' },
      { entityId: 'c1', eventId: 'e3' },
    ], keys)
    expect(first.get('c1')).toBe(keys.get('e2'))
  })

  it('ignores appearances at events it cannot place', () => {
    const first = firstAppearances([{ entityId: 'c1', eventId: 'unknown' }], keys)
    expect(first.has('c1')).toBe(false)
  })

  it('handles an entity that never appears', () => {
    expect(firstAppearances([], keys).size).toBe(0)
  })
})

describe('isRevealed', () => {
  const first = firstAppearances([
    { entityId: 'early', eventId: 'e1' },
    { entityId: 'late', eventId: 'e4' },
  ], keys)

  it('shows an entity from the moment it appears', () => {
    expect(isRevealed('early', first, keys.get('e1')!)).toBe(true)
  })

  it('keeps showing it afterwards', () => {
    expect(isRevealed('early', first, keys.get('e4')!)).toBe(true)
  })

  it('hides an entity the reader has not reached', () => {
    expect(isRevealed('late', first, keys.get('e1')!)).toBe(false)
  })

  it('reveals everything when the cursor is on all chapters', () => {
    // Null is a position the reader has to choose, so it is treated as an
    // explicit request to see the whole thing.
    expect(isRevealed('late', first, null)).toBe(true)
  })

  it('shows an entity that never appears in the narration', () => {
    // Standalone reference material has no moment to be revealed at; hiding it
    // would make it permanently invisible rather than merely late.
    expect(isRevealed('unreferenced', first, keys.get('e1')!)).toBe(true)
  })
})

describe('revealed and hiddenCount', () => {
  const records = [{ id: 'early' }, { id: 'late' }, { id: 'unreferenced' }]
  const first = firstAppearances([
    { entityId: 'early', eventId: 'e1' },
    { entityId: 'late', eventId: 'e4' },
  ], keys)

  it('filters a list down to what has been met', () => {
    expect(revealed(records, first, keys.get('e1')!).map((r) => r.id))
      .toEqual(['early', 'unreferenced'])
  })

  it('counts what is being held back, for the note that explains it', () => {
    expect(hiddenCount(records, first, keys.get('e1')!)).toBe(1)
    expect(hiddenCount(records, first, keys.get('e4')!)).toBe(0)
  })

  it('hides nothing at all chapters', () => {
    expect(revealed(records, first, null)).toHaveLength(3)
    expect(hiddenCount(records, first, null)).toBe(0)
  })

  it('does not mutate the list it is given', () => {
    const copy = [...records]
    revealed(records, first, keys.get('e1')!)
    expect(records).toEqual(copy)
  })
})


describe('firstEventId', () => {
  it('finds the opening moment across chapters, not merely the first listed', () => {
    // Shuffled on purpose: a plain events[0] would pass on ordered input and
    // say nothing.
    const shuffled = [events[3], events[1], events[2], events[0]]
    expect(firstEventId(shuffled, chapters)).toBe('e1')
  })

  it('is null for a story with no events, and for events whose chapter is gone', () => {
    expect(firstEventId([], chapters)).toBeNull()
    // A chapter missing from the map has no position, so it cannot be "first".
    expect(firstEventId([{ id: 'orphan', chapterId: 'ch-gone', sortOrder: 0 }], chapters)).toBeNull()
  })

  it('breaks a tie by id, so two devices agree', () => {
    const tied = [
      { id: 'zz', chapterId: 'ch1', sortOrder: 0 },
      { id: 'aa', chapterId: 'ch1', sortOrder: 0 },
    ]
    expect(firstEventId(tied, chapters)).toBe('aa')
    expect(firstEventId([...tied].reverse(), chapters)).toBe('aa')
  })
})


describe('readingProgress', () => {
  it('reports the chapter and how many the book has', () => {
    expect(readingProgress('e3', events, chapters)).toEqual({ chapter: 2, total: 3 })
  })

  it('shows nothing rather than something wrong', () => {
    // Each of these would otherwise draw a bar the reader cannot trust.
    expect(readingProgress(null, events, chapters)).toBeNull()          // all chapters
    expect(readingProgress(undefined, events, chapters)).toBeNull()     // never opened
    expect(readingProgress('gone', events, chapters)).toBeNull()        // deleted event
    expect(readingProgress('e1', events, new Map())).toBeNull()         // no chapters
  })

  it('counts to the highest chapter, not the number of events', () => {
    // Two events in chapter 1 must not make the book look two chapters long.
    expect(readingProgress('e2', events, chapters)!.total).toBe(3)
  })
})
