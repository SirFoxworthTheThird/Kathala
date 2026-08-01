import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useActiveEventId } from '@/store'
import { useWorld } from '@/db/hooks/useWorlds'
import {
  firstAppearances, hiddenCount, isRevealed, revealed, sortKeysByEvent,
  type Appearance, type SortKey,
} from '@/lib/spoilers'

/**
 * Reading mode, and what the reader has met so far.
 *
 * The gate is derived rather than stored: an entity is revealed at the earliest
 * event that uses it, which falls straight out of records the app already keeps
 * — cast lists on events, and the per-event snapshots that drive every other
 * view. Nothing had to be authored for a world to become spoiler-safe, which is
 * why the library worlds work without being rebuilt.
 */

export interface ReadingGate {
  /** Whether gating applies at all. */
  active: boolean
  /** The reader's position, or null for "all chapters" (full reveal). */
  cursor: SortKey | null
  /** Chapter number at the cursor, for the banner. */
  chapterNumber: number | null
  isRevealed: (entityId: string) => boolean
  filter: <T extends { id: string }>(records: readonly T[]) => T[]
  hidden: <T extends { id: string }>(records: readonly T[]) => number
  /**
   * How many of each group the cursor is holding back. Carried on the gate so a
   * list can say "47 not yet met" without separately loading the ungated set,
   * which is exactly the set it is trying not to have.
   */
  hiddenCounts: { characters: number; items: number; locations: number }
  /**
   * Whether a moment has been reached. Used by records that carry their own
   * reveal point rather than being discovered through appearances — a lore page
   * with `visibleFromEventId`, or a knowledge fact with `readerLearnsAtEventId`.
   */
  hasReached: (eventId: string | null | undefined) => boolean
  /**
   * Whether a record linked to other entities should be shown.
   *
   * A lore page about a character the reader has not met gives that character
   * away by existing, so it waits for all of its links. With no links there is
   * nothing to wait for and the page is shown.
   */
  linksRevealed: (entityIds: readonly string[] | null | undefined) => boolean
}

/** A gate that hides nothing — used while data is loading, and when writing. */
export const OPEN_GATE: ReadingGate = {
  active: false,
  cursor: null,
  chapterNumber: null,
  isRevealed: () => true,
  filter: (records) => [...records],
  hidden: () => 0,
  hiddenCounts: { characters: 0, items: 0, locations: 0 },
  hasReached: () => true,
  linksRevealed: () => true,
}

export function useReadingMode(worldId: string | null): boolean {
  return !!useWorld(worldId)?.readingMode
}

/**
 * Build the reveal gate for a world.
 *
 * Returns an open gate when reading mode is off, so callers can use it
 * unconditionally rather than branching at every list.
 */
export function useReadingGate(worldId: string | null): ReadingGate {
  const readingMode = useReadingMode(worldId)
  const activeEventId = useActiveEventId()

  const data = useLiveQuery(
    async () => {
      if (!worldId || !readingMode) return null
      const [
        events, chapters, charSnaps, itemPlacements, locSnaps, itemSnaps,
        regionSnaps, characters, items, markers,
      ] = await Promise.all([
        db.events.where('worldId').equals(worldId).toArray(),
        db.chapters.where('worldId').equals(worldId).toArray(),
        db.characterSnapshots.where('worldId').equals(worldId).toArray(),
        db.itemPlacements.where('worldId').equals(worldId).toArray(),
        db.locationSnapshots.where('worldId').equals(worldId).toArray(),
        db.itemSnapshots.where('worldId').equals(worldId).toArray(),
        db.mapRegionSnapshots.where('worldId').equals(worldId).toArray(),
        db.characters.where('worldId').equals(worldId).toArray(),
        db.items.where('worldId').equals(worldId).toArray(),
        db.locationMarkers.where('worldId').equals(worldId).toArray(),
      ])
      return { events, chapters, charSnaps, itemPlacements, locSnaps, itemSnaps, regionSnaps, characters, items, markers }
    },
    [worldId, readingMode],
    null,
  )

  return useMemo(() => {
    if (!readingMode || !data) return OPEN_GATE

    const chapterNumberById = new Map(data.chapters.map((c) => [c.id, c.number]))
    const sortKeyByEvent = sortKeysByEvent(data.events, chapterNumberById)

    const cursor = activeEventId ? sortKeyByEvent.get(activeEventId) ?? null : null
    const cursorEvent = activeEventId ? data.events.find((e) => e.id === activeEventId) : undefined
    const chapterNumber = cursorEvent ? chapterNumberById.get(cursorEvent.chapterId) ?? null : null

    // Every way an entity can be tied to a moment in the story. A character
    // counts as met when they are on stage or their state is recorded — being
    // *mentioned* deliberately does not reveal them, since a name dropped in
    // dialogue is exactly the kind of foreshadowing a reader should meet in the
    // book rather than in an index.
    const appearances: Appearance[] = []
    for (const ev of data.events) {
      for (const id of ev.involvedCharacterIds) appearances.push({ entityId: id, eventId: ev.id })
      if (ev.povCharacterId) appearances.push({ entityId: ev.povCharacterId, eventId: ev.id })
      for (const id of ev.involvedItemIds) appearances.push({ entityId: id, eventId: ev.id })
      if (ev.locationMarkerId) appearances.push({ entityId: ev.locationMarkerId, eventId: ev.id })
      // Threads and motifs are carried by the events that advance them, so the
      // first such event is when the reader meets the subplot. Their names are
      // among the sharpest a world holds — "The Philosopher's Stone Mystery"
      // gives away the book on its own.
      for (const id of ev.threadIds ?? []) appearances.push({ entityId: id, eventId: ev.id })
      for (const id of ev.motifIds ?? []) appearances.push({ entityId: id, eventId: ev.id })
    }
    for (const s of data.charSnaps) {
      appearances.push({ entityId: s.characterId, eventId: s.eventId })
      if (s.currentLocationMarkerId) {
        appearances.push({ entityId: s.currentLocationMarkerId, eventId: s.eventId })
      }
      for (const id of s.inventoryItemIds) appearances.push({ entityId: id, eventId: s.eventId })
    }
    for (const p of data.itemPlacements) appearances.push({ entityId: p.itemId, eventId: p.eventId })
    for (const s of data.itemSnaps) appearances.push({ entityId: s.itemId, eventId: s.eventId })
    for (const s of data.locSnaps) {
      appearances.push({ entityId: s.locationMarkerId, eventId: s.eventId })
    }
    // A region's snapshots are the same shape as a location's — regionId and
    // eventId — so a territory enters the story the moment its state is first
    // recorded, on exactly the rule already used for the places inside it.
    for (const s of data.regionSnaps) {
      appearances.push({ entityId: s.regionId, eventId: s.eventId })
    }

    const firstSeen = firstAppearances(appearances, sortKeyByEvent)

    return {
      active: true,
      cursor,
      chapterNumber,
      isRevealed: (entityId: string) => isRevealed(entityId, firstSeen, cursor),
      filter: <T extends { id: string }>(records: readonly T[]) => revealed(records, firstSeen, cursor),
      hidden: <T extends { id: string }>(records: readonly T[]) => hiddenCount(records, firstSeen, cursor),
      hiddenCounts: {
        characters: hiddenCount(data.characters, firstSeen, cursor),
        items: hiddenCount(data.items, firstSeen, cursor),
        locations: hiddenCount(data.markers, firstSeen, cursor),
      },
      hasReached: (eventId) => {
        if (cursor === null || !eventId) return true
        const at = sortKeyByEvent.get(eventId)
        // An unplaceable event cannot be compared, so it does not hold
        // anything back — the same choice made for entities that never appear.
        return at === undefined || at <= cursor
      },
      linksRevealed: (entityIds) => {
        if (cursor === null || !entityIds || entityIds.length === 0) return true
        return entityIds.every((id) => isRevealed(id, firstSeen, cursor))
      },
    }
  }, [readingMode, data, activeEventId])
}
