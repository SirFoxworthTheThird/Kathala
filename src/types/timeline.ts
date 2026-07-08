export interface Timeline {
  id: string
  worldId: string
  name: string
  description: string
  color: string
  createdAt: number
}

export interface Chapter {
  id: string
  worldId: string
  timelineId: string
  number: number
  title: string
  synopsis: string
  notes: string
  /** Optional per-chapter word-count target for the manuscript. null = unset. */
  wordGoal: number | null
  createdAt: number
  updatedAt: number
}

export type EventStatus = 'idea' | 'outline' | 'draft' | 'revised' | 'final'

export interface WorldEvent {
  id: string
  worldId: string
  chapterId: string
  timelineId: string
  title: string
  description: string
  locationMarkerId: string | null
  involvedCharacterIds: string[]
  /** Characters referenced in this event but not physically present ("@"-mentions).
   *  Distinct from involvedCharacterIds, which is the on-stage cast. */
  mentionedCharacterIds: string[]
  involvedItemIds: string[]
  tags: string[]
  sortOrder: number
  /** Days of travel before this event. Drives continuity distance checks. */
  travelDays: number | null
  /** Explicit absolute in-world day, overriding the travelDays-derived clock.
   *  Lets flashbacks/flash-forwards sit at their true chronological time,
   *  independent of narrative order. null = use the derived clock. */
  inWorldTime: number | null
  /** Dramatic intensity 1–5 for the pacing curve. null = unrated. */
  tension: number | null
  /** Story-structure beat this event fulfils (beat id, e.g. 'midpoint'). null = none. */
  structureBeat: string | null
  /** Plot threads / subplots this event advances (PlotThread ids). */
  threadIds: string[]
  status: EventStatus
  povCharacterId: string | null
  /** Marks the event as a flashback/retrospective — suppresses present-state continuity checks. */
  isFlashback: boolean
  createdAt: number
  updatedAt: number
}
