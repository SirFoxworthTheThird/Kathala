import { describe, it, expect } from 'vitest'
import { locationTypeLabel } from '@/lib/locationType'

/**
 * The seven types are a fantasy vocabulary, and "Custom" was a member of it
 * rather than a way out. A station map read *Bay Nineteen · Building*, *The
 * Ossuary · Building*, *Marn's Office · Custom* — the last printing the word
 * "Custom" on the pin as though it were a kind of place.
 */
describe('locationTypeLabel', () => {
  it('uses the writer\'s own word for a custom type', () => {
    expect(locationTypeLabel({ iconType: 'custom', customType: 'Docking bay' })).toBe('Docking bay')
  })

  it('prints nothing rather than the word "Custom"', () => {
    // The pair: with a word there is a label, without one there is no line at
    // all. A rule that always returned null would fail the half above.
    expect(locationTypeLabel({ iconType: 'custom' })).toBeNull()
    expect(locationTypeLabel({ iconType: 'custom', customType: '   ' })).toBeNull()
  })

  it('leaves the six real types alone', () => {
    // Including when a stale customType is sitting on the record: switching
    // away from Custom must not keep showing the old word.
    expect(locationTypeLabel({ iconType: 'city' })).toBe('city')
    expect(locationTypeLabel({ iconType: 'building', customType: 'Docking bay' })).toBe('building')
  })
})
