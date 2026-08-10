import { describe, it, expect } from 'vitest'
import { describeHidden, describeReadingPosition } from '../readingNotice'

const counts = (characters = 0, locations = 0, items = 0) => ({ characters, locations, items })

describe('describeHidden', () => {
  it('lists the groups in reading order, with an "and" before the last', () => {
    expect(describeHidden(counts(12, 4, 2))).toBe('12 characters, 4 places and 2 items')
  })

  it('joins two groups without a comma', () => {
    expect(describeHidden(counts(12, 0, 2))).toBe('12 characters and 2 items')
  })

  it('leaves out a group with none of its kind rather than reporting zero', () => {
    // A reader who has met everyone does not need to be told there are no
    // characters left to meet.
    expect(describeHidden(counts(0, 3, 0))).toBe('3 places')
  })

  it('singularises each group on its own count', () => {
    expect(describeHidden(counts(1, 1, 1))).toBe('1 character, 1 place and 1 item')
  })

  it('says nothing at all when nothing is hidden', () => {
    expect(describeHidden(counts())).toBeNull()
  })
})

describe('describeReadingPosition', () => {
  it('names the chapter and what it is holding back', () => {
    expect(describeReadingPosition(4, counts(12, 4, 2)))
      .toBe('You are reading up to chapter 4, so 12 characters, 4 places and 2 items you have not met stay hidden until you reach them.')
  })

  it('still says where you are when nothing is hidden yet', () => {
    // Reachable on chapter one of a book that introduces its whole cast there —
    // the mode is on and doing nothing, which is worth saying rather than
    // looking like it is off.
    expect(describeReadingPosition(1, counts()))
      .toBe('You are reading up to chapter 1. Nothing is being held back yet.')
  })

  it('says the book is open once the whole thing is revealed', () => {
    expect(describeReadingPosition(null, counts()))
      .toBe('You have revealed the whole book, so nothing is being held back.')
  })
})
