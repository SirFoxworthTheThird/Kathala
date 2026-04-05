import { db } from '@/db/database'
import type {
  World, MapLayer, LocationMarker, Character, Item,
  CharacterSnapshot, CharacterMovement, ItemPlacement, LocationSnapshot, ItemSnapshot,
  Relationship, RelationshipSnapshot, Timeline, Chapter, WorldEvent, TravelMode,
} from '@/types'

const EXPORT_VERSION = 1

interface BlobExport {
  id: string
  worldId: string
  mimeType: string
  dataBase64: string
  createdAt: number
}

export interface WorldExportFile {
  version: typeof EXPORT_VERSION
  /** 'full' = single file with blobs, 'data' = split data file (no blobs). Absent in legacy exports — treat as 'full'. */
  type?: 'full' | 'data'
  exportedAt: number
  world: World
  mapLayers: MapLayer[]
  locationMarkers: LocationMarker[]
  characters: Character[]
  items: Item[]
  characterSnapshots: CharacterSnapshot[]
  characterMovements: CharacterMovement[]
  itemPlacements: ItemPlacement[]
  locationSnapshots: LocationSnapshot[]
  itemSnapshots: ItemSnapshot[]
  relationships: Relationship[]
  relationshipSnapshots: RelationshipSnapshot[]
  timelines: Timeline[]
  chapters: Chapter[]
  events: WorldEvent[]
  blobs: BlobExport[]
  travelModes: TravelMode[]
  relationshipPositions?: Record<string, { x: number; y: number }>
}

/** Companion file produced by exportWorldSplit — contains only the binary blobs. */
export interface WorldImagesFile {
  version: typeof EXPORT_VERSION
  type: 'images'
  worldId: string
  worldName: string
  exportedAt: number
  blobs: BlobExport[]
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = atob(base64)
  const array = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    array[i] = bytes.charCodeAt(i)
  }
  return new Blob([array], { type: mimeType })
}

export async function exportWorld(worldId: string): Promise<void> {
  const [
    world,
    mapLayers,
    locationMarkers,
    characters,
    items,
    characterSnapshots,
    characterMovements,
    itemPlacements,
    locationSnapshots,
    itemSnapshots,
    relationships,
    relationshipSnapshots,
    timelines,
    chapters,
    events,
    rawBlobs,
    travelModes,
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
  ])

  if (!world) throw new Error('World not found')

  const blobs: BlobExport[] = await Promise.all(
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

  const exportData: WorldExportFile = {
    version: EXPORT_VERSION,
    type: 'full',
    exportedAt: Date.now(),
    world,
    mapLayers,
    locationMarkers,
    characters,
    items,
    characterSnapshots,
    characterMovements,
    itemPlacements,
    locationSnapshots,
    itemSnapshots,
    relationships,
    relationshipSnapshots,
    timelines,
    chapters,
    events,
    blobs,
    travelModes,
    relationshipPositions,
  }

  triggerDownload(JSON.stringify(exportData), `${world.name.replace(/[^a-z0-9]/gi, '_')}.pwk`)
}

function triggerDownload(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Export a world as two separate files:
 *  - `WorldName.pwk`        — all story data, no images (fast to open/share)
 *  - `WorldName.images.pwk` — binary blobs only (maps, portraits, etc.)
 *
 * Both files are needed for a complete round-trip import.
 * The images file can also be imported independently to restore images
 * for an already-imported world.
 */
export async function exportWorldSplit(worldId: string): Promise<void> {
  const [
    world,
    mapLayers,
    locationMarkers,
    characters,
    items,
    characterSnapshots,
    characterMovements,
    itemPlacements,
    locationSnapshots,
    itemSnapshots,
    relationships,
    relationshipSnapshots,
    timelines,
    chapters,
    events,
    rawBlobs,
    travelModes,
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
  ])

  if (!world) throw new Error('World not found')

  const blobs: BlobExport[] = await Promise.all(
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

  const safeName = world.name.replace(/[^a-z0-9]/gi, '_')
  const exportedAt = Date.now()

  // ── File 1: data (no blobs) ──────────────────────────────────────────────
  const dataFile: WorldExportFile = {
    version: EXPORT_VERSION,
    type: 'data',
    exportedAt,
    world,
    mapLayers,
    locationMarkers,
    characters,
    items,
    characterSnapshots,
    characterMovements,
    itemPlacements,
    locationSnapshots,
    itemSnapshots,
    relationships,
    relationshipSnapshots,
    timelines,
    chapters,
    events,
    blobs: [],
    travelModes,
    relationshipPositions,
  }
  triggerDownload(JSON.stringify(dataFile), `${safeName}.pwk`)

  // ── File 2: images ───────────────────────────────────────────────────────
  const imagesFile: WorldImagesFile = {
    version: EXPORT_VERSION,
    type: 'images',
    worldId,
    worldName: world.name,
    exportedAt,
    blobs,
  }
  // Small delay so browsers don't block the second download as a popup
  await new Promise((r) => setTimeout(r, 200))
  triggerDownload(JSON.stringify(imagesFile), `${safeName}.pwb`)
}

/**
 * Import only the images companion file (`.images.pwk`) for an already-imported world.
 * Safe to run multiple times — uses bulkPut so existing blobs are overwritten.
 */
export async function importWorldImages(file: File): Promise<string> {
  const text = await file.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error('Invalid file: could not parse JSON') }

  if (typeof data !== 'object' || data === null) throw new Error('Invalid images file')
  const d = data as Record<string, unknown>
  if (d.type !== 'images') throw new Error('Not an images export file (.images.pwk)')
  if (typeof d.worldId !== 'string') throw new Error('Invalid images file: missing worldId')
  if (!Array.isArray(d.blobs)) throw new Error('Invalid images file: missing blobs array')

  const worldId = d.worldId as string
  const world = await db.worlds.get(worldId)
  if (!world) throw new Error('World not found — import the data file (.pwk) first.')

  const blobs = d.blobs as BlobExport[]
  await db.transaction('rw', [db.blobs], async () => {
    for (const b of blobs) {
      await db.blobs.put({
        id: b.id,
        worldId: b.worldId,
        mimeType: b.mimeType,
        data: base64ToBlob(b.dataBase64, b.mimeType),
        createdAt: b.createdAt,
      })
    }
  })

  return worldId
}

function validateImport(data: unknown): asserts data is WorldExportFile {
  if (typeof data !== 'object' || data === null) throw new Error('Invalid file: not an object')
  const d = data as Record<string, unknown>
  if (typeof d.version !== 'number') throw new Error('Invalid file: missing version')
  if (d.version !== EXPORT_VERSION) throw new Error(`Unsupported export version: ${d.version}`)
  if (typeof d.world !== 'object' || d.world === null) throw new Error('Invalid file: missing world')
  const world = d.world as Record<string, unknown>
  if (typeof world.id !== 'string' || typeof world.name !== 'string') throw new Error('Invalid file: world missing id or name')
  const arrayFields = ['mapLayers', 'locationMarkers', 'characters', 'items', 'characterSnapshots', 'relationships', 'timelines', 'chapters', 'events', 'blobs'] as const
  for (const field of arrayFields) {
    if (!Array.isArray(d[field])) throw new Error(`Invalid file: ${field} is not an array`)
  }
  // characterMovements added in a later version; default to empty array if absent
  if (d.characterMovements !== undefined && !Array.isArray(d.characterMovements)) {
    throw new Error('Invalid file: characterMovements is not an array')
  }
  if (!d.characterMovements) (d as Record<string, unknown>).characterMovements = []
  if (d.itemPlacements !== undefined && !Array.isArray(d.itemPlacements)) {
    throw new Error('Invalid file: itemPlacements is not an array')
  }
  if (!d.itemPlacements) (d as Record<string, unknown>).itemPlacements = []
  if (d.relationshipSnapshots !== undefined && !Array.isArray(d.relationshipSnapshots)) {
    throw new Error('Invalid file: relationshipSnapshots is not an array')
  }
  if (!d.relationshipSnapshots) (d as Record<string, unknown>).relationshipSnapshots = []
  if (d.locationSnapshots !== undefined && !Array.isArray(d.locationSnapshots)) {
    throw new Error('Invalid file: locationSnapshots is not an array')
  }
  if (!d.locationSnapshots) (d as Record<string, unknown>).locationSnapshots = []
  if (d.itemSnapshots !== undefined && !Array.isArray(d.itemSnapshots)) {
    throw new Error('Invalid file: itemSnapshots is not an array')
  }
  if (!d.itemSnapshots) (d as Record<string, unknown>).itemSnapshots = []
  if (d.travelModes !== undefined && !Array.isArray(d.travelModes)) {
    throw new Error('Invalid file: travelModes is not an array')
  }
  if (!d.travelModes) (d as Record<string, unknown>).travelModes = []
}

function normalizeImport(data: WorldExportFile): void {
  // Backfill startChapterId on relationships exported before it was added
  for (const rel of data.relationships) {
    if ((rel as unknown as Record<string, unknown>).startChapterId === undefined) {
      (rel as unknown as Record<string, unknown>).startChapterId = null
    }
  }
  // Backfill scale fields on map layers exported before they were added
  for (const layer of data.mapLayers) {
    if ((layer as unknown as Record<string, unknown>).scalePixelsPerUnit === undefined) {
      (layer as unknown as Record<string, unknown>).scalePixelsPerUnit = null
    }
    if ((layer as unknown as Record<string, unknown>).scaleUnit === undefined) {
      (layer as unknown as Record<string, unknown>).scaleUnit = null
    }
  }
  // Backfill synopsis, notes, and travelDays on chapters exported before they were added
  for (const ch of data.chapters) {
    if ((ch as unknown as Record<string, unknown>).synopsis === undefined) {
      (ch as unknown as Record<string, unknown>).synopsis = ''
    }
    if ((ch as unknown as Record<string, unknown>).notes === undefined) {
      (ch as unknown as Record<string, unknown>).notes = ''
    }
    if ((ch as unknown as Record<string, unknown>).travelDays === undefined) {
      (ch as unknown as Record<string, unknown>).travelDays = null
    }
  }
  // Backfill travelModeId on snapshots exported before it was added
  for (const snap of data.characterSnapshots) {
    if ((snap as unknown as Record<string, unknown>).travelModeId === undefined) {
      (snap as unknown as Record<string, unknown>).travelModeId = null
    }
  }
}

export async function importWorld(file: File): Promise<string> {
  const text = await file.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid file: could not parse JSON')
  }
  validateImport(data)
  normalizeImport(data)

  await db.transaction('rw', [
    db.worlds, db.mapLayers, db.locationMarkers, db.characters,
    db.items, db.characterSnapshots, db.characterMovements, db.itemPlacements,
    db.locationSnapshots, db.itemSnapshots,
    db.relationships, db.relationshipSnapshots, db.timelines,
    db.chapters, db.events, db.blobs, db.travelModes,
  ], async () => {
    await db.worlds.put(data.world)
    await db.mapLayers.bulkPut(data.mapLayers)
    await db.locationMarkers.bulkPut(data.locationMarkers)
    await db.characters.bulkPut(data.characters)
    await db.items.bulkPut(data.items)
    await db.characterSnapshots.bulkPut(data.characterSnapshots)
    await db.characterMovements.bulkPut(data.characterMovements)
    await db.itemPlacements.bulkPut(data.itemPlacements)
    await db.locationSnapshots.bulkPut(data.locationSnapshots)
    await db.itemSnapshots.bulkPut(data.itemSnapshots)
    await db.relationships.bulkPut(data.relationships)
    await db.relationshipSnapshots.bulkPut(data.relationshipSnapshots)
    await db.timelines.bulkPut(data.timelines)
    await db.chapters.bulkPut(data.chapters)
    await db.events.bulkPut(data.events)
    await db.travelModes.bulkPut(data.travelModes)

    for (const b of data.blobs) {
      await db.blobs.put({
        id: b.id,
        worldId: b.worldId,
        mimeType: b.mimeType,
        data: base64ToBlob(b.dataBase64, b.mimeType),
        createdAt: b.createdAt,
      })
    }
  })

  if (data.relationshipPositions && typeof data.relationshipPositions === 'object') {
    localStorage.setItem(`wb-rel-pos-${data.world.id}`, JSON.stringify(data.relationshipPositions))
  }

  return data.world.id
}
