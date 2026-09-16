import { describe, it, expect } from 'vitest'
import { shelfCounts, hasShelfCounts } from '../shelfCounts'

/**
 * A blind reader run found the shelf card for *The Count of Monte Cristo*
 * saying "41 characters" beside a progress line reading "Chapter 7 of 117",
 * at which point the reader had met ten.
 */
describe('shelfCounts', () => {
  it('withholds the cast size from a reader but keeps the chapter count', () => {
    expect(shelfCounts({ readingMode: true, chapters: 117, characters: 41 }))
      .toEqual({ chapters: 117, characters: null })
  })

  it('gives a writer both', () => {
    // The other half. Without it, returning null for everything would pass the
    // test above and take the counts off every card in the app.
    expect(shelfCounts({ readingMode: false, chapters: 117, characters: 41 }))
      .toEqual({ chapters: 117, characters: 41 })
  })

  it('leaves out a count of zero rather than printing "0 characters"', () => {
    expect(shelfCounts({ readingMode: false, chapters: 0, characters: 0 }))
      .toEqual({ chapters: null, characters: null })
    expect(shelfCounts({ readingMode: false, chapters: 3, characters: 0 }))
      .toEqual({ chapters: 3, characters: null })
  })

  it('knows when there is no row worth drawing', () => {
    // The card used to draw the row on `chapters > 0 || characters > 0`. With
    // the cast withheld, a reading world with characters and no chapters would
    // have drawn an empty paragraph.
    expect(hasShelfCounts(shelfCounts({ readingMode: true, chapters: 0, characters: 41 })))
      .toBe(false)
    expect(hasShelfCounts(shelfCounts({ readingMode: true, chapters: 117, characters: 41 })))
      .toBe(true)
    expect(hasShelfCounts(shelfCounts({ readingMode: false, chapters: 0, characters: 41 })))
      .toBe(true)
  })
})
