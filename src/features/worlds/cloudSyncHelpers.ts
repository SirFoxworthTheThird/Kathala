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

/** Deserialize a JSON string and import it into the local DB (full replace). */
export async function importWorldData(json: string): Promise<string> {
  const { importWorldFromJson } = await import('@/lib/exportImport')
  return importWorldFromJson(json)
}

export type { MergePreview, WorldExportFile } from '@/lib/exportImport'

/** Parse a .pwk JSON string and diff it against the local DB without writing anything. */
export async function previewWorldMerge(json: string) {
  const { previewWorldMerge: fn } = await import('@/lib/exportImport')
  return fn(json)
}

/** Apply a previously-parsed world file in either 'replace' or 'merge' mode. */
export async function applyWorldImport(
  parsed: import('@/lib/exportImport').WorldExportFile,
  mode: 'replace' | 'merge',
): Promise<string> {
  const { applyWorldImport: fn } = await import('@/lib/exportImport')
  return fn(parsed, mode)
}
