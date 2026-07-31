/**
 * Positions that survive two people reordering at once.
 *
 * Order was a dense index: 0, 1, 2… Moving one card to the front therefore
 * renumbered every card behind it, so a reorder wrote the whole column. When
 * two devices each did that and the results were merged field by field, the two
 * renumberings interleaved — several rows claiming the same position, and the
 * order that came out depending on which rows happened to be newer. Nothing was
 * lost, but the sequence was nobody's.
 *
 * A fractional position is picked *between* its neighbours instead, so a move
 * writes exactly one row. Two people moving different cards then touch
 * different rows and both moves survive; two people moving the *same* card is a
 * genuine conflict, settled like any other scalar, and only that card moves.
 *
 * Ties still have to be broken, because two devices can independently land on
 * the same midpoint. Comparing ids after position gives every device the same
 * answer without any of them having to agree first.
 */

/**
 * Gap between freshly appended items.
 *
 * Deliberately 1, matching the dense indices this replaces. Positions are
 * composed into sort keys elsewhere on the assumption that they stay small —
 * `chapterNumber * 10_000 + sortOrder` in seven places, and
 * `chapterNumber + sortOrder / 1_000_000` in computeSortKeySync. A wider step
 * would push the tenth event of a chapter past the 10,000 band and bleed one
 * chapter into the next. Keeping the step at 1 means appended positions are
 * exactly what they were, and only the space *between* them is new.
 */
export const POSITION_STEP = 1

/**
 * Below this, midpoints stop being representable and two inserts at the same
 * spot would collapse onto one number. Callers renumber the run instead.
 */
const MIN_GAP = 1e-6

export interface Positioned {
  id: string
  sortOrder: number
}

/**
 * A position between two neighbours, or past the end when one side is absent.
 *
 * Returns null when the neighbours are too close to fit anything between them —
 * the caller should renumber that stretch rather than write a position that
 * cannot be subdivided again.
 */
export function positionBetween(before: number | null, after: number | null): number | null {
  if (before === null && after === null) return POSITION_STEP
  if (before === null) return after! - POSITION_STEP
  if (after === null) return before + POSITION_STEP
  if (after - before < MIN_GAP) return null
  return before + (after - before) / 2
}

/**
 * Sort by position, breaking ties by id.
 *
 * The tiebreak is what makes the result the same on every device. Without it,
 * equal positions leave the order to whatever the storage layer returns, which
 * is stable within one device and meaningless across two.
 */
export function compareByPosition(a: Positioned, b: Positioned): number {
  return a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Put records in their agreed order. */
export function inPositionOrder<T extends Positioned>(records: readonly T[]): T[] {
  return [...records].sort(compareByPosition)
}

/**
 * Where to put `movedId` so it lands at `toIndex` of the current order, as the
 * single write that realises the move.
 *
 * Returns the whole run renumbered when no gap is left to slot into — rare, and
 * the only case that touches more than one row.
 */
export function moveTo(
  records: readonly Positioned[],
  movedId: string,
  toIndex: number,
): Positioned[] {
  const ordered = inPositionOrder(records)
  const without = ordered.filter((r) => r.id !== movedId)
  const clamped = Math.max(0, Math.min(Math.trunc(toIndex), without.length))

  const before = clamped > 0 ? without[clamped - 1].sortOrder : null
  const after = clamped < without.length ? without[clamped].sortOrder : null
  const position = positionBetween(before, after)

  if (position !== null) return [{ id: movedId, sortOrder: position }]

  // No room between the neighbours: spread the run out again and place the
  // moved card in its new slot. Writing several rows here is the cost of
  // never writing them the rest of the time.
  const settled = [...without.slice(0, clamped), { id: movedId, sortOrder: 0 }, ...without.slice(clamped)]
  return renumber(settled)
}

/** Space a run out evenly, from the start. Used when midpoints run out. */
export function renumber(records: readonly Positioned[]): Positioned[] {
  return records.map((r, i) => ({ id: r.id, sortOrder: (i + 1) * POSITION_STEP }))
}

/** The position for a new record appended after everything already present. */
export function positionForAppend(records: readonly Positioned[]): number {
  if (records.length === 0) return POSITION_STEP
  return Math.max(...records.map((r) => r.sortOrder)) + POSITION_STEP
}
