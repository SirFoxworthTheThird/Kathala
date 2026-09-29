import { describe, it, expect } from 'vitest'
import { nextTension, normalizeTag, parseTravelDays, parseInWorldDay } from '../sceneFields'

describe('nextTension', () => {
  it('sets the level clicked', () => {
    expect(nextTension(null, 3)).toBe(3)
    expect(nextTension(2, 4)).toBe(4)
  })
  it('clears it when the level clicked is the one already set', () => {
    expect(nextTension(3, 3)).toBeNull()
  })
  it('clears it when asked for none', () => {
    expect(nextTension(3, null)).toBeNull()
    expect(nextTension(null, null)).toBeNull()
  })
})

describe('normalizeTag', () => {
  it('lower-cases, trims, and joins words with hyphens', () => {
    expect(normalizeTag('  Night  Watch ')).toBe('night-watch')
  })
  it('is empty for nothing typed', () => {
    expect(normalizeTag('   ')).toBe('')
  })
})

describe('parseTravelDays', () => {
  it('reads a number of days, fractions included', () => {
    expect(parseTravelDays('3')).toBe(3)
    expect(parseTravelDays('0.5')).toBe(0.5)
  })
  it('never goes below zero', () => {
    expect(parseTravelDays('-2')).toBe(0)
  })
  it('is none for blank or unreadable', () => {
    expect(parseTravelDays('')).toBeNull()
    expect(parseTravelDays('  ')).toBeNull()
    expect(parseTravelDays('soon')).toBeNull()
  })
})

describe('parseInWorldDay', () => {
  it('reads a day, before the story’s zero included', () => {
    expect(parseInWorldDay('12')).toBe(12)
    expect(parseInWorldDay('-40')).toBe(-40)
  })
  it('is none for blank or unreadable', () => {
    expect(parseInWorldDay('')).toBeNull()
    expect(parseInWorldDay('later')).toBeNull()
  })
})
