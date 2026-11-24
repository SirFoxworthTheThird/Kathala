/**
 * An editor's changes in a scene, in the order a reader meets them (UX-2-23).
 *
 * Bringing a file in keeps the edits made with tracking off before the tracked
 * ones, because the tracked were made on the text after them, and Changes
 * listed them so: *well-known*, in paragraph 2, above the two tracked changes
 * in paragraph 1. Working down the list against the Page went back and forth.
 *
 * Each is placed where its words are in the scene as it is: the words it
 * changes with those kept either side, or fewer of those where the others were
 * changed too, so long as they are found once. One not found keeps its place
 * after those that are, in the order it came.
 */
export interface Placeable { before: string; prefix: string; suffix: string }

export function whereInScene(prose: string, c: Placeable): number | null {
  for (const k of [Infinity, 32, 16, 8]) {
    const lead = k === Infinity ? c.prefix : c.prefix.slice(-k)
    const tail = k === Infinity ? c.suffix : c.suffix.slice(0, k)
    const needle = `${lead}${c.before}${tail}`
    if (!needle.trim()) return null
    const at = prose.indexOf(needle)
    if (at >= 0 && prose.indexOf(needle, at + 1) < 0) return at + lead.length
  }
  return null
}

export function inReadingOrder<T extends Placeable>(rows: readonly T[], prose: string | undefined): T[] {
  if (prose === undefined) return [...rows]
  const at = new Map(rows.map((r) => [r, whereInScene(prose, r)]))
  return rows
    .map((r, i) => ({ r, i, at: at.get(r) ?? Infinity }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map(({ r }) => r)
}
