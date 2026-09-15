import { describe, it, expect } from 'vitest'
import { chaptersBehind, shouldOfferReturn, type ContentsChapter } from '../readingContents'

const CHAPTERS: ContentsChapter[] = [
  { id: 'c1', number: 1, title: 'Down the Rabbit-Hole' },
  { id: 'c2', number: 2, title: 'The Pool of Tears' },
  { id: 'c3', number: 3, title: 'A Caucus-Race' },
  { id: 'c4', number: 4, title: 'The Rabbit Sends in a Little Bill' },
]

describe('chaptersBehind', () => {
  it('offers the chapters the reader has reached, including the one they are in', () => {
    expect(chaptersBehind(CHAPTERS, 2).map((c) => c.number)).toEqual([1, 2])
  })

  it('never offers a chapter ahead, because the click would be the reveal', () => {
    // The prose of the whole book is in the column, so *reading* into chapter 4
    // advances the gate a scene at a time and is ordinary. A click that lands
    // there from chapter 1 would advance it three chapters at once and unlock
    // the cast, the places and the lore of a book nobody has read — R14, where
    // the reveal was the click rather than the screen it landed on.
    const offered = chaptersBehind(CHAPTERS, 1)
    expect(offered.map((c) => c.number)).toEqual([1])
    expect(offered.some((c) => c.number > 1)).toBe(false)
  })

  it('offers the whole book to a reader who asked for all chapters', () => {
    // A null gate is a deliberate full reveal, so there is nothing to withhold.
    expect(chaptersBehind(CHAPTERS, null)).toHaveLength(4)
  })

  it('offers nothing above a gate below the first chapter', () => {
    expect(chaptersBehind(CHAPTERS, 0)).toEqual([])
  })

  it('does not hand back the caller’s array to be mutated', () => {
    const all = chaptersBehind(CHAPTERS, null)
    all.pop()
    expect(CHAPTERS).toHaveLength(4)
  })
})

describe('shouldOfferReturn', () => {
  const at = (scrollTop: number, placeTop: number | null = 5000) =>
    shouldOfferReturn({ scrollTop, placeTop, clientHeight: 800 })

  it('offers the way back once the reader has left their place', () => {
    expect(at(1000)).toBe(true)
  })

  it('stays quiet while they are still on it', () => {
    expect(at(5000)).toBe(false)
    expect(at(4900), 'a heading just above the fold is not wandering off').toBe(false)
  })

  it('stays quiet below their place, where reading on has already moved it', () => {
    // Scrolling down moves the cursor with them, so there is nothing to return
    // to that is not where they already are.
    expect(at(9000)).toBe(false)
  })

  it('needs more than half a screen of distance before it speaks', () => {
    // The threshold is what keeps this off a screen whose point is quiet.
    // Half of 800 is 400, so exactly 400 away is still "on it" and 401 is not.
    expect(at(5000 - 400), 'exactly half a screen is not yet away').toBe(false)
    expect(at(5000 - 401), 'a pixel past it is').toBe(true)
  })

  it('says nothing when there is no place to return to', () => {
    expect(at(0, null)).toBe(false)
  })
})
