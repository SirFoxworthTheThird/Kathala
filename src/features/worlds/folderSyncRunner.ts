import { saveFolderBinding, type FolderBinding } from '@/lib/folderSync'
import { latestSeq } from '@/db/hooks/useOperations'
import { resolveFolderSyncState, type FolderSyncState } from '@/lib/folderSyncState'
import { exportWorldData } from './cloudSyncHelpers'

/**
 * The filesystem side of folder sync: reading the bound file's timestamp, and
 * writing the world to it while recording enough to detect the next remote
 * change. The rules for what those facts mean live in
 * `src/lib/folderSyncState.ts`, which is pure and unit-tested.
 */

/** The bound file's lastModified, or undefined if it is gone or unreadable. */
export async function readFileModified(binding: FolderBinding): Promise<number | undefined> {
  try {
    const handle = await binding.handle.getFileHandle(binding.fileName)
    const file = await handle.getFile()
    return file.lastModified
  } catch {
    // NotFoundError (someone moved or deleted it) or a permission failure. Both
    // mean "we cannot see a file to clobber", which is the safe reading.
    return undefined
  }
}

export interface FolderSyncStatus {
  state: FolderSyncState
  localSeq: number
  fileModified?: number
}

export async function readFolderSyncState(
  worldId: string,
  binding: FolderBinding,
): Promise<FolderSyncStatus> {
  const [localSeq, fileModified] = await Promise.all([
    latestSeq(worldId),
    readFileModified(binding),
  ])
  return {
    state: resolveFolderSyncState({
      localSeq,
      lastSyncedSeq: binding.lastSyncedSeq,
      fileModified,
      lastPushedFileModified: binding.lastPushedFileModified,
    }),
    localSeq,
    fileModified,
  }
}

/**
 * Write the world to its bound folder and record the two facts the next
 * conflict check needs: the journal seq this file represents, and the
 * lastModified the filesystem gave it.
 *
 * Deliberately unconditional — callers decide whether writing is safe. Auto-save
 * checks first; "save anyway" from the panel is the user overriding on purpose.
 */
export async function pushWorldToFolder(
  worldId: string,
  binding: FolderBinding,
): Promise<FolderBinding> {
  const json = await exportWorldData(worldId)
  const fileHandle = await binding.handle.getFileHandle(binding.fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(json)
  await writable.close()

  // Read the timestamp back rather than using Date.now(): the filesystem is the
  // authority, and it may round or skew. Comparing our own clock against its
  // value is what would produce phantom conflicts.
  const seq = await latestSeq(worldId)
  const written = await readFileModified(binding)
  const next: FolderBinding = {
    ...binding,
    lastSyncedAt: Date.now(),
    lastSyncedSeq: seq,
    lastPushedFileModified: written,
  }
  await saveFolderBinding(next)
  return next
}

/**
 * Record that the folder's copy is now what this device holds — used after a
 * successful load, so the next auto-save doesn't immediately think the folder
 * is ahead of us.
 */
export async function markPulled(
  worldId: string,
  binding: FolderBinding,
): Promise<FolderBinding> {
  const seq = await latestSeq(worldId)
  const fileModified = await readFileModified(binding)
  const next: FolderBinding = {
    ...binding,
    lastSyncedAt: Date.now(),
    lastSyncedSeq: seq,
    lastPushedFileModified: fileModified,
  }
  await saveFolderBinding(next)
  return next
}
