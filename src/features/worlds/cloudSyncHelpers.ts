/**
 * Thin bridge between the cloud sync layer and the export/import system.
 * Kept separate so CloudSyncPanel doesn't import the full exportImport module
 * at component parse time (it's large and only needed on user action).
 */

/** Serialize a world to a JSON string using the standard .pwk export format. */
export async function exportWorldData(worldId: string): Promise<string> {
  const { serializeWorldForSync } = await import('@/lib/exportImport')
  return serializeWorldForSync(worldId)
}

/** What a world is kept in its folder as: a series' whole file for a series (#698), else the world's. */
export async function exportSyncData(key: string): Promise<string> {
  const { db } = await import('@/db/database')
  if ((await db.worlds.get(key))?.kind !== 'series') return exportWorldData(key)
  const { serializeSeries } = await import('@/lib/exportImport')
  return serializeSeries(key)
}

/**
 * The folder's file read, and what bringing it in would add and change, with
 * the act that brings it in: a series' file over the series (#698), or a
 * world's over the world.
 */
export async function previewSyncFile(key: string, json: string): Promise<{
  preview: import('@/lib/exportImport').MergePreview
  apply: (mode: 'replace' | 'merge', prefer?: import('@/lib/mergeFields').ConflictPreference) => Promise<string>
}> {
  const { db } = await import('@/db/database')
  const lib = await import('@/lib/exportImport')
  if ((await db.worlds.get(key))?.kind !== 'series') {
    const { preview, parsed } = await lib.previewWorldMerge(json)
    return { preview, apply: (mode, prefer = 'newer') => lib.applyWorldImport(parsed, mode, prefer) }
  }
  const { preview, parsed } = await lib.previewSeriesMerge(json)
  if (parsed.series.world.id !== key) throw new Error('The file in the folder is another series.')
  return { preview, apply: (mode, prefer = 'newer') => lib.importSeriesData(parsed, mode, prefer) }
}

/** Deserialize a JSON string and import it into the local DB (full replace). */
export async function importWorldData(json: string): Promise<string> {
  const { importWorldFromJson } = await import('@/lib/exportImport')
  return importWorldFromJson(json)
}

export type { MergePreview, PreviewConflict, WorldExportFile } from '@/lib/exportImport'
export type { ConflictPreference } from '@/lib/mergeFields'

/** Parse a .pwk JSON string and diff it against the local DB without writing anything. */
export async function previewWorldMerge(json: string) {
  const { previewWorldMerge: fn } = await import('@/lib/exportImport')
  return fn(json)
}

/** Apply a previously-parsed world file in either 'replace' or 'merge' mode. */
export async function applyWorldImport(
  parsed: import('@/lib/exportImport').WorldExportFile,
  mode: 'replace' | 'merge',
  prefer: import('@/lib/mergeFields').ConflictPreference = 'newer',
): Promise<string> {
  const { applyWorldImport: fn } = await import('@/lib/exportImport')
  return fn(parsed, mode, prefer)
}
