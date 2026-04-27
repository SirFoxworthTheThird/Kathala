import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { World } from '@/types'
import { generateId } from '@/lib/id'

export function useWorlds() {
  return useLiveQuery(() => db.worlds.orderBy('createdAt').toArray(), [], [])
}

export function useWorld(id: string | null) {
  return useLiveQuery(() => (id ? db.worlds.get(id) : undefined), [id])
}

export async function createWorld(data: Pick<World, 'name' | 'description'>): Promise<World> {
  const now = Date.now()
  const world: World = {
    id: generateId(),
    name: data.name,
    description: data.description,
    coverImageId: null,
    theme: null,
    continuityStaleThreshold: 5,
    createdAt: now,
    updatedAt: now,
  }
  await db.worlds.add(world)
  return world
}

export async function updateWorld(id: string, data: Partial<Omit<World, 'id' | 'createdAt'>>) {
  await db.worlds.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteWorld(id: string) {
  await db.transaction('rw', [
    db.worlds, db.mapLayers, db.locationMarkers, db.characters,
    db.items, db.characterSnapshots, db.characterMovements, db.itemPlacements,
    db.locationSnapshots, db.itemSnapshots,
    db.relationships, db.relationshipSnapshots, db.timelines,
    db.chapters, db.events, db.blobs, db.travelModes,
    db.timelineRelationships, db.crossTimelineArtifacts,
    db.mapRoutes, db.mapRegions, db.mapRegionSnapshots, db.mapAnnotations,
    db.loreCategories, db.lorePages,
    db.factions, db.factionMemberships, db.factionRelationships,
  ], async () => {
    await db.worlds.delete(id)
    await db.mapLayers.where('worldId').equals(id).delete()
    await db.locationMarkers.where('worldId').equals(id).delete()
    await db.characters.where('worldId').equals(id).delete()
    await db.items.where('worldId').equals(id).delete()
    await db.characterSnapshots.where('worldId').equals(id).delete()
    await db.characterMovements.where('worldId').equals(id).delete()
    await db.itemPlacements.where('worldId').equals(id).delete()
    await db.locationSnapshots.where('worldId').equals(id).delete()
    await db.itemSnapshots.where('worldId').equals(id).delete()
    await db.relationships.where('worldId').equals(id).delete()
    await db.relationshipSnapshots.where('worldId').equals(id).delete()
    await db.timelines.where('worldId').equals(id).delete()
    await db.chapters.where('worldId').equals(id).delete()
    await db.events.where('worldId').equals(id).delete()
    await db.blobs.where('worldId').equals(id).delete()
    await db.travelModes.where('worldId').equals(id).delete()
    await db.timelineRelationships.where('worldId').equals(id).delete()
    await db.crossTimelineArtifacts.where('worldId').equals(id).delete()
    await db.mapRoutes.where('worldId').equals(id).delete()
    await db.mapRegions.where('worldId').equals(id).delete()
    await db.mapRegionSnapshots.where('worldId').equals(id).delete()
    await db.mapAnnotations.where('worldId').equals(id).delete()
    await db.loreCategories.where('worldId').equals(id).delete()
    await db.lorePages.where('worldId').equals(id).delete()
    await db.factions.where('worldId').equals(id).delete()
    await db.factionMemberships.where('worldId').equals(id).delete()
    await db.factionRelationships.where('worldId').equals(id).delete()
  })
}
