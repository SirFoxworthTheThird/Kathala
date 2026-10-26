import type { Chapter, KnowledgeFact, WorldEvent } from '@/types'
import { computeKnowledgeLeaks } from './proseContinuity'
import { positionLookup } from './bookOrder'

/*
  What the reader knows, chapter by chapter, in the order they read it — and
  which era told them (next-plan.md, Part E2). In a book braided from eras the
  reader meets a fact in whichever strand says it first, which is not always
  the scene the writer set to reveal it: run 10's judges found the Compact
  naming the Opener eight chapters before the Mercy was to.

  Each fact the reader is set to learn is placed at its reveal, and at every
  earlier chapter whose prose gives it away by the early-reveal check's rule
  (`computeKnowledgeLeaks`): drawn against the chapter order, a strand telling
  it early is visible at a glance.
*/

/** A chapter as the schedule draws it: in reading order, with its strand. */
export interface ScheduleChapter { id: string; number: number; title: string; timelineId: string }

/** Where the reader meets a fact: the scene, its chapter, and the strand it is in. */
export interface ScheduleMark { eventId: string; chapterId: string; timelineId: string }

/** A chapter that gives a fact away before its reveal, with what matched and how many chapters early. */
export interface ScheduleLeak extends ScheduleMark { term: string; chaptersEarly: number }

export interface ScheduleRow {
  fact: KnowledgeFact
  reveal: ScheduleMark
  /** Earlier chapters that give it away, first first; one per chapter. */
  leaks: ScheduleLeak[]
}

export interface ReaderSchedule {
  chapters: ScheduleChapter[]
  /** Each fact the reader is set to learn at a scene in the book, in the order of their reveals. */
  rows: ScheduleRow[]
}

export function readerSchedule({ facts, events, chapters, sceneTextByEvent }: {
  facts: KnowledgeFact[]
  events: WorldEvent[]
  chapters: Chapter[]
  sceneTextByEvent: Map<string, string>
}): ReaderSchedule {
  const ordered = [...chapters].sort((a, b) => a.number - b.number)
  const index = new Map(ordered.map((c, i) => [c.id, i]))
  const numberOf = new Map(ordered.map((c) => [c.id, c.number]))
  const eventById = new Map(events.map((e) => [e.id, e]))
  const order = positionLookup(events, chapters)
  const mark = (eventId: string): ScheduleMark | null => {
    const e = eventById.get(eventId)
    return e && index.has(e.chapterId) ? { eventId, chapterId: e.chapterId, timelineId: e.timelineId } : null
  }

  const leaksOf = new Map<string, ScheduleLeak[]>()
  for (const leak of computeKnowledgeLeaks({ facts, events, chapters, sceneTextByEvent })) {
    const at = mark(leak.leakEventId)
    const reveal = mark(leak.revealEventId)
    if (!at || !reveal) continue
    const list = leaksOf.get(leak.fact.id) ?? []
    // One per chapter: the first scene of it to give it away.
    const same = list.find((l) => l.chapterId === at.chapterId)
    if (same && order(same.eventId) <= order(at.eventId)) continue
    // Counted in chapter numbers: the book numbers its chapters across every strand, so this is how many the reader turns.
    const leakRow = { ...at, term: leak.matchedTerm, chaptersEarly: numberOf.get(reveal.chapterId)! - numberOf.get(at.chapterId)! }
    leaksOf.set(leak.fact.id, same ? list.map((l) => (l === same ? leakRow : l)) : [...list, leakRow])
  }

  const rows: ScheduleRow[] = []
  for (const fact of facts) {
    const reveal = fact.readerLearnsAtEventId ? mark(fact.readerLearnsAtEventId) : null
    if (!reveal) continue
    const leaks = (leaksOf.get(fact.id) ?? []).sort((a, b) => order(a.eventId) - order(b.eventId))
    rows.push({ fact, reveal, leaks })
  }
  rows.sort((a, b) => order(a.reveal.eventId) - order(b.reveal.eventId) || a.fact.title.localeCompare(b.fact.title))

  return {
    chapters: ordered.map((c) => ({ id: c.id, number: c.number, title: c.title, timelineId: c.timelineId })),
    rows,
  }
}

/** A fact the reader knows at a point, and where they first met it: its reveal, or a strand that gave it away before. */
export interface KnownFact { row: ScheduleRow; told: ScheduleMark; early: boolean }

/**
 * What the reader knows by scene `eventId` — at or before it in reading order —
 * and where each was first met: a leak before the reveal, if one came first.
 */
export function knownBy(schedule: ReaderSchedule, eventId: string, events: WorldEvent[], chapters: Chapter[]): KnownFact[] {
  const order = positionLookup(events, chapters)
  const here = order(eventId)
  if (here < 0) return []
  const out: KnownFact[] = []
  for (const row of schedule.rows) {
    const first = row.leaks.find((l) => order(l.eventId) <= here)
    if (first) out.push({ row, told: first, early: true })
    else if (order(row.reveal.eventId) <= here) out.push({ row, told: row.reveal, early: false })
  }
  return out
}
