import { db } from '@/db/database'
import { collectWorldData } from '@/lib/exportImport'
import { planSequel, type SequelSelection, type SequelOptions } from '@/lib/sequel'
import { recordsWithCustody } from '@/lib/custody'
import { storyOf } from '@/lib/stateEngine'
import { wholeRecords } from '@/lib/personState'
import { rederiveCustodyAt } from './useCustody'
import { sparseAt } from './useSnapshots'

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
  const collected = await collectWorldData(sourceWorldId)
  // Each person ends the book holding what custody says they hold, not their last record's copy (Part B1).
  const story = storyOf(collected.events, collected.chapters, collected.timelines, { pinsSetClock: collected.world.pinsSetClock })
  const collective = new Set(collected.items.filter((i) => i.isCollective).map((i) => i.id))
  // And each record whole at its scene (Part B2): the sequel starts from where they ended, every part of it.
  const src = { ...collected, characterSnapshots: recordsWithCustody(wholeRecords(collected.characterSnapshots, story), collected.itemCustody, story, collective) }
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
      if (b) await db.blobs.put({ id: to, worldId: plan.world.id, mimeType: b.mimeType, data: b.data, url: b.url, createdAt: Date.now() })
    }
  })
  // The sequel's opening states hold what they carry over; custody says so from its first scene.
  await rederiveCustodyAt(plan.world.id, plan.events.map((e) => e.id))
  // Each opening state says only what it says (Part B2), now custody has the inventories.
  await sparseAt(plan.world.id, plan.events.map((e) => e.id))

  return plan.world.id
}
