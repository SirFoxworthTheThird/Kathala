import { describe, it, expect } from 'vitest'
import { blockingReason, listPhrase, unmetRequirements } from '../blockingReason'

const req = (met: boolean, need: string) => ({ met, need })

describe('unmetRequirements', () => {
  it('names every unmet requirement, not just the first', () => {
    // RT-1: the HUD hinted at the point count and never at the name, so a
    // writer with three points and no name pressed a dead button in silence.
    expect(unmetRequirements([req(false, 'a name'), req(false, 'two points')]))
      .toEqual(['a name', 'two points'])
  })

  it('keeps the declared order, so the message reads the way the form does', () => {
    expect(unmetRequirements([req(true, 'a name'), req(false, 'two points'), req(false, 'a type')]))
      .toEqual(['two points', 'a type'])
  })

  it('is empty when everything is satisfied', () => {
    expect(unmetRequirements([req(true, 'a name'), req(true, 'two points')])).toEqual([])
  })
})

describe('listPhrase', () => {
  it('joins one, two and three the way a sentence does', () => {
    expect(listPhrase(['a name'])).toBe('a name')
    expect(listPhrase(['a name', 'two points'])).toBe('a name and two points')
    expect(listPhrase(['a name', 'two points', 'a type'])).toBe('a name, two points and a type')
  })

  it('is empty for nothing', () => {
    expect(listPhrase([])).toBe('')
  })
})

describe('blockingReason', () => {
  it('is null when the action can run — the signal to render nothing at all', () => {
    // Not an empty string: X-5 is that permanent help text is noise, and a
    // blank paragraph still reserves the space a message would take.
    expect(blockingReason([req(true, 'a name')])).toBeNull()
    expect(blockingReason([])).toBeNull()
  })

  it('names one missing thing', () => {
    expect(blockingReason([req(false, 'a name'), req(true, 'two points')]))
      .toBe('Needs a name.')
  })

  it('names both when both are missing', () => {
    expect(blockingReason([req(false, 'a name'), req(false, 'two points')]))
      .toBe('Needs a name and two points.')
  })

  it('handles the four-condition case the relationship form has', () => {
    expect(blockingReason([
      req(false, 'a first character'),
      req(false, 'a second character'),
      req(true, 'two different characters'),
      req(false, 'a label'),
    ])).toBe('Needs a first character, a second character and a label.')
  })
})
