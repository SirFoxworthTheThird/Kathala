import { describe, it, expect } from 'vitest'
import {
  describeShift, nextChapterNumber, parseChapterNumber, planChapterInsert, planChapterMove, type NumberedChapter,
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

describe('planChapterMove', () => {
  const ch = (id: string, number: number) => ({ id, number })
  const book = [ch('a', 1), ch('b', 2), ch('d', 4), ch('e', 5)]
  const apply = (shifts: ReturnType<typeof planChapterMove>) =>
    book.map((c) => ({ id: c.id, number: shifts.find((s) => s.id === c.id)?.to ?? c.number }))
      .sort((x, y) => x.number - y.number).map((c) => `${c.id}${c.number}`).join(' ')

  it('moves a chapter to the front, the others taking the numbers in order', () => {
    expect(apply(planChapterMove(book, 'e', 0))).toBe('e1 a2 b4 d5')
  })

  it('moves one to the end', () => {
    expect(apply(planChapterMove(book, 'a', 3))).toBe('b1 d2 e4 a5')
  })

  it('touches only the chapters between the old place and the new', () => {
    const shifts = planChapterMove(book, 'b', 2)
    expect(shifts.map((s) => s.id).sort()).toEqual(['b', 'd'])
    expect(apply(shifts)).toBe('a1 d2 b4 e5')
  })

  it('keeps a gap and a prologue where they were', () => {
    const withPrologue = [ch('p', 0), ch('x', 1), ch('y', 3)]
    const shifts = planChapterMove(withPrologue, 'y', 0)
    const numbers = withPrologue
      .map((c) => ({ id: c.id, n: shifts.find((s) => s.id === c.id)?.to ?? c.number }))
      .sort((m, n) => m.n - n.n)
    expect(numbers).toEqual([{ id: 'y', n: 0 }, { id: 'p', n: 1 }, { id: 'x', n: 3 }])
  })

  it('does nothing for a move to where it already is, or for a chapter it does not know', () => {
    expect(planChapterMove(book, 'b', 1)).toEqual([])
    expect(planChapterMove(book, 'zz', 0)).toEqual([])
  })

  it('clamps a place past either end', () => {
    expect(apply(planChapterMove(book, 'b', 99))).toBe('a1 d2 e4 b5')
    expect(apply(planChapterMove(book, 'b', -3))).toBe('b1 a2 d4 e5')
  })
})
