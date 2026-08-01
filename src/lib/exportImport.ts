import { db } from '@/db/database'
import type { Table } from 'dexie'
import { markJournalDiscontinuity } from '@/db/hooks/useOperations'
import type { Tombstone } from '@/types/operation'
import { applyTombstones, mergeTombstoneSets, pruneStaleTombstones } from '@/lib/mergeTombstones'
import { mergeRecords, type ConflictPreference, type FieldConflict } from '@/lib/mergeFields'
import type {
  CharacterGoal,
  World, MapLayer, LocationMarker, Character, Item,
  CharacterSnapshot, CharacterMovement, ItemPlacement, LocationSnapshot, ItemSnapshot,
  Relationship, RelationshipSnapshot, Timeline, Chapter, WorldEvent, TravelMode,
  TimelineRelationship, CrossTimelineArtifact, MapRoute, MapRegion, MapRegionSnapshot,
  MapAnnotation, LoreCategory, LorePage, Faction, FactionMembership, FactionRelationship,
  KnowledgeFact, KnowledgeReveal,
  SceneText,
  PlotThread,
  ContinuitySuppression,
  WritingLog,
  Motif,
  SceneRevision,
} from '@/types'
import { generateId } from '@/lib/id'

export const EXPORT_VERSION = 18

interface BlobExport {
  id: string
  worldId: string
  mimeType: string
  /** Present for uploaded images. Absent for linked images (see `url`). */
  dataBase64?: string
  /** Present for linked (external-URL) images. */
  url?: string
  createdAt: number
}

type RawBlob = { id: string; worldId: string; mimeType: string; data?: Blob; url?: string; createdAt: number }

/** Serialize a stored blob to its export form — the external URL for a linked
 *  image, or base64 for uploaded binary data. */
async function blobToExport(b: RawBlob): Promise<BlobExport> {
  if (b.url) return { id: b.id, worldId: b.worldId, mimeType: b.mimeType, url: b.url, createdAt: b.createdAt }
  return { id: b.id, worldId: b.worldId, mimeType: b.mimeType, dataBase64: b.data ? await blobToBase64(b.data) : '', createdAt: b.createdAt }
}

/** Rebuild a stored blob record from its export form. */
function blobRecordFromExport(b: BlobExport): RawBlob {
  if (b.url) return { id: b.id, worldId: b.worldId, mimeType: b.mimeType, url: b.url, createdAt: b.createdAt }
  return { id: b.id, worldId: b.worldId, mimeType: b.mimeType, data: base64ToBlob(b.dataBase64 ?? '', b.mimeType), createdAt: b.createdAt }
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
  timelineRelationships: TimelineRelationship[]
  crossTimelineArtifacts: CrossTimelineArtifact[]
  mapRoutes: MapRoute[]
  mapRegions: MapRegion[]
  mapRegionSnapshots: MapRegionSnapshot[]
  mapAnnotations: MapAnnotation[]
  loreCategories: LoreCategory[]
  lorePages: LorePage[]
  factions: Faction[]
  factionMemberships: FactionMembership[]
  factionRelationships: FactionRelationship[]
  knowledgeFacts?: KnowledgeFact[]
  knowledgeReveals?: KnowledgeReveal[]
  characterGoals?: CharacterGoal[]
  sceneTexts?: SceneText[]
  plotThreads?: PlotThread[]
  motifs?: Motif[]
  continuitySuppressions?: ContinuitySuppression[]
  writingLogs?: WritingLog[]
  sceneRevisions?: SceneRevision[]
  /**
   * Deletions, so a merge on another device removes what this one removed
   * instead of treating the absence as "never existed" and resurrecting it.
   * The operation journal itself stays out of the file — it is device-local
   * history — but a tombstone is world state.
   */
  tombstones?: Tombstone[]
  relationshipPositions?: Record<string, { x: number; y: number }>
  /** @deprecated v6 and earlier stored only IDs via localStorage; superseded by continuitySuppressions */
  suppressedIssueIds?: string[]
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

// ── Shared data-gathering ─────────────────────────────────────────────────────

interface CollectedWorldData {
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
  rawBlobs: RawBlob[]
  travelModes: TravelMode[]
  timelineRelationships: TimelineRelationship[]
  crossTimelineArtifacts: CrossTimelineArtifact[]
  mapRoutes: MapRoute[]
  mapRegions: MapRegion[]
  mapRegionSnapshots: MapRegionSnapshot[]
  mapAnnotations: MapAnnotation[]
  loreCategories: LoreCategory[]
  lorePages: LorePage[]
  factions: Faction[]
  factionMemberships: FactionMembership[]
  factionRelationships: FactionRelationship[]
  knowledgeFacts: KnowledgeFact[]
  knowledgeReveals: KnowledgeReveal[]
  characterGoals: CharacterGoal[]
  sceneTexts: SceneText[]
  plotThreads: PlotThread[]
  motifs: Motif[]
  continuitySuppressions: ContinuitySuppression[]
  writingLogs: WritingLog[]
  sceneRevisions: SceneRevision[]
  tombstones: Tombstone[]
}

export type { CollectedWorldData }

export async function collectWorldData(worldId: string): Promise<CollectedWorldData> {
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
    timelineRelationships,
    crossTimelineArtifacts,
    mapRoutes,
    mapRegions,
    mapRegionSnapshots,
    mapAnnotations,
    loreCategories,
    lorePages,
    factions,
    factionMemberships,
    factionRelationships,
    knowledgeFacts,
    knowledgeReveals,
    characterGoals,
    sceneTexts,
    plotThreads,
    motifs,
    continuitySuppressions,
    writingLogs,
    sceneRevisions,
    tombstones,
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
    db.loreCategories.where('worldId').equals(worldId).toArray(),
    db.lorePages.where('worldId').equals(worldId).toArray(),
    db.factions.where('worldId').equals(worldId).toArray(),
    db.factionMemberships.where('worldId').equals(worldId).toArray(),
    db.factionRelationships.where('worldId').equals(worldId).toArray(),
    db.knowledgeFacts.where('worldId').equals(worldId).toArray(),
    db.knowledgeReveals.where('worldId').equals(worldId).toArray(),
    db.characterGoals.where('worldId').equals(worldId).toArray(),
    db.sceneTexts.where('worldId').equals(worldId).toArray(),
    db.plotThreads.where('worldId').equals(worldId).toArray(),
    db.motifs.where('worldId').equals(worldId).toArray(),
    db.continuitySuppressions.where('worldId').equals(worldId).toArray(),
    db.writingLogs.where('worldId').equals(worldId).toArray(),
    db.sceneRevisions.where('worldId').equals(worldId).toArray(),
    db.tombstones.where('worldId').equals(worldId).toArray(),
  ])

  if (!world) throw new Error('World not found')

  return {
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
    rawBlobs: rawBlobs as RawBlob[],
    travelModes,
    timelineRelationships,
    crossTimelineArtifacts,
    mapRoutes,
    mapRegions,
    mapRegionSnapshots,
    mapAnnotations,
    loreCategories,
    lorePages,
    factions,
    factionMemberships,
    factionRelationships,
    knowledgeFacts,
    knowledgeReveals,
    characterGoals,
    sceneTexts,
    plotThreads,
    motifs,
    continuitySuppressions,
    writingLogs,
    sceneRevisions,
    tombstones,
  }
}

function readLocalStorageExtras(worldId: string): {
  relationshipPositions?: Record<string, { x: number; y: number }>
} {
  let relationshipPositions: Record<string, { x: number; y: number }> | undefined
  try {
    const raw = localStorage.getItem(`wb-rel-pos-${worldId}`)
    if (raw) relationshipPositions = JSON.parse(raw)
  } catch { /* ignore */ }

  return { relationshipPositions }
}

// ── Streaming export ──────────────────────────────────────────────────────────

/**
 * Write a JSON file where all blobs are streamed one-at-a-time rather than
 * loaded into memory simultaneously.
 *
 * Uses the File System Access API (showSaveFilePicker) when available
 * (Chrome/Edge/Electron).  Falls back to sequential in-memory accumulation +
 * triggerDownload on Firefox and other browsers.
 *
 * headerObj must NOT include a `blobs` key — blobs are appended via streaming.
 */
async function writeJsonWithBlobs(
  headerObj: Record<string, unknown>,
  rawBlobs: RawBlob[],
  filename: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  // Build a JSON envelope with a string placeholder for the blobs array, then
  // split the string at the placeholder so we can stream blob entries in between.
  const PLACEHOLDER = '"__BLOBS_PLACEHOLDER__"'
  const envelope = JSON.stringify({ ...headerObj, blobs: '__BLOBS_PLACEHOLDER__' })
  const splitIdx = envelope.indexOf(PLACEHOLDER)
  const prefix = envelope.slice(0, splitIdx) + '['
  const suffix = ']' + envelope.slice(splitIdx + PLACEHOLDER.length)

  const total = rawBlobs.length
  onProgress?.(0, total)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const picker = (window as any).showSaveFilePicker as ((...a: any[]) => Promise<any>) | undefined

  if (picker) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let writable: any
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: 'PlotWeave Export', accept: { 'application/json': ['.pwk', '.pwb'] } }],
      })
      writable = await handle.createWritable()
      await writable.write(prefix)
      for (let i = 0; i < rawBlobs.length; i++) {
        const b = rawBlobs[i]
        const entry = await blobToExport(b)
        await writable.write((i > 0 ? ',' : '') + JSON.stringify(entry))
        onProgress?.(i + 1, total)
      }
      await writable.write(suffix)
      await writable.close()
      return
    } catch (err) {
      if (writable) { try { await writable.close() } catch { /* ignore */ } }
      // User cancelled — silent exit
      if ((err as { name?: string }).name === 'AbortError') return
      // Other picker error — fall through to in-memory fallback
    }
  }

  // Fallback: sequential in-memory accumulation (Firefox, Safari, old browsers)
  const parts: string[] = [prefix]
  for (let i = 0; i < rawBlobs.length; i++) {
    const b = rawBlobs[i]
    const entry = await blobToExport(b)
    parts.push((i > 0 ? ',' : '') + JSON.stringify(entry))
    onProgress?.(i + 1, total)
  }
  parts.push(suffix)
  triggerDownload(parts.join(''), filename)
}

// ── Export functions ──────────────────────────────────────────────────────────

export async function exportWorld(
  worldId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const d = await collectWorldData(worldId)
  const extras = readLocalStorageExtras(worldId)
  const headerObj: Record<string, unknown> = {
    version: EXPORT_VERSION,
    type: 'full',
    exportedAt: Date.now(),
    world: d.world,
    mapLayers: d.mapLayers,
    locationMarkers: d.locationMarkers,
    characters: d.characters,
    items: d.items,
    characterSnapshots: d.characterSnapshots,
    characterMovements: d.characterMovements,
    itemPlacements: d.itemPlacements,
    locationSnapshots: d.locationSnapshots,
    itemSnapshots: d.itemSnapshots,
    relationships: d.relationships,
    relationshipSnapshots: d.relationshipSnapshots,
    timelines: d.timelines,
    chapters: d.chapters,
    events: d.events,
    travelModes: d.travelModes,
    timelineRelationships: d.timelineRelationships,
    crossTimelineArtifacts: d.crossTimelineArtifacts,
    mapRoutes: d.mapRoutes,
    mapRegions: d.mapRegions,
    mapRegionSnapshots: d.mapRegionSnapshots,
    mapAnnotations: d.mapAnnotations,
    loreCategories: d.loreCategories,
    lorePages: d.lorePages,
    factions: d.factions,
    factionMemberships: d.factionMemberships,
    factionRelationships: d.factionRelationships,
    knowledgeFacts: d.knowledgeFacts,
    knowledgeReveals: d.knowledgeReveals,
    characterGoals: d.characterGoals,
    sceneTexts: d.sceneTexts,
    plotThreads: d.plotThreads,
    motifs: d.motifs,
    continuitySuppressions: d.continuitySuppressions,
    writingLogs: d.writingLogs,
    sceneRevisions: d.sceneRevisions,
    tombstones: d.tombstones,
    ...extras,
  }
  const filename = `${d.world.name.replace(/[^a-z0-9]/gi, '_')}.pwk`
  await writeJsonWithBlobs(headerObj, d.rawBlobs, filename, onProgress)
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
 *  - `WorldName.pwk`  — all story data, no images (fast to open/share)
 *  - `WorldName.pwb`  — binary blobs only (maps, portraits, etc.)
 *
 * Both files are needed for a complete round-trip import.
 * The images file can also be imported independently to restore images
 * for an already-imported world.
 */
export async function exportWorldSplit(
  worldId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const d = await collectWorldData(worldId)
  const extras = readLocalStorageExtras(worldId)
  const safeName = d.world.name.replace(/[^a-z0-9]/gi, '_')
  const exportedAt = Date.now()

  // ── File 1: data (no blobs) — immediate download ─────────────────────────
  const dataFile: WorldExportFile = {
    version: EXPORT_VERSION,
    type: 'data',
    exportedAt,
    world: d.world,
    mapLayers: d.mapLayers,
    locationMarkers: d.locationMarkers,
    characters: d.characters,
    items: d.items,
    characterSnapshots: d.characterSnapshots,
    characterMovements: d.characterMovements,
    itemPlacements: d.itemPlacements,
    locationSnapshots: d.locationSnapshots,
    itemSnapshots: d.itemSnapshots,
    relationships: d.relationships,
    relationshipSnapshots: d.relationshipSnapshots,
    timelines: d.timelines,
    chapters: d.chapters,
    events: d.events,
    blobs: [],
    travelModes: d.travelModes,
    timelineRelationships: d.timelineRelationships,
    crossTimelineArtifacts: d.crossTimelineArtifacts,
    mapRoutes: d.mapRoutes,
    mapRegions: d.mapRegions,
    mapRegionSnapshots: d.mapRegionSnapshots,
    mapAnnotations: d.mapAnnotations,
    loreCategories: d.loreCategories,
    lorePages: d.lorePages,
    factions: d.factions,
    factionMemberships: d.factionMemberships,
    factionRelationships: d.factionRelationships,
    knowledgeFacts: d.knowledgeFacts,
    knowledgeReveals: d.knowledgeReveals,
    characterGoals: d.characterGoals,
    sceneTexts: d.sceneTexts,
    plotThreads: d.plotThreads,
    motifs: d.motifs,
    continuitySuppressions: d.continuitySuppressions,
    writingLogs: d.writingLogs,
    sceneRevisions: d.sceneRevisions,
    tombstones: d.tombstones,
    ...extras,
  }
  triggerDownload(JSON.stringify(dataFile), `${safeName}.pwk`)

  // ── File 2: images — streamed via File System Access API when available ───
  const imagesHeader: Record<string, unknown> = {
    version: EXPORT_VERSION,
    type: 'images',
    worldId,
    worldName: d.world.name,
    exportedAt,
  }
  await writeJsonWithBlobs(imagesHeader, d.rawBlobs, `${safeName}.pwb`, onProgress)
}

/**
 * Serialize a world to a JSON string for cloud sync.
 * Blobs are converted in-memory sequentially to keep peak memory bounded.
 */
export async function serializeWorldForSync(worldId: string): Promise<string> {
  const d = await collectWorldData(worldId)
  const extras = readLocalStorageExtras(worldId)
  const blobs: BlobExport[] = []
  for (const b of d.rawBlobs) {
    blobs.push(await blobToExport(b))
  }
  const exportData: WorldExportFile = {
    version: EXPORT_VERSION,
    type: 'full',
    exportedAt: Date.now(),
    world: d.world,
    mapLayers: d.mapLayers,
    locationMarkers: d.locationMarkers,
    characters: d.characters,
    items: d.items,
    characterSnapshots: d.characterSnapshots,
    characterMovements: d.characterMovements,
    itemPlacements: d.itemPlacements,
    locationSnapshots: d.locationSnapshots,
    itemSnapshots: d.itemSnapshots,
    relationships: d.relationships,
    relationshipSnapshots: d.relationshipSnapshots,
    timelines: d.timelines,
    chapters: d.chapters,
    events: d.events,
    blobs,
    travelModes: d.travelModes,
    timelineRelationships: d.timelineRelationships,
    crossTimelineArtifacts: d.crossTimelineArtifacts,
    mapRoutes: d.mapRoutes,
    mapRegions: d.mapRegions,
    mapRegionSnapshots: d.mapRegionSnapshots,
    mapAnnotations: d.mapAnnotations,
    loreCategories: d.loreCategories,
    lorePages: d.lorePages,
    factions: d.factions,
    factionMemberships: d.factionMemberships,
    factionRelationships: d.factionRelationships,
    knowledgeFacts: d.knowledgeFacts,
    knowledgeReveals: d.knowledgeReveals,
    characterGoals: d.characterGoals,
    sceneTexts: d.sceneTexts,
    plotThreads: d.plotThreads,
    motifs: d.motifs,
    continuitySuppressions: d.continuitySuppressions,
    writingLogs: d.writingLogs,
    sceneRevisions: d.sceneRevisions,
    tombstones: d.tombstones,
    ...extras,
  }
  return JSON.stringify(exportData)
}

/**
 * Import only the images companion file (`.pwb`) for an already-imported world.
 * Safe to run multiple times — uses bulkPut so existing blobs are overwritten.
 */
export async function importWorldImages(file: File): Promise<string> {
  const text = await file.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error('Invalid file: could not parse JSON') }

  if (typeof data !== 'object' || data === null) throw new Error('Invalid images file')
  const d = data as Record<string, unknown>
  if (d.type !== 'images') throw new Error('Not an images export file (.pwb)')
  if (typeof d.worldId !== 'string') throw new Error('Invalid images file: missing worldId')
  if (!Array.isArray(d.blobs)) throw new Error('Invalid images file: missing blobs array')

  const worldId = d.worldId as string
  const world = await db.worlds.get(worldId)
  if (!world) throw new Error('World not found — import the data file (.pwk) first.')

  const blobs = d.blobs as BlobExport[]
  await db.transaction('rw', [db.blobs], async () => {
    for (const b of blobs) {
      await db.blobs.put(blobRecordFromExport(b))
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
  if (d.timelineRelationships !== undefined && !Array.isArray(d.timelineRelationships)) {
    throw new Error('Invalid file: timelineRelationships is not an array')
  }
  if (!d.timelineRelationships) (d as Record<string, unknown>).timelineRelationships = []
  if (d.crossTimelineArtifacts !== undefined && !Array.isArray(d.crossTimelineArtifacts)) {
    throw new Error('Invalid file: crossTimelineArtifacts is not an array')
  }
  if (!d.crossTimelineArtifacts) (d as Record<string, unknown>).crossTimelineArtifacts = []
  if (d.mapRoutes !== undefined && !Array.isArray(d.mapRoutes)) {
    throw new Error('Invalid file: mapRoutes is not an array')
  }
  if (!d.mapRoutes) (d as Record<string, unknown>).mapRoutes = []
  if (d.mapRegions !== undefined && !Array.isArray(d.mapRegions)) {
    throw new Error('Invalid file: mapRegions is not an array')
  }
  if (!d.mapRegions) (d as Record<string, unknown>).mapRegions = []
  if (d.mapRegionSnapshots !== undefined && !Array.isArray(d.mapRegionSnapshots)) {
    throw new Error('Invalid file: mapRegionSnapshots is not an array')
  }
  if (!d.mapRegionSnapshots) (d as Record<string, unknown>).mapRegionSnapshots = []
  if (d.mapAnnotations !== undefined && !Array.isArray(d.mapAnnotations)) {
    throw new Error('Invalid file: mapAnnotations is not an array')
  }
  if (!d.mapAnnotations) (d as Record<string, unknown>).mapAnnotations = []
  if (d.loreCategories !== undefined && !Array.isArray(d.loreCategories)) {
    throw new Error('Invalid file: loreCategories is not an array')
  }
  if (!d.loreCategories) (d as Record<string, unknown>).loreCategories = []
  if (d.lorePages !== undefined && !Array.isArray(d.lorePages)) {
    throw new Error('Invalid file: lorePages is not an array')
  }
  if (!d.lorePages) (d as Record<string, unknown>).lorePages = []
  if (d.factions !== undefined && !Array.isArray(d.factions)) {
    throw new Error('Invalid file: factions is not an array')
  }
  if (!d.factions) (d as Record<string, unknown>).factions = []
  if (d.factionMemberships !== undefined && !Array.isArray(d.factionMemberships)) {
    throw new Error('Invalid file: factionMemberships is not an array')
  }
  if (!d.factionMemberships) (d as Record<string, unknown>).factionMemberships = []
  if (d.factionRelationships !== undefined && !Array.isArray(d.factionRelationships)) {
    throw new Error('Invalid file: factionRelationships is not an array')
  }
  if (!d.factionRelationships) (d as Record<string, unknown>).factionRelationships = []
  if (d.knowledgeFacts !== undefined && !Array.isArray(d.knowledgeFacts)) {
    throw new Error('Invalid file: knowledgeFacts is not an array')
  }
  if (!d.knowledgeFacts) (d as Record<string, unknown>).knowledgeFacts = []
  if (d.knowledgeReveals !== undefined && !Array.isArray(d.knowledgeReveals)) {
    throw new Error('Invalid file: knowledgeReveals is not an array')
  }
  if (!d.knowledgeReveals) (d as Record<string, unknown>).knowledgeReveals = []
  if (d.characterGoals !== undefined && !Array.isArray(d.characterGoals)) {
    throw new Error('Invalid file: characterGoals is not an array')
  }
  if (!d.characterGoals) (d as Record<string, unknown>).characterGoals = []
  if (d.tombstones !== undefined && !Array.isArray(d.tombstones)) {
    throw new Error('Invalid file: tombstones is not an array')
  }
  if (!d.tombstones) (d as Record<string, unknown>).tombstones = []
  if (d.sceneTexts !== undefined && !Array.isArray(d.sceneTexts)) {
    throw new Error('Invalid file: sceneTexts is not an array')
  }
  if (!d.sceneTexts) (d as Record<string, unknown>).sceneTexts = []
  if (d.plotThreads !== undefined && !Array.isArray(d.plotThreads)) {
    throw new Error('Invalid file: plotThreads is not an array')
  }
  if (!d.plotThreads) (d as Record<string, unknown>).plotThreads = []
  if (d.motifs !== undefined && !Array.isArray(d.motifs)) {
    throw new Error('Invalid file: motifs is not an array')
  }
  if (!d.motifs) (d as Record<string, unknown>).motifs = []
  if (d.writingLogs !== undefined && !Array.isArray(d.writingLogs)) {
    throw new Error('Invalid file: writingLogs is not an array')
  }
  if (!d.writingLogs) (d as Record<string, unknown>).writingLogs = []
  if (d.sceneRevisions !== undefined && !Array.isArray(d.sceneRevisions)) {
    throw new Error('Invalid file: sceneRevisions is not an array')
  }
  if (!d.sceneRevisions) (d as Record<string, unknown>).sceneRevisions = []
}

function normalizeImport(data: WorldExportFile): void {
  type Rec = Record<string, unknown>

  // ── Common backfills (apply to all versions) ────────────────────────────────

  // Backfill theme on world exported before it was added
  {
    const w = data.world as unknown as Rec
    if (w.theme === undefined) w.theme = null
  }
  // Backfill color and birthDate on characters exported before they were added
  for (const char of data.characters) {
    const c = char as unknown as Rec
    if (c.color === undefined) c.color = null
    if (c.birthDate === undefined) c.birthDate = null
    // Journal versions (#115) start fresh on import: a `.pwk` is a snapshot of
    // a world's current state, and the exporting device's history means nothing
    // in the importing one. The operation journal itself is deliberately not
    // part of the file for the same reason.
    if (c.version === undefined) c.version = 1
  }
  // Backfill scale and level fields on map layers exported before they were added
  for (const layer of data.mapLayers) {
    const l = layer as unknown as Rec
    if (l.scalePixelsPerUnit === undefined) l.scalePixelsPerUnit = null
    if (l.scaleUnit === undefined) l.scaleUnit = null
    if (l.levelGroupId === undefined) l.levelGroupId = null
    if (l.levelIndex === undefined) l.levelIndex = 0
    if (l.levelLabel === undefined) l.levelLabel = ''
  }
  // Backfill linkedMapLayerId and factionId on regions exported before they were added
  for (const region of data.mapRegions) {
    const r = region as unknown as Rec
    if (r.linkedMapLayerId === undefined) r.linkedMapLayerId = null
    if (r.factionId === undefined) r.factionId = null
  }
  // Backfill factionId on locationMarkers exported before it was added
  for (const marker of data.locationMarkers) {
    const m = marker as unknown as Rec
    if (m.factionId === undefined) m.factionId = null
  }
  // Backfill synopsis, notes and wordGoal on chapters exported before they were added
  for (const ch of data.chapters) {
    const c = ch as unknown as Rec
    if (c.synopsis === undefined) c.synopsis = ''
    if (c.notes === undefined) c.notes = ''
    if (c.wordGoal === undefined) c.wordGoal = null
  }
  // Backfill travelDays, isFlashback, inWorldTime and tension on events (may be absent on older exports)
  for (const ev of data.events) {
    const e = ev as unknown as Rec
    if (e.travelDays === undefined) e.travelDays = null
    if (e.isFlashback === undefined) e.isFlashback = false
    if (e.inWorldTime === undefined) e.inWorldTime = null
    if (e.tension === undefined) e.tension = null
    if (e.structureBeat === undefined) e.structureBeat = null
    if (e.mentionedCharacterIds === undefined) e.mentionedCharacterIds = []
    if (e.threadIds === undefined) e.threadIds = []
    if (e.motifIds === undefined) e.motifIds = []
  }
  // Backfill the reader-clock and origin on knowledge facts (added after knowledge shipped)
  for (const fact of data.knowledgeFacts ?? []) {
    const f = fact as unknown as Rec
    if (f.readerLearnsAtEventId === undefined) f.readerLearnsAtEventId = null
    if (f.originEventId === undefined) f.originEventId = null
  }
  // Backfill travelModeId on character snapshots exported before it was added
  for (const snap of data.characterSnapshots) {
    const s = snap as unknown as Rec
    if (s.travelModeId === undefined) s.travelModeId = null
  }
  // Backfill continuityStaleThreshold and calendar on worlds exported before they were added
  {
    const w = data.world as unknown as Rec
    if (w.continuityStaleThreshold === undefined) w.continuityStaleThreshold = 5
    if (w.calendar === undefined) w.calendar = null
    if (w.wordTarget === undefined) w.wordTarget = null
    if (w.targetDate === undefined) w.targetDate = null
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
          mentionedCharacterIds: [],
          involvedItemIds: [],
          tags: [],
          threadIds: [],
          sortOrder: 0,
          travelDays: (c.travelDays as number | null) ?? null,
          inWorldTime: null,
          tension: null,
          structureBeat: null,
          status: 'draft',
          povCharacterId: null,
          isFlashback: false,
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

  // ── v3-v6: recompute sortKey to the fractional formula ───────────────────────
  // v3-v6 files have sortKey using the old formula (chapter.number × 10_000 + sortOrder).
  // v7+ files use the fractional formula (chapter.number + sortOrder / 1_000_000).
  // v1/v2 files have no sortKey at all — compute fresh below.
  if (data.version < 7) {
    const eventById = new Map(data.events.map((e) => [e.id, e]))
    const chapterNumberById = new Map(data.chapters.map((c) => [c.id, c.number]))

    const getSortKey = (eventId: string): number => {
      const ev = eventById.get(eventId)
      if (!ev) return 0
      const chapNum = chapterNumberById.get(ev.chapterId) ?? 0
      return chapNum + ev.sortOrder / 1_000_000
    }

    const snapshotArrays: Rec[][] = [
      data.characterSnapshots as unknown as Rec[],
      data.locationSnapshots as unknown as Rec[],
      data.itemSnapshots as unknown as Rec[],
      data.relationshipSnapshots as unknown as Rec[],
    ]
    for (const arr of snapshotArrays) {
      for (const snap of arr) {
        snap.sortKey = getSortKey(snap.eventId as string)
      }
    }
  }
}

/** Import a world from a raw JSON string (used by cloud sync). */
export async function importWorldFromJson(json: string): Promise<string> {
  let data: unknown
  try { data = JSON.parse(json) } catch { throw new Error('Invalid file: could not parse JSON') }
  validateImport(data)
  normalizeImport(data)
  return importWorldData(data)
}

async function importWorldData(data: WorldExportFile, replaceExisting = true): Promise<string> {
  // Normalise continuitySuppressions: v7+ files carry the DB records directly;
  // v6 and earlier stored only issueIds via localStorage (notes were lost on export).
  // Merge both sources so that upgrading users don't lose their suppressions.
  const suppressionsToImport: ContinuitySuppression[] = []
  if (Array.isArray(data.continuitySuppressions)) {
    suppressionsToImport.push(...data.continuitySuppressions)
  }
  if (Array.isArray(data.suppressedIssueIds)) {
    const existingIds = new Set(suppressionsToImport.map((s) => s.issueId))
    for (const issueId of data.suppressedIssueIds) {
      if (!existingIds.has(issueId)) {
        suppressionsToImport.push({ id: generateId(), worldId: data.world.id, issueId, note: '' })
      }
    }
  }

  await db.transaction('rw', [
    db.worlds, db.mapLayers, db.locationMarkers, db.characters,
    db.items, db.characterSnapshots, db.characterMovements, db.itemPlacements,
    db.locationSnapshots, db.itemSnapshots,
    db.relationships, db.relationshipSnapshots, db.timelines,
    db.chapters, db.events, db.blobs, db.travelModes,
    db.timelineRelationships, db.crossTimelineArtifacts,
    db.mapRoutes, db.mapRegions, db.mapRegionSnapshots, db.mapAnnotations,
    db.loreCategories, db.lorePages, db.factions, db.factionMemberships, db.factionRelationships,
    db.knowledgeFacts, db.knowledgeReveals, db.characterGoals, db.sceneTexts, db.plotThreads,
    db.motifs, db.continuitySuppressions, db.writingLogs, db.sceneRevisions,
    db.tombstones,
  ], async () => {
    // A normal import and the explicit "Replace all" action must remove records
    // that are no longer present in the incoming file. Previously this path only
    // used bulkPut(), so re-importing an enriched sequel left its generated
    // "Main Story" timeline (and any other local-only records) behind.
    //
    // Merge imports pass replaceExisting=false because their payload has already
    // been combined with the local records above.
    if (replaceExisting) {
      await Promise.all([
        db.mapLayers.where('worldId').equals(data.world.id).delete(),
        db.locationMarkers.where('worldId').equals(data.world.id).delete(),
        db.characters.where('worldId').equals(data.world.id).delete(),
        db.items.where('worldId').equals(data.world.id).delete(),
        db.characterSnapshots.where('worldId').equals(data.world.id).delete(),
        db.characterMovements.where('worldId').equals(data.world.id).delete(),
        db.itemPlacements.where('worldId').equals(data.world.id).delete(),
        db.locationSnapshots.where('worldId').equals(data.world.id).delete(),
        db.itemSnapshots.where('worldId').equals(data.world.id).delete(),
        db.relationships.where('worldId').equals(data.world.id).delete(),
        db.relationshipSnapshots.where('worldId').equals(data.world.id).delete(),
        db.timelines.where('worldId').equals(data.world.id).delete(),
        db.chapters.where('worldId').equals(data.world.id).delete(),
        db.events.where('worldId').equals(data.world.id).delete(),
        db.blobs.where('worldId').equals(data.world.id).delete(),
        db.travelModes.where('worldId').equals(data.world.id).delete(),
        db.timelineRelationships.where('worldId').equals(data.world.id).delete(),
        db.crossTimelineArtifacts.where('worldId').equals(data.world.id).delete(),
        db.mapRoutes.where('worldId').equals(data.world.id).delete(),
        db.mapRegions.where('worldId').equals(data.world.id).delete(),
        db.mapRegionSnapshots.where('worldId').equals(data.world.id).delete(),
        db.mapAnnotations.where('worldId').equals(data.world.id).delete(),
        db.loreCategories.where('worldId').equals(data.world.id).delete(),
        db.lorePages.where('worldId').equals(data.world.id).delete(),
        db.factions.where('worldId').equals(data.world.id).delete(),
        db.factionMemberships.where('worldId').equals(data.world.id).delete(),
        db.factionRelationships.where('worldId').equals(data.world.id).delete(),
        db.knowledgeFacts.where('worldId').equals(data.world.id).delete(),
        db.knowledgeReveals.where('worldId').equals(data.world.id).delete(),
        db.characterGoals.where('worldId').equals(data.world.id).delete(),
        db.sceneTexts.where('worldId').equals(data.world.id).delete(),
        db.plotThreads.where('worldId').equals(data.world.id).delete(),
        db.motifs.where('worldId').equals(data.world.id).delete(),
        db.writingLogs.where('worldId').equals(data.world.id).delete(),
        db.sceneRevisions.where('worldId').equals(data.world.id).delete(),
        db.continuitySuppressions.where('worldId').equals(data.world.id).delete(),
      ])
    }

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
    await db.timelineRelationships.bulkPut(data.timelineRelationships)
    await db.crossTimelineArtifacts.bulkPut(data.crossTimelineArtifacts)
    await db.mapRoutes.bulkPut(data.mapRoutes)
    await db.mapRegions.bulkPut(data.mapRegions)
    await db.mapRegionSnapshots.bulkPut(data.mapRegionSnapshots)
    await db.mapAnnotations.bulkPut(data.mapAnnotations)
    await db.loreCategories.bulkPut(data.loreCategories)
    await db.lorePages.bulkPut(data.lorePages)
    await db.factions.bulkPut(data.factions)
    await db.factionMemberships.bulkPut(data.factionMemberships)
    await db.factionRelationships.bulkPut(data.factionRelationships)
    await db.knowledgeFacts.bulkPut(data.knowledgeFacts ?? [])
    await db.knowledgeReveals.bulkPut(data.knowledgeReveals ?? [])
    await db.characterGoals.bulkPut(data.characterGoals ?? [])
    await db.sceneTexts.bulkPut(data.sceneTexts ?? [])
    await db.plotThreads.bulkPut(data.plotThreads ?? [])
    await db.motifs.bulkPut(data.motifs ?? [])
    await db.writingLogs.bulkPut(data.writingLogs ?? [])
    await db.sceneRevisions.bulkPut(data.sceneRevisions ?? [])
    // Deletions travel with the world so the far side removes what this side
    // removed. Written after markJournalDiscontinuity clears the journal (which
    // is device-local history) — a tombstone is world state, not history.
    await db.tombstones.bulkPut(data.tombstones ?? [])
    if (suppressionsToImport.length > 0) {
      await db.continuitySuppressions.bulkPut(suppressionsToImport)
    }

    for (const b of data.blobs) {
      await db.blobs.put(blobRecordFromExport(b))
    }
  })

  if (data.relationshipPositions && typeof data.relationshipPositions === 'object') {
    localStorage.setItem(`wb-rel-pos-${data.world.id}`, JSON.stringify(data.relationshipPositions))
  } else if (replaceExisting) {
    localStorage.removeItem(`wb-rel-pos-${data.world.id}`)
  }

  // Import writes the whole world wholesale and reuses its ids, so any journal
  // left under that id describes a different history. Reset it rather than
  // leave a partial one — see markJournalDiscontinuity.
  await markJournalDiscontinuity(data.world.id)
  return data.world.id
}

export async function importWorld(file: File): Promise<string> {
  const text = await file.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error('Invalid file: could not parse JSON') }
  validateImport(data)
  normalizeImport(data)
  return importWorldData(data)
}

// ── Merge / collaboration helpers ─────────────────────────────────────────────

/** Fields of one record that both copies changed, with what each side had. */
export interface RecordConflict {
  id: string
  /** What to call the record on screen — its name or title. */
  label: string
  fields: FieldConflict[]
}

export interface MergePreview {
  exportedAt: number
  characters:  { added: number; updated: number }
  events:      { added: number; updated: number }
  chapters:    { added: number; updated: number }
  locations:   { added: number; updated: number }
  items:       { added: number; updated: number }
  /**
   * Fields both copies changed, so the merge had to pick one. Surfaced so the
   * choice can be shown and, if the user disagrees with it, reversed.
   */
  conflicts:   PreviewConflict[]
}

export interface PreviewConflict extends RecordConflict {
  /** Human-facing group name, for reading rather than for logic. */
  entity: string
}

/**
 * Merge two arrays by ID.
 *
 * Records only in `incoming` are added. Records in both are merged field by
 * field (see `mergeRecords`) rather than one whole record replacing the other:
 * taking the newer record entire meant that retitling a scene on one device
 * silently discarded a cast change made on another, which is data loss that
 * looked like a successful merge.
 */
function mergeTable<T extends { id: string }>(
  incoming: T[],
  local: T[],
  prefer: ConflictPreference = 'newer',
  label: (r: T) => string = () => '',
): { result: T[]; added: number; updated: number; conflicts: RecordConflict[] } {
  const localById    = new Map(local.map((r) => [r.id, r]))
  const incomingById = new Map(incoming.map((r) => [r.id, r]))
  const result: T[]  = []
  const conflicts: RecordConflict[] = []
  let added = 0, updated = 0

  for (const loc of local) {
    const inc = incomingById.get(loc.id)
    if (!inc) {
      result.push(loc) // local-only — keep
      continue
    }
    const merged = mergeRecords(loc, inc, prefer)
    result.push(merged.record)
    if (merged.conflicts.length > 0) {
      updated++
      conflicts.push({ id: loc.id, label: label(loc), fields: merged.conflicts })
    } else if (JSON.stringify(merged.record) !== JSON.stringify(loc)) {
      updated++
    }
  }
  for (const inc of incoming) {
    if (!localById.has(inc.id)) {
      result.push(inc)
      added++
    }
  }
  return { result, added, updated, conflicts }
}

/**
 * Parse and validate a .pwk JSON string, diff it against the current world in
 * the DB, and return a human-readable preview plus the parsed data object so
 * the caller can execute without re-parsing.
 */
export async function previewWorldMerge(
  json: string,
): Promise<{ preview: MergePreview; parsed: WorldExportFile }> {
  let raw: unknown
  try { raw = JSON.parse(json) } catch { throw new Error('Invalid file: could not parse JSON') }
  validateImport(raw)
  normalizeImport(raw)
  const parsed = raw as WorldExportFile
  const worldId = parsed.world.id

  const [localChars, localEvents, localChapters, localLocations, localItems] = await Promise.all([
    db.characters.where('worldId').equals(worldId).toArray(),
    db.events.where('worldId').equals(worldId).toArray(),
    db.chapters.where('worldId').equals(worldId).toArray(),
    db.locationMarkers.where('worldId').equals(worldId).toArray(),
    db.items.where('worldId').equals(worldId).toArray(),
  ])

  const named = <T extends { name?: string; title?: string }>(r: T) => r.name ?? r.title ?? ''
  const chars = mergeTable(parsed.characters, localChars, 'newer', named)
  const evts  = mergeTable(parsed.events, localEvents, 'newer', named)
  const chaps = mergeTable(parsed.chapters, localChapters, 'newer', named)
  const locs  = mergeTable(parsed.locationMarkers, localLocations, 'newer', named)
  const itms  = mergeTable(parsed.items, localItems, 'newer', named)

  return {
    parsed,
    preview: {
      exportedAt: parsed.exportedAt,
      characters: { added: chars.added, updated: chars.updated },
      events:     { added: evts.added,  updated: evts.updated  },
      chapters:   { added: chaps.added, updated: chaps.updated },
      locations:  { added: locs.added,  updated: locs.updated  },
      items:      { added: itms.added,  updated: itms.updated  },
      conflicts: [
        ...chars.conflicts.map((c) => ({ ...c, entity: 'Character' })),
        ...evts.conflicts.map((c) => ({ ...c, entity: 'Event' })),
        ...chaps.conflicts.map((c) => ({ ...c, entity: 'Chapter' })),
        ...locs.conflicts.map((c) => ({ ...c, entity: 'Location' })),
        ...itms.conflicts.map((c) => ({ ...c, entity: 'Item' })),
      ],
    },
  }
}

/**
 * Apply a previously parsed WorldExportFile to the DB.
 * - 'replace': identical to a normal import (overwrites everything).
 * - 'merge': per-table smart merge — keeps locally-newer records and
 *   local-only records; pulls in incoming additions and newer remote edits.
 */
export async function applyWorldImport(
  parsed: WorldExportFile,
  mode: 'replace' | 'merge',
  prefer: ConflictPreference = 'newer',
): Promise<string> {
  if (mode === 'replace') return importWorldData(parsed)

  const worldId = parsed.world.id

  const [
    localChars, localItems, localLocs, localLayers,
    localEvents, localChapters, localTimelines,
    localRels, localRelSnaps,
    localCharSnaps, localMovements, localItemPlacements,
    localLocSnaps, localItemSnaps,
    localTravelModes, localTlRels, localCta,
    localRoutes, localRegions, localRegSnaps, localAnnotations,
    localLoreCats, localLorePages,
    localFactions, localFactionMemberships, localFactionRelationships,
    localKnowledgeFacts, localKnowledgeReveals, localCharacterGoals,
    localSceneTexts, localPlotThreads,
    localMotifs, localWritingLogs, localSceneRevisions, localTombstones,
  ] = await Promise.all([
    db.characters.where('worldId').equals(worldId).toArray(),
    db.items.where('worldId').equals(worldId).toArray(),
    db.locationMarkers.where('worldId').equals(worldId).toArray(),
    db.mapLayers.where('worldId').equals(worldId).toArray(),
    db.events.where('worldId').equals(worldId).toArray(),
    db.chapters.where('worldId').equals(worldId).toArray(),
    db.timelines.where('worldId').equals(worldId).toArray(),
    db.relationships.where('worldId').equals(worldId).toArray(),
    db.relationshipSnapshots.where('worldId').equals(worldId).toArray(),
    db.characterSnapshots.where('worldId').equals(worldId).toArray(),
    db.characterMovements.where('worldId').equals(worldId).toArray(),
    db.itemPlacements.where('worldId').equals(worldId).toArray(),
    db.locationSnapshots.where('worldId').equals(worldId).toArray(),
    db.itemSnapshots.where('worldId').equals(worldId).toArray(),
    db.travelModes.where('worldId').equals(worldId).toArray(),
    db.timelineRelationships.where('worldId').equals(worldId).toArray(),
    db.crossTimelineArtifacts.where('worldId').equals(worldId).toArray(),
    db.mapRoutes.where('worldId').equals(worldId).toArray(),
    db.mapRegions.where('worldId').equals(worldId).toArray(),
    db.mapRegionSnapshots.where('worldId').equals(worldId).toArray(),
    db.mapAnnotations.where('worldId').equals(worldId).toArray(),
    db.loreCategories.where('worldId').equals(worldId).toArray(),
    db.lorePages.where('worldId').equals(worldId).toArray(),
    db.factions.where('worldId').equals(worldId).toArray(),
    db.factionMemberships.where('worldId').equals(worldId).toArray(),
    db.factionRelationships.where('worldId').equals(worldId).toArray(),
    db.knowledgeFacts.where('worldId').equals(worldId).toArray(),
    db.knowledgeReveals.where('worldId').equals(worldId).toArray(),
    db.characterGoals.where('worldId').equals(worldId).toArray(),
    db.sceneTexts.where('worldId').equals(worldId).toArray(),
    db.plotThreads.where('worldId').equals(worldId).toArray(),
    db.motifs.where('worldId').equals(worldId).toArray(),
    db.writingLogs.where('worldId').equals(worldId).toArray(),
    db.sceneRevisions.where('worldId').equals(worldId).toArray(),
    db.tombstones.where('worldId').equals(worldId).toArray(),
  ])

  const merged = {
    world:                parsed.world, // world-level fields: use incoming (name, description)
    mapLayers:            mergeTable(parsed.mapLayers, localLayers, prefer).result,
    locationMarkers:      mergeTable(parsed.locationMarkers, localLocs, prefer).result,
    characters:           mergeTable(parsed.characters, localChars, prefer).result,
    items:                mergeTable(parsed.items, localItems, prefer).result,
    characterSnapshots:   mergeTable(parsed.characterSnapshots, localCharSnaps, prefer).result,
    characterMovements:   mergeTable(parsed.characterMovements, localMovements, prefer).result,
    itemPlacements:       mergeTable(parsed.itemPlacements, localItemPlacements, prefer).result,
    locationSnapshots:    mergeTable(parsed.locationSnapshots, localLocSnaps, prefer).result,
    itemSnapshots:        mergeTable(parsed.itemSnapshots, localItemSnaps, prefer).result,
    relationships:        mergeTable(parsed.relationships, localRels, prefer).result,
    relationshipSnapshots:mergeTable(parsed.relationshipSnapshots, localRelSnaps, prefer).result,
    timelines:            mergeTable(parsed.timelines, localTimelines, prefer).result,
    chapters:             mergeTable(parsed.chapters, localChapters, prefer).result,
    events:               mergeTable(parsed.events, localEvents, prefer).result,
    travelModes:          mergeTable(parsed.travelModes, localTravelModes, prefer).result,
    timelineRelationships:mergeTable(parsed.timelineRelationships, localTlRels, prefer).result,
    crossTimelineArtifacts:mergeTable(parsed.crossTimelineArtifacts, localCta, prefer).result,
    mapRoutes:            mergeTable(parsed.mapRoutes, localRoutes, prefer).result,
    mapRegions:           mergeTable(parsed.mapRegions, localRegions, prefer).result,
    mapRegionSnapshots:   mergeTable(parsed.mapRegionSnapshots, localRegSnaps, prefer).result,
    mapAnnotations:       mergeTable(parsed.mapAnnotations, localAnnotations, prefer).result,
    loreCategories:       mergeTable(parsed.loreCategories, localLoreCats, prefer).result,
    lorePages:            mergeTable(parsed.lorePages, localLorePages, prefer).result,
    factions:             mergeTable(parsed.factions, localFactions, prefer).result,
    factionMemberships:   mergeTable(parsed.factionMemberships, localFactionMemberships, prefer).result,
    factionRelationships: mergeTable(parsed.factionRelationships, localFactionRelationships, prefer).result,
    knowledgeFacts:       mergeTable(parsed.knowledgeFacts ?? [], localKnowledgeFacts).result,
    knowledgeReveals:     mergeTable(parsed.knowledgeReveals ?? [], localKnowledgeReveals).result,
    characterGoals:       mergeTable(parsed.characterGoals ?? [], localCharacterGoals).result,
    sceneTexts:           mergeTable(parsed.sceneTexts ?? [], localSceneTexts).result,
    plotThreads:          mergeTable(parsed.plotThreads ?? [], localPlotThreads).result,
    motifs:               mergeTable(parsed.motifs ?? [], localMotifs).result,
    writingLogs:          mergeTable(parsed.writingLogs ?? [], localWritingLogs).result,
    sceneRevisions:       mergeTable(parsed.sceneRevisions ?? [], localSceneRevisions).result,
    blobs:                parsed.blobs, // blobs: always use incoming (binary, no updatedAt)
    relationshipPositions: parsed.relationshipPositions,
    suppressedIssueIds:   parsed.suppressedIssueIds,
  }

  // ── Deletions ──────────────────────────────────────────────────────────────
  // mergeTable unions by id, so a record the *other* device deleted looks
  // local-only here and would come straight back. Tombstones are what turn "not
  // in the incoming file" into "deliberately removed", so they are applied
  // after the union rather than left to inference.
  const allTombstones = mergeTombstoneSets(localTombstones, parsed.tombstones ?? [])
  const record = merged as unknown as Record<string, Array<{ id: string; updatedAt?: number }>>
  const revived = new Set<string>()
  const removedByTable = new Map<string, string[]>()
  for (const table of Object.keys(record)) {
    const rows = record[table]
    if (!Array.isArray(rows)) continue
    const out = applyTombstones(rows, allTombstones, table)
    record[table] = out.kept
    if (out.removed.length > 0) removedByTable.set(table, out.removed)
    for (const id of out.revived) revived.add(id)
  }

  // Dropping a record from the merged set is not the same as deleting it here.
  // A merge import writes with bulkPut and never deletes (replaceExisting is
  // false, because the payload is already the union), so a record *this* device
  // still holds and the other device deleted is simply left untouched — it
  // survives, and the next push carries it back. Deletions that arrived by
  // tombstone therefore have to be applied to the store explicitly.
  //
  // The other direction — deleted here, still present in the incoming file —
  // needs none of this, since the record is not in the store to begin with.
  // That asymmetry is why only one half of it was covered for so long.
  for (const [table, ids] of removedByTable) {
    const dexieTable = (db as unknown as Record<string, Table<unknown, string> | undefined>)[table]
    if (dexieTable?.bulkDelete) await dexieTable.bulkDelete(ids)
  }

  // A record edited after its deletion was kept (see applyTombstones), so its
  // headstone is stale — leaving it would delete the record on the next merge.
  // Merge writes with bulkPut and never deletes, so stale rows have to go
  // explicitly rather than by omission from the merged set.
  const pruned = pruneStaleTombstones(allTombstones, revived)
  const keptIds = new Set(pruned.map((t) => t.id))
  const staleIds = allTombstones.filter((t) => !keptIds.has(t.id)).map((t) => t.id)
  if (staleIds.length > 0) await db.tombstones.bulkDelete(staleIds)
  ;(merged as unknown as Record<string, unknown>).tombstones = pruned

  return importWorldData(merged as WorldExportFile, false)
}
