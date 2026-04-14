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
  /** Event on the inner (target) timeline */
  innerEventId: string
  /** Event on the outer (source) timeline the cursor should jump to */
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
  label: string
  description: string
  createdAt: number
  updatedAt: number
}

export interface CrossTimelineArtifact {
  id: string
  worldId: string
  /** The item that travels across timelines */
  itemId: string
  /** Timeline where/when the item was created */
  originTimelineId: string
  /** Timeline where/when the item is found or encountered */
  encounterTimelineId: string
  encounterNotes: string
  createdAt: number
  updatedAt: number
}
