import { describe, it, expect } from 'vitest'
import { nextCell, clampCell, handlesKey } from '../gridNavigation'

const size = { rows: 5, cols: 8 }
const at = (row: number, col: number) => ({ row, col })

describe('handlesKey', () => {
  it('claims the movement keys and leaves everything else alone', () => {
    for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']) {
      expect(handlesKey(k), k).toBe(true)
    }
    // Enter and Space activate the cell, Tab leaves the grid, and typing must
    // still reach the filter box — none of them are ours to swallow.
    for (const k of ['Enter', ' ', 'Tab', 'Escape', 'a', 'F5']) {
      expect(handlesKey(k), k).toBe(false)
    }
  })
})

describe('nextCell', () => {
  it('moves one cell in each direction', () => {
    expect(nextCell(at(2, 3), 'ArrowUp', size)).toEqual(at(1, 3))
    expect(nextCell(at(2, 3), 'ArrowDown', size)).toEqual(at(3, 3))
    expect(nextCell(at(2, 3), 'ArrowLeft', size)).toEqual(at(2, 2))
    expect(nextCell(at(2, 3), 'ArrowRight', size)).toEqual(at(2, 4))
  })

  it('stops at the edges instead of wrapping', () => {
    // Wrapping from the end of one character's row into the next character's
    // would move you to a different row without saying so.
    expect(nextCell(at(0, 0), 'ArrowUp', size)).toEqual(at(0, 0))
    expect(nextCell(at(0, 0), 'ArrowLeft', size)).toEqual(at(0, 0))
    expect(nextCell(at(4, 7), 'ArrowDown', size)).toEqual(at(4, 7))
    expect(nextCell(at(4, 7), 'ArrowRight', size)).toEqual(at(4, 7))
  })

  it('sends Home and End to the ends of the row, and with Ctrl to the grid corners', () => {
    expect(nextCell(at(3, 5), 'Home', size)).toEqual(at(3, 0))
    expect(nextCell(at(3, 5), 'End', size)).toEqual(at(3, 7))
    expect(nextCell(at(3, 5), 'Home', size, true)).toEqual(at(0, 0))
    expect(nextCell(at(3, 5), 'End', size, true)).toEqual(at(4, 7))
  })

  it('pages by a screenful, clamped to the grid', () => {
    const tall = { rows: 40, cols: 3 }
    expect(nextCell(at(20, 1), 'PageDown', tall)).toEqual(at(30, 1))
    expect(nextCell(at(20, 1), 'PageUp', tall)).toEqual(at(10, 1))
    expect(nextCell(at(2, 1), 'PageUp', tall)).toEqual(at(0, 1))
    expect(nextCell(at(38, 1), 'PageDown', tall)).toEqual(at(39, 1))
    // The column is kept — paging is vertical.
    expect(nextCell(at(20, 2), 'PageDown', tall)!.col).toBe(2)
  })

  it('returns null for a key it does not own, so the browser still gets it', () => {
    expect(nextCell(at(1, 1), 'Enter', size)).toBeNull()
    expect(nextCell(at(1, 1), 'Tab', size)).toBeNull()
    expect(nextCell(at(1, 1), 'x', size)).toBeNull()
  })

  it('has nowhere to go in an empty grid', () => {
    expect(nextCell(at(0, 0), 'ArrowDown', { rows: 0, cols: 0 })).toBeNull()
    expect(nextCell(at(0, 0), 'ArrowRight', { rows: 3, cols: 0 })).toBeNull()
  })

  it('recovers from a remembered cell that is now outside the grid', () => {
    // Switching from the per-event view to the per-chapter one cuts the columns
    // by an order of magnitude.
    expect(nextCell(at(99, 99), 'ArrowLeft', size)).toEqual(at(4, 6))
    expect(nextCell(at(99, 99), 'ArrowUp', size)).toEqual(at(3, 7))
  })
})

describe('clampCell', () => {
  it('pulls a cell back inside a grid that shrank', () => {
    expect(clampCell(at(80, 400), size)).toEqual(at(4, 7))
    expect(clampCell(at(-3, -1), size)).toEqual(at(0, 0))
  })

  it('leaves a cell that is already inside alone', () => {
    expect(clampCell(at(2, 3), size)).toEqual(at(2, 3))
  })

  it('collapses to the origin when there is no grid left', () => {
    // Something has to be the tab stop even while a filter matches nothing,
    // or the grid drops out of the tab order and never comes back.
    expect(clampCell(at(3, 3), { rows: 0, cols: 0 })).toEqual(at(0, 0))
  })
})
