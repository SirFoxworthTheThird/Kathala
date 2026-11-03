import { describe, it, expect } from 'vitest'
import { openingSentence, statedGap, contradicts } from '@/lib/statedGaps'

describe('openingSentence', () => {
  it('reads past a header block, a heading in capitals and a dateline in italics to the first sentence of prose', () => {
    expect(openingSentence('[ @@Ash · #The Yards ]\n\nJONATHAN HARKER’S JOURNAL\n\n_3 May. Bistritz._\n\nThree days later the snow came. It stayed.'))
      .toBe('Three days later the snow came.')
    expect(openingSentence('_The Compact · 310 AL_\n\nShe found the dots on the fourth night.')).toBe('She found the dots on the fourth night.')
  })

  it('is empty where there is no prose', () => {
    expect(openingSentence('')).toBe('')
    expect(openingSentence('[ @@Ash ]')).toBe('')
  })
})

describe('statedGap', () => {
  const gap = (text: string) => {
    const g = statedGap(text)
    return g && [g.days, g.tolerance, g.quote]
  }

  it('reads the next day, and a count of days, weeks, fortnights, months and years later', () => {
    expect(gap('The next morning Franz woke first.')).toEqual([1, 1, 'The next morning'])
    expect(gap('Next day he was much more cheerful.')).toEqual([1, 1, 'Next day'])
    expect(gap('“The following evening,” she said, “we left.”')).toEqual([1, 1, 'The following evening'])
    expect(gap('Three days later the snow came.')).toEqual([3, 1, 'Three days later'])
    expect(gap('A fortnight later, by excellent good fortune, the doctor gave a dinner.')).toEqual([14, 2, 'A fortnight later'])
    expect(gap('Nine weeks had passed.')).toEqual([63, 9, 'Nine weeks had passed'])
    expect(gap('Two months later she wrote.')).toEqual([61, 10, 'Two months later'])
    expect(gap('A year later nothing had changed.')).toEqual([365, 60, 'A year later'])
    expect(gap('12 days later.')).toEqual([12, 1, '12 days later'])
  })

  it('takes "after" only where it looks back at the scene before, or ends the phrase', () => {
    expect(gap('Three days after the scene we have just described, the contract was signed.')).toEqual([3, 1, 'Three days after'])
    expect(gap('Two days after, they came back.')).toEqual([2, 1, 'Two days after'])
    // Counted from something else.
    expect(gap('A year after Louis XVIII. was restored, the governor came.')).toBeNull()
    expect(gap('Two days after Mr. Bennet’s return, a letter came.')).toBeNull()
  })

  it('reads only the opening: a gap met later in the scene, or a vague one, says nothing about the cut', () => {
    expect(gap('She waited. Three weeks later the letter came.')).toBeNull()
    expect(gap('She slept, and the next morning she rode out.')).toBeNull()
    expect(gap('She waited until two days later, when the letter came.')).toBeNull()
    expect(gap('Some days later the letter came.')).toBeNull()
    expect(gap('Later that night the letter came.')).toBeNull()
  })

  it('counts months and years on the book’s calendar', () => {
    const g = statedGap('Two years later the colony fell.', { daysPerYear: 400, monthsPerYear: 10 })
    expect(g?.days).toBe(800)
    expect(statedGap('Three months later.', { daysPerYear: 400, monthsPerYear: 10 })?.days).toBe(120)
  })
})

describe('contradicts', () => {
  const fortnight = statedGap('A fortnight later the doctor dined.')!

  it('when the dates make the gap shorter than the words allow', () => {
    expect(contradicts(fortnight, 3)).toBe(true)
    expect(contradicts(fortnight, 11)).toBe(true)
  })

  it('not within the words’ tolerance, nor when the dates make it longer: the scene before may have run on', () => {
    expect(contradicts(fortnight, 12)).toBe(false)
    expect(contradicts(fortnight, 14)).toBe(false)
    expect(contradicts(fortnight, 40)).toBe(false)
  })
})
