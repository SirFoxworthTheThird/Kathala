export type TimelineRelationshipType =
  | 'frame_narrative'
  | 'historical_echo'
  | 'embedded_fiction'
  | 'alternate'

export type TimelineAnchorKind = 'character' | 'location' | 'document'

export interface TimelineAnchor {
  kind: TimelineAnchorKind
  /** characterId, locationMarkerId, or itemId depending on kind */
  entityId: string
}

export interface TimelineSyncPoint {
  /** Event in the inner (target) timeline */
  innerEventId: string
  /** Event in the outer (source) timeline that the narrator is at when telling this */
  outerEventId: string
}

export interface TimelineRelationship {
  id: string
  worldId: string
  /** The "outer" or "present" timeline (narrator, present era, or story container) */
  sourceTimelineId: string
  /** The "inner" or "past" timeline (the story being told, or the earlier era) */
  targetTimelineId: string
  type: TimelineRelationshipType
  /** What connects these timelines (narrator character, shared location, document item, etc.) */
  anchors: TimelineAnchor[]
  /**
   * Frame narrative only. Optional mapping from inner-timeline events to the
   * outer-timeline event being narrated at that point. When inner playback
   * reaches a sync point, the outer cursor jumps to the linked outer event.
   */
  syncPoints: TimelineSyncPoint[]
  /** Human-readable label, e.g. "Kvothe narrates his life" */
  label: string
  description: string
  createdAt: number
  updatedAt: number
}

/**
 * An item that physically exists in one timeline but is encountered
 * (found, read, inherited) in another — e.g. Ash's letters found by Roland.
 */
export interface CrossTimelineArtifact {
  id: string
  worldId: string
  itemId: string
  /** Timeline where this item was created / originally exists */
  originTimelineId: string
  /** Timeline where this item is encountered, found, or read */
  encounterTimelineId: string
  /** e.g. "found in archive box 14", "read as manuscript" */
  encounterNotes: string
  createdAt: number
  updatedAt: number
}
