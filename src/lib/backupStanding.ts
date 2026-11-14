import { relativeTime } from '@/lib/relativeTime'
import { FOLDER_SYNC_LABELS, type FolderSyncState } from '@/lib/folderSyncState'

/**
 * What to tell a writer about the only copy of their book.
 *
 * A world lives in one browser's IndexedDB. Clearing site data, a corrupted
 * profile or a reinstalled machine takes it, and the only defence is a copy in
 * a folder the author chose. That machinery has existed for a while and was
 * **opt-in and silent**: the status chip rendered nothing at all unless a
 * folder was already bound, so the writer most at risk — the one who has never
 * heard of the feature — was the one told nothing.
 *
 * Silence is the wrong default for this and only this. Everywhere else the app
 * stays out of the way; here, saying nothing is indistinguishable from saying
 * *you are safe*.
 *
 * Kept pure so the sentences can be tested without a filesystem, a clock or a
 * browser that supports directory handles.
 */

export type BackupState =
  | FolderSyncState
  /** A folder is bound but the browser has not been given access this session. */
  | 'no-permission'
  /** No folder has ever been chosen for this world. */
  | 'unbacked'
  /** This browser does not expose the folder picker, so there is no folder to choose. */
  | 'unsupported'

export interface BackupSummary {
  short: string
  detail: string
  /** `warn` earns amber; everything else stays quiet. */
  tone: 'muted' | 'warn'
}

/*
  A copy exported by hand: a .pwk downloaded on this device (round-trip-plan-3.md,
  T13, S3). It is not a backup kept as you write, so with no folder the pill
  still says so; but "exists only in this browser" stops being true the moment
  one is saved, and the pill said it anyway. Kept on the device, beside the
  folder binding it stands in for, and never carried in the file.
*/
const EXPORTED_KEY = (worldId: string) => `kathala-exported-${worldId}`
/** Said to the backup chip when a copy is saved, so it answers at once rather than at its next look. */
export const EXPORTED_EVENT = 'kathala-world-exported'

/** Note that a copy of the world was exported now. */
export function noteExported(worldId: string, at = Date.now()): void {
  try { localStorage.setItem(EXPORTED_KEY(worldId), String(at)) } catch { /* not kept: the chip says what it knew */ }
  try { window.dispatchEvent(new CustomEvent(EXPORTED_EVENT, { detail: worldId })) } catch { /* no window */ }
}

/** When a copy of the world was last exported on this device: 0 for never. */
export function lastExported(worldId: string): number {
  try { return Number(localStorage.getItem(EXPORTED_KEY(worldId))) || 0 } catch { return 0 }
}

export function backupSummary(input: {
  state: BackupState
  /** Epoch ms of the last successful write; 0 or undefined if never. */
  lastSyncedAt?: number
  /** Epoch ms of the last copy exported by hand on this device; 0 or undefined if never. */
  exportedAt?: number
  now?: number
}): BackupSummary {
  const { state, lastSyncedAt = 0, exportedAt = 0, now = Date.now() } = input
  const when = lastSyncedAt > 0 ? relativeTime(lastSyncedAt, now) : null
  const copied = exportedAt > 0 ? relativeTime(exportedAt, now) : null

  switch (state) {
    case 'unbacked':
      // A copy exported by hand: when, and that it is not kept up to date.
      if (copied) {
        return {
          short: `Copy exported ${copied}`,
          detail: `A copy of this world was exported ${copied}. Anything written since is only in this browser. Choose a folder and Kathala will keep a copy there as you write.`,
          tone: 'muted',
        }
      }
      /*
        Muted, not amber. This is the state most worlds are in, and an alarm
        that is always on is an alarm nobody reads — but it says the true thing
        rather than nothing, and it is one click from fixing.
      */
      return {
        short: 'Not backed up',
        detail: 'This world exists only in this browser. Choose a folder and Kathala will keep a copy there as you write.',
        tone: 'muted',
      }
    case 'unsupported':
      if (copied) {
        return {
          short: `Copy exported ${copied}`,
          detail: `A copy of this world was exported ${copied}. Anything written since is only in this browser, which cannot keep a folder copy: export again from World Settings to bring the copy up to date.`,
          tone: 'muted',
        }
      }
      /*
        Brave blocks the File System Access API outright, with no flag to
        re-enable it, and no Chromium on Android exposes the directory picker
        at all. This used to render *nothing* — the reasoning being that there
        was nothing to offer — which put the writers with the **fewest** routes
        to a second copy in the group told least about it. There is something
        to offer: `exportWorld` falls back to a plain download link and works
        in every browser. So the standing is the same sentence, and only the
        remedy differs.
      */
      return {
        short: 'Not backed up',
        detail: 'This world exists only in this browser, and this browser cannot keep a folder copy — Brave blocks it, and no mobile browser offers it. Export a .pwk file from World Settings to keep one yourself.',
        tone: 'muted',
      }
    case 'no-permission':
      return {
        short: 'Backup paused',
        detail: when
          ? `Kathala has lost access to the backup folder — nothing has been saved since ${when}. Open World Settings to reconnect it.`
          : 'Kathala has lost access to the backup folder. Open World Settings to reconnect it.',
        tone: 'warn',
      }
    case 'in-sync':
      /*
        **The time is the point.** "Saved" on its own is a claim with no date on
        it, and a backup that stopped working three days ago says exactly the
        same word as one written a minute ago.
      */
      return {
        short: when ? `Backed up ${when}` : 'Backed up',
        detail: FOLDER_SYNC_LABELS['in-sync'].detail,
        tone: 'muted',
      }
    case 'local-ahead':
      return {
        short: when ? `Saving — last ${when}` : 'Saving…',
        detail: FOLDER_SYNC_LABELS['local-ahead'].detail,
        tone: 'muted',
      }
    case 'never-synced':
      return {
        short: 'Not saved yet',
        detail: FOLDER_SYNC_LABELS['never-synced'].detail,
        tone: 'muted',
      }
    case 'remote-ahead':
      return {
        short: 'Newer copy in folder',
        detail: FOLDER_SYNC_LABELS['remote-ahead'].detail,
        tone: 'warn',
      }
    case 'conflict':
      return {
        short: 'Conflict copy saved',
        detail: FOLDER_SYNC_LABELS.conflict.detail,
        tone: 'warn',
      }
  }
}
