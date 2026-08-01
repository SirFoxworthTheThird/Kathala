import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { loadFolderBinding, checkPermission } from '@/lib/folderSync'
import { pushWorldToFolder, pushConflictCopy, readFolderSyncState } from './folderSyncRunner'

const DEBOUNCE_MS = 30_000 // save 30 s after the last change

/**
 * Watches all world data via liveQuery and auto-saves to the bound folder
 * 30 seconds after the last change.
 *
 * The bound folder is usually inside Dropbox/iCloud/OneDrive, so the file is
 * shared state between the author's machines. Auto-save therefore refuses to
 * write whenever the file has changed since we last wrote it — otherwise
 * whichever device saved last would silently destroy the other's work. Those
 * cases surface in the Cloud Sync panel for the user to resolve; see
 * src/lib/folderSyncState.ts.
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
        const { state } = await readFolderSyncState(worldId, binding)
        if (state === 'in-sync') return
        if (state === 'conflict') {
          // Both sides moved. Writing the bound file would destroy the other
          // device's work; writing nothing would strand this one. A side copy
          // keeps both, without the author having to notice anything.
          await pushConflictCopy(worldId, binding)
          return
        }
        // remote-ahead: the folder has work we don't, and we have none of our
        // own to lose. Leave it for the user to load.
        if (state === 'remote-ahead') return
        await pushWorldToFolder(worldId, binding)
      } catch {
        // A failed auto-save is not silent data loss: the world is already
        // committed locally, and the panel shows the folder is behind.
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [version, worldId])
}
