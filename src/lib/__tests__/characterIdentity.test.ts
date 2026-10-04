import { describe, it, expect } from 'vitest'
import { revealTargets, revealReached, identityLinks } from '../characterIdentity'

const jekyll = { id: 'jekyll' }
const hyde = { id: 'hyde', revealedAs: { characterId: 'jekyll', eventId: 'reveal' } }
const utterson = { id: 'utterson' }
const keys = new Map([['carew', 4.2], ['reveal', 9.4]])
const sortKeyOf = (id: string) => keys.get(id)

describe('revealTargets', () => {
  it('anyone but themself, and not someone already revealed as someone else', () => {
    expect(revealTargets([jekyll, hyde, utterson], 'utterson').map((c) => c.id)).toEqual(['jekyll'])
  })

  it('nobody, for a head: no chains', () => {
    expect(revealTargets([jekyll, hyde, utterson], 'jekyll')).toEqual([])
  })

  it('the revealed one may be re-pointed, but never at themself', () => {
    expect(revealTargets([jekyll, hyde, utterson], 'hyde').map((c) => c.id)).toEqual(['jekyll', 'utterson'])
  })
})

describe('revealReached', () => {
  it('from the reveal scene on, or for the whole book', () => {
    expect(revealReached(hyde, 4.2, sortKeyOf)).toBe(false)
    expect(revealReached(hyde, 9.4, sortKeyOf)).toBe(true)
    expect(revealReached(hyde, null, sortKeyOf)).toBe(true)
  })

  it('never for a reveal whose scene cannot be placed, nor for one with no link', () => {
    expect(revealReached({ revealedAs: { characterId: 'jekyll', eventId: 'gone' } }, null, sortKeyOf)).toBe(false)
    expect(revealReached({}, null, sortKeyOf)).toBe(false)
  })
})

describe('identityLinks', () => {
  it('both directions, from the roster given', () => {
    expect(identityLinks([jekyll, hyde, utterson], 'hyde')).toEqual({ revealedAs: jekyll, alsoAs: [] })
    expect(identityLinks([jekyll, hyde, utterson], 'jekyll')).toEqual({ revealedAs: null, alsoAs: [hyde] })
    expect(identityLinks([jekyll, hyde, utterson], 'utterson')).toEqual({ revealedAs: null, alsoAs: [] })
  })

  it('nothing to someone not in the roster — a reader who has not met them', () => {
    expect(identityLinks([hyde, utterson], 'hyde')).toEqual({ revealedAs: null, alsoAs: [] })
  })
})
