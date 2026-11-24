import { describe, it, expect } from 'vitest'
import { castAliveSplit, firstRecordOf } from '@/lib/castAtCursor'

/**
 * WRUN-4. The dashboard counted `character.isAlive` — the record's end-of-book
 * flag — beside a time cursor, so it read the same at chapter one and chapter
 * twenty-seven, and never moved when a writer marked someone deceased.
 */
describe('castAliveSplit', () => {
  const cast = [
    { id: 'lucy', isAlive: false },   // dead by the end of the book
    { id: 'mina', isAlive: true },
    { id: 'count', isAlive: false },  // dead by the end of the book
  ]

  it('reads the snapshot at the cursor, not the end-of-book flag', () => {
    // Early on, everyone is still alive — which is the whole finding.
    const early = [
      { characterId: 'lucy', isAlive: true },
      { characterId: 'mina', isAlive: true },
      { characterId: 'count', isAlive: true },
    ]
    expect(castAliveSplit(cast, early)).toEqual({ alive: 3, dead: 0 })
  })

  it('and moves as the story does', () => {
    // The presence half: later, the same cast reads differently. Without this
    // pair, "3 alive" could be satisfied by a function that ignores snapshots.
    const late = [
      { characterId: 'lucy', isAlive: false },
      { characterId: 'mina', isAlive: true },
      { characterId: 'count', isAlive: false },
    ]
    expect(castAliveSplit(cast, late)).toEqual({ alive: 1, dead: 2 })
  })

  it('counts a character marked deceased at the cursor, even while their record says alive', () => {
    // Current State writes the snapshot and not the entity flag, so this is the
    // shape a writer produces the moment they kill someone.
    const marren = [{ id: 'marren', isAlive: true }]
    expect(castAliveSplit(marren, [{ characterId: 'marren', isAlive: false }]))
      .toEqual({ alive: 0, dead: 1 })
  })

  it('falls back to the record for anyone with no snapshot yet', () => {
    // A cast list before any state is recorded, which is most of a new world.
    expect(castAliveSplit(cast, [])).toEqual({ alive: 1, dead: 2 })
  })

  it('mixes the two without losing anyone', () => {
    const some = [{ characterId: 'lucy', isAlive: true }]
    // Lucy from her snapshot (alive), the other two from their records.
    expect(castAliveSplit(cast, some)).toEqual({ alive: 2, dead: 1 })
  })

  it('ignores snapshots for characters not in the cast', () => {
    // The gate filters the cast in reading mode; snapshots are not filtered
    // with it, so a stray entry must not be counted as a person.
    const stray = [{ characterId: 'someone-hidden', isAlive: true }]
    expect(castAliveSplit([{ id: 'mina', isAlive: true }], stray))
      .toEqual({ alive: 1, dead: 0 })
  })

  it('counts nobody in an empty world', () => {
    expect(castAliveSplit([], [])).toEqual({ alive: 0, dead: 0 })
  })

  describe('before the story reaches someone (UX-1-1, D-1)', () => {
    it('their first record decides, not the end-of-book flag', () => {
      // Lucy and the Count are dead by the end; both are first recorded alive.
      const first = [{ characterId: 'lucy', isAlive: true }, { characterId: 'count', isAlive: true }]
      expect(castAliveSplit(cast, [], first)).toEqual({ alive: 3, dead: 0 })
    })

    it('someone first recorded dead counts dead from the start', () => {
      const first = [{ characterId: 'lucy', isAlive: false }, { characterId: 'count', isAlive: true }]
      expect(castAliveSplit(cast, [], first)).toEqual({ alive: 2, dead: 1 })
    })

    it('a state at the cursor still outranks the first record', () => {
      const first = [{ characterId: 'lucy', isAlive: true }]
      expect(castAliveSplit(cast, [{ characterId: 'lucy', isAlive: false }], first)).toEqual({ alive: 1, dead: 2 })
    })
  })
})

describe('firstRecordOf', () => {
  const position = (id: string) => ({ e1: 1, e2: 2, e3: 3 } as Record<string, number>)[id] ?? -1
  it('takes each character’s earliest record in reading order, whatever order they come in', () => {
    const records = [
      { characterId: 'a', eventId: 'e3', isAlive: false },
      { characterId: 'a', eventId: 'e1', isAlive: true },
      { characterId: 'b', eventId: 'e2', isAlive: false },
      { characterId: 'a', eventId: 'e2', isAlive: false },
    ]
    const first = firstRecordOf(records, position)
    expect(first.map((r) => [r.characterId, r.eventId]).sort()).toEqual([['a', 'e1'], ['b', 'e2']])
  })
})
