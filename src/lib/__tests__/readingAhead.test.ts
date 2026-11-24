import { describe, it, expect } from 'vitest'
import { chapterBlockLabel, sceneTickLabel, asksBeforeJumping, continueBurst, DRIFT_BURST_MS } from '@/lib/readingAhead'

describe('chapterBlockLabel', () => {
  it('withholds the title of a chapter the reader has not reached', () => {
    expect(chapterBlockLabel({ number: 9, title: "Mina Murray's Journal" }, false))
      .toEqual({ title: null, tooltip: 'Ch. 9 — not yet reached' })
  })

  /*
    The pair. Withholding everything would make the bar unusable, and the number
    is not the spoiler — a book's own contents page carries it.
  */
  it('keeps the title once it has been reached', () => {
    expect(chapterBlockLabel({ number: 7, title: 'A Sailor Disappears' }, true))
      .toEqual({ title: 'A Sailor Disappears', tooltip: 'Ch. 7 — A Sailor Disappears' })
  })

  it('copes with an untitled chapter without inventing a dash', () => {
    expect(chapterBlockLabel({ number: 3 }, true)).toEqual({ title: null, tooltip: 'Ch. 3' })
  })

  it('treats an empty title as no title rather than drawing a bare separator', () => {
    expect(chapterBlockLabel({ number: 3, title: '' }, true).tooltip).toBe('Ch. 3')
  })
})

describe('sceneTickLabel', () => {
  /*
    The bigger half of R14: every scene in the book was a button whose
    accessible name was the scene's title, at the bottom of every screen.
  */
  it('names an unreached scene by where it is, not by what happens', () => {
    expect(sceneTickLabel({
      chapterNumber: 9, index: 0, title: 'Jonathan and Mina Marry', revealed: false,
    })).toBe('Chapter 9, moment 1 — not yet reached')
  })

  it('keeps unreached ticks distinguishable from one another', () => {
    const a = sceneTickLabel({ chapterNumber: 9, index: 0, title: 'x', revealed: false })
    const b = sceneTickLabel({ chapterNumber: 9, index: 1, title: 'y', revealed: false })
    expect(a).not.toBe(b)
  })

  it('gives a reached scene its own title', () => {
    expect(sceneTickLabel({
      chapterNumber: 7, index: 2, title: 'A Sailor Disappears', revealed: true,
    })).toBe('A Sailor Disappears')
  })

  it('keeps the pairing note on a reached scene', () => {
    expect(sceneTickLabel({
      chapterNumber: 7, index: 2, title: 'A Sailor Disappears', revealed: true, linked: true,
    })).toBe('A Sailor Disappears — paired with a moment on the other track')
  })

  it('does not leak a title through the pairing note', () => {
    // `linked` is about the tick, not about permission: an unreached paired
    // scene must not be the one place the wording survives.
    expect(sceneTickLabel({
      chapterNumber: 9, index: 0, title: 'Jonathan and Mina Marry', revealed: false, linked: true,
    })).not.toContain('Jonathan')
  })
})

describe('asksBeforeJumping', () => {
  it('asks before a skip of two chapters or more', () => {
    expect(asksBeforeJumping(7, 9)).toBe(true)
    expect(asksBeforeJumping(7, 27)).toBe(true)
  })

  /*
    Three ways it must stay silent, because this is the intended way to move a
    reading position and an interruption on every click would be worse than the
    leak it guards.
  */
  it('never interrupts ordinary reading', () => {
    expect(asksBeforeJumping(7, 8), 'the next chapter').toBe(false)
    expect(asksBeforeJumping(7, 7), 'another scene in this chapter').toBe(false)
    expect(asksBeforeJumping(7, 2), 'going back').toBe(false)
  })

  it('does not ask when there is no position to move from', () => {
    // A reader who asked to see the whole book has no place to read ahead of.
    expect(asksBeforeJumping(null, 27)).toBe(false)
  })
})

describe('continueBurst: a fling is one move (UX-1-7)', () => {
  it('a move close after the last continues the burst, from where it began', () => {
    let b = continueBurst(null, { id: 's1', chapter: 1 }, 0)
    b = continueBurst(b, { id: 's2', chapter: 2 }, 60)
    b = continueBurst(b, { id: 's4', chapter: 4 }, 120)
    expect(b).toEqual({ from: 's1', fromChapter: 1, at: 120 })
    // So each step is judged from chapter 1: 9→10 is still a skip.
    expect(asksBeforeJumping(b.fromChapter, 10)).toBe(true)
  })

  it('a move after a pause starts a burst of its own', () => {
    const b = continueBurst({ from: 's1', fromChapter: 1, at: 0 }, { id: 's9', chapter: 9 }, DRIFT_BURST_MS + 1)
    expect(b).toEqual({ from: 's9', fromChapter: 9, at: DRIFT_BURST_MS + 1 })
    // Right at the window's edge, still the same one.
    expect(continueBurst({ from: 's1', fromChapter: 1, at: 0 }, { id: 's9', chapter: 9 }, DRIFT_BURST_MS).from).toBe('s1')
  })
})
