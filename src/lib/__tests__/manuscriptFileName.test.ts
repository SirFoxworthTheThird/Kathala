import { describe, it, expect } from 'vitest'
import { manuscriptFileName, slugify } from '@/lib/manuscriptFileName'

/**
 * N11: exporting from a world named "The Ninth Bell" produced
 * `the-drowning-year.md`, the name of the timeline.
 */

const base = { worldName: 'The Ninth Bell', timelineName: 'The Drowning Year', ext: 'md' }

describe('slugify', () => {
  it('makes a title safe to be a file name', () => {
    expect(slugify('The Ninth Bell')).toBe('the-ninth-bell')
    expect(slugify("Marrow & Salt: A Novel")).toBe('marrow-salt-a-novel')
  })

  it('never returns nothing, so a file always has a name', () => {
    expect(slugify('   ')).toBe('manuscript')
    expect(slugify('!!!')).toBe('manuscript')
  })
})

describe('manuscriptFileName', () => {
  it('names the file after the book', () => {
    // The finding: this used to be `the-drowning-year.md`.
    expect(manuscriptFileName({ ...base, timelineCount: 1 })).toBe('the-ninth-bell.md')
  })

  it('adds the timeline only when there is more than one to tell apart', () => {
    expect(manuscriptFileName({ ...base, timelineCount: 2 }))
      .toBe('the-ninth-bell-the-drowning-year.md')
  })

  it('carries the format through', () => {
    expect(manuscriptFileName({ ...base, timelineCount: 1, ext: 'epub' })).toBe('the-ninth-bell.epub')
  })

  it('falls back when the world has somehow no name', () => {
    expect(manuscriptFileName({ ...base, worldName: undefined, timelineCount: 1 }))
      .toBe('manuscript.md')
    expect(manuscriptFileName({ ...base, worldName: '  ', timelineCount: 1 }))
      .toBe('manuscript.md')
  })

  it('leaves an unnamed timeline out rather than calling it "manuscript"', () => {
    // `slugify('')` is "manuscript", so testing the slug instead of the name
    // would produce `the-ninth-bell-manuscript.md`.
    expect(manuscriptFileName({ ...base, timelineName: '  ', timelineCount: 3 }))
      .toBe('the-ninth-bell.md')
  })
})
