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

export interface BackupSummary {
  short: string
  detail: string
  /** `warn` earns amber; everything else stays quiet. */
  tone: 'muted' | 'warn'
}

export function backupSummary(input: {
  state: BackupState
  /** Epoch ms of the last successful write; 0 or undefined if never. */
  lastSyncedAt?: number
  now?: number
}): BackupSummary {
  const { state, lastSyncedAt = 0, now = Date.now() } = input
  const when = lastSyncedAt > 0 ? relativeTime(lastSyncedAt, now) : null

  switch (state) {
    case 'unbacked':
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
