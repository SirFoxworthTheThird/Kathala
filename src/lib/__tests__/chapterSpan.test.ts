import { describe, it, expect } from 'vitest'
import { describeChapterSpan } from '../chapterSpan'

describe('describeChapterSpan', () => {
  it('says only the count when the timeline starts at chapter one', () => {
    // "10 chapters · Ch. 1–10" tells you nothing the count did not.
    expect(describeChapterSpan([1, 2, 3])).toBe('3 chapters')
  })

  it('spells out the span when it does not', () => {
    // The finding: "The Road to Mordor (10 chapters)" opening at Ch. 12 reads
    // as missing data rather than as the second half of a book.
    expect(describeChapterSpan([12, 13, 14, 15, 16, 17, 18, 19, 20, 21]))
      .toBe('10 chapters · Ch. 12–21')
  })

  it('does not care what order the numbers arrive in', () => {
    expect(describeChapterSpan([21, 12, 15])).toBe('3 chapters · Ch. 12–21')
  })

  it('gives a single late chapter one number rather than a range of itself', () => {
    expect(describeChapterSpan([12])).toBe('1 chapter · Ch. 12')
  })

  it('handles a gap in the numbering without claiming the missing ones', () => {
    // Deleting Ch. 13–19 leaves a real hole; the span is still the honest
    // description of where this timeline sits in the book.
    expect(describeChapterSpan([12, 20])).toBe('2 chapters · Ch. 12–20')
  })

  it('says a timeline with no chapters has none', () => {
    expect(describeChapterSpan([])).toBe('No chapters')
  })
})
