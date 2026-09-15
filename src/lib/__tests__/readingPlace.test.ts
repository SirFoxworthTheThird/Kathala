import { describe, it, expect } from 'vitest'
import { readingPlace, minutesLeft, type ChapterExtent } from '../readingPlace'

/** Three chapters, 1000px each, 2000 words each. */
const CHAPTERS: ChapterExtent[] = [
  { number: 1, top: 0, height: 1000, words: 2000 },
  { number: 2, top: 1000, height: 1000, words: 2000 },
  { number: 3, top: 2000, height: 1000, words: 2000 },
]

const place = (scrollTop: number, chapters: ChapterExtent[] = CHAPTERS) =>
  readingPlace({ scrollTop, scrollHeight: 3000, clientHeight: 500, chapters })

describe('readingPlace', () => {
  it('reads 0 at the top and 100 at the bottom', () => {
    expect(place(0).percent).toBe(0)
    // Scrollable distance is 3000 - 500, so the bottom is 2500 rather than 3000.
    // Measuring against scrollHeight would stop a finished book at 83%.
    expect(place(2500).percent).toBe(100)
  })

  it('measures progress against what can be scrolled, not the column height', () => {
    expect(place(1250).percent).toBe(50)
  })

  it('never exceeds its bounds when the browser overscrolls', () => {
    expect(place(-200).percent).toBe(0)
    expect(place(99_999).percent).toBe(100)
  })

  it('reports 0 for a book that fits on one screen, not 100', () => {
    // Nothing to scroll: the reader is at the beginning of it, and a progress
    // indicator that congratulates them on finishing would be a lie.
    const short = readingPlace({
      scrollTop: 0, scrollHeight: 400, clientHeight: 800, chapters: CHAPTERS,
    })
    expect(short.percent).toBe(0)
  })

  it('names the chapter the reader is looking at', () => {
    expect(place(0).chapter?.number).toBe(1)
    expect(place(999).chapter?.number).toBe(1)
    expect(place(1000).chapter?.number).toBe(2)
    expect(place(2400).chapter?.number).toBe(3)
  })

  it('counts down the words left in that chapter', () => {
    expect(place(1000).chapter?.wordsLeft).toBe(2000) // just arrived
    expect(place(1500).chapter?.wordsLeft).toBe(1000) // halfway
    expect(place(1999).chapter?.wordsLeft).toBe(2)    // nearly out of it
  })

  it('falls back to the first chapter above the first chapter', () => {
    // An overscroll at the top of the book, which browsers do produce.
    expect(place(-50).chapter?.number).toBe(1)
  })

  it('says nothing about chapters when there are none', () => {
    expect(place(0, []).chapter).toBeNull()
    // But still reports progress, because the column still scrolls.
    expect(place(1250, []).percent).toBe(50)
  })

  it('survives a chapter of no height without dividing by zero', () => {
    const collapsed: ChapterExtent[] = [{ number: 1, top: 0, height: 0, words: 500 }]
    expect(place(0, collapsed).chapter).toEqual({ number: 1, wordsLeft: 0 })
  })
})

describe('minutesLeft', () => {
  it('converts words to minutes at a reading pace', () => {
    expect(minutesLeft(2400)).toBe(10)
    expect(minutesLeft(240)).toBe(1)
  })

  it('never promises zero minutes for prose that is still there', () => {
    // Rounding would otherwise say "0 min left" with a paragraph to go.
    expect(minutesLeft(10)).toBe(1)
    expect(minutesLeft(1)).toBe(1)
  })
})
