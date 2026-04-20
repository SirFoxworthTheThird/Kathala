export interface LoreCategory {
  id: string
  worldId: string
  name: string
  color: string | null
  sortOrder: number
}

export interface LorePage {
  id: string
  worldId: string
  categoryId: string | null
  title: string
  body: string
  tags: string[]
  coverImageId: string | null
  linkedEntityIds: string[]
  visibleFromEventId: string | null
  createdAt: number
  updatedAt: number
}
