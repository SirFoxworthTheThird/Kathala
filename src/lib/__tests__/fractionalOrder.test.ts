import { describe, it, expect } from 'vitest'
import {
  POSITION_STEP, compareByPosition, inPositionOrder, moveTo,
  positionBetween, positionForAppend, renumber,
} from '@/lib/fractionalOrder'

const run = (...ids: string[]) => ids.map((id, i) => ({ id, sortOrder: (i + 1) * POSITION_STEP }))
const ids = (rs: { id: string }[]) => rs.map((r) => r.id)

/** Apply a set of position writes to a run, as the database would. */
const applyWrites = (
  base: { id: string; sortOrder: number }[],
  writes: { id: string; sortOrder: number }[],
) => {
  const byId = new Map(base.map((r) => [r.id, { ...r }]))
  for (const w of writes) byId.set(w.id, { ...w })
  return inPositionOrder([...byId.values()])
}

describe('positionBetween', () => {
  it('takes the midpoint of two neighbours', () => {
    expect(positionBetween(0, 100)).toBe(50)
  })

  it('steps past the end when there is no neighbour that side', () => {
    expect(positionBetween(100, null)).toBe(100 + POSITION_STEP)
    expect(positionBetween(null, 100)).toBe(100 - POSITION_STEP)
    expect(positionBetween(null, null)).toBe(POSITION_STEP)
  })

  it('refuses when the neighbours are too close to fit between', () => {
    // Saying "no room" is the point: a position that cannot be subdivided
    // again would quietly stop being orderable on the next insert.
    expect(positionBetween(1, 1 + 1e-12)).toBeNull()
  })
})

describe('compareByPosition', () => {
  it('breaks ties by id so every device agrees', () => {
    const tied = [{ id: 'b', sortOrder: 5 }, { id: 'a', sortOrder: 5 }]
    expect(ids(inPositionOrder(tied))).toEqual(['a', 'b'])
  })

  it('puts position before id', () => {
    expect(compareByPosition({ id: 'z', sortOrder: 1 }, { id: 'a', sortOrder: 2 })).toBeLessThan(0)
  })
})

describe('moveTo', () => {
  it('writes exactly one row for an ordinary move', () => {
    // The whole reason for fractional positions: the rows that did not move
    // are not touched, so another device's moves cannot be overwritten.
    const writes = moveTo(run('a', 'b', 'c'), 'c', 0)
    expect(writes).toHaveLength(1)
    expect(writes[0].id).toBe('c')
  })

  it('lands the card where it was dropped', () => {
    // The index is into the list *without* the moved card, matching the
    // reorderInsert convention this replaces.
    const base = run('a', 'b', 'c')
    expect(ids(applyWrites(base, moveTo(base, 'c', 0)))).toEqual(['c', 'a', 'b'])
    expect(ids(applyWrites(base, moveTo(base, 'a', 1)))).toEqual(['b', 'a', 'c'])
    expect(ids(applyWrites(base, moveTo(base, 'a', 99)))).toEqual(['b', 'c', 'a'])
  })

  it('renumbers only when the neighbours have no room left', () => {
    const cramped = [
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 1 + 1e-12 },
      { id: 'c', sortOrder: 500 },
    ]
    const writes = moveTo(cramped, 'c', 1)
    expect(writes.length).toBeGreaterThan(1)
    expect(ids(applyWrites(cramped, writes))).toEqual(['a', 'c', 'b'])
  })

  it('survives repeated insertion at the same spot', () => {
    let rows = run('a', 'z')
    for (let i = 0; i < 40; i++) {
      const writes = moveTo([...rows, { id: `n${i}`, sortOrder: positionForAppend(rows) }], `n${i}`, 1)
      rows = applyWrites([...rows, { id: `n${i}`, sortOrder: positionForAppend(rows) }], writes)
    }
    expect(rows[0].id).toBe('a')
    expect(rows[rows.length - 1].id).toBe('z')
    expect(new Set(rows.map((r) => r.sortOrder)).size).toBe(rows.length)
  })
})

describe('two devices reordering at once', () => {
  it('keeps both moves when they move different cards', () => {
    // Each writes one row, and the rows are different, so a field-level merge
    // has nothing to choose between.
    const base = run('a', 'b', 'c', 'd')

    const deviceOne = moveTo(base, 'd', 0)   // d to the front
    const deviceTwo = moveTo(base, 'b', 3)   // b towards the back

    const merged = applyWrites(base, [...deviceOne, ...deviceTwo])
    expect(ids(merged)).toEqual(['d', 'a', 'c', 'b'])
  })

  it('reaches the same order whichever side is applied first', () => {
    const base = run('a', 'b', 'c', 'd')
    const deviceOne = moveTo(base, 'd', 0)
    const deviceTwo = moveTo(base, 'b', 3)

    const oneThenTwo = applyWrites(base, [...deviceOne, ...deviceTwo])
    const twoThenOne = applyWrites(base, [...deviceTwo, ...deviceOne])
    expect(ids(oneThenTwo)).toEqual(ids(twoThenOne))
  })

  it('settles on one position when both moved the same card', () => {
    // A real conflict rather than a mergeable one — but only that card is
    // affected, and both devices end up with the same sequence.
    const base = run('a', 'b', 'c')
    const winner = moveTo(base, 'c', 0)

    expect(ids(applyWrites(base, winner))).toEqual(['c', 'a', 'b'])
  })

  it('gives the same order on both devices when positions collide exactly', () => {
    // Independent midpoints can coincide. The id tiebreak is what stops the
    // two devices disagreeing about what comes first.
    const collided = [
      { id: 'zeta', sortOrder: 512 },
      { id: 'alpha', sortOrder: 512 },
      { id: 'mid', sortOrder: 700 },
    ]
    expect(ids(inPositionOrder(collided))).toEqual(['alpha', 'zeta', 'mid'])
    expect(ids(inPositionOrder([...collided].reverse()))).toEqual(['alpha', 'zeta', 'mid'])
  })
})

describe('renumber and append', () => {
  it('spaces a run out with room to insert again', () => {
    const spaced = renumber(run('a', 'b', 'c'))
    expect(spaced.map((r) => r.sortOrder)).toEqual([POSITION_STEP, POSITION_STEP * 2, POSITION_STEP * 3])
    expect(positionBetween(spaced[0].sortOrder, spaced[1].sortOrder)).not.toBeNull()
  })

  it('appends past everything already there', () => {
    expect(positionForAppend([])).toBe(POSITION_STEP)
    expect(positionForAppend(run('a', 'b'))).toBe(POSITION_STEP * 3)
  })
})
