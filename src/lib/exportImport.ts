import { db } from '@/db/database'
import type {
  World, MapLayer, LocationMarker, Character, Item,
  CharacterSnapshot, CharacterMovement, ItemPlacement, LocationSnapshot, ItemSnapshot,
  Relationship, RelationshipSnapshot, Timeline, Chapter, WorldEvent, TravelMode,
} from '@/types'

const EXPORT_VERSION = 3

interface BlobExport {
  id: string
  worldId: string
  mimeType: string
  dataBase64: string
  createdAt: number
}

export interface WorldExportFile {
  version: number
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
  version: number
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
  if (d.version < 1 || d.version > EXPORT_VERSION) throw new Error(`Unsupported export version: ${d.version}`)
  // v3 added sortKey to snapshots; v1/v2 files are backfilled in normalizeImport
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
  type Rec = Record<string, unknown>

  // ── Common backfills (apply to all versions) ────────────────────────────────

  // Backfill color on characters exported before it was added
  for (const char of data.characters) {
    const c = char as unknown as Rec
    if (c.color === undefined) c.color = null
  }
  // Backfill scale fields on map layers exported before they were added
  for (const layer of data.mapLayers) {
    const l = layer as unknown as Rec
    if (l.scalePixelsPerUnit === undefined) l.scalePixelsPerUnit = null
    if (l.scaleUnit === undefined) l.scaleUnit = null
  }
  // Backfill synopsis and notes on chapters exported before they were added
  for (const ch of data.chapters) {
    const c = ch as unknown as Rec
    if (c.synopsis === undefined) c.synopsis = ''
    if (c.notes === undefined) c.notes = ''
  }
  // Backfill travelDays on events (may be absent on older v2 exports too)
  for (const ev of data.events) {
    const e = ev as unknown as Rec
    if (e.travelDays === undefined) e.travelDays = null
  }
  // Backfill travelModeId on character snapshots exported before it was added
  for (const snap of data.characterSnapshots) {
    const s = snap as unknown as Rec
    if (s.travelModeId === undefined) s.travelModeId = null
  }

  // ── v1 → v2 migration ───────────────────────────────────────────────────────
  // v1 had snapshots/movements keyed by chapterId; v2 uses eventId.
  // v1 had Relationship.startChapterId; v2 uses startEventId.
  if (data.version === 1) {
    // Backfill pre-Option-A v1 compat: startChapterId may be absent entirely
    for (const rel of data.relationships) {
      const r = rel as unknown as Rec
      if (r.startChapterId === undefined) r.startChapterId = null
    }
    // Backfill travelDays on chapters (was on Chapter in v1, moved to WorldEvent in v2)
    for (const ch of data.chapters) {
      const c = ch as unknown as Rec
      if (c.travelDays === undefined) c.travelDays = null
    }

    // Build chapterId → first-event-id map
    const eventsByChapter = new Map<string, WorldEvent[]>()
    for (const ev of data.events) {
      const arr = eventsByChapter.get(ev.chapterId) ?? []
      arr.push(ev)
      eventsByChapter.set(ev.chapterId, arr)
    }
    const chapterToEventId = new Map<string, string>()
    for (const [chapterId, evs] of eventsByChapter) {
      evs.sort((a, b) => a.sortOrder - b.sortOrder)
      chapterToEventId.set(chapterId, evs[0].id)
    }

    // For chapters that have no events, create a synthetic event
    const now = Date.now()
    for (const ch of data.chapters) {
      if (!chapterToEventId.has(ch.id)) {
        const c = ch as unknown as Rec
        const newId = crypto.randomUUID()
        data.events.push({
          id: newId,
          worldId: data.world.id,
          chapterId: ch.id,
          timelineId: ch.timelineId,
          title: '',
          description: '',
          locationMarkerId: null,
          involvedCharacterIds: [],
          involvedItemIds: [],
          tags: [],
          sortOrder: 0,
          travelDays: (c.travelDays as number | null) ?? null,
          createdAt: now,
          updatedAt: now,
        })
        chapterToEventId.set(ch.id, newId)
      }
    }

    // Rename chapterId → eventId on each snapshot/movement array
    function remapToEventId(arr: Rec[]): void {
      for (const item of arr) {
        if ('chapterId' in item && !('eventId' in item)) {
          item.eventId = chapterToEventId.get(item.chapterId as string) ?? item.chapterId
          delete item.chapterId
        }
      }
    }
    remapToEventId(data.characterSnapshots as unknown as Rec[])
    remapToEventId(data.characterMovements as unknown as Rec[])
    remapToEventId(data.itemPlacements as unknown as Rec[])
    remapToEventId(data.locationSnapshots as unknown as Rec[])
    remapToEventId(data.itemSnapshots as unknown as Rec[])
    remapToEventId(data.relationshipSnapshots as unknown as Rec[])

    // Rename startChapterId → startEventId on relationships
    for (const rel of data.relationships) {
      const r = rel as unknown as Rec
      if ('startChapterId' in r) {
        const chapId = r.startChapterId as string | null
        r.startEventId = chapId ? (chapterToEventId.get(chapId) ?? null) : null
        delete r.startChapterId
      }
    }
  } else {
    // v2+: backfill startEventId if absent (very early v2 exports)
    for (const rel of data.relationships) {
      const r = rel as unknown as Rec
      if (r.startEventId === undefined) r.startEventId = null
    }
  }

  // ── v3: backfill sortKey on all snapshot arrays (v1/v2 files lack it) ────────
  if (data.version < 3) {
    const eventById = new Map(data.events.map((e) => [e.id, e]))
    const chapterNumberById = new Map(data.chapters.map((c) => [c.id, c.number]))

    const getSortKey = (eventId: string): number => {
      const ev = eventById.get(eventId)
      if (!ev) return 0
      const chapNum = chapterNumberById.get(ev.chapterId) ?? 0
      return chapNum * 10_000 + ev.sortOrder
    }

    const snapshotArrays: Rec[][] = [
      data.characterSnapshots as unknown as Rec[],
      data.locationSnapshots as unknown as Rec[],
      data.itemSnapshots as unknown as Rec[],
      data.relationshipSnapshots as unknown as Rec[],
    ]
    for (const arr of snapshotArrays) {
      for (const snap of arr) {
        if (snap.sortKey === undefined) {
          snap.sortKey = getSortKey(snap.eventId as string)
        }
      }
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
