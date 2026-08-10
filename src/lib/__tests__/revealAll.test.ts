import { describe, it, expect } from 'vitest'
import { revealAllAction } from '../revealAll'

describe('revealAllAction', () => {
  it('asks first when reading mode is on', () => {
    expect(revealAllAction({ worldLoaded: true, gateActive: true })).toBe('confirm')
  })

  it('clears the cursor outright when writing', () => {
    expect(revealAllAction({ worldLoaded: true, gateActive: false })).toBe('clear')
  })

  it('does nothing until the world is loaded, whatever the gate says', () => {
    // The whole point: an unloaded world reports gateActive false, which is
    // indistinguishable from "writing" and was taking the clear path. A reader
    // clicking during that window lost their place and saw the whole book.
    expect(revealAllAction({ worldLoaded: false, gateActive: false })).toBe('wait')
    expect(revealAllAction({ worldLoaded: false, gateActive: true })).toBe('wait')
  })
})
