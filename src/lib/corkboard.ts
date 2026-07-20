/**
 * Pure ordering helpers for the corkboard / scene outliner. The board shows one
 * column per chapter and one card per event; dragging a card reorders it within
 * a column or moves it to another. All the index math lives here so it can be
 * unit-tested independently of drag-and-drop wiring.
 */

/**
 * Insert `movedId` into `orderedIds` at `toIndex`, first removing it if already
 * present. Works for both a within-column reorder (list contains movedId) and a
 * cross-column move (list is the target column, without movedId). `toIndex` is
 * clamped into range.
 */
export function reorderInsert(orderedIds: string[], movedId: string, toIndex: number): string[] {
  const without = orderedIds.filter((id) => id !== movedId)
  const clamped = Math.max(0, Math.min(Math.trunc(toIndex), without.length))
  return [...without.slice(0, clamped), movedId, ...without.slice(clamped)]
}

/** Map an ordered id list to `{ id, sortOrder }` pairs (sortOrder = index). */
export function assignSortOrders(orderedIds: string[]): { id: string; sortOrder: number }[] {
  return orderedIds.map((id, i) => ({ id, sortOrder: i }))
}

/**
 * Return only the `{ id, sortOrder }` pairs whose sortOrder differs from the
 * current value — the minimal set of writes needed to realise `orderedIds`.
 */
export function sortOrderDiff(
  orderedIds: string[],
  current: Map<string, number>,
): { id: string; sortOrder: number }[] {
  return assignSortOrders(orderedIds).filter(({ id, sortOrder }) => current.get(id) !== sortOrder)
}
