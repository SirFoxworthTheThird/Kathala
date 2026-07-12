import { db } from '@/db/database'
import { collectWorldData } from '@/lib/exportImport'
import { planSequel, type SequelSelection, type SequelOptions } from '@/lib/sequel'

/**
 * Create a sequel world from an existing one: gather the source, plan the fork
 * (see planSequel), then bulk-write the new records and copy the referenced
 * blobs (portraits, map images) with fresh ids. Returns the new world's id.
 */
export async function createSequelWorld(
  sourceWorldId: string,
  selection: SequelSelection,
  options: SequelOptions,
): Promise<string> {
  const src = await collectWorldData(sourceWorldId)
  const plan = planSequel(src, selection, options)
  const blobById = new Map(src.rawBlobs.map((b) => [b.id, b]))

  await db.transaction('rw', [
    db.worlds, db.timelines, db.characters, db.items, db.factions, db.factionMemberships,
    db.factionRelationships, db.relationships, db.mapLayers, db.locationMarkers, db.mapRoutes,
    db.mapRegions, db.mapAnnotations, db.loreCategories, db.lorePages, db.travelModes,
    db.chapters, db.events, db.characterSnapshots, db.blobs,
  ], async () => {
    await db.worlds.put(plan.world)
    await db.timelines.bulkPut(plan.timelines)
    await db.characters.bulkPut(plan.characters)
    await db.items.bulkPut(plan.items)
    await db.factions.bulkPut(plan.factions)
    await db.factionMemberships.bulkPut(plan.factionMemberships)
    await db.factionRelationships.bulkPut(plan.factionRelationships)
    await db.relationships.bulkPut(plan.relationships)
    await db.mapLayers.bulkPut(plan.mapLayers)
    await db.locationMarkers.bulkPut(plan.locationMarkers)
    await db.mapRoutes.bulkPut(plan.mapRoutes)
    await db.mapRegions.bulkPut(plan.mapRegions)
    await db.mapAnnotations.bulkPut(plan.mapAnnotations)
    await db.loreCategories.bulkPut(plan.loreCategories)
    await db.lorePages.bulkPut(plan.lorePages)
    await db.travelModes.bulkPut(plan.travelModes)
    await db.chapters.bulkPut(plan.chapters)
    await db.events.bulkPut(plan.events)
    await db.characterSnapshots.bulkPut(plan.characterSnapshots)

    for (const { from, to } of plan.blobCopies) {
      const b = blobById.get(from)
      if (b) await db.blobs.put({ id: to, worldId: plan.world.id, mimeType: b.mimeType, data: b.data, createdAt: Date.now() })
    }
  })

  return plan.world.id
}
