import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { loadFolderBinding, saveFolderBinding, checkPermission } from '@/lib/folderSync'

const DEBOUNCE_MS = 30_000 // save 30 s after the last change

/**
 * Watches all world data via liveQuery and auto-saves to the bound folder
 * 30 seconds after the last change. Silent on failure — the user can always
 * save manually from World Settings.
 *
 * Must be called from a component that stays mounted for the lifetime of a
 * world session (e.g. AppShell).
 */
export function useAutoFolderSync(worldId: string | undefined) {
  const isFirst = useRef(true)

  // Subscribe to all world data. liveQuery re-fires whenever any of these
  // tables change for this world, including edits to existing records.
  const version = useLiveQuery(async () => {
    if (!worldId) return undefined
    await Promise.all([
      db.worlds.get(worldId),
      db.characters.where('worldId').equals(worldId).toArray(),
      db.items.where('worldId').equals(worldId).toArray(),
      db.locationMarkers.where('worldId').equals(worldId).toArray(),
      db.events.where('worldId').equals(worldId).toArray(),
      db.chapters.where('worldId').equals(worldId).toArray(),
      db.characterSnapshots.where('worldId').equals(worldId).toArray(),
      db.itemPlacements.where('worldId').equals(worldId).toArray(),
      db.locationSnapshots.where('worldId').equals(worldId).toArray(),
      db.itemSnapshots.where('worldId').equals(worldId).toArray(),
      db.relationships.where('worldId').equals(worldId).toArray(),
      db.relationshipSnapshots.where('worldId').equals(worldId).toArray(),
      db.timelines.where('worldId').equals(worldId).toArray(),
      db.mapAnnotations.where('worldId').equals(worldId).toArray(),
      db.mapRegions.where('worldId').equals(worldId).toArray(),
    ])
    return Date.now()
  }, [worldId])

  useEffect(() => {
    if (version === undefined) return
    // Skip the initial emission on mount — we don't want to save immediately.
    if (isFirst.current) {
      isFirst.current = false
      return
    }

    const timer = setTimeout(async () => {
      if (!worldId) return
      const binding = await loadFolderBinding(worldId)
      if (!binding) return
      // Only proceed if the user already granted permission this session.
      // Auto-save cannot show a permission prompt (no user gesture).
      const granted = await checkPermission(binding.handle)
      if (!granted) return
      try {
        const { exportWorldData } = await import('./cloudSyncHelpers')
        const json       = await exportWorldData(worldId)
        const fileHandle = await binding.handle.getFileHandle(binding.fileName, { create: true })
        const writable   = await fileHandle.createWritable()
        await writable.write(json)
        await writable.close()
        await saveFolderBinding({ ...binding, lastSyncedAt: Date.now() })
      } catch {
        // Auto-save failures are silent — the user can manually save from Settings.
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [version, worldId])
}
