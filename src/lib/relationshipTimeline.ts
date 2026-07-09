import type {
  Relationship, RelationshipSnapshot, WorldEvent, Chapter,
  RelationshipSentiment, RelationshipStrength,
} from '@/types'

/** One recorded state of a relationship along the story. */
export interface RelationshipTimelinePoint {
  eventId: string | null
  chapterNumber: number | null
  eventTitle: string | null
  label: string
  sentiment: RelationshipSentiment
  strength: RelationshipStrength
  isActive: boolean
  /** true for the relationship's default/initial state (no snapshot). */
  isBase: boolean
}

/**
 * Builds the evolution of a single relationship: its initial (base) state,
 * then every per-event snapshot in narrative order — so "allies → rivals →
 * reconciled" reads as a sequence. Pure and derived; nothing stored.
 */
export function computeRelationshipTimeline({
  relationship, snapshots, events, chapters,
}: {
  relationship: Relationship
  snapshots: RelationshipSnapshot[]
  events: WorldEvent[]
  chapters: Chapter[]
}): RelationshipTimelinePoint[] {
  const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))
  const eventById = new Map(events.map((e) => [e.id, e]))
  const orderOf = (eventId: string): number => {
    const ev = eventById.get(eventId)
    if (!ev) return -1
    return (chapterNumber.get(ev.chapterId) ?? 0) * 10_000 + ev.sortOrder
  }
  const chapterNumberOfEvent = (eventId: string | null): number | null => {
    if (!eventId) return null
    const ev = eventById.get(eventId)
    return ev ? chapterNumber.get(ev.chapterId) ?? null : null
  }
  const titleOfEvent = (eventId: string | null): string | null => {
    if (!eventId) return null
    return eventById.get(eventId)?.title ?? null
  }

  const own = snapshots
    .filter((s) => s.relationshipId === relationship.id)
    .sort((a, b) => orderOf(a.eventId) - orderOf(b.eventId))

  const points: RelationshipTimelinePoint[] = []

  // Base/initial state — unless the earliest snapshot already sits at the start point.
  const baseEventId = relationship.startEventId
  const firstSnapAtBase = own[0] && own[0].eventId === baseEventId
  if (!firstSnapAtBase) {
    points.push({
      eventId: baseEventId,
      chapterNumber: chapterNumberOfEvent(baseEventId),
      eventTitle: titleOfEvent(baseEventId),
      label: relationship.label,
      sentiment: relationship.sentiment,
      strength: relationship.strength,
      isActive: true,
      isBase: true,
    })
  }

  for (const s of own) {
    points.push({
      eventId: s.eventId,
      chapterNumber: chapterNumberOfEvent(s.eventId),
      eventTitle: titleOfEvent(s.eventId),
      label: s.label,
      sentiment: s.sentiment,
      strength: s.strength,
      isActive: s.isActive,
      isBase: false,
    })
  }

  return points
}
