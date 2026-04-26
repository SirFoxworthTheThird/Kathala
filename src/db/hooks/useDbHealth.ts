import { db } from '@/db/database'

export interface OrphanReport {
  characterSnapshots: number
  locationSnapshots: number
  itemSnapshots: number
  relationshipSnapshots: number
  itemPlacements: number
  characterMovements: number
  mapRegionSnapshots: number
  factionMemberships: number
}

/** Scan every snapshot/membership/placement table for records pointing to deleted parent entities. */
export async function scanOrphans(worldId: string): Promise<OrphanReport> {
  const [
    events,
    characters,
    items,
    locationMarkers,
    relationships,
    regions,
    factions,
    charSnaps,
    locSnaps,
    itemSnaps,
    relSnaps,
    itemPlacements,
    charMovements,
    regionSnaps,
    factionMemberships,
  ] = await Promise.all([
    db.events.where('worldId').equals(worldId).toArray(),
    db.characters.where('worldId').equals(worldId).toArray(),
    db.items.where('worldId').equals(worldId).toArray(),
    db.locationMarkers.where('worldId').equals(worldId).toArray(),
    db.relationships.where('worldId').equals(worldId).toArray(),
    db.mapRegions.where('worldId').equals(worldId).toArray(),
    db.factions.where('worldId').equals(worldId).toArray(),
    db.characterSnapshots.where('worldId').equals(worldId).toArray(),
    db.locationSnapshots.where('worldId').equals(worldId).toArray(),
    db.itemSnapshots.where('worldId').equals(worldId).toArray(),
    db.relationshipSnapshots.where('worldId').equals(worldId).toArray(),
    db.itemPlacements.where('worldId').equals(worldId).toArray(),
    db.characterMovements.where('worldId').equals(worldId).toArray(),
    db.mapRegionSnapshots.where('worldId').equals(worldId).toArray(),
    db.factionMemberships.where('worldId').equals(worldId).toArray(),
  ])

  const eventIds = new Set(events.map((e) => e.id))
  const characterIds = new Set(characters.map((c) => c.id))
  const itemIds = new Set(items.map((i) => i.id))
  const markerIds = new Set(locationMarkers.map((m) => m.id))
  const relationshipIds = new Set(relationships.map((r) => r.id))
  const regionIds = new Set(regions.map((r) => r.id))
  const factionIds = new Set(factions.map((f) => f.id))

  return {
    characterSnapshots: charSnaps.filter(
      (s) => !eventIds.has(s.eventId) || !characterIds.has(s.characterId)
    ).length,
    locationSnapshots: locSnaps.filter(
      (s) => !eventIds.has(s.eventId) || !markerIds.has(s.locationMarkerId)
    ).length,
    itemSnapshots: itemSnaps.filter(
      (s) => !eventIds.has(s.eventId) || !itemIds.has(s.itemId)
    ).length,
    relationshipSnapshots: relSnaps.filter(
      (s) => !eventIds.has(s.eventId) || !relationshipIds.has(s.relationshipId)
    ).length,
    itemPlacements: itemPlacements.filter(
      (p) => !eventIds.has(p.eventId) || !itemIds.has(p.itemId)
    ).length,
    characterMovements: charMovements.filter(
      (m) => !eventIds.has(m.eventId) || !characterIds.has(m.characterId)
    ).length,
    mapRegionSnapshots: regionSnaps.filter(
      (s) => !eventIds.has(s.eventId) || !regionIds.has(s.regionId)
    ).length,
    factionMemberships: factionMemberships.filter(
      (m) => !factionIds.has(m.factionId) || !characterIds.has(m.characterId)
    ).length,
  }
}

export function totalOrphans(report: OrphanReport): number {
  return Object.values(report).reduce((sum, n) => sum + n, 0)
}

/** Delete all orphaned records in a single transaction. */
export async function purgeOrphans(worldId: string): Promise<void> {
  const [
    events,
    characters,
    items,
    locationMarkers,
    relationships,
    regions,
    factions,
  ] = await Promise.all([
    db.events.where('worldId').equals(worldId).toArray(),
    db.characters.where('worldId').equals(worldId).toArray(),
    db.items.where('worldId').equals(worldId).toArray(),
    db.locationMarkers.where('worldId').equals(worldId).toArray(),
    db.relationships.where('worldId').equals(worldId).toArray(),
    db.mapRegions.where('worldId').equals(worldId).toArray(),
    db.factions.where('worldId').equals(worldId).toArray(),
  ])

  const eventIds = new Set(events.map((e) => e.id))
  const characterIds = new Set(characters.map((c) => c.id))
  const itemIds = new Set(items.map((i) => i.id))
  const markerIds = new Set(locationMarkers.map((m) => m.id))
  const relationshipIds = new Set(relationships.map((r) => r.id))
  const regionIds = new Set(regions.map((r) => r.id))
  const factionIds = new Set(factions.map((f) => f.id))

  await db.transaction('rw', [
    db.characterSnapshots, db.locationSnapshots, db.itemSnapshots,
    db.relationshipSnapshots, db.itemPlacements, db.characterMovements,
    db.mapRegionSnapshots, db.factionMemberships,
  ], async () => {
    await db.characterSnapshots.where('worldId').equals(worldId)
      .filter((s) => !eventIds.has(s.eventId) || !characterIds.has(s.characterId))
      .delete()
    await db.locationSnapshots.where('worldId').equals(worldId)
      .filter((s) => !eventIds.has(s.eventId) || !markerIds.has(s.locationMarkerId))
      .delete()
    await db.itemSnapshots.where('worldId').equals(worldId)
      .filter((s) => !eventIds.has(s.eventId) || !itemIds.has(s.itemId))
      .delete()
    await db.relationshipSnapshots.where('worldId').equals(worldId)
      .filter((s) => !eventIds.has(s.eventId) || !relationshipIds.has(s.relationshipId))
      .delete()
    await db.itemPlacements.where('worldId').equals(worldId)
      .filter((p) => !eventIds.has(p.eventId) || !itemIds.has(p.itemId))
      .delete()
    await db.characterMovements.where('worldId').equals(worldId)
      .filter((m) => !eventIds.has(m.eventId) || !characterIds.has(m.characterId))
      .delete()
    await db.mapRegionSnapshots.where('worldId').equals(worldId)
      .filter((s) => !eventIds.has(s.eventId) || !regionIds.has(s.regionId))
      .delete()
    await db.factionMemberships.where('worldId').equals(worldId)
      .filter((m) => !factionIds.has(m.factionId) || !characterIds.has(m.characterId))
      .delete()
  })
}
