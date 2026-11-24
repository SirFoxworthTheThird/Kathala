import { describe, it, expect } from 'vitest'
import { motifWarning } from '@/lib/motifWarning'

/*
  UX-2-18, D-10: six of Dracula's seven motifs were amber, four of them for
  three or four quiet chapters. Going quiet mid-story is now judged as a
  thread is: at least five quiet chapters and more than a third of its span.
*/
describe('motifWarning', () => {
  const row = (longestDormancy: number, first: number, last: number, trailingGap = 0) =>
    ({ eventCount: 5, trailingGap, longestDormancy, firstChapterNumber: first, lastChapterNumber: last })

  it('three or four quiet chapters across a long book are breathing, not vanishing', () => {
    expect(motifWarning(row(3, 1, 27))).toBeNull()
    expect(motifWarning(row(4, 1, 27))).toBeNull()
  })

  it('a long silence that is a third of its span still warns', () => {
    expect(motifWarning(row(10, 1, 27))).toBe('vanishes for 10 chapters mid-story')
    // Five quiet of a twelve-chapter span: past a third.
    expect(motifWarning(row(5, 1, 12))).toBe('vanishes for 5 chapters mid-story')
    // Five of twenty-seven is not.
    expect(motifWarning(row(5, 1, 27))).toBeNull()
  })

  it('fading out, and never tagged, are said as before', () => {
    expect(motifWarning(row(0, 1, 20, 7))).toBe('fades out — last seen Ch. 20, absent 7 chapters')
    expect(motifWarning({ ...row(0, 1, 1), eventCount: 0 })).toBe('no scenes tagged yet')
  })
})
