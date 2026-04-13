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
  createdAt: number
  updatedAt: number
}
