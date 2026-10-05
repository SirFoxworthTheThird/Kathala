import { describe, it, expect } from 'vitest'
import { inOpenHeader, mentionInsert, punctuate } from '../mentionInsert'

describe('inOpenHeader', () => {
  it('is a first line opened with [ and not closed before the caret', () => {
    expect(inOpenHeader('[#The Kitchen @@Wren Hallo')).toBe(true)
    expect(inOpenHeader('  [@@Wren')).toBe(true)
  })
  it('is not a closed line, nor prose', () => {
    expect(inOpenHeader('[#The Kitchen] @@Wren')).toBe(false)
    expect(inOpenHeader('She said @@Wren')).toBe(false)
    expect(inOpenHeader('')).toBe(false)
  })
})

describe('mentionInsert', () => {
  it('closes a header line still open, with the caret before the ]', () => {
    expect(mentionInsert('Wren Halloway', { inHeader: true, after: '' }))
      .toEqual({ insert: '@@Wren Halloway]', caret: '@@Wren Halloway'.length, autoSpace: null })
  })
  it('leaves a closed one to its own ]', () => {
    expect(mentionInsert('Wren', { inHeader: true, after: ']' }))
      .toEqual({ insert: '@@Wren ', caret: '@@Wren '.length, autoSpace: null })
  })
  it('in the prose, a name and a space, and says where the space is', () => {
    expect(mentionInsert('Oren', { inHeader: false, after: ' went' }))
      .toEqual({ insert: 'Oren ', caret: 5, autoSpace: 4 })
  })
})

describe('punctuate', () => {
  const text = 'Then Oren  went.'
  // "Then Oren " — the space the picker put is at 9, the caret straight after it.
  it('takes the space after a picked name for a closing mark', () => {
    expect(punctuate('Then Oren ', 9, 10, ',')).toEqual({ text: 'Then Oren,', caret: 10 })
    expect(punctuate('Then Oren ', 9, 10, '’')).toEqual({ text: 'Then Oren’', caret: 10 })
  })
  it('leaves a letter, a moved caret, or no pick alone', () => {
    expect(punctuate('Then Oren ', 9, 10, 'w')).toBeNull()
    expect(punctuate('Then Oren ', 9, 4, ',')).toBeNull()
    expect(punctuate('Then Oren ', null, 10, ',')).toBeNull()
    expect(punctuate(text, 3, 4, ',')).toBeNull()
  })
})
