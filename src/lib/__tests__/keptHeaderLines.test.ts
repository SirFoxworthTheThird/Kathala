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
})
