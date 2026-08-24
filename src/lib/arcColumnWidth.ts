/**
 * How wide a column of the Character Arc grid should be.
 *
 * The width was a constant — 100px in scene mode, 110px in chapter mode —
 * applied as both `minWidth` and `maxWidth`, so columns never took space that
 * was going spare. Measured on a three-chapter world at 1440px: the table was
 * **512px wide inside a 1440px main**, with every location string clipped —
 * "Hallowmere Lock" needing 85px in a 79px box, "A Lamp in the Window" 112px in
 * 93px — and 928px of empty screen beside it.
 *
 * The constant is right for the case it was chosen for: a 117-chapter book has
 * to scroll, and wide columns there would only mean more scrolling. It was
 * applied unconditionally, which is the whole of the finding.
 *
 * So it is a floor rather than a fixed size. When the columns do not fill the
 * space they share it; when they overflow, nothing changes and the grid scrolls
 * exactly as it did. The cap stops two columns in a wide window from becoming a
 * pair of billboards.
 */
export const ARC_COLUMN_MAX = 220

export function arcColumnWidth(args: {
  /** Width of the scroller the table sits in. 0 before it has been measured. */
  containerWidth: number
  /** The sticky name column, which is not shared out. */
  rowHeaderWidth: number
  columnCount: number
  /** The narrowest a column may be — the old constant. */
  base: number
}): number {
  const { containerWidth, rowHeaderWidth, columnCount, base } = args
  if (columnCount <= 0 || containerWidth <= 0) return base

  const available = containerWidth - rowHeaderWidth
  if (available <= 0) return base

  const fair = Math.floor(available / columnCount)
  if (fair <= base) return base
  return Math.min(fair, ARC_COLUMN_MAX)
}
