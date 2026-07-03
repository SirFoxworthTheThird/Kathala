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
  status: EventStatus
  povCharacterId: string | null
  /** Marks the event as a flashback/retrospective — suppresses present-state continuity checks. */
  isFlashback: boolean
  createdAt: number
  updatedAt: number
}
