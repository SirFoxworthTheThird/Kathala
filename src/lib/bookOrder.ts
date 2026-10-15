/**
 * Where a scene sits in the book: its chapter's number, then its place in the
 * chapter. **The one place this is computed.**
 *
 * There used to be four formulas, written out by hand in about twenty files:
 * - `chapter + sortOrder / 1_000_000`, the stored `sortKey`;
 * - the old formula, chapter times ten thousand plus `sortOrder`, in the
 *   checker, the prose checks and a dozen views;
 * - the same with a hundred thousand, in Find & replace, and with a million in
 *   four more;
 * - a sequel's first snapshot stored at ten thousand, the old formula's scale.
 *
 * They agree on order only while a chapter holds fewer than ten thousand
 * scenes, and they are not comparable with each other at all. A position
 * computed one way and compared with one stored another way is how 396 of the
 * Fellowship's 533 states once resolved to the wrong chapter (see
 * `snapshotUtils.orderOf`). `bookOrder.test.ts` holds every other file to
 * calling these.
 *
 * Since #621 a chapter's number is its place in the whole book, every
 * timeline's, so this order is the book's reading order.
 */

/** A scene's place in the book. Comparable across every timeline. */
export type BookPosition = number

/** The position of a scene `sortOrder` into chapter `chapterNumber`. */
export function bookPosition(chapterNumber: number, sortOrder: number): BookPosition {
  return chapterNumber + sortOrder / 1_000_000
}

/** What a scene needs to have a position. */
export interface Placed {
  chapterId: string
  sortOrder: number
}

/** A scene's position, or `missing` when its chapter is not in the map. */
export function positionOf(scene: Placed, chapterNumberById: ReadonlyMap<string, number>, missing = 0): BookPosition {
  return bookPosition(chapterNumberById.get(scene.chapterId) ?? missing, scene.sortOrder)
}

/** Sorts scenes into book order. */
export function inBookOrder(chapterNumberById: ReadonlyMap<string, number>): (a: Placed, b: Placed) => number {
  return (a, b) => positionOf(a, chapterNumberById) - positionOf(b, chapterNumberById)
}

/** Chapter numbers by id, the map every function here reads. */
export function chapterNumbers(chapters: Iterable<{ id: string; number: number }>): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of chapters) out.set(c.id, c.number)
  return out
}

/**
 * A scene's position by id, for code that holds ids rather than scenes: -1
 * for a scene that is not there. A scene whose chapter is missing sits at
 * chapter 0, as every copy of this function did before it was this one.
 */
export function positionLookup(
  scenes: Iterable<Placed & { id: string }>,
  chapters: Iterable<{ id: string; number: number }>,
): (sceneId: string) => BookPosition {
  const numbers = chapterNumbers(chapters)
  const byId = new Map<string, Placed>()
  for (const s of scenes) byId.set(s.id, s)
  return (sceneId) => {
    const scene = byId.get(sceneId)
    return scene ? positionOf(scene, numbers) : -1
  }
}
