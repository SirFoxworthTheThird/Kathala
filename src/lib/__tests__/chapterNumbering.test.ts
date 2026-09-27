import { describe, it, expect } from 'vitest'
import {
  describeShift, nextChapterNumber, parseChapterNumber, planChapterInsert, type NumberedChapter,
} from '@/lib/chapterNumbering'

const ch = (...numbers: number[]): NumberedChapter[] => numbers.map((n, i) => ({ id: `c${i}`, number: n }))

describe('nextChapterNumber', () => {
  it('suggests one past the highest, not one past the count', () => {
    // 1, 2, 4: the count says 4, which is taken.
    expect(nextChapterNumber(ch(1, 2, 4))).toBe(5)
    expect(nextChapterNumber(ch(1, 2, 3))).toBe(4)
  })

  it('suggests 1 for a timeline with no chapters', () => {
    expect(nextChapterNumber([])).toBe(1)
  })
})

describe('parseChapterNumber', () => {
  it('takes a whole number, including 0 for a prologue', () => {
    expect(parseChapterNumber('7')).toBe(7)
    expect(parseChapterNumber(' 12 ')).toBe(12)
    expect(parseChapterNumber('0')).toBe(0)
  })

  it('refuses what a chapter cannot be numbered', () => {
    for (const bad of ['', ' ', '-1', '2.5', '3a', 'three', '1e3', '99999999999999999999']) {
      expect(parseChapterNumber(bad), bad).toBeNull()
    }
  })
})

describe('planChapterInsert', () => {
  it('moves nobody when the number is free', () => {
    expect(planChapterInsert(ch(1, 2, 4), 3)).toEqual([])
    expect(planChapterInsert(ch(1, 2), 0)).toEqual([])
  })

  it('moves the chapter that had it, and each one after it up to a gap', () => {
    // 1, 2, 3, 5 with a new 2: 2→3 and 3→4 move, and 5 does not — 4 was free.
    expect(planChapterInsert(ch(1, 2, 3, 5), 2)).toEqual([
      { id: 'c1', from: 2, to: 3 },
      { id: 'c2', from: 3, to: 4 },
    ])
  })

  it('moves the whole tail when there is no gap', () => {
    expect(planChapterInsert(ch(1, 2, 3), 1).map((s) => `${s.from}→${s.to}`)).toEqual(['1→2', '2→3', '3→4'])
  })

  it('never leaves a number held twice', () => {
    for (const wanted of [0, 1, 2, 3, 4, 5, 6]) {
      const chapters = ch(1, 2, 3, 5)
      const shifts = new Map(planChapterInsert(chapters, wanted).map((s) => [s.id, s.to]))
      const after = [...chapters.map((c) => shifts.get(c.id) ?? c.number), wanted]
      expect(new Set(after).size, `inserting ${wanted}`).toBe(after.length)
    }
  })

  it('moves two chapters that already shared a number together, and does not join them', () => {
    const tied: NumberedChapter[] = [{ id: 'a', number: 3 }, { id: 'b', number: 3 }, { id: 'c', number: 4 }]
    expect(planChapterInsert(tied, 3)).toEqual([
      { id: 'a', from: 3, to: 4 }, { id: 'b', from: 3, to: 4 }, { id: 'c', from: 4, to: 5 },
    ])
  })
})

describe('describeShift', () => {
  it('says what will move, before it does', () => {
    expect(describeShift([])).toBe('')
    expect(describeShift([{ id: 'x', from: 3, to: 4 }])).toBe('Chapter 3 becomes 4')
    expect(describeShift(planChapterInsert(ch(1, 2, 3, 4, 5, 6, 7), 3))).toBe('Chapters 3–7 become 4–8')
  })
})
