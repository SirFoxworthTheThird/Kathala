/**
 * Keyboard movement for the Arc grid.
 *
 * The grid draws 628 cells on a real cast, and every one of them was a `<td>`
 * with a click handler: no tab stop, no focus, nothing for a screen reader to
 * land on. Giving each cell its own tab stop would have been worse than leaving
 * it alone — 628 presses to cross the screen — so it follows the pattern a
 * spreadsheet already taught everyone: the grid is one tab stop, and the arrow
 * keys move within it.
 *
 * Pure, so the movement can be tested without a DOM.
 */

export interface Cell {
  row: number
  col: number
}

export interface GridSize {
  rows: number
  cols: number
}

/** Keys this grid consumes. Anything else is left for the browser. */
const HANDLED = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown',
])

export function handlesKey(key: string): boolean {
  return HANDLED.has(key)
}

/** How far PageUp/PageDown jump — a screenful, near enough, without measuring one. */
const PAGE = 10

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, n))
}

/**
 * Where `key` moves from `from`, or null when the key is not ours. Movement is
 * clamped rather than wrapping: wrapping from the last column of one row to the
 * first of the next loses your place in a grid this wide, and a writer scanning
 * one character's row across the chapters would be thrown into another
 * character's without noticing.
 */
export function nextCell(
  from: Cell,
  key: string,
  size: GridSize,
  ctrl = false,
): Cell | null {
  if (!handlesKey(key)) return null
  if (size.rows <= 0 || size.cols <= 0) return null

  const lastRow = size.rows - 1
  const lastCol = size.cols - 1
  const row = clamp(from.row, lastRow)
  const col = clamp(from.col, lastCol)

  switch (key) {
    case 'ArrowUp':    return { row: clamp(row - 1, lastRow), col }
    case 'ArrowDown':  return { row: clamp(row + 1, lastRow), col }
    case 'ArrowLeft':  return { row, col: clamp(col - 1, lastCol) }
    case 'ArrowRight': return { row, col: clamp(col + 1, lastCol) }
    // Ctrl+Home/End go to the grid's corners, plain Home/End to the row's ends —
    // the same split a spreadsheet uses.
    case 'Home':       return ctrl ? { row: 0, col: 0 } : { row, col: 0 }
    case 'End':        return ctrl ? { row: lastRow, col: lastCol } : { row, col: lastCol }
    case 'PageUp':     return { row: clamp(row - PAGE, lastRow), col }
    case 'PageDown':   return { row: clamp(row + PAGE, lastRow), col }
    default:           return null
  }
}

/**
 * Keeps the remembered cell inside a grid that has shrunk — switching from the
 * per-event view to the per-chapter one cuts the columns by an order of
 * magnitude, and a cell remembered off the end would leave the grid with no
 * tab stop at all.
 */
export function clampCell(cell: Cell, size: GridSize): Cell {
  if (size.rows <= 0 || size.cols <= 0) return { row: 0, col: 0 }
  return { row: clamp(cell.row, size.rows - 1), col: clamp(cell.col, size.cols - 1) }
}
