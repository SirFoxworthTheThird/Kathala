import { describe, it, expect } from 'vitest'
import { keptLineWarning } from '../keptHeaderLines'

describe('keptLineWarning', () => {
  it('says who is in the scene now, not that nothing changed', () => {
    const said = keptLineWarning({ names: ['Wren Haloway'], place: null }, { cast: ['Ilse', 'Saffi', 'Jory'], place: 'The Bell' })
    expect(said).toBe('Nothing in this world is called “Wren Haloway” — the line was not applied, so the spelling can be fixed on it. In the scene now: Ilse, Saffi and Jory.')
    expect(said).not.toMatch(/left as it was/)
  })
  it('says so when nobody is', () => {
    expect(keptLineWarning({ names: ['X'], place: null }, { cast: [], place: null })).toMatch(/Nobody is in its cast yet\.$/)
  })
  it('for a place, where the scene is still set', () => {
    expect(keptLineWarning({ names: [], place: 'The Larder' }, { cast: ['Wren'], place: 'The Quay' }))
      .toBe('Nothing in this world is called “The Larder” — the line was not applied, so the spelling can be fixed on it. It is still set at The Quay.')
    expect(keptLineWarning({ names: [], place: 'The Larder' }, { cast: [], place: null })).toMatch(/It has no setting yet\.$/)
  })
  it('both, when both are unknown', () => {
    expect(keptLineWarning({ names: ['Wren Haloway'], place: 'The Cellar' }, { cast: ['Wren'], place: null }))
      .toMatch(/“Wren Haloway” or “The Cellar” — .* In the scene now: Wren\. It has no setting yet\.$/)
  })
  it('names a fact title nothing answers with the rest, and a line naming only that says nothing of the cast', () => {
    // Facts are offered to be made beside the note (part 4 of the header plan); the note names them like anything else.
    const text = keptLineWarning({ names: [], place: null, facts: ['The ledger is forged'] }, { cast: ['Sabine'], place: null })
    expect(text).toContain('“The ledger is forged”')
    expect(text).not.toContain('In the scene now')
  })
})

describe('a line asking what the rules refuse', () => {
  it('says only that when every name is answered, and both when one is not', () => {
    expect(keptLineWarning({ names: [], place: null, refused: ['Edward Hyde cannot be revealed to be themself.'] }, { cast: ['Edward Hyde'], place: null }))
      .toBe('Edward Hyde cannot be revealed to be themself. The line was kept as typed, so it can be changed on it.')
    const both = keptLineWarning({ names: ['Mr Seek'], place: null, refused: ['Edward Hyde cannot be revealed to be themself.'] }, { cast: ['Edward Hyde'], place: null })
    expect(both).toMatch(/^Nothing in this world is called “Mr Seek”/)
    expect(both).toMatch(/Edward Hyde cannot be revealed to be themself\.$/)
  })
})
