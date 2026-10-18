import { bookPosition, chapterNumbers, type BookPosition } from '@/lib/bookOrder'
import { computeInWorldDays, type ClockRules, type ClockScene } from '@/lib/inWorldTime'
import type { Timeline } from '@/types'

/**
 * Last known state, for every kind of record, by one rule. **The one place it
 * is decided.**
 *
 * State is written as deltas: a record at a scene says what was true there,
 * and what is true at the cursor is the last record at or before it. The
 * question every screen asks — where is she, what does he hold, is the bridge
 * still standing — is the same question, and it used to be answered in about
 * twenty places, in book order across every timeline.
 *
 * Book order across timelines is right for parallel storylines and for a frame
 * story, and wrong for a book in eras. Writer run 10 braided three timelines
 * centuries apart; with the cursor in 742 AL, the Writer's Brief listed people
 * from 311 AL "carried forward, age 783", and the map put two of them in the
 * Hall of Muster, because their records came earlier in the book. So:
 *
 * - **People stay in their era.** A person's state is read in book order across
 *   timelines whose in-world spans overlap (`Story.sameEra`), and never carried
 *   between timelines whose spans do not.
 * - **Things and places can cross eras, by in-world time.** An item's or
 *   place's state comes from its own era first. Where its era has none yet, it
 *   comes from the latest record in another era that is earlier in in-world
 *   time, and says so: `Known.carriedFrom` names that timeline, so a screen can
 *   say "last known in 311 AL" instead of presenting it as a fact here.
 *
 * Nothing past the cursor in book order is read, in either case. A carried
 * record is chosen by in-world time, but only among records the book has
 * already shown — the reader's position is the cursor, and a later chapter of
 * an earlier era is still a later chapter.
 */

/** What a scene needs for the engine to place it, in the book and in time. */
export type StoryScene = ClockScene

/** The in-world days a timeline's scenes cover, first to last. */
export interface TimelineSpan {
  first: number
  last: number
  /**
   * No day offset and no scene with a date of its own: nothing says when it
   * is, so it is taken to share people with every timeline, as all timelines
   * did before eras. A frame story nobody dated is the usual case.
   */
  undated: boolean
}

/** A world's scenes, placed once, for the engine to read. */
export interface Story {
  /** A scene's place in the book; -1 for a scene that is not there. */
  position(sceneId: string): BookPosition
  /** A scene's timeline, or null for a scene that is not there. */
  timelineOf(sceneId: string): string | null
  /** A scene's absolute in-world day, on the world's clock, or null. */
  dayOf(sceneId: string): number | null
  /** Each timeline's span, by id. */
  spans: ReadonlyMap<string, TimelineSpan>
  /**
   * Whether a person's state may carry between two timelines: the same
   * timeline, either one undated, or spans that overlap. Unknown timelines
   * (null) count as the same era, as they did before eras.
   */
  sameEra(a: string | null, b: string | null): boolean
  /**
   * A key per era, for a rule that walks a sequence — an item's holders one
   * after another — and has to walk each era on its own. Timelines that share
   * an era share a key, and so do timelines joined through a third: an
   * undated frame shares an era with every timeline, so in a book with one,
   * every timeline has the same key and the walk is the book's, as before
   * eras. `sameEra` is the finer answer, for a lookup at one moment.
   */
  eraOf(sceneId: string): string | null
}

/**
 * Builds a `Story`. Build it once per render (or per write) and pass it on:
 * it computes every scene's in-world day.
 *
 * `timelines` is required on purpose. Each timeline's `dayOffset` is what puts
 * eras apart; without it every timeline's clock starts at day 0, and the
 * checker's birth-date rule read 742 AL scenes as day 0 of the world clock
 * (run 10: 43 false "before they were born").
 */
export function storyOf(
  scenes: readonly StoryScene[],
  chapters: Iterable<{ id: string; number: number }>,
  timelines: ReadonlyArray<Pick<Timeline, 'id' | 'dayOffset'>>,
  rules: ClockRules = {},
): Story {
  const numbers = chapterNumbers(chapters)
  const byId = new Map<string, StoryScene>()
  for (const s of scenes) byId.set(s.id, s)
  const position = new Map<string, BookPosition>()
  for (const s of scenes) position.set(s.id, bookPosition(numbers.get(s.chapterId) ?? 0, s.sortOrder))

  const days = computeInWorldDays(scenes, [...numbers].map(([id, number]) => ({ id, number })), timelines, rules)

  const spans = new Map<string, TimelineSpan>()
  const offsetOf = new Map(timelines.map((t) => [t.id, t.dayOffset]))
  for (const s of scenes) {
    const day = days.get(s.id)
    if (day === undefined) continue
    const dated = s.inWorldTime != null || (s.travelDays ?? 0) !== 0
    const span = spans.get(s.timelineId)
    if (!span) spans.set(s.timelineId, { first: day, last: day, undated: offsetOf.get(s.timelineId) == null && !dated })
    else {
      span.first = Math.min(span.first, day)
      span.last = Math.max(span.last, day)
      if (dated) span.undated = false
    }
  }

  function sameEra(a: string | null, b: string | null): boolean {
    if (a === null || b === null || a === b) return true
    const x = spans.get(a)
    const y = spans.get(b)
    // A timeline with no scenes has no span, and no records to carry either.
    if (!x || !y || x.undated || y.undated) return true
    return x.first <= y.last && y.first <= x.last
  }

  // Eras as groups: each timeline joined to every one it shares an era with.
  const group = new Map<string, string>([...spans.keys()].map((t) => [t, t]))
  const root = (t: string): string => {
    let r = t
    while (group.get(r) !== r) r = group.get(r)!
    return r
  }
  const ids = [...spans.keys()]
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (sameEra(ids[i], ids[j])) group.set(root(ids[j]), root(ids[i]))
    }
  }

  return {
    position: (id) => position.get(id) ?? -1,
    timelineOf: (id) => byId.get(id)?.timelineId ?? null,
    dayOf: (id) => days.get(id) ?? null,
    spans,
    sameEra,
    eraOf(id) {
      const t = byId.get(id)?.timelineId
      return t === undefined ? null : group.has(t) ? root(t) : t
    },
  }
}

/**
 * How a kind of record carries: a person's (character and relationship
 * states) only within an era, a thing's (items, places, map regions) across
 * eras by in-world time. See the module comment.
 */
export type CarryRule = 'person' | 'thing'

/** Minimum shape of a record the engine resolves. */
export interface Dated {
  eventId: string
  /** The stored position; read only for a record whose scene is gone. */
  sortKey?: number | null
  /** Read only with no cursor, for the most recently updated record. */
  updatedAt?: number
}

/** A resolved record, and where it came from. */
export interface Known<T> {
  record: T
  /** The timeline it was carried from, when that is another era; else null. */
  carriedFrom: string | null
}

/*
  Where a record sits. Computed, not stored: a stored sortKey written under an
  older formula is not comparable with a computed one (see `bookOrder.ts`),
  and 396 of the Fellowship's 533 states once resolved to the wrong chapter for
  it. The stored key is read only when the scene is gone and it is all there is.
*/
function placeOf(record: Dated, story: Story): BookPosition {
  const at = story.position(record.eventId)
  return at === -1 ? record.sortKey ?? -1 : at
}

/**
 * The last known record per entity at `cursor`.
 *
 * - With no cursor: the most recently updated record per entity, which is
 *   what a screen with no moment chosen shows.
 * - With a cursor that is not a scene in the story: only records at it.
 * - Otherwise: the record at the cursor's own scene if there is one, else the
 *   latest at or before it in book order within the cursor's era, else — for
 *   things — the latest in in-world time among other eras' records that are
 *   before the cursor both in the book and in time.
 */
export function lastKnown<T extends Dated>(
  records: readonly T[],
  cursor: string | null,
  story: Story,
  rule: CarryRule,
  entityOf: (record: T) => string,
): Map<string, Known<T>> {
  const out = new Map<string, Known<T>>()
  if (records.length === 0) return out

  if (cursor === null) {
    for (const r of records) {
      const id = entityOf(r)
      const current = out.get(id)
      if (!current || (r.updatedAt ?? 0) > (current.record.updatedAt ?? 0)) out.set(id, { record: r, carriedFrom: null })
    }
    return out
  }

  const here = story.position(cursor)
  if (here === -1) {
    for (const r of records) if (r.eventId === cursor) out.set(entityOf(r), { record: r, carriedFrom: null })
    return out
  }
  const era = story.timelineOf(cursor)
  const today = story.dayOf(cursor)

  const best = new Map<string, { record: T; at: BookPosition }>()
  const carried = new Map<string, { record: T; at: BookPosition; day: number; from: string }>()
  for (const r of records) {
    const at = placeOf(r, story)
    if (at === -1 || at > here) continue
    const id = entityOf(r)
    const from = story.timelineOf(r.eventId)
    if (story.sameEra(era, from)) {
      const current = best.get(id)
      if (!current || r.eventId === cursor || (current.record.eventId !== cursor && at > current.at)) best.set(id, { record: r, at })
      continue
    }
    if (rule !== 'thing' || from === null || today === null) continue
    const day = story.dayOf(r.eventId)
    if (day === null || day > today) continue
    const current = carried.get(id)
    if (!current || day > current.day || (day === current.day && at > current.at)) carried.set(id, { record: r, at, day, from })
  }

  for (const [id, { record }] of best) out.set(id, { record, carriedFrom: null })
  for (const [id, { record, from }] of carried) if (!out.has(id)) out.set(id, { record, carriedFrom: from })
  return out
}

/** `lastKnown`, as the records alone. No records gives back the same array, so a memo downstream keeps its reference. */
export function lastKnownRecords<T extends Dated>(
  records: T[],
  cursor: string | null,
  story: Story,
  rule: CarryRule,
  entityOf: (record: T) => string,
): T[] {
  if (records.length === 0) return records
  return [...lastKnown(records, cursor, story, rule, entityOf).values()].map((k) => k.record)
}

/** One entity's last known record, from that entity's records. */
export function lastKnownOne<T extends Dated>(
  records: readonly T[],
  cursor: string | null,
  story: Story,
  rule: CarryRule,
): Known<T> | undefined {
  // With no cursor there is no moment to resolve at, and a single record's
  // lookup has always answered nothing then.
  if (cursor === null) return undefined
  return lastKnown(records, cursor, story, rule, () => '').get('')
}

/**
 * The timeline a resolved record was carried from, when that is another era
 * than the cursor's; null when it is this era's own. What a screen says beside
 * a thing's state so it is not read as a fact at this scene: "last known in
 * The Mercy".
 */
export function carriedFrom(record: Pick<Dated, 'eventId'>, cursor: string | null, story: Story): string | null {
  if (cursor === null) return null
  const from = story.timelineOf(record.eventId)
  return story.sameEra(story.timelineOf(cursor), from) ? null : from
}

/**
 * Whether these timelines fall into more than one era: some two of them whose
 * spans never meet. In a book of one era nothing ever carries, and a choice
 * about carrying would choose nothing.
 */
export function inEras(story: Story, timelineIds: readonly string[]): boolean {
  return timelineIds.some((a) => timelineIds.some((b) => !story.sameEra(a, b)))
}

/**
 * The entities with records, none of them in the cursor's era: a person who
 * is "not in this era" rather than unplaced in it. Empty with no cursor, or a
 * cursor that is not a scene.
 */
export function outOfEra<T extends Dated>(
  records: readonly T[],
  cursor: string | null,
  story: Story,
  entityOf: (record: T) => string,
): Set<string> {
  const out = new Set<string>()
  if (cursor === null || story.position(cursor) === -1) return out
  const era = story.timelineOf(cursor)
  const here = new Set<string>()
  for (const r of records) {
    const id = entityOf(r)
    if (story.sameEra(era, story.timelineOf(r.eventId))) here.add(id)
    else out.add(id)
  }
  for (const id of here) out.delete(id)
  return out
}

/**
 * The last known record before scene `eventId`, not counting one at it: what
 * a record written at this scene would repeat, or the state a change here
 * starts from. For writes.
 *
 * These used to compare stored `sortKey`s, which knew nothing of eras and,
 * for a record written under an older formula, put it in the wrong place
 * (see `placeOf`).
 */
export function lastBefore<T extends Dated>(
  records: readonly T[],
  eventId: string,
  story: Story,
  rule: CarryRule,
): T | undefined {
  return lastKnownOne(records.filter((r) => r.eventId !== eventId), eventId, story, rule)?.record
}
