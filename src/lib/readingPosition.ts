import { computeSortKeySync, type SortKey } from './sortKey'

/** The minimum an event and its chapter must tell us to be placed in the book. */
export interface PlaceableEvent {
  id: string
  chapterId: string
  sortOrder: number
}

/**
 * The first scene of a book, in story order.
 *
 * Used to start a newly downloaded world at its opening rather than nowhere. A
 * world with no remembered position has a `null` cursor, and a null cursor
 * means *all chapters* — so a book that has never been opened reveals its whole
 * cast, every place, and all of its lore before a word has been read. That is
 * the exact opposite of what reading mode is for, at the one moment a reader is
 * most likely to look around.
 *
 * Ordering is the project's one story order — chapter number plus scene
 * position — computed through `computeSortKeySync` rather than re-derived, so a
 * book cannot open at a different scene than the one the gate calls first.
 * Events whose chapter is missing sort to -1 there and are skipped rather than
 * winning by being unplaceable.
 */
export function firstSceneId(
  chapters: readonly { id: string; number: number }[],
  events: readonly PlaceableEvent[],
): string | null {
  const chapterNumberById = new Map(chapters.map((c) => [c.id, c.number]))
  const eventById = new Map(events.map((e) => [e.id, e]))

  let bestId: string | null = null
  let bestKey = Infinity
  for (const ev of events) {
    const key = computeSortKeySync(ev.id, eventById, chapterNumberById)
    if (key < 0) continue
    if (key < bestKey) {
      bestKey = key
      bestId = ev.id
    }
  }
  return bestId
}

/**
 * Where the cursor should go when a reader's eye reaches a scene.
 *
 * Two rules, both of them about not taking something away from the reader.
 *
 * **Never move a null cursor.** Null means "all chapters" — a deliberate choice
 * made through a confirm, and recorded so the next visit honours it. Advancing
 * from it would quietly close a gate the reader had opened, which is the one
 * change they explicitly asked not to have.
 *
 * **Never go backwards.** Turning back to re-read an earlier passage, or
 * scrolling up to check a name, would otherwise re-hide everything learned
 * since — the reader would watch the book they have read shrink behind them.
 * The cursor is a high-water mark, so reading on moves it and reading back does
 * not. Moving it backwards deliberately is what the time cursor control is for.
 *
 * Returns the event id to move to, or `null` for "leave it where it is".
 */
export function cursorForScene(
  args: {
    cursor: SortKey | null
    scene: { id: string; sortKey: SortKey }
  },
): string | null {
  const { cursor, scene } = args
  if (cursor === null) return null
  if (scene.sortKey <= cursor) return null
  return scene.id
}

/**
 * Place a world at its opening scene if it is a reading-mode world that nobody
 * has positioned yet.
 *
 * Called once, when a world arrives — a Library download or an imported
 * `.pwk` — rather than every time one is opened. Opening is the wrong moment:
 * a reader who has chosen "all chapters" records a null position deliberately,
 * and re-seeding on open would put them back at the start of the book every
 * visit. Arrival happens once and cannot fight a choice that has not been made.
 *
 * A world with no chapters or no events is left alone; there is no first scene
 * to open at, and a world can be imported empty.
 */
export async function seedReadingStart(
  worldId: string,
  deps: {
    isReadingMode: (worldId: string) => Promise<boolean>
    load: (worldId: string) => Promise<{
      chapters: readonly { id: string; number: number }[]
      events: readonly PlaceableEvent[]
    }>
    seed: (worldId: string, eventId: string) => void
  },
): Promise<string | null> {
  if (!(await deps.isReadingMode(worldId))) return null
  const { chapters, events } = await deps.load(worldId)
  const first = firstSceneId(chapters, events)
  if (!first) return null
  deps.seed(worldId, first)
  return first
}
