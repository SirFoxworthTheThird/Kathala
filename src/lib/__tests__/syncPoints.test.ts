import { describe, it, expect } from 'vitest'
import { outerEventAt } from '../syncPoints'

const INNER = ['i1', 'i2', 'i3', 'i4', 'i5']
const PAIRS = [
  { innerEventId: 'i2', outerEventId: 'o-attic' },
  { innerEventId: 'i4', outerEventId: 'o-fireside' },
]

describe('outerEventAt', () => {
  it('gives the pairing when the cursor is exactly on one', () => {
    expect(outerEventAt(INNER, PAIRS, 'i2')).toBe('o-attic')
    expect(outerEventAt(INNER, PAIRS, 'i4')).toBe('o-fireside')
  })

  it('holds the last pairing between them', () => {
    // The teller is at that point in the telling until the story reaches the
    // moment that moves them. Matching exactly would show the frame's cast on
    // one scene and drop them on the next.
    expect(outerEventAt(INNER, PAIRS, 'i3')).toBe('o-attic')
    expect(outerEventAt(INNER, PAIRS, 'i5')).toBe('o-fireside')
  })

  it('has nothing in force before the first pairing', () => {
    // Scrubbing back to the start of the tale clears the ghosts rather than
    // leaving them stranded at a moment the reader has moved away from.
    expect(outerEventAt(INNER, PAIRS, 'i1')).toBeNull()
  })

  it('has nothing in force with no cursor, and none with no pairings', () => {
    expect(outerEventAt(INNER, PAIRS, null)).toBeNull()
    expect(outerEventAt(INNER, [], 'i5')).toBeNull()
  })

  it('ignores a cursor that is not on this track at all', () => {
    // The outer track's own events reach this while it is active; none of them
    // are inner events, and guessing at one would put the map in a state the
    // story is not in.
    expect(outerEventAt(INNER, PAIRS, 'o-attic')).toBeNull()
  })

  it('reads the pairings in track order, not the order they were authored', () => {
    const authoredBackwards = [
      { innerEventId: 'i4', outerEventId: 'o-fireside' },
      { innerEventId: 'i2', outerEventId: 'o-attic' },
    ]
    expect(outerEventAt(INNER, authoredBackwards, 'i3')).toBe('o-attic')
    expect(outerEventAt(INNER, authoredBackwards, 'i5')).toBe('o-fireside')
  })

  it('takes the later pairing when one event carries two', () => {
    // Nothing stops a writer pairing the same moment twice; the last one wins
    // rather than the result depending on Map insertion order by accident.
    const doubled = [
      { innerEventId: 'i2', outerEventId: 'o-attic' },
      { innerEventId: 'i2', outerEventId: 'o-later' },
    ]
    expect(outerEventAt(INNER, doubled, 'i2')).toBe('o-later')
  })
})
