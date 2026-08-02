/**
 * Spoiler gating for reading mode.
 *
 * PlotWeave already answers "what is true at this moment?" for anything that
 * carries a snapshot — where a character stands, what they hold, whether they
 * are alive. What it does not do by default is hide the *existence* of things
 * the reader has not met yet. A roster listing all fifty characters in chapter
 * two tells you the story's whole cast, and a lore page titled after a
 * late-book revelation gives the revelation away in the index.
 *
 * So gating is about first appearance: an entity becomes visible at the
 * earliest moment the story actually uses it, and stays visible from then on.
 * Everything here is a plain function over plain data — the wiring lives in the
 * hooks that already load these records.
 */

/** Globally comparable event position: `chapter.number + sortOrder / 1e6`. */
export type SortKey = number

export interface EventPosition {
  id: string
  chapterId: string
  sortOrder: number
}

/** Order events the way the timeline and the time cursor both do. */
export function sortKeysByEvent(
  events: readonly EventPosition[],
  chapterNumberById: ReadonlyMap<string, number>,
): Map<string, SortKey> {
  const out = new Map<string, SortKey>()
  for (const ev of events) {
    const chapter = chapterNumberById.get(ev.chapterId)
    if (chapter === undefined) continue
    out.set(ev.id, chapter + ev.sortOrder / 1_000_000)
  }
  return out
}

/**
 * The opening moment of a story, or null if it has none.
 *
 * Where a book with no remembered place should start. Null is *not* a neutral
 * cursor — it means "all chapters", so opening a freshly downloaded book with
 * no position would lay the whole plot out before the reader had read a word.
 *
 * Ties are broken by id so two events sharing a position give the same answer
 * on every device, matching how the timeline orders them.
 */
export function firstEventId(
  events: readonly EventPosition[],
  chapterNumberById: ReadonlyMap<string, number>,
): string | null {
  const keys = sortKeysByEvent(events, chapterNumberById)
  let best: { id: string; key: SortKey } | null = null
  for (const [id, key] of keys) {
    if (!best || key < best.key || (key === best.key && id < best.id)) best = { id, key }
  }
  return best?.id ?? null
}

export interface ReadingProgress {
  /** The chapter the reader is in. */
  chapter: number
  /** How many chapters the book has. */
  total: number
}

/**
 * How far into a book a remembered position is, for the shelf.
 *
 * Null when there is nothing honest to show: no position, a position pointing
 * at an event that no longer exists, or a story with no chapters. "All
 * chapters" is null too — the reader asked to see everything, which is not a
 * place in the book and should not be drawn as one.
 */
export function readingProgress(
  eventId: string | null | undefined,
  events: readonly EventPosition[],
  chapterNumberById: ReadonlyMap<string, number>,
): ReadingProgress | null {
  if (!eventId) return null
  const event = events.find((e) => e.id === eventId)
  if (!event) return null
  const chapter = chapterNumberById.get(event.chapterId)
  if (chapter === undefined) return null

  let total = 0
  for (const n of chapterNumberById.values()) if (n > total) total = n
  // Highest chapter number rather than a count, so the two halves of "Ch.5 of
  // 17" are the same kind of number even where chapters are numbered oddly.
  return total > 0 ? { chapter, total } : null
}

/** One "this entity is used at this event" fact. */
export interface Appearance {
  entityId: string
  eventId: string
}

/**
 * The earliest position at which each entity is used.
 *
 * Callers assemble the appearances from whatever links their entity to an
 * event — a character from snapshots and cast lists, an item from placements,
 * a location from the events set there. Keeping that out here means a new
 * entity group joins gating by describing its own links rather than by
 * extending a switch in this file.
 */
export function firstAppearances(
  appearances: Iterable<Appearance>,
  sortKeyByEvent: ReadonlyMap<string, SortKey>,
): Map<string, SortKey> {
  const out = new Map<string, SortKey>()
  for (const { entityId, eventId } of appearances) {
    const key = sortKeyByEvent.get(eventId)
    if (key === undefined) continue
    const current = out.get(entityId)
    if (current === undefined || key < current) out.set(entityId, key)
  }
  return out
}

/**
 * Whether an entity should be shown at the reader's position.
 *
 * Two deliberate choices:
 *
 * A null cursor means "all chapters", which the reader has to select. Treating
 * it as full reveal respects that; the alternative — hiding everything until a
 * position is picked — makes the app look broken to someone who has not
 * realised the cursor exists.
 *
 * An entity with no appearance at all is shown. It is not part of the narrated
 * sequence, so there is no moment to reveal it at, and hiding it would make
 * standalone reference material permanently invisible rather than merely late.
 */
export function isRevealed(
  entityId: string,
  firstSeen: ReadonlyMap<string, SortKey>,
  cursor: SortKey | null,
): boolean {
  if (cursor === null) return true
  const first = firstSeen.get(entityId)
  if (first === undefined) return true
  return first <= cursor
}

/** Filter a list of records down to what the reader has met. */
export function revealed<T extends { id: string }>(
  records: readonly T[],
  firstSeen: ReadonlyMap<string, SortKey>,
  cursor: SortKey | null,
): T[] {
  if (cursor === null) return [...records]
  return records.filter((r) => isRevealed(r.id, firstSeen, cursor))
}

/**
 * How many records the cursor is holding back, for the note that tells a reader
 * the list is short on purpose rather than incomplete.
 */
export function hiddenCount<T extends { id: string }>(
  records: readonly T[],
  firstSeen: ReadonlyMap<string, SortKey>,
  cursor: SortKey | null,
): number {
  if (cursor === null) return 0
  return records.length - revealed(records, firstSeen, cursor).length
}
