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
 * An entity with no appearance at all is *hidden*. A guard that fails open is
 * not a guard: the reader cannot tell "the story has not placed this yet" from
 * "nobody recorded where this goes", and the second silently reveals the first.
 * In the shipped Philosopher's Stone that gap put Charlie Weasley, a flying
 * motorcycle and Godric's Hollow on screen at chapter one.
 *
 * This costs nothing permanently, which is what makes it affordable: "all
 * chapters" is one control away and reveals everything, so an entity the story
 * never places is late rather than lost. It applies only to entities discovered
 * through appearances — characters, items, places, threads, motifs, regions.
 * Records carrying their own reveal point go through `hasReached`, and records
 * that are merely *linked* to others go through `linksRevealed`; genuine
 * standalone reference material is gated there, not here.
 */
export function isRevealed(
  entityId: string,
  firstSeen: ReadonlyMap<string, SortKey>,
  cursor: SortKey | null,
): boolean {
  if (cursor === null) return true
  const first = firstSeen.get(entityId)
  if (first === undefined) return false
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

/** Just enough of a location marker to decide which maps it reveals. */
export interface RevealingMarker {
  id: string
  mapLayerId: string
  linkedMapLayerId?: string | null
}

export interface RevealingMapLayer {
  id: string
  parentMapId?: string | null
}

/**
 * Which maps the reader has been to, given which markers they have met.
 *
 * Markers are gated but the maps holding them were not, so a world with a map
 * per setting listed every place in the book by name before the reader arrived
 * — the gating defeated by its own sidebar. A map is shown when either reveal
 * point has been reached:
 *
 * - a marker **on** it is revealed — the reader is looking at somewhere on this
 *   map, so the map itself is no longer news;
 * - or the marker **linking** to it is revealed — a sub-map called "Diagon
 *   Alley" is exactly as much of a spoiler as the marker of the same name, and
 *   keeps step with it.
 *
 * Either will do. Waiting for the link alone hid the one place the reader was
 * actually in: a scene names where it happens and that marker is revealed with
 * the scene, but if it sits on a sub-map, the sub-map waited on a *different*
 * marker pointing at it — so a chapter set inside the Prancing Pony left the
 * map of Bree missing, with the scene's own location on it.
 *
 * A map with neither — nothing on it, nothing pointing at it — has no reveal
 * point to wait for and stays, the same choice made for an entity that never
 * appears anywhere.
 */
export function mapLayerRevealer(
  markers: readonly RevealingMarker[],
  markerRevealed: (markerId: string) => boolean,
  layers: readonly RevealingMapLayer[] = [],
): (layerId: string) => boolean {
  const linked = new Set<string>()
  const populated = new Set<string>()
  // Kept apart rather than merged, because they are the two reveal points and
  // the bug was reading only one of them.
  const standingOn = new Set<string>()
  const linkedFrom = new Set<string>()
  for (const m of markers) {
    populated.add(m.mapLayerId)
    if (m.linkedMapLayerId) linked.add(m.linkedMapLayerId)
    if (!markerRevealed(m.id)) continue
    standingOn.add(m.mapLayerId)
    if (m.linkedMapLayerId) linkedFrom.add(m.linkedMapLayerId)
  }
  const parentById = new Map(layers.map((layer) => [layer.id, layer.parentMapId ?? null]))
  const reached = new Set([...standingOn, ...linkedFrom])
  // Reveal the complete navigation path to each reached layer. Guarding with
  // `reached` also makes malformed cyclic map data harmless.
  for (const layerId of [...reached]) {
    let parentId = parentById.get(layerId) ?? null
    while (parentId && !reached.has(parentId)) {
      reached.add(parentId)
      parentId = parentById.get(parentId) ?? null
    }
  }
  return (id) => {
    if (reached.has(id)) return true
    // Nothing revealed points here yet: it waits only if there was something to
    // wait for in the first place.
    return !linked.has(id) && !populated.has(id)
  }
}
