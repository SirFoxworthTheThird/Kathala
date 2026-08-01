import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from '@/db/hooks/ReadingGateContext'

export interface EchoLocation {
  counterpartTimelineName: string
  events: Array<{ id: string; title: string }>
}

/**
 * Returns a map from location marker ID → echo info for every location that
 * has a character presence in the counterpart timeline of a `historical_echo`
 * relationship involving `activeTimelineId`.
 *
 * Returns an empty map when no `historical_echo` relationship exists.
 *
 * Echo rings are always-on for a writer: they do not change with the active
 * event, which is the point — you want to see the parallel whole. For a reader
 * that is exactly backwards, since each ring carries the title of an event in
 * the other timeline, so while reading they are cut at the cursor like
 * everything else.
 */
export function useEchoLocations(
  activeTimelineId: string | null,
  worldId: string | null,
): Map<string, EchoLocation> {
  const raw = useLiveQuery(async () => {
    if (!activeTimelineId || !worldId) return null

    const rel = await db.timelineRelationships
      .where('worldId').equals(worldId)
      .filter(
        (r) =>
          r.type === 'historical_echo' &&
          (r.sourceTimelineId === activeTimelineId || r.targetTimelineId === activeTimelineId),
      )
      .first()
    if (!rel) return null

    const counterpartId =
      rel.sourceTimelineId === activeTimelineId ? rel.targetTimelineId : rel.sourceTimelineId

    const counterpartTimeline = await db.timelines.get(counterpartId)
    if (!counterpartTimeline) return null

    const chapters = await db.chapters.where('timelineId').equals(counterpartId).toArray()
    if (chapters.length === 0) return { name: counterpartTimeline.name, pairs: [] as Array<[string, { id: string; title: string }]> }

    const chapterIds = chapters.map((c) => c.id)
    const events = await db.events.where('chapterId').anyOf(chapterIds).toArray()
    if (events.length === 0) return { name: counterpartTimeline.name, pairs: [] as Array<[string, { id: string; title: string }]> }

    const eventById = new Map(events.map((e) => [e.id, e]))
    const eventIds = events.map((e) => e.id)

    const snaps = await db.characterSnapshots
      .where('eventId').anyOf(eventIds)
      .filter((s) => !!s.currentLocationMarkerId)
      .toArray()

    // Deduplicate: one entry per (markerId, eventId) pair
    const seen = new Set<string>()
    const pairs: Array<[string, { id: string; title: string }]> = []
    for (const snap of snaps) {
      const markerId = snap.currentLocationMarkerId!
      const ev = eventById.get(snap.eventId)
      if (!ev) continue
      const key = `${markerId}|${ev.id}`
      if (!seen.has(key)) {
        seen.add(key)
        pairs.push([markerId, { id: ev.id, title: ev.title }])
      }
    }

    return { name: counterpartTimeline.name, pairs }
  }, [activeTimelineId, worldId])

  const gate = useGate()

  return useMemo(() => {
    if (!raw) return new Map()
    const map = new Map<string, EchoLocation>()
    for (const [markerId, ev] of raw.pairs) {
      if (!gate.hasReached(ev.id) || !gate.isRevealed(markerId)) continue
      const existing = map.get(markerId)
      if (existing) {
        existing.events.push(ev)
      } else {
        map.set(markerId, { counterpartTimelineName: raw.name, events: [ev] })
      }
    }
    return map
  }, [raw, gate])
}
