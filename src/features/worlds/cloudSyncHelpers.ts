/**
 * Thin bridge between the cloud sync layer and the export/import system.
 * Kept separate so CloudSyncPanel doesn't import the full exportImport module
 * at component parse time (it's large and only needed on user action).
 */

/** Serialize a world to a JSON string using the standard .pwk export format. */
export async function exportWorldData(worldId: string): Promise<string> {
  // Re-implement data-gathering inline so we get a string instead of triggering a download
  const { db } = await import('@/db/database')

  const [
    world,
    mapLayers, locationMarkers, characters, items,
    characterSnapshots, characterMovements, itemPlacements,
    locationSnapshots, itemSnapshots,
    relationships, relationshipSnapshots,
    timelines, chapters, events,
    rawBlobs, travelModes,
    timelineRelationships, crossTimelineArtifacts,
    mapRoutes, mapRegions, mapRegionSnapshots, mapAnnotations,
  ] = await Promise.all([
    db.worlds.get(worldId),
    db.mapLayers.where('worldId').equals(worldId).toArray(),
    db.locationMarkers.where('worldId').equals(worldId).toArray(),
    db.characters.where('worldId').equals(worldId).toArray(),
    db.items.where('worldId').equals(worldId).toArray(),
    db.characterSnapshots.where('worldId').equals(worldId).toArray(),
    db.characterMovements.where('worldId').equals(worldId).toArray(),
    db.itemPlacements.where('worldId').equals(worldId).toArray(),
    db.locationSnapshots.where('worldId').equals(worldId).toArray(),
    db.itemSnapshots.where('worldId').equals(worldId).toArray(),
    db.relationships.where('worldId').equals(worldId).toArray(),
    db.relationshipSnapshots.where('worldId').equals(worldId).toArray(),
    db.timelines.where('worldId').equals(worldId).toArray(),
    db.chapters.where('worldId').equals(worldId).toArray(),
    db.events.where('worldId').equals(worldId).toArray(),
    db.blobs.where('worldId').equals(worldId).toArray(),
    db.travelModes.where('worldId').equals(worldId).toArray(),
    db.timelineRelationships.where('worldId').equals(worldId).toArray(),
    db.crossTimelineArtifacts.where('worldId').equals(worldId).toArray(),
    db.mapRoutes.where('worldId').equals(worldId).toArray(),
    db.mapRegions.where('worldId').equals(worldId).toArray(),
    db.mapRegionSnapshots.where('worldId').equals(worldId).toArray(),
    db.mapAnnotations.where('worldId').equals(worldId).toArray(),
  ])

  if (!world) throw new Error('World not found')

  // Convert blobs to base64 inline
  const blobs = await Promise.all(
    rawBlobs.map(async (b) => ({
      id: b.id,
      worldId: b.worldId,
      mimeType: b.mimeType,
      dataBase64: await blobToBase64(b.data),
      createdAt: b.createdAt,
    }))
  )

  let relationshipPositions: Record<string, { x: number; y: number }> | undefined
  try {
    const raw = localStorage.getItem(`wb-rel-pos-${worldId}`)
    if (raw) relationshipPositions = JSON.parse(raw)
  } catch { /* ignore */ }

  let suppressedIssueIds: string[] | undefined
  try {
    const raw = localStorage.getItem('plotweave-ui')
    if (raw) {
      const ui = JSON.parse(raw) as { state?: { suppressedIssueIds?: Record<string, string[]> } }
      suppressedIssueIds = ui.state?.suppressedIssueIds?.[worldId] ?? []
    }
  } catch { /* ignore */ }

  const data = {
    version: 5,
    type: 'full' as const,
    exportedAt: Date.now(),
    world,
    mapLayers, locationMarkers, characters, items,
    characterSnapshots, characterMovements, itemPlacements,
    locationSnapshots, itemSnapshots,
    relationships, relationshipSnapshots,
    timelines, chapters, events,
    blobs, travelModes,
    timelineRelationships, crossTimelineArtifacts,
    mapRoutes, mapRegions, mapRegionSnapshots, mapAnnotations,
    relationshipPositions,
    suppressedIssueIds,
  }

  return JSON.stringify(data)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Deserialize a JSON string and import it into the local DB. */
export async function importWorldData(json: string): Promise<string> {
  const { importWorldFromJson } = await import('@/lib/exportImport')
  return importWorldFromJson(json)
}
