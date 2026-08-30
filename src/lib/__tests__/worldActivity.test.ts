import { describe, it, expect } from 'vitest'
import { worldActivity } from '@/lib/worldActivity'

const MADE = 1_700_000_000_000
const LATER = MADE + 86_400_000
const LATER_STILL = LATER + 86_400_000

describe('worldActivity', () => {
  it('says Created for a world nothing has happened to', () => {
    // `createWorld` writes the same `now` to both fields, so this is the real
    // shape of a brand-new world rather than an invented one.
    expect(worldActivity({ createdAt: MADE, updatedAt: MADE }, null))
      .toEqual({ label: 'Created', at: MADE })
  })

  it('says Edited once the journal has something in it', () => {
    expect(worldActivity({ createdAt: MADE, updatedAt: MADE }, LATER))
      .toEqual({ label: 'Edited', at: LATER })
  })

  it('still says Edited when the only change was to the world record itself', () => {
    // A rename is not journalled — `world` is not on the operation seam — so
    // this is the case `updatedAt` exists to cover.
    expect(worldActivity({ createdAt: MADE, updatedAt: LATER }, null))
      .toEqual({ label: 'Edited', at: LATER })
  })

  it('takes the later of the two, whichever it is', () => {
    expect(worldActivity({ createdAt: MADE, updatedAt: LATER }, LATER_STILL).at).toBe(LATER_STILL)
    expect(worldActivity({ createdAt: MADE, updatedAt: LATER_STILL }, LATER).at).toBe(LATER_STILL)
  })

  it('falls back to Created when the journal was reset, rather than guessing', () => {
    /*
      An imported world: `markJournalDiscontinuity` clears the operations, so
      there is nothing to read. Saying "Created" is the honest answer — the
      alternative is printing a date the app cannot stand behind.
    */
    expect(worldActivity({ createdAt: MADE, updatedAt: MADE }, null).label).toBe('Created')
  })

  it('never reports a moment before the world existed', () => {
    // A clock that went backwards, or a journal carried in from elsewhere.
    const before = MADE - 86_400_000
    expect(worldActivity({ createdAt: MADE, updatedAt: MADE }, before))
      .toEqual({ label: 'Created', at: MADE })
  })
})
