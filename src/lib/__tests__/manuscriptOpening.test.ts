import { describe, it, expect } from 'vitest'
import { openingState } from '@/lib/manuscriptOpening'

const state = (compiled: boolean, worldHasProse: boolean | undefined) =>
  openingState({ compiled, worldHasProse })

describe('openingState', () => {
  it('shows the book once the manuscript is compiled', () => {
    expect(state(true, true)).toBe('book')
    expect(state(true, undefined)).toBe('book')
    // Even if the count disagrees: the prose is on screen, so it exists.
    expect(state(true, false)).toBe('book')
  })

  it('says it is opening while the prose is on its way', () => {
    expect(state(false, true)).toBe('opening')
  })

  /*
    The case the whole thing is for. `useLiveQuery` has no initial value and
    returns undefined again when it re-subscribes — so "not yet known" arrives
    both before the first answer and after a later one, and neither is grounds
    for telling a reader their book is empty.
  */
  it('does not claim the book is empty before it knows', () => {
    expect(state(false, undefined)).toBe('opening')
  })

  it('claims it empty only on a definite no', () => {
    expect(state(false, false)).toBe('empty')
  })
})
