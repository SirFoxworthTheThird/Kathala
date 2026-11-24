import type { TimelineAnchor, TimelineRelationship, TimelineRelationshipType, TimelineSyncPoint } from '@/types'

const TYPES: readonly TimelineRelationshipType[] = ['frame_narrative', 'historical_echo', 'embedded_fiction', 'alternate']

/** Names an older file used for a type, and the type each means now. */
const OLD_TYPES: Record<string, TimelineRelationshipType> = {
  flashback: 'frame_narrative',
  frame: 'frame_narrative',
  embedded: 'embedded_fiction',
  echo: 'historical_echo',
  parallel: 'alternate',
}

/** The fields an older shape had in place of the ones it has now. */
const OLD_FIELDS = ['fromTimelineId', 'toTimelineId', 'fromEventId', 'toEventId'] as const

/**
 * A timeline relationship in the shape the app reads, whatever shape it was
 * stored in (ux-expert-fixes-plan.md, Part 4; UX-1-4).
 *
 * *The Odyssey*'s file stores its one relationship as `fromTimelineId` /
 * `toTimelineId`, a type of `flashback`, and `fromEventId` / `toEventId`, with
 * no `anchors` and no `syncPoints`. Opening **Link Timelines** read
 * `rel.anchors.length` and took the whole app down. Mended here: the timelines
 * under their names now, the type one of the four, the two scenes as the frame's
 * one sync point (the outer scene the telling is at, the inner scene it tells),
 * and both lists present.
 *
 * Called on import and on every read, so a record already stored in the old
 * shape is read in the new one too. A record already in shape is returned as it
 * is, the same object.
 */
export function mendTimelineRelationship(raw: TimelineRelationship): TimelineRelationship {
  const r = raw as TimelineRelationship & Partial<Record<(typeof OLD_FIELDS)[number], string>>
  const typeOk = (TYPES as readonly string[]).includes(r.type)
  const whole = typeOk && Array.isArray(r.anchors) && Array.isArray(r.syncPoints)
    && typeof r.sourceTimelineId === 'string' && typeof r.targetTimelineId === 'string'
    && typeof r.label === 'string' && typeof r.description === 'string'
    && OLD_FIELDS.every((f) => !(f in r))
  if (whole) return raw

  const type: TimelineRelationshipType = typeOk ? r.type : OLD_TYPES[String(r.type)] ?? 'alternate'
  const syncPoints: TimelineSyncPoint[] = Array.isArray(r.syncPoints)
    ? r.syncPoints
    : type === 'frame_narrative' && r.fromEventId && r.toEventId
      ? [{ outerEventId: r.fromEventId, innerEventId: r.toEventId }]
      : []
  const anchors: TimelineAnchor[] = Array.isArray(r.anchors) ? r.anchors : []
  const mended: Record<string, unknown> = {
    ...r,
    sourceTimelineId: r.sourceTimelineId ?? r.fromTimelineId ?? '',
    targetTimelineId: r.targetTimelineId ?? r.toTimelineId ?? '',
    type,
    anchors,
    syncPoints,
    label: typeof r.label === 'string' ? r.label : '',
    description: typeof r.description === 'string' ? r.description : '',
  }
  for (const f of OLD_FIELDS) delete mended[f]
  return mended as unknown as TimelineRelationship
}
