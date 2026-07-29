/**
 * Deciding whether it is safe to write a world to its bound folder.
 *
 * Folder sync is how one author keeps a world on two machines: the bound folder
 * is usually inside Dropbox/iCloud/OneDrive, so the file travels between them.
 * That makes the file shared state, and auto-save has to treat it as such —
 * writing unconditionally would let whichever device saved last silently
 * destroy the other's work.
 *
 * Two questions decide it, and the operation journal answers the first:
 *   1. Do we have local edits the folder hasn't seen? (journal seq moved on)
 *   2. Has the file changed since we wrote it? (lastModified moved on)
 *
 * Everything here is a pure function over those two facts so the rules can be
 * tested without a filesystem.
 */

export type FolderSyncState =
  /** Never written to the folder — the first save is unambiguous. */
  | 'never-synced'
  /** Local and folder agree; nothing to do. */
  | 'in-sync'
  /** We have edits the folder lacks. Safe to push. */
  | 'local-ahead'
  /** The folder moved on and we have no local edits. Safe to pull. */
  | 'remote-ahead'
  /** Both moved on. Not safe to do anything automatically. */
  | 'conflict'

export interface FolderSyncInput {
  /** Highest journal seq for this world right now. */
  localSeq: number
  /** Journal seq at our last successful write; undefined if never written. */
  lastSyncedSeq?: number
  /** The bound file's current lastModified, or undefined if it is missing. */
  fileModified?: number
  /** The file's lastModified immediately after our last write. */
  lastPushedFileModified?: number
}

/**
 * A tolerance for filesystem timestamp granularity. Some filesystems and sync
 * clients round lastModified to the nearest second, so an exact comparison
 * would report phantom remote changes.
 */
export const MODIFIED_TOLERANCE_MS = 1_500

export function resolveFolderSyncState(input: FolderSyncInput): FolderSyncState {
  const { localSeq, lastSyncedSeq, fileModified, lastPushedFileModified } = input

  // Never pushed, or the file has since been deleted from the folder: the next
  // write cannot clobber anything we know about.
  if (lastSyncedSeq === undefined || lastPushedFileModified === undefined) return 'never-synced'
  if (fileModified === undefined) return 'never-synced'

  // A journal that has gone *backwards* means it was reset by a bulk import
  // (see markJournalDiscontinuity), not that we are up to date. The store
  // changed wholesale, so treat it as dirty rather than assume it is clean.
  const localDirty = localSeq !== lastSyncedSeq

  const remoteChanged = fileModified - lastPushedFileModified > MODIFIED_TOLERANCE_MS

  if (localDirty && remoteChanged) return 'conflict'
  if (localDirty) return 'local-ahead'
  if (remoteChanged) return 'remote-ahead'
  return 'in-sync'
}

/**
 * Whether auto-save may write without asking. It may only do so when it cannot
 * destroy anything: nothing has been pushed yet, or the folder still holds
 * exactly what we last put there.
 */
export function canAutoPush(state: FolderSyncState): boolean {
  return state === 'never-synced' || state === 'local-ahead'
}

/** Whether the user has to make a decision before anything is written. */
export function needsAttention(state: FolderSyncState): boolean {
  return state === 'conflict' || state === 'remote-ahead'
}

export const FOLDER_SYNC_LABELS: Record<FolderSyncState, { label: string; detail: string }> = {
  'never-synced': {
    label: 'Not saved yet',
    detail: 'This world has not been written to the folder yet.',
  },
  'in-sync': {
    label: 'Up to date',
    detail: 'The folder holds the same version as this device.',
  },
  'local-ahead': {
    label: 'Unsaved changes',
    detail: 'You have edits the folder has not received yet.',
  },
  'remote-ahead': {
    label: 'Newer copy in folder',
    detail: 'Another device saved to this folder. Load it to catch up.',
  },
  conflict: {
    label: 'Both changed',
    detail:
      'You have edits here and another device saved to the folder. Auto-save is paused so neither is lost — load the folder copy to compare, or save yours over it.',
  },
}
