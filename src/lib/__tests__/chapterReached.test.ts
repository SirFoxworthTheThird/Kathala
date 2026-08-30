import { describe, it, expect } from 'vitest'
import { chapterWithheld } from '@/lib/chapterReached'

/**
 * The rule that decides whether a reader is allowed to see a chapter's page.
 * `ChapterRow` has applied it to its synopsis all along; the detail page behind
 * that row applied nothing, which is how a reader run found chapter 17 of
 * *Philosopher's Stone* from chapter 4.
 */

const reading = (chapterNumber: number | null) => ({ active: true, chapterNumber })

describe('chapterWithheld', () => {
  it('withholds a chapter past the reader', () => {
    expect(chapterWithheld(reading(4), 5)).toBe(true)
    expect(chapterWithheld(reading(4), 17)).toBe(true)
  })

  it('allows the chapter the reader is in, and everything before it', () => {
    expect(chapterWithheld(reading(4), 4)).toBe(false)
    expect(chapterWithheld(reading(4), 1)).toBe(false)
  })

  /*
    Both halves of "not gated" — a writer, and a reader who has deliberately
    asked for the whole book. Without these the rule would be satisfied by one
    that hides everything from everybody.
  */
  it('withholds nothing while writing', () => {
    expect(chapterWithheld({ active: false, chapterNumber: 4 }, 17)).toBe(false)
  })

  it('withholds nothing from a reader who chose to see it all', () => {
    // "All chapters" is a cursor of null: they asked, and were warned.
    expect(chapterWithheld(reading(null), 17)).toBe(false)
  })

  it('compares by number, so a chapter with no events is still held back', () => {
    // The reason this is a number comparison rather than an event lookup.
    expect(chapterWithheld(reading(1), 2)).toBe(true)
  })
})
