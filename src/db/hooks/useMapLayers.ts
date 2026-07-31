import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import type { MapLayer } from '@/types'
import { generateId } from '@/lib/id'
import { descendantLayerIds } from '@/lib/mapTree'
import { groupRepresentativeId } from '@/lib/mapLevels'

const MAP_DELETE_TABLES = [
  db.mapLayers, db.locationMarkers, db.locationSnapshots, db.characterSnapshots,
  db.mapRoutes, db.mapRegions, db.mapRegionSnapshots, db.mapAnnotations,
]

/**
 * Delete a set of map layers and everything they own — markers (and their
 * location/character snapshots), routes, regions (and region snapshots), and
 * annotations — then clear any dangling sub-map links pointing at them.
 *
 * Every table is touched with a single indexed/bulk pass (no per-marker or
 * per-region rescans), so cost stays roughly linear in the affected rows even
 * when hundreds of layers are removed at once. Must run inside a rw transaction
 * covering MAP_DELETE_TABLES.
 */
async function cascadeDeleteLayerSet(layerIds: string[]): Promise<void> {
  if (layerIds.length === 0) return
  const layerIdSet = new Set(layerIds)

  // Markers on the deleted layers, plus their own child records.
  const markerIds = (await db.locationMarkers.where('mapLayerId').anyOf(layerIds).toArray()).map((m) => m.id)
  await db.locationMarkers.where('mapLayerId').anyOf(layerIds).delete()
  if (markerIds.length) {
    const markerIdSet = new Set(markerIds)
    await db.locationSnapshots.where('locationMarkerId').anyOf(markerIds).delete()
    // One pass over characterSnapshots instead of one scan per marker.
    await db.characterSnapshots
      .filter((s) => s.currentLocationMarkerId !== null && markerIdSet.has(s.currentLocationMarkerId))
      .modify({ currentLocationMarkerId: null })
  }

  // Map-layer-owned objects.
  const regionIds = (await db.mapRegions.where('mapLayerId').anyOf(layerIds).toArray()).map((r) => r.id)
  await db.mapRoutes.where('mapLayerId').anyOf(layerIds).delete()
  await db.mapRegions.where('mapLayerId').anyOf(layerIds).delete()
  if (regionIds.length) {
    await db.mapRegionSnapshots.where('regionId').anyOf(regionIds).delete()
  }
  await db.mapAnnotations.where('mapLayerId').anyOf(layerIds).delete()

  // Drop dangling links from surviving markers/regions that pointed at any of
  // the deleted layers, so they no longer offer a broken sub-map link.
  await db.locationMarkers
    .filter((m) => m.linkedMapLayerId !== null && layerIdSet.has(m.linkedMapLayerId))
    .modify({ linkedMapLayerId: null })
  await db.mapRegions
    .filter((r) => r.linkedMapLayerId !== null && layerIdSet.has(r.linkedMapLayerId))
    .modify({ linkedMapLayerId: null })

  await db.mapLayers.bulkDelete(layerIds)
}

/** Delete the given layers (and everything they own) in one transaction. */
export async function deleteMapLayersCascade(layerIds: string[]): Promise<void> {
  if (layerIds.length === 0) return
  await db.transaction('rw', MAP_DELETE_TABLES, () => cascadeDeleteLayerSet(layerIds))
}

/**
 * Whether a map is one the reader has been to.
 *
 * Location markers are gated, but the maps holding them were not — so a world
 * with a map per setting listed every place in the book by name before the
 * reader arrived, which is the gating defeated by its own sidebar. The rule
 * here makes the map list agree with the locations list:
 *
 * 1. A sub-map is reached through the marker that links to it, so it waits for
 *    that marker. A map called "Diagon Alley" is exactly as much of a spoiler
 *    as the marker of the same name, and must keep step with it.
 * 2. Otherwise a map is shown once any marker on it is revealed.
 * 3. A map with neither — nothing on it and nothing pointing at it — has no
 *    reveal point to wait for, and stays. That is the same choice made for an
 *    entity that never appears anywhere.
 */
function useLayerRevealed(worldId: string | null): (layerId: string) => boolean {
  const gate = useGate()
  const markers = useLiveQuery(
    () => (worldId ? db.locationMarkers.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
  return useMemo(() => {
    if (!gate.active) return () => true
    const linked = new Set<string>()
    const linkedRevealed = new Set<string>()
    const populated = new Set<string>()
    const populatedRevealed = new Set<string>()
    for (const m of markers) {
      const shown = gate.isRevealed(m.id)
      populated.add(m.mapLayerId)
      if (shown) populatedRevealed.add(m.mapLayerId)
      if (m.linkedMapLayerId) {
        linked.add(m.linkedMapLayerId)
        if (shown) linkedRevealed.add(m.linkedMapLayerId)
      }
    }
    return (id: string) => {
      if (linked.has(id)) return linkedRevealed.has(id)
      return !populated.has(id) || populatedRevealed.has(id)
    }
  }, [gate, markers])
}

export function useMapLayers(worldId: string | null) {
  const isRevealed = useLayerRevealed(worldId)
  const all = useLiveQuery(
    () => (worldId ? db.mapLayers.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
  return useMemo(() => all.filter((l) => isRevealed(l.id)), [all, isRevealed])
}

export function useMapLayer(id: string | null) {
  return useLiveQuery(() => (id ? db.mapLayers.get(id) : undefined), [id])
}

export function useRootMapLayers(worldId: string | null) {
  const isRevealed = useLayerRevealed(worldId)
  const all = useLiveQuery(
    () =>
      worldId
        ? db.mapLayers
            .where('worldId')
            .equals(worldId)
            .filter((m) => m.parentMapId === null)
            .toArray()
        : [],
    [worldId],
    []
  )
  return useMemo(() => all.filter((l) => isRevealed(l.id)), [all, isRevealed])
}

export function useChildMapLayers(parentMapId: string | null) {
  return useLiveQuery(
    () =>
      parentMapId
        ? db.mapLayers.where('parentMapId').equals(parentMapId).toArray()
        : [],
    [parentMapId],
    []
  )
}

export async function createMapLayer(
  data: Pick<MapLayer, 'worldId' | 'parentMapId' | 'name' | 'description' | 'imageId' | 'imageWidth' | 'imageHeight' | 'scalePixelsPerUnit' | 'scaleUnit'>
    & Partial<Pick<MapLayer, 'levelGroupId' | 'levelIndex' | 'levelLabel'>>
): Promise<MapLayer> {
  const now = Date.now()
  const layer: MapLayer = {
    id: generateId(),
    levelGroupId: null,
    levelIndex: 0,
    levelLabel: '',
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await db.mapLayers.add(layer)
  return layer
}

export async function updateMapLayer(id: string, data: Partial<Omit<MapLayer, 'id' | 'createdAt'>>) {
  await db.mapLayers.update(id, { ...data, updatedAt: Date.now() })
}

/**
 * Add a new floor/level to a map. The base layer becomes the ground floor of a
 * level group (created on first use), and the new floor is stacked above it as a
 * sibling — same parent map and name — with its own image and locations. Returns
 * the new floor's id, or null if the base layer is missing.
 */
export async function addMapLevel(
  baseLayerId: string,
  image: { imageId: string; imageWidth: number; imageHeight: number },
  levelLabel: string,
): Promise<string | null> {
  return db.transaction('rw', db.mapLayers, async () => {
    const base = await db.mapLayers.get(baseLayerId)
    if (!base) return null

    // Ensure the base layer anchors a group as its ground floor.
    let groupId = base.levelGroupId
    if (!groupId) {
      groupId = generateId()
      await db.mapLayers.update(base.id, {
        levelGroupId: groupId,
        levelIndex: 0,
        levelLabel: base.levelLabel || 'Ground floor',
        updatedAt: Date.now(),
      })
    }

    const members = await db.mapLayers.where('levelGroupId').equals(groupId).toArray()
    const nextIndex = members.length ? Math.max(...members.map((l) => l.levelIndex)) + 1 : 1

    const now = Date.now()
    const floor: MapLayer = {
      id: generateId(),
      worldId: base.worldId,
      parentMapId: base.parentMapId,
      name: base.name,
      description: '',
      imageId: image.imageId,
      imageWidth: image.imageWidth,
      imageHeight: image.imageHeight,
      scalePixelsPerUnit: null,
      scaleUnit: null,
      levelGroupId: groupId,
      levelIndex: nextIndex,
      levelLabel: levelLabel.trim() || `Level ${nextIndex}`,
      createdAt: now,
      updatedAt: now,
    }
    await db.mapLayers.add(floor)
    return floor.id
  })
}

/**
 * Delete one floor of a level group. If it was the group's representative (the
 * floor that markers/regions drill into) and other floors remain, those links
 * are re-pointed to the new representative so the place stays reachable from the
 * map. A standalone layer just deletes normally.
 */
export async function deleteMapLevel(floorId: string): Promise<void> {
  const floor = await db.mapLayers.get(floorId)
  if (!floor || !floor.levelGroupId) {
    await deleteMapLayer(floorId)
    return
  }
  const groupId = floor.levelGroupId
  const members = await db.mapLayers.where('levelGroupId').equals(groupId).toArray()
  const wasRepresentative = groupRepresentativeId(members, groupId) === floorId
  const remaining = members.filter((l) => l.id !== floorId)

  // Capture what drills into this floor before the cascade clears those links.
  let linkingMarkerIds: string[] = []
  let linkingRegionIds: string[] = []
  if (wasRepresentative && remaining.length > 0) {
    linkingMarkerIds = (await db.locationMarkers.filter((m) => m.linkedMapLayerId === floorId).toArray()).map((m) => m.id)
    linkingRegionIds = (await db.mapRegions.filter((r) => r.linkedMapLayerId === floorId).toArray()).map((r) => r.id)
  }

  await deleteMapLayer(floorId)

  if (wasRepresentative && remaining.length > 0) {
    const newRep = groupRepresentativeId(remaining, groupId)
    if (newRep) {
      const now = Date.now()
      for (const id of linkingMarkerIds) await db.locationMarkers.update(id, { linkedMapLayerId: newRep, updatedAt: now })
      for (const id of linkingRegionIds) await db.mapRegions.update(id, { linkedMapLayerId: newRep, updatedAt: now })
    }
  }
}

/**
 * Swap the image on an existing map layer, keeping all its content. When
 * `rescale` is true (and the new image is a different size), every marker,
 * annotation, region vertex and raw route waypoint on the layer is scaled
 * proportionally so it stays in the same relative spot, and the map's scale
 * calibration is adjusted to match. When false, pixel coordinates are left as
 * they are (right for a same-size redraw or a higher-res copy).
 */
export async function replaceMapLayerImage(
  layerId: string,
  image: { imageId: string; imageWidth: number; imageHeight: number },
  opts: { rescale: boolean } = { rescale: true },
): Promise<void> {
  await db.transaction('rw', [
    db.mapLayers, db.locationMarkers, db.mapRegions, db.mapRoutes, db.mapAnnotations,
  ], async () => {
    const layer = await db.mapLayers.get(layerId)
    if (!layer) return

    const oldW = layer.imageWidth
    const oldH = layer.imageHeight
    const doRescale =
      opts.rescale && oldW > 0 && oldH > 0 &&
      (image.imageWidth !== oldW || image.imageHeight !== oldH)
    const sx = doRescale ? image.imageWidth / oldW : 1
    const sy = doRescale ? image.imageHeight / oldH : 1

    const patch: Partial<MapLayer> = {
      imageId: image.imageId,
      imageWidth: image.imageWidth,
      imageHeight: image.imageHeight,
      updatedAt: Date.now(),
    }
    // A scale of "pixels per unit" must track the horizontal rescale so measured
    // distances stay the same on screen.
    if (doRescale && layer.scalePixelsPerUnit != null) {
      patch.scalePixelsPerUnit = layer.scalePixelsPerUnit * sx
    }
    await db.mapLayers.update(layerId, patch)

    if (!doRescale) return

    await db.locationMarkers.where('mapLayerId').equals(layerId).modify((m) => {
      m.x *= sx; m.y *= sy
    })
    await db.mapAnnotations.where('mapLayerId').equals(layerId).modify((a) => {
      a.x *= sx; a.y *= sy
    })
    await db.mapRegions.where('mapLayerId').equals(layerId).modify((r) => {
      r.vertices = r.vertices.map((v) => ({ x: v.x * sx, y: v.y * sy }))
    })
    await db.mapRoutes.where('mapLayerId').equals(layerId).modify((rt) => {
      rt.waypoints = rt.waypoints.map((w) =>
        typeof w === 'string' ? w : { x: w.x * sx, y: w.y * sy },
      )
    })
  })
}

export async function deleteMapLayer(id: string) {
  await db.transaction('rw', MAP_DELETE_TABLES, async () => {
    const layer = await db.mapLayers.get(id)
    if (!layer) return
    // The layer plus every sub-map nested under it, at any depth, so deleting a
    // map also removes the maps it contains (matching the "and its N sub-map(s)"
    // confirmation) instead of orphaning them.
    const worldLayers = await db.mapLayers.where('worldId').equals(layer.worldId).toArray()
    await cascadeDeleteLayerSet([id, ...descendantLayerIds(worldLayers, id)])
  })
}
